import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { masterDataWriteRoles, requireApiRole } from "@/lib/api-auth";
import { objectIdSchema } from "@/lib/validation";
import Account from "@/models/Account";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(masterDataWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID kode akun tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const account = await Account.findByIdAndUpdate(
    parsedId.data,
    { $set: { isActive: false } },
    { returnDocument: "after", runValidators: true }
  );

  if (!account) {
    return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ account });
}
