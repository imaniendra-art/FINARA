import mongoose from "mongoose";

const BudgetRequestItemSchema = new mongoose.Schema(
  {
    budgetRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BudgetRequest",
      required: true,
    },
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    unit: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true },
    referenceUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

BudgetRequestItemSchema.pre("validate", function () {
  this.total = this.quantity * this.unitPrice;
});

BudgetRequestItemSchema.index({ budgetRequestId: 1, createdAt: 1 });

export default mongoose.models.BudgetRequestItem ||
  mongoose.model("BudgetRequestItem", BudgetRequestItemSchema);
