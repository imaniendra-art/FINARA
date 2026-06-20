import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../src/models/User";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

async function resetDb() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection not established");
    
    // Get all collections
    const collections = await db.collections();
    
    console.log(`Found ${collections.length} collections. Clearing data...`);
    
    for (const collection of collections) {
      await collection.deleteMany({});
      console.log(`Cleared collection: ${collection.collectionName}`);
    }

    console.log("All data cleared successfully.");

    console.log("Creating new admin user...");
    const adminPassword = await bcrypt.hash("admin123", 10);
    
    const superAdmin = await User.create({
      name: "Super Admin",
      email: "admin@finara.com",
      password: adminPassword,
      role: "super_admin",
      isActive: true,
    });
    
    console.log("Super Admin created:", superAdmin.email);

    console.log("Reset completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error resetting database:", error);
    process.exit(1);
  }
}

resetDb();
