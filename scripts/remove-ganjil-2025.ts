import mongoose from "mongoose";
import dotenv from "dotenv";
import Student from "../src/models/Student";
import StudentBill from "../src/models/StudentBill";
import Payment from "../src/models/Payment";
import JournalEntry from "../src/models/JournalEntry";
import JournalLine from "../src/models/JournalLine";
import FeeType from "../src/models/FeeType";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

async function executeCleanup() {
  if (!MONGODB_URI) {
    console.error("Error: MONGODB_URI is not defined");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  // Force mongoose to register FeeType schema (so populate doesn't fail if needed)
  void FeeType.modelName;

  // 1. Find all active students from Angkatan 2025
  const students2025 = await Student.find({ entryYear: 2025 }).lean();
  const studentIds = students2025.map((s) => s._id);
  console.log(`Found ${students2025.length} students from Angkatan 2025.`);

  if (studentIds.length === 0) {
    console.log("No Angkatan 2025 students found. Exiting.");
    await mongoose.connection.close();
    return;
  }

  // 2. Find Ganjil SPP Bills for these students in TA 2025/2026
  const ganjilBills = await StudentBill.find({
    studentId: { $in: studentIds },
    semester: "Ganjil",
    academicYear: "2025/2026",
  }).lean();

  console.log(`Found ${ganjilBills.length} Ganjil 2025/2026 bills for these students.`);

  if (ganjilBills.length === 0) {
    console.log("No matching Ganjil 2025/2026 bills found. Exiting.");
    await mongoose.connection.close();
    return;
  }

  let deletedBillsCount = 0;
  let deletedPaymentsCount = 0;
  let deletedJournalEntriesCount = 0;
  let deletedJournalLinesCount = 0;

  // 3. Loop through each bill and clean up payments, journals, and lines
  for (const bill of ganjilBills) {
    // Find all payments linked to this bill
    const payments = await Payment.find({ billId: bill._id }).lean();

    for (const payment of payments) {
      // Find all journal entries for this payment
      const journalEntries = await JournalEntry.find({
        $or: [
          { sourceId: payment._id },
          { _id: payment.journalEntryId }
        ]
      }).lean();

      const journalEntryIds = journalEntries.map((je) => je._id);

      if (journalEntryIds.length > 0) {
        // Delete Journal Lines
        const jlRes = await JournalLine.collection.deleteMany({
          journalEntryId: { $in: journalEntryIds },
        });
        deletedJournalLinesCount += jlRes.deletedCount || 0;

        // Delete Journal Entries
        const jeRes = await JournalEntry.collection.deleteMany({
          _id: { $in: journalEntryIds },
        });
        deletedJournalEntriesCount += jeRes.deletedCount || 0;
      }

      // Delete Payment (bypassing mongoose middleware delete blocks using .collection)
      const payRes = await Payment.collection.deleteOne({ _id: payment._id });
      deletedPaymentsCount += payRes.deletedCount || 0;
    }

    // Delete Student Bill
    const billRes = await StudentBill.collection.deleteOne({ _id: bill._id });
    deletedBillsCount += billRes.deletedCount || 0;
  }

  console.log("\n=== MAINTENANCE CLEANUP REPORT ===");
  console.log(`Deleted Student Bills    : ${deletedBillsCount}`);
  console.log(`Deleted Payments         : ${deletedPaymentsCount}`);
  console.log(`Deleted Journal Entries  : ${deletedJournalEntriesCount}`);
  console.log(`Deleted Journal Lines    : ${deletedJournalLinesCount}`);
  console.log("==================================");

  await mongoose.connection.close();
  console.log("\nDatabase connection closed.");
}

executeCleanup().catch(console.error);
