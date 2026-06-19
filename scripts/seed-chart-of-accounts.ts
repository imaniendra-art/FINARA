import mongoose from "mongoose";
import dotenv from "dotenv";
import Account from "../src/models/Account";
import JournalLine from "../src/models/JournalLine";
import Payment from "../src/models/Payment";
import CashTransaction from "../src/models/CashTransaction";
import FeeType from "../src/models/FeeType";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

interface CoaDefinition {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  normalBalance: "debit" | "credit";
  parentCode: string | null;
}

// Complete STIMI YAPMI Makassar Chart of Accounts
const accountsToSeed: CoaDefinition[] = [
  // 1-100 KAS & Children
  { code: "1-100", name: "KAS", type: "asset", normalBalance: "debit", parentCode: null },
  { code: "1-101", name: "Kas Kecil", type: "asset", normalBalance: "debit", parentCode: "1-100" },
  { code: "1-102", name: "Kas Kegiatan", type: "asset", normalBalance: "debit", parentCode: "1-100" },
  { code: "1-103", name: "Kas RPL", type: "asset", normalBalance: "debit", parentCode: "1-100" },
  { code: "1-104", name: "Kas Lainnya", type: "asset", normalBalance: "debit", parentCode: "1-100" },

  // 1-200 BANK & Children
  { code: "1-200", name: "BANK", type: "asset", normalBalance: "debit", parentCode: null },
  { code: "1-201", name: "Bank BRI Operasional", type: "asset", normalBalance: "debit", parentCode: "1-200" },
  { code: "1-202", name: "Bank BRI RPL", type: "asset", normalBalance: "debit", parentCode: "1-200" },
  { code: "1-203", name: "Bank BTN", type: "asset", normalBalance: "debit", parentCode: "1-200" },

  // 1-300 PERSEDIAAN & Children
  { code: "1-300", name: "PERSEDIAAN", type: "asset", normalBalance: "debit", parentCode: null },
  { code: "1-301", name: "Persediaan Perlengkapan", type: "asset", normalBalance: "debit", parentCode: "1-300" },
  { code: "1-302", name: "Persediaan Peralatan", type: "asset", normalBalance: "debit", parentCode: "1-300" },
  { code: "1-303", name: "Persediaan Lainnya", type: "asset", normalBalance: "debit", parentCode: "1-300" },

  // 1-400 PIUTANG & Children
  { code: "1-400", name: "PIUTANG", type: "asset", normalBalance: "debit", parentCode: null },
  { code: "1-401", name: "Piutang Jangka Pendek", type: "asset", normalBalance: "debit", parentCode: "1-400" },
  { code: "1-402", name: "Piutang Jangka Panjang", type: "asset", normalBalance: "debit", parentCode: "1-400" },
  { code: "1-403", name: "Piutang Rekanan", type: "asset", normalBalance: "debit", parentCode: "1-400" },
  { code: "1-404", name: "Piutang Karyawan", type: "asset", normalBalance: "debit", parentCode: "1-400" },
  { code: "1-405", name: "Piutang Lainnya", type: "asset", normalBalance: "debit", parentCode: "1-400" },

  // 1-500 ASET LANCAR LAINNYA & Children
  { code: "1-500", name: "ASET LANCAR LAINNYA", type: "asset", normalBalance: "debit", parentCode: null },
  { code: "1-501", name: "Sewa Dibayar di Muka", type: "asset", normalBalance: "debit", parentCode: "1-500" },
  { code: "1-502", name: "Pembelian Dibayar di Muka", type: "asset", normalBalance: "debit", parentCode: "1-500" },
  { code: "1-503", name: "Beban Dibayar di Muka Lainnya", type: "asset", normalBalance: "debit", parentCode: "1-500" },

  // 1-600 ASET TIDAK LANCAR & Children
  { code: "1-600", name: "ASET TIDAK LANCAR", type: "asset", normalBalance: "debit", parentCode: null },
  { code: "1-601", name: "Inventaris Lembaga", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-602", name: "Perlengkapan", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-603", name: "Peralatan", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-604", name: "Kendaraan", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-605", name: "Bangunan", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-606", name: "Aktiva Tetap Lainnya", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-607", name: "Akum. Peny. Inventaris Lembaga", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-608", name: "Akm. Peny. Peralatan", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-609", name: "Akm. Peny. Kendaraan", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-610", name: "Akm. Peny. Bangunan", type: "asset", normalBalance: "debit", parentCode: "1-600" },
  { code: "1-611", name: "Akm. Peny. Aktiva Tetap Lainnya", type: "asset", normalBalance: "debit", parentCode: "1-600" },

  // 2-100 LIABILITAS JANGKA PENDEK & Children
  { code: "2-100", name: "LIABILITAS JANGKA PENDEK", type: "liability", normalBalance: "credit", parentCode: null },
  { code: "2-101", name: "Hutang Operasional", type: "liability", normalBalance: "credit", parentCode: "2-100" },
  { code: "2-102", name: "Hutang Rekanan", type: "liability", normalBalance: "credit", parentCode: "2-100" },
  { code: "2-103", name: "Hutang Kegiatan", type: "liability", normalBalance: "credit", parentCode: "2-100" },

  // 2-200 LIABILITAS JANGKA PANJANG & Children
  { code: "2-200", name: "LIABILITAS JANGKA PANJANG", type: "liability", normalBalance: "credit", parentCode: null },
  { code: "2-201", name: "Hutang Bank", type: "liability", normalBalance: "credit", parentCode: "2-200" },
  { code: "2-202", name: "Hutang Jangka Panjang Lainnya", type: "liability", normalBalance: "credit", parentCode: "2-200" },

  // 3-100 ASET NETO & Children
  { code: "3-100", name: "ASET NETO", type: "equity", normalBalance: "credit", parentCode: null },
  { code: "3-101", name: "Tanpa Pembatasan", type: "equity", normalBalance: "credit", parentCode: "3-100" },
  { code: "3-102", name: "Dengan Pembatasan", type: "equity", normalBalance: "credit", parentCode: "3-100" },

  // 4-100 PENDAPATAN & Children
  { code: "4-100", name: "PENDAPATAN", type: "revenue", normalBalance: "credit", parentCode: null },
  { code: "4-101", name: "Pendapatan SPP", type: "revenue", normalBalance: "credit", parentCode: "4-100" },
  { code: "4-102", name: "Pendapatan Lainnya", type: "revenue", normalBalance: "credit", parentCode: "4-100" },
  { code: "4-103", name: "Pendapatan Administrasi RPL", type: "revenue", normalBalance: "credit", parentCode: "4-100" },

  // 5-100 BEBAN & Children
  { code: "5-100", name: "BEBAN", type: "expense", normalBalance: "debit", parentCode: null },
  { code: "5-101", name: "Biaya Listrik & Air", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-102", name: "Biaya ATK", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-103", name: "Biaya Honor Dosen", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-104", name: "Biaya Internet", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-105", name: "Biaya Transport", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-106", name: "Biaya Vendor", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-107", name: "Biaya Kegiatan", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-108", name: "Biaya Jasa", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-109", name: "Biaya Konsumsi", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-110", name: "Biaya Operasional", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-111", name: "Biaya Pajak", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-112", name: "Biaya Proker", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-113", name: "Biaya Gaji", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-114", name: "Biaya Lain-Lain", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-115", name: "Prive", type: "expense", normalBalance: "debit", parentCode: "5-100" },
  { code: "5-116", name: "Biaya Administrasi RPL", type: "expense", normalBalance: "debit", parentCode: "5-100" }
];

async function getUsedAccountIds(): Promise<Set<string>> {
  const [journalAccounts, paymentAccounts, cashMainAccounts, cashBankAccounts, feeTypeAccounts] =
    await Promise.all([
      JournalLine.distinct("accountId"),
      Payment.distinct("cashOrBankAccountId"),
      CashTransaction.distinct("accountId"),
      CashTransaction.distinct("cashOrBankAccountId"),
      FeeType.distinct("revenueAccountId"),
    ]);

  return new Set(
    [
      ...journalAccounts,
      ...paymentAccounts,
      ...cashMainAccounts,
      ...cashBankAccounts,
      ...feeTypeAccounts,
    ].map((id) => id.toString())
  );
}

async function seed() {
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB successfully\n");

    const parentCodeToIdMap: Map<string, mongoose.Types.ObjectId> = new Map();

    // ==========================================
    // PASS 1: Seed Parent Accounts
    // ==========================================
    console.log("=== PASS 1: Seeding Parent Accounts ===");
    const parentAccounts = accountsToSeed.filter((acc) => acc.parentCode === null);

    for (const acc of parentAccounts) {
      try {
        const existing = await Account.findOne({ code: acc.code });
        if (existing) {
          // Update if changed
          let isModified = false;
          if (
            existing.name !== acc.name ||
            existing.type !== acc.type ||
            existing.normalBalance !== acc.normalBalance ||
            existing.parentId !== null ||
            existing.isActive !== true
          ) {
            existing.name = acc.name;
            existing.type = acc.type;
            existing.normalBalance = acc.normalBalance;
            existing.parentId = null;
            existing.isActive = true;
            isModified = true;
          }

          if (isModified) {
            await existing.save();
            console.log(`Updated Parent Account: [${acc.code}] ${acc.name}`);
            updatedCount++;
          } else {
            console.log(`Skipped Parent Account (No changes): [${acc.code}] ${acc.name}`);
            skippedCount++;
          }
          parentCodeToIdMap.set(acc.code, existing._id);
        } else {
          // Create new parent account
          const newAcc = await Account.create({
            code: acc.code,
            name: acc.name,
            type: acc.type,
            normalBalance: acc.normalBalance,
            parentId: null,
            isActive: true,
          });
          console.log(`Created Parent Account: [${acc.code}] ${acc.name}`);
          createdCount++;
          parentCodeToIdMap.set(acc.code, newAcc._id);
        }
      } catch (err) {
        console.error(`Error seeding parent account [${acc.code}]:`, err);
        errorCount++;
      }
    }

    console.log("\n=== PASS 2: Seeding Child Accounts ===");
    const childAccounts = accountsToSeed.filter((acc) => acc.parentCode !== null);

    for (const acc of childAccounts) {
      try {
        const parentId = parentCodeToIdMap.get(acc.parentCode!);
        if (!parentId) {
          throw new Error(`Parent account [${acc.parentCode}] not found in map.`);
        }

        const existing = await Account.findOne({ code: acc.code });
        if (existing) {
          let isModified = false;
          if (
            existing.name !== acc.name ||
            existing.type !== acc.type ||
            existing.normalBalance !== acc.normalBalance ||
            !existing.parentId ||
            existing.parentId.toString() !== parentId.toString() ||
            existing.isActive !== true
          ) {
            existing.name = acc.name;
            existing.type = acc.type;
            existing.normalBalance = acc.normalBalance;
            existing.parentId = parentId;
            existing.isActive = true;
            isModified = true;
          }

          if (isModified) {
            await existing.save();
            console.log(`Updated Child Account: [${acc.code}] ${acc.name}`);
            updatedCount++;
          } else {
            console.log(`Skipped Child Account (No changes): [${acc.code}] ${acc.name}`);
            skippedCount++;
          }
        } else {
          // Create new child account
          await Account.create({
            code: acc.code,
            name: acc.name,
            type: acc.type,
            normalBalance: acc.normalBalance,
            parentId: parentId,
            isActive: true,
          });
          console.log(`Created Child Account: [${acc.code}] ${acc.name}`);
          createdCount++;
        }
      } catch (err) {
        console.error(`Error seeding child account [${acc.code}]:`, err);
        errorCount++;
      }
    }

    // ==========================================
    // PASS 3: Safe Legacy Accounts Handling
    // ==========================================
    console.log("\n=== PASS 3: Handling Legacy Accounts ===");
    const newCodesSet = new Set(accountsToSeed.map((acc) => acc.code));
    const allAccountsInDb = await Account.find({});
    const usedAccountIds = await getUsedAccountIds();

    let deactivatedCount = 0;
    let legacyActiveCount = 0;

    for (const dbAcc of allAccountsInDb) {
      if (!newCodesSet.has(dbAcc.code)) {
        const idString = dbAcc._id.toString();
        const isUsed = usedAccountIds.has(idString);

        if (isUsed) {
          // If used, keep it active to avoid breaking transactions
          if (!dbAcc.isActive) {
            dbAcc.isActive = true;
            await dbAcc.save();
            console.log(`Kept legacy account [${dbAcc.code}] ${dbAcc.name} ACTIVE because it is used in transactions.`);
            updatedCount++;
          } else {
            console.log(`Legacy account [${dbAcc.code}] ${dbAcc.name} remains ACTIVE (used in transactions).`);
            legacyActiveCount++;
          }
        } else {
          // If not used, safely deactivate
          if (dbAcc.isActive) {
            dbAcc.isActive = false;
            await dbAcc.save();
            console.log(`Deactivated legacy account [${dbAcc.code}] ${dbAcc.name} (not used in transactions).`);
            deactivatedCount++;
          } else {
            console.log(`Legacy account [${dbAcc.code}] ${dbAcc.name} is already INACTIVE.`);
          }
        }
      }
    }

    // ==========================================
    // PASS 4: Map standard FeeTypes to new accounts
    // ==========================================
    console.log("\n=== PASS 4: Remapping Standard Fee Types ===");
    const sppAcc = await Account.findOne({ code: "4-101" });
    const lainnyaAcc = await Account.findOne({ code: "4-102" });

    if (sppAcc) {
      const result = await FeeType.updateMany(
        { name: "SPP" },
        { $set: { revenueAccountId: sppAcc._id } }
      );
      if (result.modifiedCount > 0) {
        console.log(`Remapped FeeType 'SPP' to new account '4-101' (${result.modifiedCount} records updated).`);
      } else {
        console.log("FeeType 'SPP' already mapped or not found.");
      }
    }

    if (lainnyaAcc) {
      const result = await FeeType.updateMany(
        { name: { $in: ["Pendaftaran", "Ujian"] } },
        { $set: { revenueAccountId: lainnyaAcc._id } }
      );
      if (result.modifiedCount > 0) {
        console.log(`Remapped FeeTypes 'Pendaftaran'/'Ujian' to new account '4-102' (${result.modifiedCount} records updated).`);
      } else {
        console.log("FeeTypes 'Pendaftaran'/'Ujian' already mapped or not found.");
      }
    }

    console.log("\n==========================================");
    console.log("SEEDING STATISTICS SUMMARY");
    console.log("==========================================");
    console.log(`Jumlah Dibuat (Created):       ${createdCount}`);
    console.log(`Jumlah Diperbarui (Updated):    ${updatedCount}`);
    console.log(`Jumlah Dilewati (Skipped):      ${skippedCount}`);
    console.log(`Jumlah Dinonaktifkan (Deact):   ${deactivatedCount}`);
    console.log(`Jumlah Legacy Aktif (Legacy):   ${legacyActiveCount}`);
    console.log(`Jumlah Error (Errors):          ${errorCount}`);
    console.log("==========================================\n");

    console.log("Seeding completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error during database seeding:", error);
    process.exit(1);
  }
}

seed();
