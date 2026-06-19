import mongoose from "mongoose";
import { calculateBillStatus, calculateRemainingAmount } from "@/lib/finance";

const StudentBillSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    feeTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "FeeType", required: true },
    academicYear: { type: String, required: true },
    semester: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "cancelled"],
      default: "unpaid",
    },
    notes: { type: String },
  },
  { timestamps: true }
);

StudentBillSchema.pre("validate", function () {
  if (this.discount > this.amount) {
    throw new Error("Discount cannot be greater than bill amount");
  }

  const remainingAmount = calculateRemainingAmount(
    this.amount,
    this.discount,
    this.paidAmount
  );

  if (remainingAmount < 0) {
    throw new Error("Paid amount cannot be greater than net bill amount");
  }

  this.remainingAmount = remainingAmount;
  this.status = calculateBillStatus(remainingAmount, this.amount - this.discount);
});

// Compound index to prevent duplicate bills
StudentBillSchema.index(
  { studentId: 1, feeTypeId: 1, academicYear: 1, semester: 1 },
  { unique: true }
);

export default mongoose.models.StudentBill || mongoose.model("StudentBill", StudentBillSchema);
