import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CashTransaction from "@/models/CashTransaction";
import KasproRequest from "@/models/KasproRequest";
import User from "@/models/User";
import { createFinanceNumber } from "@/lib/finance";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.KASPRO_API_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, kasproId } = body;

    if (!action || !kasproId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await dbConnect();

    // Find a system user or super_admin to act as creator
    let adminUser = await User.findOne({ role: "super_admin" });
    if (!adminUser) {
      return NextResponse.json({ error: "System requires at least one super_admin" }, { status: 500 });
    }

    if (action === "create_draft") {
      const { judul, nominal, tanggal, pengusul } = body;

      const existingRequest = await KasproRequest.findOne({ kasproId });
      if (existingRequest) {
        return NextResponse.json({ message: "Request already exists" }, { status: 200 });
      }

      const request = await KasproRequest.create({
        kasproId,
        judul,
        nominal,
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        pengusul,
        status: "pending_akun",
      });

      return NextResponse.json({ message: "KasproRequest created successfully", id: request._id }, { status: 201 });

    } else if (action === "post_draft") {
      const { buktiUrl } = body;

      const request = await KasproRequest.findOne({ kasproId });
      if (!request) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      request.buktiUrl = buktiUrl;
      request.status = "pending_validasi";
      await request.save();

      return NextResponse.json({ message: "Bukti attached successfully", status: request.status }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("KASPRO Integration Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
