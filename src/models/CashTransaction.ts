import mongoose from "mongoose";

const CashTransactionSchema = new mongoose.Schema(
  {
    transactionNumber: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ["cash_in", "cash_out"], required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    cashOrBankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, required: true },
    notes: { type: String },
    attachmentUrl: { type: String },
    status: {
      type: String,
      enum: ["draft", "posted", "cancelled"],
      default: "draft",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    origin: { type: String },
    metadata: {
      nim: String,
      wisuda_ke: String,
      nama: String,
    },
  },
  { timestamps: true }
);

async function blockPostedCashTransactionDelete(this: mongoose.Query<unknown, unknown>) {
  const transaction = await this.model.findOne(this.getFilter()).select("status").lean();

  if (transaction?.status === "posted") {
    throw new Error("Posted cash transactions cannot be deleted");
  }
}

CashTransactionSchema.pre("deleteOne", { query: true, document: false }, blockPostedCashTransactionDelete);
CashTransactionSchema.pre("findOneAndDelete", blockPostedCashTransactionDelete);

export default mongoose.models.CashTransaction ||
  mongoose.model("CashTransaction", CashTransactionSchema);
