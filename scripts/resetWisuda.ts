import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

const CashTransactionSchema = new mongoose.Schema({}, { strict: false });
const CashTransaction = mongoose.models.CashTransaction || mongoose.model("CashTransaction", CashTransactionSchema, "cashtransactions");

async function reset() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB FINARA");

    const result = await CashTransaction.deleteMany({ origin: "PANDAWA" });

    console.log(`Deleted ${result.deletedCount} pending PANDAWA transactions in FINARA`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

reset();
