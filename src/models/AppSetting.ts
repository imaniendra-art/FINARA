import mongoose from "mongoose";

const AppSettingSchema = new mongoose.Schema(
  {
    campusName: { type: String, required: true, default: "STIMI YAPMI Makassar" },
    appName: { type: String, required: true, default: "FINARA" },
    appFullName: {
      type: String,
      required: true,
      default: "Finance Administration and Reporting Application STIMI",
    },
    address: { type: String, default: "Makassar" },
    phone: { type: String, default: "" },
    email: { type: String, default: "-" },
    website: { type: String, default: "-" },
    leaderName: { type: String, default: "" },
    leaderPosition: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    currency: { type: String, required: true, default: "IDR" },
    timezone: { type: String, required: true, default: "Asia/Makassar" },
    dateFormat: { type: String, required: true, default: "dd/MM/yyyy" },
    defaultTheme: { type: String, required: true, default: "light" },
    receiptPrefix: { type: String, required: true, default: "KWT" },
    receiptFooterText: {
      type: String,
      default: "Terima kasih telah melakukan pembayaran.",
    },
    receiptSignerName: { type: String, default: "" },
    receiptSignerPosition: { type: String, default: "Petugas BAUK" },
    showCampusLogo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.AppSetting || mongoose.model("AppSetting", AppSettingSchema);
