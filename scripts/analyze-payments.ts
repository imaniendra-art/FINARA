import mongoose from "mongoose";
import dotenv from "dotenv";
import Student from "../src/models/Student";
import Payment from "../src/models/Payment";
import StudentBill from "../src/models/StudentBill";
import FeeType from "../src/models/FeeType";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

type PopulatedFeeType = {
  name?: string;
};

type PopulatedStudent = {
  nim?: string;
  name?: string;
};

async function analyze() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not defined");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");
  console.log("FeeType registered model:", FeeType.modelName);

  // Count total students and by status/type
  const totalStudents = await Student.countDocuments();
  const activeStudents = await Student.countDocuments({ status: "active" });
  const kipStudents = await Student.countDocuments({ biayaPendidikan: "KIP" });
  const regulerStudents = await Student.countDocuments({ biayaPendidikan: "Reguler" });
  const otherStudents = await Student.countDocuments({ biayaPendidikan: { $exists: false } });

  console.log("\n=== DATA MAHASISWA ===");
  console.log(`Total Mahasiswa di Database : ${totalStudents}`);
  console.log(`Mahasiswa Aktif             : ${activeStudents}`);
  console.log(`Mahasiswa KIP               : ${kipStudents}`);
  console.log(`Mahasiswa Reguler           : ${regulerStudents}`);
  console.log(`Mahasiswa Tanpa Label       : ${otherStudents}`);

  // Count total payments and total amount
  const payments = await Payment.find().populate("studentId").lean();
  console.log("\n=== DATA PEMBAYARAN ===");
  console.log(`Total Transaksi Pembayaran  : ${payments.length}`);

  // Inspect detail for student Nur Isma Hadianti
  const sampleStudent = await Student.findOne({ nim: "2561201001" });
  if (sampleStudent) {
    console.log(`\n=== DETAIL TAGIHAN & PEMBAYARAN UNTUK ${sampleStudent.name} (NIM: ${sampleStudent.nim}) ===`);
    const studentBills = await StudentBill.find({ studentId: sampleStudent._id }).populate("feeTypeId").lean();
    console.log("Tagihan:");
    for (const b of studentBills) {
      const feeType = b.feeTypeId as PopulatedFeeType | undefined;
      console.log(`- ID: ${b._id}, Jenis: ${feeType?.name}, Semester: ${b.semester}, Tahun: ${b.academicYear}, Total: Rp ${b.amount.toLocaleString("id-ID")}, Terbayar: Rp ${b.paidAmount.toLocaleString("id-ID")}, Status: ${b.status}`);
    }
    const studentPays = await Payment.find({ studentId: sampleStudent._id }).lean();
    console.log("Pembayaran:");
    for (const p of studentPays) {
      console.log(`- ID: ${p._id}, Bill ID: ${p.studentBillId}, Jumlah: Rp ${p.amount.toLocaleString("id-ID")}, Tanggal: ${p.paymentDate}`);
    }
  }


  let totalAmount = 0;
  const studentPaymentCounts: Record<string, number> = {};
  const studentPaymentAmounts: Record<string, number> = {};

  for (const pay of payments) {
    totalAmount += pay.amount;
    const student = pay.studentId as PopulatedStudent | undefined;
    if (student) {
      const key = `${student.nim} - ${student.name}`;
      studentPaymentCounts[key] = (studentPaymentCounts[key] || 0) + 1;
      studentPaymentAmounts[key] = (studentPaymentAmounts[key] || 0) + pay.amount;
    } else {
      const key = `Unknown Student (${pay.studentId})`;
      studentPaymentCounts[key] = (studentPaymentCounts[key] || 0) + 1;
      studentPaymentAmounts[key] = (studentPaymentAmounts[key] || 0) + pay.amount;
    }
  }

  console.log(`Total Pemasukan di Database : Rp ${totalAmount.toLocaleString("id-ID")}`);

  // Find students who have made multiple payments
  console.log("\n=== MAHASISWA DENGAN MULTIPEL PEMBAYARAN ===");
  let multipleCount = 0;
  for (const [student, count] of Object.entries(studentPaymentCounts)) {
    if (count > 1) {
      multipleCount++;
      console.log(`- ${student}: ${count} kali bayar, Total Rp ${studentPaymentAmounts[student].toLocaleString("id-ID")}`);
    }
  }
  if (multipleCount === 0) {
    console.log("Tidak ada mahasiswa dengan multipel pembayaran.");
  }

  // Count bills and unpaid/paid status
  const totalBills = await StudentBill.countDocuments();
  const paidBills = await StudentBill.countDocuments({ status: "paid" });
  const unpaidBills = await StudentBill.countDocuments({ status: "unpaid" });
  const partialBills = await StudentBill.countDocuments({ status: "partial" });

  console.log("\n=== DATA TAGIHAN ===");
  console.log(`Total Tagihan               : ${totalBills}`);
  console.log(`Tagihan Lunas (paid)        : ${paidBills}`);
  console.log(`Tagihan Belum Lunas (unpaid): ${unpaidBills}`);
  console.log(`Tagihan Dicicil (partial)   : ${partialBills}`);

  await mongoose.connection.close();
  console.log("\nDatabase connection closed.");
}

analyze().catch(console.error);
