import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { financeReadRoles, masterDataWriteRoles, requireApiRole } from "@/lib/api-auth";
import { accountInputSchema, objectIdSchema } from "@/lib/validation";
import Account from "@/models/Account";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID kode akun tidak valid." }, { status: 400 });
  }

  await dbConnect();

  const account = await Account.findById(parsedId.data).populate("parentId", "code name").lean();
  if (!account) {
    return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ account });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole(masterDataWriteRoles);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID kode akun tidak valid." }, { status: 400 });
  }

  const parsed = accountInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data kode akun tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsed.data.parentId === parsedId.data) {
    return NextResponse.json({ error: "Akun tidak bisa menjadi induk untuk dirinya sendiri." }, { status: 400 });
  }

  await dbConnect();

  const duplicateAccount = await Account.findOne({
    _id: { $ne: parsedId.data },
    code: { $regex: `^${escapeRegex(parsed.data.code)}$`, $options: "i" },
  }).lean();

  if (duplicateAccount) {
    return NextResponse.json({ error: "Kode akun sudah digunakan." }, { status: 409 });
  }

  if (parsed.data.parentId) {
    const parentAccount = await Account.findById(parsed.data.parentId).select("_id").lean();
    if (!parentAccount) {
      return NextResponse.json({ error: "Akun induk tidak ditemukan." }, { status: 404 });
    }
  }

  try {
    const account = await Account.findByIdAndUpdate(
      parsedId.data,
      {
        $set: {
          ...parsed.data,
          parentId: parsed.data.parentId ? new mongoose.Types.ObjectId(parsed.data.parentId) : null,
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!account) {
      return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Kode akun sudah digunakan." }, { status: 409 });
    }

    console.error("Update account error:", error);
    return NextResponse.json({ error: "Kode akun gagal diperbarui." }, { status: 500 });
  }
}
