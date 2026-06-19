import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Account from "@/models/Account";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";
import { z } from "zod";
import dayjs from "dayjs";

const trialBalanceQuerySchema = z.object({
  endDate: z.string().min(1, "End date is required"),
});

type AccountTotal = {
  _id: { toString(): string };
  totalDebit: number;
  totalCredit: number;
};

type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles = ["super_admin", "admin_bauk", "pimpinan", "auditor"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const query = {
      endDate: searchParams.get("endDate") || "",
    };

    const validation = trialBalanceQuerySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { endDate } = validation.data;
    const end = dayjs(endDate).endOf("day").toDate();

    await dbConnect();

    // 1. Find all posted entries up to endDate
    const validEntries = await JournalEntry.find({
      date: { $lte: end },
      status: "posted",
    }).select("_id").lean();

    const validEntryIds = validEntries.map((entry) => entry._id);

    // 2. Aggregate all lines by accountId
    const aggregatedLines = await JournalLine.aggregate<AccountTotal>([
      {
        $match: {
          journalEntryId: { $in: validEntryIds },
        },
      },
      {
        $group: {
          _id: "$accountId",
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
        },
      },
    ]);

    // Create a map of account totals
    const accountTotalsMap = new Map<string, { totalDebit: number; totalCredit: number }>();
    for (const item of aggregatedLines) {
      accountTotalsMap.set(item._id.toString(), {
        totalDebit: item.totalDebit,
        totalCredit: item.totalCredit,
      });
    }

    // 3. Fetch all active accounts
    const allAccounts = await Account.find({ isActive: true }).sort({ code: 1 }).lean();

    const trialBalanceRows: TrialBalanceRow[] = [];
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    for (const acc of allAccounts) {
      const totals = accountTotalsMap.get(acc._id.toString()) || { totalDebit: 0, totalCredit: 0 };
      const { totalDebit, totalCredit } = totals;

      // Only include accounts that have mutations or existing balances
      // In a real system, you might want to show all accounts, but usually only those with >0 totals
      if (totalDebit === 0 && totalCredit === 0) {
        continue;
      }

      let debitBalance = 0;
      let creditBalance = 0;

      const net = totalDebit - totalCredit;

      if (net > 0) {
        debitBalance = net;
      } else if (net < 0) {
        creditBalance = Math.abs(net);
      }

      // Add to grand totals
      grandTotalDebit += debitBalance;
      grandTotalCredit += creditBalance;

      trialBalanceRows.push({
        accountId: acc._id.toString(),
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normalBalance: acc.normalBalance,
        totalDebit,
        totalCredit,
        debitBalance,
        creditBalance,
      });
    }

    return NextResponse.json({
      period: {
        endDate: end,
      },
      rows: trialBalanceRows,
      totals: {
        debit: grandTotalDebit,
        credit: grandTotalCredit,
      },
    });
  } catch (error: unknown) {
    console.error("Trial Balance API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
