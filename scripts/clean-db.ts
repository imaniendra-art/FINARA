import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

// Import all models to ensure they are registered
import "../src/models/User";
import "../src/models/Account";
import "../src/models/FeeType";
import "../src/models/Student";
import "../src/models/CashTransaction";
import "../src/models/JournalEntry";
import "../src/models/JournalLine";
import "../src/models/Payment";
import "../src/models/StudentBill";
import "../src/models/AuditLog";
import "../src/models/BudgetRequest";
import "../src/models/BudgetRequestItem";
import "../src/models/AppSetting";
import "../src/models/AcademicPeriod";
import "../src/models/BudgetPeriod";
import "../src/models/BudgetWorkUnit";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

async function cleanDb() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection not established");
    
    // We want to delete User, CashTransaction, JournalEntry, JournalLine, Payment, StudentBill, AuditLog, BudgetRequest, BudgetRequestItem, Student
    const collectionsToClear = [
      "users",
      "cashtransactions",
      "journalentries",
      "journallines",
      "payments",
      "studentbills",
      "auditlogs",
      "budgetrequests",
      "budgetrequestitems",
      "students"
    ];

    for (const collectionName of collectionsToClear) {
      try {
        const collection = db.collection(collectionName);
        await collection.deleteMany({});
        console.log(`Cleared collection: ${collectionName}`);
      } catch (err) {
        console.log(`Collection ${collectionName} might not exist yet or error:`, err);
      }
    }

    console.log("Creating new admin user...");
    const adminPassword = await bcrypt.hash("admin123", 10);
    
    // Get the User model dynamically
    const User = mongoose.model("User");
    const superAdmin = await User.create({
      name: "Admin STIMI",
      email: "admin@stimi.ac.id",
      password: adminPassword,
      role: "super_admin",
      isActive: true,
    });
    
    console.log("Super Admin created:", superAdmin.email);

    console.log("Database cleanup completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error resetting database:", error);
    process.exit(1);
  }
}

cleanDb();
