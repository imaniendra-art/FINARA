import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";
import Account from "../src/models/Account";
import JournalEntry from "../src/models/JournalEntry";
import JournalLine from "../src/models/JournalLine";
import CashTransaction from "../src/models/CashTransaction";
import User from "../src/models/User";

// Load environment variables
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

// Generate unique transaction number
function generateEntryNumber(prefix: string) {
  return `${prefix}-${new Date().getTime().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

async function seed() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB successfully\n");

    // 1. Get an existing User (or create one) to assign as createdBy
    let adminUser = await User.findOne({ isActive: true });
    if (!adminUser) {
      console.log("No active user found. Creating a temporary system admin user...");
      adminUser = await User.create({
        name: "System Admin (Seeder)",
        email: "seeder@finara.test",
        password: "dummy_password", // Just dummy data
        role: "admin",
        personType: "pimpinan",
        isActive: true,
      });
    }
    const adminId = adminUser._id;
    console.log(`Using user: ${adminUser.name} (${adminUser.email}) as creator.`);

    // 2. Ensure parent revenue account 4-100 exists to attach new child accounts
    let parentRevenueAcc = await Account.findOne({ code: "4-100" });
    if (!parentRevenueAcc) {
       parentRevenueAcc = await Account.create({
         code: "4-100",
         name: "PENDAPATAN",
         type: "revenue",
         normalBalance: "credit",
         parentId: null,
         isActive: true
       });
       console.log("Created missing parent account 4-100 (PENDAPATAN).");
    }

    // 3. Ensure target accounts exist
    const requiredAccounts = [
      { code: "1-201", name: "Bank BRI Operasional", type: "asset", normalBalance: "debit", parentId: null },
      { code: "4-101", name: "Pendapatan SPP", type: "revenue", normalBalance: "credit", parentId: parentRevenueAcc._id },
      { code: "4-104", name: "Pendapatan PMB", type: "revenue", normalBalance: "credit", parentId: parentRevenueAcc._id },
      { code: "4-105", name: "Pendapatan Wisuda", type: "revenue", normalBalance: "credit", parentId: parentRevenueAcc._id },
      { code: "5-110", name: "Biaya Operasional", type: "expense", normalBalance: "debit", parentId: null }
    ];

    const accountMap: Record<string, mongoose.Types.ObjectId> = {};

    for (const accData of requiredAccounts) {
      let acc = await Account.findOne({ code: accData.code });
      if (!acc) {
        acc = await Account.create({
          code: accData.code,
          name: accData.name,
          type: accData.type,
          normalBalance: accData.normalBalance,
          parentId: accData.parentId,
          isActive: true
        });
        console.log(`Created missing account: [${accData.code}] ${accData.name}`);
      }
      accountMap[accData.code] = acc._id;
    }

    console.log("\nAccounts mapped successfully. Injecting journal & cash transactions...\n");

    const today = new Date();

    // Data for injection
    const transactionsToInject = [
      {
        title: "Penerimaan SPP Mahasiswa Semester Genap",
        prefix: "SPP",
        type: "cash_in",
        debitAccount: "1-201", // Bank
        creditAccount: "4-101", // Pendapatan SPP
        amount: 50000000,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)
      },
      {
        title: "Penerimaan Pendaftaran PMB Gelombang 1",
        prefix: "PMB",
        type: "cash_in",
        debitAccount: "1-201", // Bank
        creditAccount: "4-104", // Pendapatan PMB
        amount: 15000000,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
      },
      {
        title: "Penerimaan Iuran Wisuda Gelombang 1",
        prefix: "WIS",
        type: "cash_in",
        debitAccount: "1-201", // Bank
        creditAccount: "4-105", // Pendapatan Wisuda
        amount: 30000000,
        date: today
      },
      {
        title: "Pembayaran Biaya Operasional dan Perlengkapan",
        prefix: "BOP",
        type: "cash_out",
        debitAccount: "5-110", // Biaya Operasional
        creditAccount: "1-201", // Bank
        amount: 12500000,
        date: today
      }
    ];

    for (const tx of transactionsToInject) {
      // Step A: Create Journal Entry as draft
      const entry = await JournalEntry.create({
        entryNumber: generateEntryNumber(tx.prefix),
        date: tx.date,
        description: tx.title,
        sourceType: "cash_transaction",
        status: "draft",
        createdBy: adminId
      });

      // Step B: Create Journal Lines
      await JournalLine.insertMany([
        {
          journalEntryId: entry._id,
          accountId: accountMap[tx.debitAccount],
          debit: tx.amount,
          credit: 0,
          description: `(Debit) ${tx.title}`
        },
        {
          journalEntryId: entry._id,
          accountId: accountMap[tx.creditAccount],
          debit: 0,
          credit: tx.amount,
          description: `(Kredit) ${tx.title}`
        }
      ]);

      // Step C: Post Journal Entry
      await JournalEntry.findOneAndUpdate(
        { _id: entry._id },
        { $set: { status: "posted" } }
      );

      // Step D: Create corresponding CashTransaction so Dashboard is populated
      const cashAccountId = tx.type === "cash_in" ? tx.debitAccount : tx.creditAccount;
      const targetAccountId = tx.type === "cash_in" ? tx.creditAccount : tx.debitAccount;

      await CashTransaction.create({
        transactionNumber: generateEntryNumber(`CTX-${tx.prefix}`),
        date: tx.date,
        type: tx.type,
        accountId: accountMap[targetAccountId],
        cashOrBankAccountId: accountMap[cashAccountId],
        amount: tx.amount,
        description: tx.title,
        status: "posted",
        createdBy: adminId,
        journalEntryId: entry._id
      });

      console.log(`[SUCCESS] Posted Journal & CashTransaction: ${tx.title} (Rp ${tx.amount.toLocaleString('id-ID')})`);
    }

    console.log("\n==========================================");
    console.log("SEEDING DUMMY JOURNALS COMPLETED!");
    console.log("Total 4 Transactions injected (Journal + CashTransaction).");
    console.log("Hero Section, Ledger, and P&L should now be populated.");
    console.log("==========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error during database seeding:", error);
    process.exit(1);
  }
}

seed();
