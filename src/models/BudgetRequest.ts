import mongoose from "mongoose";

export const budgetRequestStatuses = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "rejected",
  "disbursed",
  "lpj_submitted",
  "completed",
  "cancelled",
] as const;

const BudgetRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true },
    requestDate: { type: Date, required: true },
    requesterName: { type: String, required: true, trim: true },
    requesterUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "BudgetWorkUnit", required: true },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: "BudgetPeriod" },
    requestType: {
      type: String,
      enum: ["proker", "incidental", "operational", "other"],
      required: true,
    },
    activityName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    totalRequestedAmount: { type: Number, required: true, min: 0 },
    totalApprovedAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: budgetRequestStatuses,
      default: "draft",
      required: true,
    },
    adminNote: { type: String, trim: true },
    leaderNote: { type: String, trim: true },
    userNote: { type: String, trim: true },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    disbursedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    disbursedAt: { type: Date },
    disbursementNote: { type: String, trim: true },
    disbursementProofUrl: { type: String, trim: true },
    lpjSubmittedAt: { type: Date },
    lpjNote: { type: String, trim: true },
    lpjProofUrl: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

BudgetRequestSchema.index({ status: 1, requestDate: -1 });
BudgetRequestSchema.index({ requesterUserId: 1, requestDate: -1 });
BudgetRequestSchema.index({ unitId: 1, periodId: 1 });

export default mongoose.models.BudgetRequest ||
  mongoose.model("BudgetRequest", BudgetRequestSchema);
