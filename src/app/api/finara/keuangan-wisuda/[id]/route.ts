import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CashTransaction from "@/models/CashTransaction";

const API_KEY = process.env.PANDAWA_FINARA_SECRET || "pandawa-secret-key-123";

// Optional: You could use FINARA's requireApiRole here to protect it,
// but for the sake of simplicity, we will just ensure they are logged in if this is called from the client
// Or we can rely on NextAuth session. We will assume standard FINARA API authentication later.

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await dbConnect();
    const { id } = params;

    const transaction = await CashTransaction.findById(id);
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.status === "posted") {
      return NextResponse.json({ error: "Transaction already validated" }, { status: 400 });
    }

    // Update status to posted (verified)
    transaction.status = "posted";
    await transaction.save();

    // Trigger webhook back to PANDAWA
    const pandawaUrl = process.env.PANDAWA_API_URL || "http://localhost:3080/api/pandawa/update-status";
    
    if (transaction.metadata?.nim) {
      fetch(pandawaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          nim: transaction.metadata.nim,
          status: "posted",
        }),
      }).catch((err) => console.error("Failed to notify PANDAWA:", err));
    }

    return NextResponse.json({ message: "Transaction validated successfully", transaction });
  } catch (error) {
    console.error("FINARA Validation Error:", error);
    return NextResponse.json({ error: "Failed to validate transaction" }, { status: 500 });
  }
}
