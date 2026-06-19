import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { financeReadRoles, requireApiRole } from "@/lib/api-auth";
import CashTransaction from "@/models/CashTransaction";
import Payment from "@/models/Payment";
import Student from "@/models/Student";
import StudentBill from "@/models/StudentBill";
import "@/models/FeeType";
import Account from "@/models/Account";

export const dynamic = "force-dynamic";

type AmountTotal = {
  _id: null;
  total: number;
  count: number;
};

type MonthlyTotal = {
  _id: {
    year: number;
    month: number;
  };
  total: number;
};

type AccountBalanceTotal = {
  _id: unknown;
  total: number;
};

type AccountSnapshot = {
  _id: unknown;
  code?: string;
  name?: string;
};

type ReceivableStatusTotal = {
  _id: "unpaid" | "partial";
  total: number;
  count: number;
};

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  return { start, end };
}

function lastMonthBuckets(count: number) {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    return {
      year,
      month,
      label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date),
      key: `${year}-${String(month).padStart(2, "0")}`,
      income: 0,
      expense: 0,
    };
  });
}

function byMonthKey(total: MonthlyTotal) {
  return `${total._id.year}-${String(total._id.month).padStart(2, "0")}`;
}

function isPettyCashAccount(account?: AccountSnapshot) {
  const label = `${account?.code ?? ""} ${account?.name ?? ""}`.toLowerCase();
  return /kas kecil|petty|cash|tunai/.test(label) && !/bank|bca|bni|bri|mandiri|btn|qris/.test(label);
}

export async function GET() {
  const auth = await requireApiRole(financeReadRoles);
  if (auth.response) {
    return auth.response;
  }

  await dbConnect();

  const { start: monthStart, end: monthEnd } = monthRange();
  const buckets = lastMonthBuckets(6);
  const chartStart = new Date(buckets[0].year, buckets[0].month - 1, 1);
  const chartEnd = new Date(buckets[buckets.length - 1].year, buckets[buckets.length - 1].month, 1);

  const [
    paymentTotal,
    cashInTotal,
    cashOutTotal,
    monthlyPaymentTotals,
    monthlyCashInTotals,
    monthlyCashOutTotals,
    receivableTotals,
    receivableByStatus,
    unpaidBillCount,
    monthPaymentTotal,
    activeStudentCount,
    latestPayments,
    dueBills,
    latestExpenses,
    paymentByCashAccount,
    cashInByCashAccount,
    cashOutByCashAccount,
  ] = await Promise.all([
    Payment.aggregate<AmountTotal>([
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    CashTransaction.aggregate<AmountTotal>([
      { $match: { status: "posted", type: "cash_in" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    CashTransaction.aggregate<AmountTotal>([
      { $match: { status: "posted", type: "cash_out" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate<MonthlyTotal>([
      { $match: { paymentDate: { $gte: chartStart, $lt: chartEnd } } },
      {
        $group: {
          _id: { year: { $year: "$paymentDate" }, month: { $month: "$paymentDate" } },
          total: { $sum: "$amount" },
        },
      },
    ]),
    CashTransaction.aggregate<MonthlyTotal>([
      { $match: { date: { $gte: chartStart, $lt: chartEnd }, status: "posted", type: "cash_in" } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          total: { $sum: "$amount" },
        },
      },
    ]),
    CashTransaction.aggregate<MonthlyTotal>([
      { $match: { date: { $gte: chartStart, $lt: chartEnd }, status: "posted", type: "cash_out" } },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          total: { $sum: "$amount" },
        },
      },
    ]),
    StudentBill.aggregate<AmountTotal>([
      { $match: { status: { $in: ["unpaid", "partial"] } } },
      { $group: { _id: null, total: { $sum: "$remainingAmount" }, count: { $sum: 1 } } },
    ]),
    StudentBill.aggregate<ReceivableStatusTotal>([
      { $match: { status: { $in: ["unpaid", "partial"] } } },
      { $group: { _id: "$status", total: { $sum: "$remainingAmount" }, count: { $sum: 1 } } },
    ]),
    StudentBill.countDocuments({ status: { $in: ["unpaid", "partial"] } }),
    Payment.aggregate<AmountTotal>([
      { $match: { paymentDate: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Student.countDocuments({ status: "active" }),
    Payment.find({})
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(5)
      .populate("studentId", "nim name")
      .lean(),
    StudentBill.find({ status: { $in: ["unpaid", "partial"] } })
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(5)
      .populate("studentId", "nim name")
      .populate("feeTypeId", "name")
      .lean(),
    CashTransaction.find({ status: "posted", type: "cash_out" })
      .sort({ date: -1, createdAt: -1 })
      .limit(5)
      .populate("accountId", "code name")
      .populate("cashOrBankAccountId", "code name")
      .lean(),
    Payment.aggregate<AccountBalanceTotal>([
      { $group: { _id: "$cashOrBankAccountId", total: { $sum: "$amount" } } },
    ]),
    CashTransaction.aggregate<AccountBalanceTotal>([
      { $match: { status: "posted", type: "cash_in" } },
      { $group: { _id: "$cashOrBankAccountId", total: { $sum: "$amount" } } },
    ]),
    CashTransaction.aggregate<AccountBalanceTotal>([
      { $match: { status: "posted", type: "cash_out" } },
      { $group: { _id: "$cashOrBankAccountId", total: { $sum: "$amount" } } },
    ]),
  ]);

  const paymentTotalValue = paymentTotal[0]?.total ?? 0;
  const cashInTotalValue = cashInTotal[0]?.total ?? 0;
  const cashOutTotalValue = cashOutTotal[0]?.total ?? 0;
  const monthlyCashInMap = new Map(monthlyCashInTotals.map((total) => [byMonthKey(total), total.total]));
  const monthlyPaymentMap = new Map(monthlyPaymentTotals.map((total) => [byMonthKey(total), total.total]));
  const monthlyCashOutMap = new Map(monthlyCashOutTotals.map((total) => [byMonthKey(total), total.total]));
  const monthly = buckets.map((bucket) => ({
    ...bucket,
    income: (monthlyPaymentMap.get(bucket.key) ?? 0) + (monthlyCashInMap.get(bucket.key) ?? 0),
    expense: monthlyCashOutMap.get(bucket.key) ?? 0,
  }));
  const receivableMap = new Map(receivableByStatus.map((item) => [item._id, item]));
  const monthPayment = monthPaymentTotal[0] ?? { total: 0, count: 0 };
  const balancesByAccount = new Map<string, number>();

  for (const item of paymentByCashAccount) {
    balancesByAccount.set(String(item._id), (balancesByAccount.get(String(item._id)) ?? 0) + item.total);
  }

  for (const item of cashInByCashAccount) {
    balancesByAccount.set(String(item._id), (balancesByAccount.get(String(item._id)) ?? 0) + item.total);
  }

  for (const item of cashOutByCashAccount) {
    balancesByAccount.set(String(item._id), (balancesByAccount.get(String(item._id)) ?? 0) - item.total);
  }

  const balanceAccounts = await Account.find({ _id: { $in: [...balancesByAccount.keys()] } })
    .select("code name")
    .lean<AccountSnapshot[]>();
  const accountMap = new Map(balanceAccounts.map((account) => [String(account._id), account]));
  let pettyCashBalance = 0;

  for (const [accountId, balance] of balancesByAccount) {
    if (isPettyCashAccount(accountMap.get(accountId))) {
      pettyCashBalance += balance;
    }
  }

  const totalCashBank = paymentTotalValue + cashInTotalValue - cashOutTotalValue;
  const bankBalance = totalCashBank - pettyCashBalance;

  const responseObj = NextResponse.json({
    summary: {
      totalCashBank,
      bankBalance,
      pettyCashBalance,
      monthIncome:
        monthPayment.total +
        (await CashTransaction.aggregate<AmountTotal>([
          { $match: { date: { $gte: monthStart, $lt: monthEnd }, status: "posted", type: "cash_in" } },
          { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]).then((items) => items[0]?.total ?? 0)),
      monthExpense:
        (await CashTransaction.aggregate<AmountTotal>([
          { $match: { date: { $gte: monthStart, $lt: monthEnd }, status: "posted", type: "cash_out" } },
          { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]).then((items) => items[0]?.total ?? 0)),
      totalReceivable: receivableTotals[0]?.total ?? 0,
      unpaidBillCount,
      monthPaymentCount: monthPayment.count,
      monthPaymentAmount: monthPayment.total,
      activeStudentCount,
    },
    charts: {
      monthly,
      receivablesByStatus: [
        {
          status: "unpaid",
          total: receivableMap.get("unpaid")?.total ?? 0,
          count: receivableMap.get("unpaid")?.count ?? 0,
        },
        {
          status: "partial",
          total: receivableMap.get("partial")?.total ?? 0,
          count: receivableMap.get("partial")?.count ?? 0,
        },
      ],
    },
    lists: {
      latestPayments,
      dueBills,
      latestExpenses,
    },
  });

  responseObj.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return responseObj;
}
