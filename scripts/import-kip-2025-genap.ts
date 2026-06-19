import mongoose from "mongoose";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import * as fs from "fs";

import Student from "../src/models/Student";
import StudentBill from "../src/models/StudentBill";
import FeeType from "../src/models/FeeType";
import Account from "../src/models/Account";
import AcademicPeriod from "../src/models/AcademicPeriod";

// Load environment variables
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not defined in .env.local");
  process.exit(1);
}

const EXCEL_FILE_PATH = "G:\\IMANIENDRA GD\\STIMI YAPMI\\KIP KULIAH\\KIP 2025\\ON GOING GENAP 2025\\KIP 2025 GENAP.xlsx";

interface ExcelRow {
  NIM?: string | number;
  nim?: string | number;
  "NIM "?: string | number;
  "nim "?: string | number;
  NAMA?: string;
  Nama?: string;
  nama?: string;
  name?: string;
  "NAMA "?: string;
  "nama "?: string;
  SPP?: string | number;
  spp?: string | number;
  "SPP "?: string | number;
  "spp "?: string | number;
}

async function run() {
  try {
    console.log("=== FINARA IMPORT KIP 2025 GENAP ===");
    
    // Check if Excel file exists
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      console.error(`Error: Excel file not found at path:\n${EXCEL_FILE_PATH}`);
      process.exit(1);
    }
    console.log("Excel file verified at source path.");

    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB successfully.");

    // Look up revenue account 4-101 (or fallback 4000 or similar name)
    console.log("Looking up SPP revenue account...");
    const sppAccount = await Account.findOne({
      $or: [
        { code: "4-101" },
        { code: "4000" },
        { name: /Pendapatan SPP/i }
      ]
    });

    if (!sppAccount) {
      console.error("Error: Could not find SPP revenue account (code 4-101 / 4000 / 'Pendapatan SPP').");
      console.error("Please seed the chart of accounts first using: npm run seed:accounts");
      process.exit(1);
    }
    console.log(`SPP revenue account found: ${sppAccount.code} - ${sppAccount.name}`);

    // Look up or create FeeType "SPP"
    console.log("Checking FeeType 'SPP'...");
    let sppFeeType = await FeeType.findOne({ name: "SPP" });
    if (!sppFeeType) {
      console.log("FeeType 'SPP' not found. Creating a new one...");
      sppFeeType = await FeeType.create({
        name: "SPP",
        description: "Sumbangan Pembinaan Pendidikan",
        defaultAmount: 2500000,
        revenueAccountId: sppAccount._id,
        isActive: true
      });
      console.log("FeeType 'SPP' created.");
    } else {
      console.log(`FeeType 'SPP' found with ID: ${sppFeeType._id}`);
      // Ensure it points to the correct account
      if (String(sppFeeType.revenueAccountId) !== String(sppAccount._id)) {
        sppFeeType.revenueAccountId = sppAccount._id;
        await sppFeeType.save();
        console.log("Updated FeeType 'SPP' to point to the correct revenue account.");
      }
    }

    // Determine Academic Year
    console.log("Determining Academic Period...");
    const activePeriod = await AcademicPeriod.findOne({ isActive: true });
    const academicYear = activePeriod?.academicYear || "2025/2026";
    const semester = "Genap";
    console.log(`Target academic period: Year = ${academicYear}, Semester = ${semester}`);

    // Parse Excel Workbook
    console.log("Reading Excel file...");
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const targetSheets = ["2022", "2023", "2024", "2025"];
    
    // Statistics counters
    const statsBySheet: Record<string, {
      excelRowsCount: number;
      studentsCreated: number;
      studentsUpdated: number;
      billsCreated: number;
      billsUpdated: number;
      billsSkippedPaid: number;
      totalSppBilled: number;
    }> = {};

    let grandTotalExcelRows = 0;
    let grandTotalStudentsCreated = 0;
    let grandTotalStudentsUpdated = 0;
    let grandTotalBillsCreated = 0;
    let grandTotalBillsUpdated = 0;
    let grandTotalBillsSkippedPaid = 0;
    let grandTotalSppBilled = 0;
    const errors: string[] = [];

    for (const sheetName of targetSheets) {
      if (!workbook.SheetNames.includes(sheetName)) {
        console.warn(`Warning: Sheet "${sheetName}" not found in workbook. Skipping.`);
        continue;
      }

      console.log(`\nProcessing Sheet "${sheetName}"...`);
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);
      
      statsBySheet[sheetName] = {
        excelRowsCount: rows.length,
        studentsCreated: 0,
        studentsUpdated: 0,
        billsCreated: 0,
        billsUpdated: 0,
        billsSkippedPaid: 0,
        totalSppBilled: 0
      };

      grandTotalExcelRows += rows.length;

      const entryYear = parseInt(sheetName, 10);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-based index + header row

        // Safely extract NIM, NAMA, and SPP
        const rawNim = row.NIM ?? row.nim ?? row["NIM "] ?? row["nim "];
        const rawName = row.NAMA ?? row.Nama ?? row.nama ?? row.name ?? row["NAMA "] ?? row["nama "];
        const rawSpp = row.SPP ?? row.spp ?? row["SPP "] ?? row["spp "];

        if (rawNim === undefined || rawNim === null || !rawName) {
          const err = `[Sheet ${sheetName} Row ${rowNum}] Missing NIM or Name. Data: ${JSON.stringify(row)}`;
          errors.push(err);
          console.warn(err);
          continue;
        }

        const nim = String(rawNim).trim();
        const name = String(rawName).trim();
        const sppAmount = Number(rawSpp);

        if (isNaN(sppAmount)) {
          const err = `[Sheet ${sheetName} Row ${rowNum}] Invalid SPP amount for NIM ${nim}: ${rawSpp}`;
          errors.push(err);
          console.warn(err);
          continue;
        }

        // 1. Upsert Student
        let student = await Student.findOne({ nim: { $regex: new RegExp(`^${nim}$`, "i") } });

        if (!student) {
          student = new Student({
            nim,
            name,
            programStudy: "Manajemen",
            entryYear,
            status: "active",
            biayaPendidikan: "KIP"
          });
          await student.save();
          statsBySheet[sheetName].studentsCreated++;
          grandTotalStudentsCreated++;
        } else {
          // Update existing student details to match Excel status and program Study
          student.name = name;
          student.programStudy = "Manajemen";
          student.entryYear = entryYear;
          student.status = "active";
          student.biayaPendidikan = "KIP";
          await student.save();
          statsBySheet[sheetName].studentsUpdated++;
          grandTotalStudentsUpdated++;
        }

        // 2. Manage SPP StudentBill
        let bill = await StudentBill.findOne({
          studentId: student._id,
          feeTypeId: sppFeeType._id,
          academicYear,
          semester
        });

        const dueDate = new Date("2026-07-31");

        if (!bill) {
          // Create new bill
          bill = new StudentBill({
            studentId: student._id,
            feeTypeId: sppFeeType._id,
            academicYear,
            semester,
            amount: sppAmount,
            discount: 0,
            paidAmount: 0,
            dueDate,
            notes: "Import KIP 2025 Genap"
          });
          await bill.save();
          statsBySheet[sheetName].billsCreated++;
          grandTotalBillsCreated++;
          statsBySheet[sheetName].totalSppBilled += sppAmount;
          grandTotalSppBilled += sppAmount;
        } else {
          // Bill already exists, check if paidAmount > 0
          if (bill.paidAmount > 0) {
            statsBySheet[sheetName].billsSkippedPaid++;
            grandTotalBillsSkippedPaid++;
            // Still count existing bill amount towards total billed in stats to verify matching totals
            statsBySheet[sheetName].totalSppBilled += bill.amount;
            grandTotalSppBilled += bill.amount;
          } else {
            // Update bill amount
            bill.amount = sppAmount;
            // The pre-validate hook on StudentBill will recalculate remainingAmount and status automatically
            await bill.save();
            statsBySheet[sheetName].billsUpdated++;
            grandTotalBillsUpdated++;
            statsBySheet[sheetName].totalSppBilled += sppAmount;
            grandTotalSppBilled += sppAmount;
          }
        }
      }
    }

    // Format currency to IDR
    const formatIDR = (num: number) => {
      return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
    };

    console.log("\n=============================================");
    console.log("===            IMPORT SUMMARY             ===");
    console.log("=============================================");
    console.log(`Academic Period : ${academicYear} (${semester})`);
    console.log(`SPP Fee Type ID : ${sppFeeType._id}`);
    console.log(`Total Excel Rows: ${grandTotalExcelRows}`);
    console.log("---------------------------------------------");
    
    console.log("\nDETAILED STATISTICS BY SHEET / ANGKATAN:");
    for (const sheetName of targetSheets) {
      const s = statsBySheet[sheetName];
      if (!s) continue;
      console.log(`\nSheet ${sheetName} (Angkatan ${sheetName}):`);
      console.log(`  - Excel Rows Count      : ${s.excelRowsCount}`);
      console.log(`  - Students Created      : ${s.studentsCreated}`);
      console.log(`  - Students Updated      : ${s.studentsUpdated}`);
      console.log(`  - SPP Bills Created     : ${s.billsCreated}`);
      console.log(`  - SPP Bills Updated     : ${s.billsUpdated}`);
      console.log(`  - SPP Bills Skipped/Paid: ${s.billsSkippedPaid}`);
      console.log(`  - Total SPP Billed Amount: ${formatIDR(s.totalSppBilled)}`);
    }

    console.log("\n---------------------------------------------");
    console.log("GRAND TOTALS:");
    console.log(`  - Total Students Created   : ${grandTotalStudentsCreated}`);
    console.log(`  - Total Students Updated   : ${grandTotalStudentsUpdated}`);
    console.log(`  - Total SPP Bills Created  : ${grandTotalBillsCreated}`);
    console.log(`  - Total SPP Bills Updated  : ${grandTotalBillsUpdated}`);
    console.log(`  - Total SPP Bills Skipped  : ${grandTotalBillsSkippedPaid}`);
    console.log(`  - GRAND TOTAL SPP BILLED   : ${formatIDR(grandTotalSppBilled)}`);
    console.log("=============================================");

    if (errors.length > 0) {
      console.log(`\nencountered ${errors.length} warning(s)/error(s) during processing:`);
      errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    } else {
      console.log("\nAll processed rows successfully verified and imported without errors.");
    }

    await mongoose.connection.close();
    console.log("\nDatabase connection closed cleanly.");
    process.exit(0);
  } catch (error) {
    console.error("\nFatal error during seeder execution:", error);
    process.exit(1);
  }
}

run();
