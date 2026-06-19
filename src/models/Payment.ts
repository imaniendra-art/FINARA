import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    billId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentBill", required: true },
    paymentDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 1 },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "qris", "other"],
      required: true,
    },
    cashOrBankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    notes: { type: String },
    receiptNumber: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
  },
  { timestamps: true }
);

function blockPaymentDelete() {
  throw new Error("Pembayaran tidak dapat dihapus. Gunakan mekanisme pembatalan/koreksi.");
}

PaymentSchema.pre("deleteOne", { query: true, document: false }, blockPaymentDelete);
PaymentSchema.pre("deleteOne", { query: false, document: true }, blockPaymentDelete);
PaymentSchema.pre("deleteMany", blockPaymentDelete);
PaymentSchema.pre("findOneAndDelete", blockPaymentDelete);

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
