import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import KasproRequest from "@/models/KasproRequest";
import CashTransaction from "@/models/CashTransaction";
import { createFinanceNumber } from "@/lib/finance";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { accountId, cashOrBankAccountId } = body;

    if (!accountId || !cashOrBankAccountId) {
      return NextResponse.json({ error: "Akun harus dipilih" }, { status: 400 });
    }

    await dbConnect();

    const kasproRequest = await KasproRequest.findById(id);
    if (!kasproRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (kasproRequest.status !== "pending_akun") {
      return NextResponse.json({ error: "Request is not in pending_akun status" }, { status: 400 });
    }

    // Create Draft CashTransaction
    const draft = await CashTransaction.create({
      transactionNumber: createFinanceNumber("CSH-OUT"),
      date: new Date(),
      type: "cash_out",
      accountId,
      cashOrBankAccountId,
      amount: kasproRequest.nominal,
      description: `Pengajuan Kaspro: ${kasproRequest.judul}`,
      notes: `Diajukan oleh: ${kasproRequest.pengusul}`,
      status: "draft",
      origin: `KASPRO-${kasproRequest.kasproId}`,
      createdBy: session.user.id,
    });

    kasproRequest.cashTransactionId = draft._id;
    kasproRequest.status = "menunggu_lpj";
    await kasproRequest.save();

    // Send webhook to KASPRO to change status from 'Diproses Keuangan' to 'Dicairkan'
    try {
      const kasproUrl = process.env.KASPRO_URL || "http://localhost:3001";
      await fetch(`${kasproUrl}/api/integrations/finara`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.KASPRO_API_SECRET}`
        },
        body: JSON.stringify({ action: "ready_for_lpj", kasproId: kasproRequest.kasproId })
      });
    } catch (err) {
      console.error("Gagal mengirim notifikasi ke KASPRO:", err);
    }

    return NextResponse.json({ message: "Request processed successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Kaspro process error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
