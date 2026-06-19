import mongoose from "mongoose";

const AccountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["asset", "liability", "equity", "revenue", "expense"],
      required: true,
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    normalBalance: { type: String, enum: ["debit", "credit"], required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

AccountSchema.index({ type: 1, isActive: 1 });
AccountSchema.index({ parentId: 1 });

export default mongoose.models.Account || mongoose.model("Account", AccountSchema);
