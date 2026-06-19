"use client";

import { useState } from "react";
import { useTrialBalance } from "@/hooks/useTrialBalance";
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
import { FileSpreadsheet, Loader2, Scale } from "lucide-react";
import * as xlsx from "xlsx";
import { PageHeader } from "@/components/layout/PageHeader";

export default function TrialBalancePage() {
  const [endDate, setEndDate] = useState<string>(
    dayjs().endOf("month").format("YYYY-MM-DD")
  );

  const [appliedFilter, setAppliedFilter] = useState<{
    endDate: string;
  } | null>(null);

  const { data: tbData, isLoading: isLoadingTB } = useTrialBalance(
    appliedFilter || { endDate: "" }
  );

  const handleShow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!endDate) return;
    setAppliedFilter({ endDate });
  };

  const handleExportExcel = () => {
    if (!tbData) return;

    const { rows, totals, period } = tbData;

    const excelData = [
      ["NERACA SALDO FINARA"],
      [`Periode s.d: ${dayjs(period.endDate).format("DD/MM/YYYY")}`],
      [],
      ["Kode Akun", "Nama Akun", "Tipe", "Total Debit", "Total Kredit", "Saldo Debit", "Saldo Kredit"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...rows.map((r: any) => [
        r.code,
        r.name,
        r.type,
        r.totalDebit,
        r.totalCredit,
        r.debitBalance,
        r.creditBalance,
      ]),
      [
        "",
        "TOTAL KESELURUHAN",
        "",
        "",
        "",
        totals.debit,
        totals.credit,
      ],
    ];

    const ws = xlsx.utils.aoa_to_sheet(excelData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Neraca Saldo");

    xlsx.writeFile(
      wb,
      `NeracaSaldo_${dayjs(period.endDate).format("YYYYMMDD")}.xlsx`
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Type Translation map
  const typeMap: Record<string, string> = {
    asset: "Aset",
    liability: "Kewajiban",
    equity: "Ekuitas",
    revenue: "Pendapatan",
    expense: "Beban",
  };

  const isBalanced = tbData?.totals?.debit === tbData?.totals?.credit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader title="Neraca Saldo" description="Laporan keseimbangan total debit dan kredit per akun (Trial Balance)." />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleShow} className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="space-y-2 flex-1">
              <Label>Per Tanggal (Cut-off)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={!endDate}>
              <Scale className="mr-2 h-4 w-4" />
              Tampilkan Neraca
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoadingTB && (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {tbData && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Neraca Saldo</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Posisi per tanggal: {dayjs(tbData.period.endDate).format("DD MMMM YYYY")}
                </p>
              </div>
              <Button variant="outline" onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2} className="align-middle border-r">Kode Akun</TableHead>
                      <TableHead rowSpan={2} className="align-middle border-r">Nama Akun</TableHead>
                      <TableHead rowSpan={2} className="align-middle border-r">Tipe</TableHead>
                      <TableHead colSpan={2} className="text-center border-r border-b">Mutasi</TableHead>
                      <TableHead colSpan={2} className="text-center border-b">Saldo Akhir</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="text-right border-r">Total Debit</TableHead>
                      <TableHead className="text-right border-r">Total Kredit</TableHead>
                      <TableHead className="text-right border-r">Debit</TableHead>
                      <TableHead className="text-right">Kredit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tbData.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                          Tidak ada data jurnal yang di-posting sampai tanggal ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      tbData.rows.map((row: any) => (
                        <TableRow key={row.accountId}>
                          <TableCell className="font-medium border-r">{row.code}</TableCell>
                          <TableCell className="border-r">{row.name}</TableCell>
                          <TableCell className="border-r">{typeMap[row.type] || row.type}</TableCell>
                          <TableCell className="text-right border-r text-slate-500">
                            {row.totalDebit > 0 ? formatCurrency(row.totalDebit) : "-"}
                          </TableCell>
                          <TableCell className="text-right border-r text-slate-500">
                            {row.totalCredit > 0 ? formatCurrency(row.totalCredit) : "-"}
                          </TableCell>
                          <TableCell className="text-right border-r font-medium text-emerald-700">
                            {row.debitBalance > 0 ? formatCurrency(row.debitBalance) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-rose-700">
                            {row.creditBalance > 0 ? formatCurrency(row.creditBalance) : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {tbData.rows.length > 0 && (
                <div className={`mt-4 p-4 rounded-lg border flex flex-col md:flex-row justify-between items-center ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                  <div className="mb-2 md:mb-0">
                    <span className="font-bold text-lg">Status: </span>
                    {isBalanced ? (
                      <span className="text-emerald-600 font-bold text-lg">SEIMBANG (BALANCED)</span>
                    ) : (
                      <span className="text-rose-600 font-bold text-lg">TIDAK SEIMBANG (UNBALANCED)</span>
                    )}
                  </div>
                  <div className="flex gap-8 text-right">
                    <div>
                      <p className="text-sm text-slate-500">Total Debit</p>
                      <p className={`text-xl font-bold ${isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(tbData.totals.debit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total Kredit</p>
                      <p className={`text-xl font-bold ${isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(tbData.totals.credit)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
