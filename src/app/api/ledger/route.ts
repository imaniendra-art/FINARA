import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Account from "@/models/Account";
import JournalEntry from "@/models/JournalEntry";
import JournalLine from "@/models/JournalLine";
import { z } from "zod";
import dayjs from "dayjs";

const ledgerQuerySchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

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
      accountId: searchParams.get("accountId") || "",
      startDate: searchParams.get("startDate") || "",
      endDate: searchParams.get("endDate") || "",
    };

    const validation = ledgerQuerySchema.safeParse(query);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { accountId, startDate, endDate } = validation.data;

    await dbConnect();

    const account = await Account.findById(accountId).lean();
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const isDebitNormal = account.normalBalance === "debit";

    const start = dayjs(startDate).startOf("day").toDate();
    const end = dayjs(endDate).endOf("day").toDate();

    // 1. Calculate Initial Balance (Saldo Awal)
    // Find all posted journal entries before the start date
    const previousEntries = await JournalEntry.find({
      date: { $lt: start },
      status: "posted",
    }).select("_id").lean();

    const previousEntryIds = previousEntries.map(entry => entry._id);

    // Sum debit and credit for these previous entries on the selected account
    const previousLines = await JournalLine.aggregate([
      {
        $match: {
          accountId: account._id,
          journalEntryId: { $in: previousEntryIds },
        },
      },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
        },
      },
    ]);

    const initialDebit = previousLines[0]?.totalDebit || 0;
    const initialCredit = previousLines[0]?.totalCredit || 0;
    
    // Formula based on normal balance
    const initialBalance = isDebitNormal
      ? initialDebit - initialCredit
      : initialCredit - initialDebit;

    // 2. Fetch Mutations for the period
    const periodEntries = await JournalEntry.find({
      date: { $gte: start, $lte: end },
      status: "posted",
    }).sort({ date: 1 }).lean();

    const periodEntryIds = periodEntries.map(entry => entry._id);

    const periodLines = await JournalLine.find({
      accountId: account._id,
      journalEntryId: { $in: periodEntryIds },
    })
      .populate({
        path: "journalEntryId",
        select: "date description entryNumber sourceType",
      })
      .lean();

    // Sort lines by the populated journalEntry date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedLines = periodLines.sort((a: any, b: any) => {
      return new Date(a.journalEntryId.date).getTime() - new Date(b.journalEntryId.date).getTime();
    });

    let currentBalance = initialBalance;
    let periodTotalDebit = 0;
    let periodTotalCredit = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mutations = sortedLines.map((line: any) => {
      const debit = line.debit || 0;
      const credit = line.credit || 0;
      
      periodTotalDebit += debit;
      periodTotalCredit += credit;

      if (isDebitNormal) {
        currentBalance = currentBalance + debit - credit;
      } else {
        currentBalance = currentBalance - debit + credit;
      }

      return {
        id: line._id,
        date: line.journalEntryId.date,
        entryNumber: line.journalEntryId.entryNumber,
        description: line.description || line.journalEntryId.description,
        sourceType: line.journalEntryId.sourceType,
        debit,
        credit,
        balance: currentBalance,
      };
    });

    return NextResponse.json({
      account: {
        id: account._id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
      },
      period: {
        startDate: start,
        endDate: end,
      },
      initialBalance,
      totalDebit: periodTotalDebit,
      totalCredit: periodTotalCredit,
      endingBalance: currentBalance,
      mutations,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Ledger API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
