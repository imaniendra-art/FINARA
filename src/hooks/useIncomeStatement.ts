import { useQuery } from "@tanstack/react-query";
import type { IncomeStatementRow } from "@/app/api/reports/income-statement/route";

type IncomeStatementData = {
  period: {
    startDate: string;
    endDate: string;
  };
  revenues: IncomeStatementRow[];
  expenses: IncomeStatementRow[];
  totals: {
    totalRevenue: number;
    totalExpense: number;
    netIncome: number;
  };
};

type IncomeStatementQuery = {
  startDate: string;
  endDate: string;
};

async function fetchIncomeStatement(query: IncomeStatementQuery): Promise<IncomeStatementData> {
  const params = new URLSearchParams();
  if (query.startDate) params.append("startDate", query.startDate);
  if (query.endDate) params.append("endDate", query.endDate);

  const response = await fetch(`/api/reports/income-statement?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Gagal mengambil data laba rugi");
  }

  return response.json();
}

export function useIncomeStatement(query: IncomeStatementQuery) {
  return useQuery({
    queryKey: ["income-statement", query],
    queryFn: () => fetchIncomeStatement(query),
    enabled: !!query.startDate && !!query.endDate,
  });
}
