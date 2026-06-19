import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { userCreateSchema } from "@/lib/validation";
import { userRoles } from "@/lib/roles";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

const userManagementRoles = ["super_admin"] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET() {
  const auth = await requireApiRole([...userManagementRoles]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const users = await User.find({})
    .sort({ name: 1 })
    .select("name email role isActive createdAt updatedAt")
    .lean();

  return NextResponse.json({
    users,
    options: {
      roles: userRoles,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiRole([...userManagementRoles]);
  if (auth.response) {
    return auth.response;
  }

  const parsed = userCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data user tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const duplicateUser = await User.findOne({
    email: { $regex: `^${escapeRegex(parsed.data.email)}$`, $options: "i" },
  }).lean();

  if (duplicateUser) {
    return NextResponse.json({ error: "Email sudah digunakan." }, { status: 409 });
  }

  try {
    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
    });

    await AuditLog.create({
      userId: auth.session.user.id,
      action: "create_user",
      module: "User",
      documentId: user._id,
      before: null,
      after: {
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });

    return NextResponse.json(
      {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Email sudah digunakan." }, { status: 409 });
    }

    console.error("Create user error:", error);
    return NextResponse.json({ error: "User gagal disimpan." }, { status: 500 });
  }
}
