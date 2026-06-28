import mongoose from "mongoose";
import dotenv from "dotenv";

import Account from "../src/models/Account";
import FeeType from "../src/models/FeeType";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

const accountsData = [
  // Aset (Debit)
  { code: "1-100", name: "KAS", type: "asset", normalBalance: "debit" },
  { code: "1-101", name: "Kas Kecil", type: "asset", normalBalance: "debit" },
  { code: "1-102", name: "Kas Kegiatan", type: "asset", normalBalance: "debit" },
  { code: "1-103", name: "Kas RPL", type: "asset", normalBalance: "debit" },
  { code: "1-104", name: "Kas Lainnya", type: "asset", normalBalance: "debit" },
  { code: "1-200", name: "BANK", type: "asset", normalBalance: "debit" },
  { code: "1-201", name: "Bank BRI Operasional", type: "asset", normalBalance: "debit" },
  { code: "1-202", name: "Bank BRI RPL", type: "asset", normalBalance: "debit" },
  { code: "1-203", name: "Bank BTN", type: "asset", normalBalance: "debit" },
  { code: "1-300", name: "PERSEDIAAN", type: "asset", normalBalance: "debit" },
  { code: "1-301", name: "Persediaan Perlengkapan", type: "asset", normalBalance: "debit" },
  { code: "1-302", name: "Persediaan Peralatan", type: "asset", normalBalance: "debit" },
  { code: "1-303", name: "Persediaan Lainnya", type: "asset", normalBalance: "debit" },
  { code: "1-400", name: "PIUTANG", type: "asset", normalBalance: "debit" },
  { code: "1-401", name: "Piutang Jangka Pendek", type: "asset", normalBalance: "debit" },
  { code: "1-402", name: "Piutang Janka Panjang", type: "asset", normalBalance: "debit" },
  { code: "1-403", name: "Piutang Rekanan", type: "asset", normalBalance: "debit" },
  { code: "1-404", name: "Piutang Karyawan", type: "asset", normalBalance: "debit" },
  { code: "1-405", name: "Piutang Lainnya", type: "asset", normalBalance: "debit" },
  { code: "1-500", name: "ASET LANCAR LAINNYA", type: "asset", normalBalance: "debit" },
  { code: "1-501", name: "Sewa Dibayar di Muka", type: "asset", normalBalance: "debit" },
  { code: "1-502", name: "Pembelian Dibayar di Muka", type: "asset", normalBalance: "debit" },
  { code: "1-503", name: "Beban Dibayar di Muka Lainnya", type: "asset", normalBalance: "debit" },
  { code: "1-600", name: "ASET TIDAK LANCAR", type: "asset", normalBalance: "debit" },
  { code: "1-601", name: "Inventaris Lembaga", type: "asset", normalBalance: "debit" },
  { code: "1-602", name: "Perlengkapan", type: "asset", normalBalance: "debit" },
  { code: "1-603", name: "Peralatan", type: "asset", normalBalance: "debit" },
  { code: "1-604", name: "Kendaraaan", type: "asset", normalBalance: "debit" },
  { code: "1-605", name: "Bangunan", type: "asset", normalBalance: "debit" },
  { code: "1-606", name: "Aktiva Tetap Lainnya", type: "asset", normalBalance: "debit" },
  // Akumulasi penyusutan adalah Contra-Asset, jadi saldo normalnya Kredit
  { code: "1-607", name: "Akum. Peny. Inventaris Lembaga", type: "asset", normalBalance: "credit" },
  { code: "1-608", name: "Akm. Peny. Peralatan", type: "asset", normalBalance: "credit" },
  { code: "1-609", name: "Akm. Peny. Kendaraan", type: "asset", normalBalance: "credit" },
  { code: "1-610", name: "Akm. Peny. Bangunan", type: "asset", normalBalance: "credit" },
  { code: "1-611", name: "Akm. Peny. Aktiva Tetap lainnya", type: "asset", normalBalance: "credit" },

  // Liabilitas (Kredit)
  { code: "2-100", name: "LIABILITAS JANGKA PENDEK", type: "liability", normalBalance: "credit" },
  { code: "2-101", name: "Hutang Operasional", type: "liability", normalBalance: "credit" },
  { code: "2-102", name: "Hutang Rekanan", type: "liability", normalBalance: "credit" },
  { code: "2-103", name: "Hutang Kegiatan", type: "liability", normalBalance: "credit" },
  { code: "2-200", name: "LIABILITAS JANGKA PANJANG", type: "liability", normalBalance: "credit" },
  { code: "2-201", name: "Hutang Bank", type: "liability", normalBalance: "credit" },
  { code: "2-202", name: "Hutang Jangka Panjang Lainnya", type: "liability", normalBalance: "credit" },

  // Ekuitas / Aset Neto (Kredit)
  { code: "3-100", name: "ASET NETO", type: "equity", normalBalance: "credit" },
  { code: "3-101", name: "Tanpa Pembatasan", type: "equity", normalBalance: "credit" },
  { code: "3-102", name: "Dengan Pembatasan", type: "equity", normalBalance: "credit" },

  // Pendapatan (Kredit)
  { code: "4-100", name: "PENDAPATAN", type: "revenue", normalBalance: "credit" },
  { code: "4-101", name: "Pendapatan SPP", type: "revenue", normalBalance: "credit" },
  { code: "4-102", name: "Pendapatan Lainnya", type: "revenue", normalBalance: "credit" },
  { code: "4-103", name: "Pendapatan Administrasi RPL", type: "revenue", normalBalance: "credit" },

  // Beban (Debit)
  { code: "5-100", name: "BEBAN", type: "expense", normalBalance: "debit" },
  { code: "5-101", name: "Biaya Listrik & Air", type: "expense", normalBalance: "debit" },
  { code: "5-102", name: "Biaya ATK", type: "expense", normalBalance: "debit" },
  { code: "5-103", name: "Biaya Honor Dosen", type: "expense", normalBalance: "debit" },
  { code: "5-104", name: "Biaya Internet", type: "expense", normalBalance: "debit" },
  { code: "5-105", name: "Biaya Transport", type: "expense", normalBalance: "debit" },
  { code: "5-106", name: "Biaya Vendor", type: "expense", normalBalance: "debit" },
  { code: "5-107", name: "Biaya Kegiatan", type: "expense", normalBalance: "debit" },
  { code: "5-108", name: "Biaya Jasa", type: "expense", normalBalance: "debit" },
  { code: "5-109", name: "Biaya Konsumsi", type: "expense", normalBalance: "debit" },
  { code: "5-110", name: "Biaya Operasional", type: "expense", normalBalance: "debit" },
  { code: "5-111", name: "Biaya Pajak", type: "expense", normalBalance: "debit" },
  { code: "5-112", name: "Biaya Proker", type: "expense", normalBalance: "debit" },
  { code: "5-113", name: "Biaya Gaji", type: "expense", normalBalance: "debit" },
  { code: "5-114", name: "Biaya Lain-Lain", type: "expense", normalBalance: "debit" },
  { code: "5-115", name: "Prive", type: "expense", normalBalance: "debit" },
  { code: "5-116", name: "Biaya Administrasi RPL", type: "expense", normalBalance: "debit" },
];

async function replaceCOA() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB.");

    // Delete all existing accounts
    console.log("Deleting old Chart of Accounts...");
    await Account.deleteMany({});

    // Insert new accounts
    console.log(`Inserting ${accountsData.length} new accounts...`);
    for (const acc of accountsData) {
      await Account.create({ ...acc, isActive: true });
    }

    // Update FeeTypes to point to the new Revenue Accounts to prevent dangling references
    const sppAccount = await Account.findOne({ code: "4-101" });
    const lainnyaAccount = await Account.findOne({ code: "4-102" });

    if (sppAccount) {
      await FeeType.updateMany(
        { name: "SPP" },
        { $set: { revenueAccountId: sppAccount._id } }
      );
    }
    
    if (lainnyaAccount) {
      await FeeType.updateMany(
        { name: { $ne: "SPP" } },
        { $set: { revenueAccountId: lainnyaAccount._id } }
      );
    }

    console.log("Chart of Accounts replaced successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error replacing COA:", error);
    process.exit(1);
  }
}

replaceCOA();
