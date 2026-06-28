import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Account from "@/models/Account";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";
import { z } from "zod";
import dayjs from "dayjs";

const incomeStatementQuerySchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type AccountTotal = {
  _id: { toString(): string };
  totalDebit: number;
  totalCredit: number;
};

export type IncomeStatementRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
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
      startDate: searchParams.get("startDate") || "",
      endDate: searchParams.get("endDate") || "",
    };

    const validation = incomeStatementQuerySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { startDate, endDate } = validation.data;
    const start = dayjs(startDate).startOf("day").toDate();
    const end = dayjs(endDate).endOf("day").toDate();

    await dbConnect();

    // 1. Fetch only Revenue and Expense accounts
    const targetAccounts = await Account.find({
      type: { $in: ["revenue", "expense"] },
      isActive: true,
    }).sort({ code: 1 }).lean();

    const targetAccountIds = targetAccounts.map(acc => acc._id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountMap = new Map<string, any>(
      targetAccounts.map(acc => [acc._id.toString(), acc])
    );

    // 2. Find all posted entries in the selected date range
    const validEntries = await JournalEntry.find({
      date: { $gte: start, $lte: end },
      status: "posted",
    }).select("_id").lean();

    const validEntryIds = validEntries.map((entry) => entry._id);

    // 3. Aggregate lines for these accounts in these entries
    const aggregatedLines = await JournalLine.aggregate<AccountTotal>([
      {
        $match: {
          journalEntryId: { $in: validEntryIds },
          accountId: { $in: targetAccountIds },
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

    const revenues: IncomeStatementRow[] = [];
    const expenses: IncomeStatementRow[] = [];

    let totalRevenue = 0;
    let totalExpense = 0;

    for (const acc of targetAccounts) {
      const totals = accountTotalsMap.get(acc._id.toString()) || { totalDebit: 0, totalCredit: 0 };
      const { totalDebit, totalCredit } = totals;

      if (totalDebit === 0 && totalCredit === 0) {
        // Skip accounts with zero mutations for cleaner reports
        continue;
      }

      if (acc.type === "revenue") {
        // Revenue normal balance is Credit
        const balance = totalCredit - totalDebit;
        revenues.push({
          accountId: acc._id.toString(),
          code: acc.code,
          name: acc.name,
          type: acc.type,
          totalDebit,
          totalCredit,
          balance,
        });
        totalRevenue += balance;
      } else if (acc.type === "expense") {
        // Expense normal balance is Debit
        const balance = totalDebit - totalCredit;
        expenses.push({
          accountId: acc._id.toString(),
          code: acc.code,
          name: acc.name,
          type: acc.type,
          totalDebit,
          totalCredit,
          balance,
        });
        totalExpense += balance;
      }
    }

    const netIncome = totalRevenue - totalExpense;

    return NextResponse.json({
      period: {
        startDate: start,
        endDate: end,
      },
      revenues,
      expenses,
      totals: {
        totalRevenue,
        totalExpense,
        netIncome,
      },
    });
  } catch (error: unknown) {
    console.error("Income Statement API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
