import mongoose from "mongoose";

const KasproRequestSchema = new mongoose.Schema(
  {
    kasproId: { type: String, required: true, unique: true },
    judul: { type: String, required: true },
    nominal: { type: Number, required: true },
    tanggal: { type: Date, required: true },
    pengusul: { type: String, required: true },
    buktiUrl: { type: String },
    status: {
      type: String,
      enum: ["pending_akun", "menunggu_lpj", "pending_validasi", "selesai", "ditolak"],
      default: "pending_akun",
    },
    cashTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "CashTransaction" },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

const KasproRequest = mongoose.models.KasproRequest || mongoose.model("KasproRequest", KasproRequestSchema);

export default KasproRequest;
