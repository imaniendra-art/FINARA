import { NextResponse } from "next/server";
import { receiptPrintRoles, requireApiRole } from "@/lib/api-auth";

export async function DELETE() {
  const auth = await requireApiRole(receiptPrintRoles);
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json(
    { error: "Pembayaran tidak dapat dihapus. Gunakan mekanisme pembatalan/koreksi." },
    { status: 405 }
  );
}
