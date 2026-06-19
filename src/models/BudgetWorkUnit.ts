import mongoose from "mongoose";

const BudgetWorkUnitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

BudgetWorkUnitSchema.index({ code: 1 }, { unique: true });
BudgetWorkUnitSchema.index({ isActive: 1, name: 1 });

export default mongoose.models.BudgetWorkUnit ||
  mongoose.model("BudgetWorkUnit", BudgetWorkUnitSchema);
