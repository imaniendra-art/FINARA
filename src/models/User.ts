import mongoose from "mongoose";
import { userRoles } from "@/lib/roles";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: userRoles,
      required: true,
    },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "BudgetWorkUnit" },
    personType: {
      type: String,
      enum: ["bauk_admin", "unit", "tendik", "dosen", "mahasiswa", "organisasi", "pimpinan", "auditor"],
    },
    relatedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    relatedLecturerId: { type: mongoose.Schema.Types.ObjectId },
    organizationName: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
