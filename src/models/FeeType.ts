import mongoose from "mongoose";

const FeeTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    defaultAmount: { type: Number, required: true, default: 0, min: 0 },
    revenueAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

FeeTypeSchema.index({ name: 1 });
FeeTypeSchema.index({ revenueAccountId: 1 });
FeeTypeSchema.index({ isActive: 1, name: 1 });

export default mongoose.models.FeeType || mongoose.model("FeeType", FeeTypeSchema);
