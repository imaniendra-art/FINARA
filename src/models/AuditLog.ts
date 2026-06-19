import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // create, update, delete, post, cancel
    module: { type: String, required: true }, // Student, Account, Payment, etc.
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
