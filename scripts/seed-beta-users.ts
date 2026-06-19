import bcrypt from "bcrypt";
import dotenv from "dotenv";
import mongoose from "mongoose";
import BudgetWorkUnit from "../src/models/BudgetWorkUnit";
import User from "../src/models/User";

dotenv.config({ path: ".env.local", quiet: true });

const MONGODB_URI = process.env.MONGODB_URI;
const defaultPassword = process.env.BETA_USER_DEFAULT_PASSWORD;
const shouldResetPasswords = process.env.RESET_BETA_PASSWORDS === "true";

if (!MONGODB_URI) {
  console.error("MONGODB_URI belum diatur di .env.local.");
  process.exit(1);
}

if (!defaultPassword) {
  console.error("BETA_USER_DEFAULT_PASSWORD belum diatur di .env.local.");
  process.exit(1);
}

const betaUsers = [
  {
    name: "Admin BAUK Beta",
    email: "admin.bauk@stimi.test",
    role: "admin_bauk",
    isActive: true,
    personType: "bauk_admin",
  },
  {
    name: "Staff BAUK Beta",
    email: "staff.bauk@stimi.test",
    role: "staff_bauk",
    isActive: true,
    personType: "bauk_admin",
  },
  {
    name: "BAAK Unit Beta",
    email: "baak@stimi.test",
    role: "unit",
    isActive: true,
    personType: "unit",
    unitCode: "BAAK",
  },
  {
    name: "PUSDATIN Unit Beta",
    email: "pusdatin@stimi.test",
    role: "unit",
    isActive: true,
    personType: "unit",
    unitCode: "PUSDATIN",
  },
  {
    name: "Tendik Beta",
    email: "tendik@stimi.test",
    role: "tendik",
    isActive: true,
    personType: "tendik",
  },
  {
    name: "Dosen Beta",
    email: "dosen@stimi.test",
    role: "dosen",
    isActive: true,
    personType: "dosen",
  },
  {
    name: "BEM Beta",
    email: "bem@stimi.test",
    role: "organisasi",
    isActive: true,
    personType: "organisasi",
    unitCode: "ORGANISASI_MAHASISWA",
    organizationName: "BEM STIMI YAPMI",
  },
  {
    name: "UKM Beta",
    email: "ukm@stimi.test",
    role: "organisasi",
    isActive: true,
    personType: "organisasi",
    unitCode: "ORGANISASI_MAHASISWA",
    organizationName: "UKM STIMI YAPMI",
  },
  {
    name: "Mahasiswa Beta",
    email: "mahasiswa@stimi.test",
    role: "mahasiswa",
    isActive: true,
    personType: "mahasiswa",
  },
  {
    name: "Pimpinan Beta",
    email: "pimpinan@stimi.test",
    role: "pimpinan",
    isActive: true,
    personType: "pimpinan",
  },
  {
    name: "Auditor Beta",
    email: "auditor@stimi.test",
    role: "auditor",
    isActive: true,
    personType: "auditor",
  },
] as const;

const budgetWorkUnits = [
  { code: "BAAK", name: "BAAK" },
  { code: "PUSDATIN", name: "PUSDATIN" },
  { code: "BAUK", name: "BAUK" },
  { code: "PRODI", name: "PRODI" },
  { code: "UMUM", name: "UMUM" },
  { code: "PERPUSTAKAAN", name: "PERPUSTAKAAN" },
  { code: "KEMAHASISWAAN", name: "KEMAHASISWAAN" },
  { code: "ORGANISASI_MAHASISWA", name: "ORGANISASI MAHASISWA" },
] as const;

type SeedStatus = "created" | "updated" | "skipped";

async function seedBudgetWorkUnits() {
  const unitMap = new Map<string, mongoose.Types.ObjectId>();

  for (const unit of budgetWorkUnits) {
    const document = await BudgetWorkUnit.findOneAndUpdate(
      { code: unit.code },
      {
        $setOnInsert: {
          code: unit.code,
          name: unit.name,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    unitMap.set(unit.code, document._id);
  }

  return unitMap;
}

async function seedBetaUsers(unitMap: Map<string, mongoose.Types.ObjectId>) {
  const passwordHash = await bcrypt.hash(defaultPassword!, 10);
  const results: Array<{ email: string; role: string; status: SeedStatus }> = [];

  for (const user of betaUsers) {
    const existing = await User.findOne({ email: user.email });
    const unitId = "unitCode" in user && user.unitCode ? unitMap.get(user.unitCode) : undefined;
    const userData = {
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      personType: user.personType,
      unitId,
      organizationName: "organizationName" in user ? user.organizationName : undefined,
    };

    if (!existing) {
      await User.create({
        ...userData,
        password: passwordHash,
      });
      results.push({ email: user.email, role: user.role, status: "created" });
      continue;
    }

    if (existing.role === "super_admin") {
      results.push({ email: user.email, role: existing.role, status: "skipped" });
      continue;
    }

    const updates: {
      name: string;
      role: (typeof betaUsers)[number]["role"];
      isActive: boolean;
      personType?: string;
      unitId?: mongoose.Types.ObjectId;
      organizationName?: string;
      password?: string;
    } = userData;

    if (shouldResetPasswords) {
      updates.password = passwordHash;
    }

    const isChanged =
      existing.name !== updates.name ||
      existing.role !== updates.role ||
      existing.isActive !== updates.isActive ||
      existing.personType !== updates.personType ||
      existing.unitId?.toString() !== updates.unitId?.toString() ||
      existing.organizationName !== updates.organizationName ||
      shouldResetPasswords;

    if (!isChanged) {
      results.push({ email: user.email, role: user.role, status: "skipped" });
      continue;
    }

    await User.updateOne({ _id: existing._id }, { $set: updates });
    results.push({ email: user.email, role: user.role, status: "updated" });
  }

  return results;
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI!);
    const unitMap = await seedBudgetWorkUnits();
    const results = await seedBetaUsers(unitMap);

    for (const result of results) {
      console.log(`${result.email}\t${result.role}\t${result.status}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Seed beta users gagal.");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
