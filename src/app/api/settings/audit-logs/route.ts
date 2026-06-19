import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { requireApiRole } from "@/lib/api-auth";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

export async function GET(request: Request) {
  const auth = await requireApiRole(["super_admin", "auditor"]);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const moduleFilter = searchParams.get("module") || "";
    const actionFilter = searchParams.get("action") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (moduleFilter) {
      query.module = moduleFilter;
    }

    if (actionFilter) {
      query.action = actionFilter;
    }

    if (search) {
      // Find matching users first to search by user name/email
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      const userIds = users.map((u) => u._id);

      query.$or = [
        { userId: { $in: userIds } },
        { module: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("userId", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    interface AuditLogDoc {
      _id: unknown;
      userId?: {
        name: string;
        email: string;
        role: string;
      };
      action: string;
      module: string;
      documentId: unknown;
      before?: unknown;
      after?: unknown;
      createdAt: string;
    }

    // Format logs for easier UI consumption
    const formattedLogs = (logs as unknown as AuditLogDoc[]).map((log) => ({
      _id: log._id,
      user: log.userId ? {
        name: log.userId.name,
        email: log.userId.email,
        role: log.userId.role,
      } : { name: "Sistem / Dihapus", email: "-", role: "system" },
      action: log.action,
      module: log.module,
      documentId: log.documentId,
      before: log.before,
      after: log.after,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Gagal memuat log aktivitas.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
