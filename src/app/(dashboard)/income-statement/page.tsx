"use client";

import { useState } from "react";
import { useIncomeStatement } from "@/hooks/useIncomeStatement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import dayjs from "dayjs";
import { FileSpreadsheet, Loader2, BarChart3 } from "lucide-react";
import * as xlsx from "xlsx";
import { PageHeader } from "@/components/layout/PageHeader";

export default function IncomeStatementPage() {
  const [startDate, setStartDate] = useState<string>(
    dayjs().startOf("month").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState<string>(
    dayjs().endOf("month").format("YYYY-MM-DD")
  );

  const [appliedFilter, setAppliedFilter] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);

  const { data: isData, isLoading } = useIncomeStatement(
    appliedFilter || { startDate: "", endDate: "" }
  );

  const handleShow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setAppliedFilter({ startDate, endDate });
  };

  const handleExportExcel = () => {
    if (!isData) return;

    const { revenues, expenses, totals, period } = isData;

    const excelData = [
      ["LAPORAN LABA / RUGI FINARA"],
      [`Periode: ${dayjs(period.startDate).format("DD/MM/YYYY")} - ${dayjs(period.endDate).format("DD/MM/YYYY")}`],
      [],
      ["PENDAPATAN"],
      ["Kode Akun", "Nama Akun", "Saldo"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...revenues.map((r: any) => [r.code, r.name, r.balance]),
      ["", "Total Pendapatan", totals.totalRevenue],
      [],
      ["BEBAN OPERASIONAL"],
      ["Kode Akun", "Nama Akun", "Saldo"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...expenses.map((e: any) => [e.code, e.name, e.balance]),
      ["", "Total Beban", totals.totalExpense],
      [],
      ["", "LABA / RUGI BERSIH", totals.netIncome],
    ];

    const ws = xlsx.utils.aoa_to_sheet(excelData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Laba Rugi");

    xlsx.writeFile(
      wb,
      `LabaRugi_${dayjs(period.startDate).format("YYYYMMDD")}_${dayjs(period.endDate).format("YYYYMMDD")}.xlsx`
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const isProfit = isData?.totals?.netIncome ? isData.totals.netIncome >= 0 : true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader title="Laporan Laba/Rugi" description="Laporan performa pendapatan dan beban (Income Statement) dalam periode tertentu." />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleShow} className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="space-y-2 flex-1">
              <Label>Tanggal Awal</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Tanggal Akhir</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={!startDate || !endDate}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Tampilkan Laporan
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isData && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Laporan Laba/Rugi</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Periode: {dayjs(isData.period.startDate).format("DD MMMM YYYY")} - {dayjs(isData.period.endDate).format("DD MMMM YYYY")}
                </p>
              </div>
              <Button variant="outline" onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </CardHeader>
            <CardContent>
              {/* Pendapatan Section */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
                  Pendapatan
                </h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/4 border-r">Kode Akun</TableHead>
                        <TableHead className="w-1/2 border-r">Nama Akun</TableHead>
                        <TableHead className="w-1/4 text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isData.revenues.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center h-16 text-muted-foreground">
                            Tidak ada pendapatan pada periode ini.
                          </TableCell>
                        </TableRow>
                      ) : (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        isData.revenues.map((row: any) => (
                          <TableRow key={row.accountId}>
                            <TableCell className="font-medium border-r">{row.code}</TableCell>
                            <TableCell className="border-r">{row.name}</TableCell>
                            <TableCell className="text-right font-medium text-slate-700">
                              {formatCurrency(row.balance)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      {/* Total Pendapatan Row */}
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                        <TableCell colSpan={2} className="font-bold text-right border-r">Total Pendapatan</TableCell>
                        <TableCell className="text-right font-black text-emerald-700">
                          {formatCurrency(isData.totals.totalRevenue)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Beban Section */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">
                  Beban Operasional
                </h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/4 border-r">Kode Akun</TableHead>
                        <TableHead className="w-1/2 border-r">Nama Akun</TableHead>
                        <TableHead className="w-1/4 text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isData.expenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center h-16 text-muted-foreground">
                            Tidak ada beban pada periode ini.
                          </TableCell>
                        </TableRow>
                      ) : (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        isData.expenses.map((row: any) => (
                          <TableRow key={row.accountId}>
                            <TableCell className="font-medium border-r">{row.code}</TableCell>
                            <TableCell className="border-r">{row.name}</TableCell>
                            <TableCell className="text-right font-medium text-slate-700">
                              {formatCurrency(row.balance)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      {/* Total Beban Row */}
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                        <TableCell colSpan={2} className="font-bold text-right border-r">Total Beban</TableCell>
                        <TableCell className="text-right font-black text-rose-700">
                          {formatCurrency(isData.totals.totalExpense)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Net Income Summary */}
              <div className={`mt-8 p-6 rounded-2xl border flex flex-col md:flex-row justify-between items-center shadow-sm ${isProfit ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="mb-2 md:mb-0">
                  <span className="font-bold text-lg uppercase tracking-wider text-slate-600">
                    {isProfit ? 'Laba Bersih' : 'Rugi Bersih'}
                  </span>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-black ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatCurrency(isData.totals.netIncome)}
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
