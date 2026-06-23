import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import CashTransaction from "@/models/CashTransaction";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "admin_bauk", "staff_bauk", "pimpinan", "auditor"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG, and PDF are allowed." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const originalExtension = file.name.split('.').pop();
    const filename = `receipt-${id}-${uniqueSuffix}.${originalExtension}`;

    // Ensure directory exists
    const uploadDir = join(process.cwd(), "public", "uploads", "receipts");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const attachmentUrl = `/uploads/receipts/${filename}`;

    await dbConnect();
    
    // Update the transaction in database
    const transaction = await CashTransaction.findByIdAndUpdate(
      id,
      { $set: { attachmentUrl } },
      { new: true }
    );

    if (!transaction) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      attachmentUrl,
      message: "Bukti transaksi berhasil diunggah" 
    });
  } catch (error: unknown) {
    console.error("Upload Receipt Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
