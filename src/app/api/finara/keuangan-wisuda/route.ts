import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { createFinanceNumber } from "@/lib/finance";
import CashTransaction from "@/models/CashTransaction";
import Account from "@/models/Account";
import User from "@/models/User";

const API_KEY = process.env.PANDAWA_FINARA_SECRET || "pandawa-secret-key-123";

function authorize(request: Request) {
  const key = request.headers.get("x-api-key");
  if (key !== API_KEY) {
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { nim, nama, wisuda_ke, status_pembayaran } = data;

    if (!nim || !nama) {
      return NextResponse.json({ error: "NIM and Nama are required" }, { status: 400 });
    }

    await dbConnect();

    // Find a system user or the first admin to attribute this transaction to
    const adminUser = await User.findOne({ role: "admin" }).select("_id").lean();
    if (!adminUser) {
      return NextResponse.json({ error: "No admin user found to attribute transaction" }, { status: 500 });
    }

    // Find default accounts (Cash/Bank and Revenue/Counter account)
    const cashAccount = await Account.findOne({ type: "asset", isActive: true }).select("_id").lean();
    const counterAccount = await Account.findOne({ isActive: true, type: { $ne: "asset" } }).select("_id").lean();

    if (!cashAccount || !counterAccount) {
      return NextResponse.json({ error: "Required accounts not configured in FINARA" }, { status: 500 });
    }

    const transaction = await CashTransaction.create({
      transactionNumber: createFinanceNumber("KIN"),
      date: new Date(),
      type: "cash_in",
      cashOrBankAccountId: cashAccount._id,
      accountId: counterAccount._id,
      amount: 1500000, // Default wisuda fee, could be dynamic
      description: `Pembayaran Wisuda Ke-${wisuda_ke || "?"} - ${nama} (${nim})`,
      notes: `Status di PANDAWA: ${status_pembayaran}`,
      status: "draft",
      createdBy: adminUser._id,
      origin: "PANDAWA",
      metadata: {
        nim,
        nama,
        wisuda_ke,
      },
    });

    return NextResponse.json({ message: "Successfully queued in FINARA", transactionId: transaction._id }, { status: 201 });
  } catch (error) {
    console.error("FINARA Webhook Error:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();

    // Fetch drafted transactions that originated from PANDAWA
    const transactions = await CashTransaction.find({
      origin: "PANDAWA",
      status: "draft",
    }).sort({ date: -1 }).lean();

    return NextResponse.json({ queue: transactions });
  } catch (error) {
    console.error("FINARA GET Queue Error:", error);
    return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500 });
  }
}
