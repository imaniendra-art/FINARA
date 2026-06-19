import mongoose from "mongoose";

const BudgetPeriodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false, required: true },
  },
  { timestamps: true }
);

BudgetPeriodSchema.index({ isActive: 1, startDate: -1 });
BudgetPeriodSchema.index({ name: 1 });

export default mongoose.models.BudgetPeriod ||
  mongoose.model("BudgetPeriod", BudgetPeriodSchema);
