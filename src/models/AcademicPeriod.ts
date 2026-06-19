import mongoose from "mongoose";

const AcademicPeriodSchema = new mongoose.Schema(
  {
    academicYear: { type: String, required: true, trim: true },
    semester: { type: String, enum: ["ganjil", "genap"], required: true },
    isActive: { type: Boolean, default: false, required: true },
  },
  { timestamps: true }
);

AcademicPeriodSchema.index({ academicYear: 1, semester: 1 }, { unique: true });
AcademicPeriodSchema.index({ isActive: 1 });

export default mongoose.models.AcademicPeriod ||
  mongoose.model("AcademicPeriod", AcademicPeriodSchema);
