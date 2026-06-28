import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../src/models/User";
import Account from "../src/models/Account";
import FeeType from "../src/models/FeeType";
import Student from "../src/models/Student";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!SEED_ADMIN_PASSWORD) {
  console.error("Please define SEED_ADMIN_PASSWORD in .env.local before seeding");
  process.exit(1);
}

const seedAdminPassword = SEED_ADMIN_PASSWORD;

async function seed() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB");

    // 1. Seed Super Admin
    const adminPassword = await bcrypt.hash(seedAdminPassword, 10);
    const superAdmin = await User.findOneAndUpdate(
      { email: "admin.keu@stimiyapmim.ac.id" },
      {
        name: "Admin STIMI",
        email: "admin.keu@stimiyapmim.ac.id",
        password: adminPassword,
        role: "super_admin",
        isActive: true,
      },
      { upsert: true, returnDocument: "after" }
    );
    console.log("Super Admin seeded:", superAdmin.email);

    // 2. Seed Accounts
    const accounts = [
      { code: "1000", name: "Kas", type: "asset", normalBalance: "debit" },
      { code: "1010", name: "Bank", type: "asset", normalBalance: "debit" },
      { code: "1100", name: "Piutang Mahasiswa", type: "asset", normalBalance: "debit" },
      { code: "2000", name: "Hutang Usaha", type: "liability", normalBalance: "credit" },
      { code: "3000", name: "Dana/Yayasan", type: "equity", normalBalance: "credit" },
      { code: "4000", name: "Pendapatan SPP", type: "revenue", normalBalance: "credit" },
      { code: "4010", name: "Pendapatan Pendaftaran", type: "revenue", normalBalance: "credit" },
      { code: "4020", name: "Pendapatan Ujian", type: "revenue", normalBalance: "credit" },
      { code: "4030", name: "Pendapatan Wisuda", type: "revenue", normalBalance: "credit" },
      { code: "5000", name: "Beban Gaji", type: "expense", normalBalance: "debit" },
      { code: "5010", name: "Beban Honor Dosen", type: "expense", normalBalance: "debit" },
      { code: "5020", name: "Beban Listrik Air Internet", type: "expense", normalBalance: "debit" },
      { code: "5030", name: "Beban ATK", type: "expense", normalBalance: "debit" },
      { code: "5040", name: "Beban Pemeliharaan", type: "expense", normalBalance: "debit" },
      { code: "5050", name: "Beban Kegiatan Kampus", type: "expense", normalBalance: "debit" },
    ];

    for (const acc of accounts) {
      await Account.findOneAndUpdate(
        { code: acc.code },
        { ...acc, isActive: true },
        { upsert: true }
      );
    }
    console.log("Chart of Accounts seeded");

    // 3. Seed Fee Types
    const sppAccount = await Account.findOne({ code: "4000" });
    const pendaftaranAccount = await Account.findOne({ code: "4010" });
    const ujianAccount = await Account.findOne({ code: "4020" });

    if (sppAccount && pendaftaranAccount && ujianAccount) {
      const feeTypes = [
        {
          name: "SPP",
          description: "Sumbangan Pembinaan Pendidikan",
          defaultAmount: 2500000,
          revenueAccountId: sppAccount._id,
        },
        {
          name: "Pendaftaran",
          description: "Biaya Pendaftaran Mahasiswa Baru",
          defaultAmount: 250000,
          revenueAccountId: pendaftaranAccount._id,
        },
        {
          name: "Ujian",
          description: "Biaya Ujian Akhir Semester",
          defaultAmount: 150000,
          revenueAccountId: ujianAccount._id,
        },
      ];

      for (const fee of feeTypes) {
        await FeeType.findOneAndUpdate(
          { name: fee.name },
          { ...fee, isActive: true },
          { upsert: true }
        );
      }
      console.log("Fee Types seeded");
    }

    // 4. Seed Dummy Students
    const dummyStudents = [
      {
        nim: "20230001",
        name: "Andi Saputra",
        gender: "L",
        programStudy: "S1 Manajemen",
        className: "A1",
        entryYear: 2023,
        phone: "081234567890",
        address: "Jl. Perintis Kemerdekaan No. 1",
        status: "active",
      },
      {
        nim: "20230002",
        name: "Budi Santoso",
        gender: "L",
        programStudy: "S1 Manajemen",
        className: "A1",
        entryYear: 2023,
        phone: "081234567891",
        address: "Jl. Urip Sumoharjo No. 10",
        status: "active",
      },
      {
        nim: "20230003",
        name: "Citra Kirana",
        gender: "P",
        programStudy: "S1 Akuntansi",
        className: "B1",
        entryYear: 2023,
        phone: "081234567892",
        address: "Jl. AP Pettarani No. 15",
        status: "active",
      },
      {
        nim: "20220001",
        name: "Dewi Lestari",
        gender: "P",
        programStudy: "S1 Manajemen",
        className: "A2",
        entryYear: 2022,
        phone: "081234567893",
        address: "Jl. Veteran Selatan No. 8",
        status: "active",
      }
    ];

    for (const student of dummyStudents) {
      await Student.findOneAndUpdate(
        { nim: student.nim },
        { ...student },
        { upsert: true }
      );
    }
    console.log("Dummy Students seeded");

    console.log("Seeding completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();
