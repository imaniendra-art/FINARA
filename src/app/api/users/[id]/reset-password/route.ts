import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import { objectIdSchema, userResetPasswordSchema } from "@/lib/validation";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

const userManagementRoles = ["super_admin"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiRole([...userManagementRoles]);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsedId = objectIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "ID user tidak valid." }, { status: 400 });
  }

  const parsed = userResetPasswordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password tidak valid", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const user = await User.findById(parsedId.data).select("name email role isActive").lean();
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  await User.findByIdAndUpdate(parsedId.data, { $set: { password: hashedPassword } }, { runValidators: true });

  await AuditLog.create({
    userId: auth.session.user.id,
    action: "reset_password",
    module: "User",
    documentId: parsedId.data,
    before: { email: user.email },
    after: { email: user.email, passwordReset: true },
  });

  return NextResponse.json({ ok: true });
}
