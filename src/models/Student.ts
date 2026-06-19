import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema(
  {
    nim: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["L", "P"] },
    programStudy: { type: String, required: true, trim: true },
    className: { type: String, trim: true },
    entryYear: { type: Number, required: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive", "graduated", "dropped_out"],
      default: "active",
      required: true,
    },
    biayaPendidikan: {
      type: String,
      enum: ["KIP", "Reguler"],
      default: "Reguler",
      required: true,
    },
  },
  { timestamps: true }
);

StudentSchema.index({ name: 1 });
StudentSchema.index({ entryYear: 1, programStudy: 1, status: 1 });
StudentSchema.index({ biayaPendidikan: 1 });

export default mongoose.models.Student || mongoose.model("Student", StudentSchema);
