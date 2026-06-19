import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { objectIdSchema, userUpdateSchema } from "@/lib/validation";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

const userManagementRoles = ["super_admin"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UserSnapshot = {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeUser(user: UserSnapshot) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRole([...userManagementRoles]);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID user tidak valid." }, { status: 400 });
  }

  const parsed = userUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data user tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsedId.data === auth.session.user.id && !parsed.data.isActive) {
    return NextResponse.json(
      { error: "Super admin tidak boleh menonaktifkan dirinya sendiri." },
      { status: 409 }
    );
  }

  await dbConnect();

  const before = await User.findById(parsedId.data)
    .select("name email role isActive")
    .lean<UserSnapshot | null>();

  if (!before) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  const duplicateUser = await User.findOne({
    _id: { $ne: parsedId.data },
    email: { $regex: `^${escapeRegex(parsed.data.email)}$`, $options: "i" },
  }).lean();

  if (duplicateUser) {
    return NextResponse.json({ error: "Email sudah digunakan." }, { status: 409 });
  }

  try {
    const user = await User.findByIdAndUpdate(
      parsedId.data,
      {
        $set: {
          name: parsed.data.name,
          email: parsed.data.email,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
        },
      },
      { returnDocument: "after", runValidators: true }
    )
      .select("name email role isActive createdAt updatedAt")
      .lean<UserSnapshot | null>();

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    const action =
      before.role !== parsed.data.role
        ? "change_role"
        : before.isActive && !parsed.data.isActive
          ? "deactivate_user"
          : !before.isActive && parsed.data.isActive
            ? "activate_user"
            : "update_user";

    await AuditLog.create({
      userId: auth.session.user.id,
      action,
      module: "User",
      documentId: parsedId.data,
      before: sanitizeUser(before),
      after: sanitizeUser(user),
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Email sudah digunakan." }, { status: 409 });
    }

    console.error("Update user error:", error);
    return NextResponse.json({ error: "User gagal diperbarui." }, { status: 500 });
  }
}
