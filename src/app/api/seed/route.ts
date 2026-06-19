import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Account from "@/models/Account";
import FeeType from "@/models/FeeType";
import Student from "@/models/Student";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An error occurred during seeding";
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.FINARA_ENABLE_SEED_API !== "true") {
      return NextResponse.json({ error: "Seed API is disabled" }, { status: 404 });
    }

    const seedApiToken = process.env.FINARA_SEED_API_TOKEN;
    if (!seedApiToken) {
      return NextResponse.json(
        { error: "FINARA_SEED_API_TOKEN must be configured before using the seed API" },
        { status: 500 }
      );
    }

    if (request.headers.get("x-finara-seed-token") !== seedApiToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!seedAdminPassword) {
      return NextResponse.json(
        { error: "SEED_ADMIN_PASSWORD must be configured before seeding" },
        { status: 500 }
      );
    }

    await dbConnect();

    // 1. Seed Super Admin
    const adminPassword = await bcrypt.hash(seedAdminPassword, 10);
    const superAdmin = await User.findOneAndUpdate(
      { email: "admin@stimi.edu" },
      {
        name: "Super Admin",
        email: "admin@stimi.edu",
        password: adminPassword,
        role: "super_admin",
        isActive: true,
      },
      { upsert: true, returnDocument: "after" }
    );

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
    ];

    for (const student of dummyStudents) {
      await Student.findOneAndUpdate(
        { nim: student.nim },
        { ...student },
        { upsert: true }
      );
    }

    return NextResponse.json({ message: "Seeding completed successfully", admin: superAdmin.email });
  } catch (error: unknown) {
    console.error("Seed API Error:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
