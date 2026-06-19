"use client";

import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAccounts } from "@/hooks/useAccounts";
import { useLedger } from "@/hooks/useLedger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import dayjs from "dayjs";
import { FileSpreadsheet, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import * as xlsx from "xlsx";

export default function LedgerPage() {
  const [accountId, setAccountId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(
    dayjs().startOf("month").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState<string>(
    dayjs().endOf("month").format("YYYY-MM-DD")
  );

  const [appliedFilters, setAppliedFilters] = useState<{
    accountId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data: accountsData, isLoading: isLoadingAccounts } = useAccounts();
  const { data: ledgerData, isLoading: isLoadingLedger } = useLedger(
    appliedFilters || { accountId: "", startDate: "", endDate: "" }
  );

  const accounts = accountsData?.accounts || [];

  const paginatedMutations = useMemo(() => {
    const mutations = ledgerData?.mutations || [];
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return mutations.slice(start, end);
  }, [ledgerData?.mutations, currentPage, rowsPerPage]);

  const totalPages = Math.ceil((ledgerData?.mutations.length || 0) / rowsPerPage) || 1;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      if (start === 1) {
        end = 5;
      } else if (end === totalPages) {
        start = totalPages - 4;
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters, rowsPerPage]);

  const handleShow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !startDate || !endDate) return;
    setAppliedFilters({ accountId, startDate, endDate });
  };

  const handleExportExcel = () => {
    if (!ledgerData) return;

    const { account, initialBalance, mutations, endingBalance, totalDebit, totalCredit } = ledgerData;

    const excelData = [
      ["BUKU BESAR FINARA"],
      [`Akun: ${account.code} - ${account.name}`],
      [`Periode: ${dayjs(appliedFilters?.startDate).format("DD/MM/YYYY")} - ${dayjs(appliedFilters?.endDate).format("DD/MM/YYYY")}`],
      [],
      ["Tanggal", "No. Jurnal", "Keterangan", "Sumber", "Debit", "Kredit", "Saldo"],
      [
        "",
        "",
        "Saldo Awal",
        "",
        "",
        "",
        initialBalance,
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...mutations.map((m: any) => [
        dayjs(m.date).format("DD/MM/YYYY"),
        m.entryNumber,
        m.description,
        m.sourceType,
        m.debit,
        m.credit,
        m.balance,
      ]),
      [
        "",
        "",
        "Total & Saldo Akhir",
        "",
        totalDebit,
        totalCredit,
        endingBalance,
      ],
    ];

    const ws = xlsx.utils.aoa_to_sheet(excelData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Buku Besar");

    xlsx.writeFile(
      wb,
      `BukuBesar_${account.code}_${dayjs(appliedFilters?.startDate).format("YYYYMMDD")}_${dayjs(appliedFilters?.endDate).format("YYYYMMDD")}.xlsx`
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Buku Besar" description="Laporan rincian mutasi debit dan kredit per akun (Ledger)." />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleShow} className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="space-y-2 flex-1">
              <Label>Akun</Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={isLoadingAccounts}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun..." />
                </SelectTrigger>
                <SelectContent>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc._id} value={acc._id}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button type="submit" disabled={!accountId || !startDate || !endDate}>
              Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoadingLedger && (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {ledgerData && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Awal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(ledgerData.initialBalance)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600">Total Debit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(ledgerData.totalDebit)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-rose-600">Total Kredit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">{formatCurrency(ledgerData.totalCredit)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">Saldo Akhir</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(ledgerData.endingBalance)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Mutasi Akun</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Akun: {ledgerData.account.code} - {ledgerData.account.name} (Saldo Normal: <span className="capitalize">{ledgerData.account.normalBalance}</span>)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Tampilkan:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleExportExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>No. Jurnal</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Kredit</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPage === 1 && (
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={3} className="font-medium">
                          Saldo Awal per {dayjs(appliedFilters?.startDate).format("DD/MM/YYYY")}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(ledgerData.initialBalance)}
                        </TableCell>
                      </TableRow>
                    )}
                    {ledgerData.mutations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                          Tidak ada transaksi pada periode ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      paginatedMutations.map((m: any) => (
                        <TableRow key={m.id}>
                          <TableCell>{dayjs(m.date).format("DD/MM/YYYY")}</TableCell>
                          <TableCell>{m.entryNumber}</TableCell>
                          <TableCell>{m.description}</TableCell>
                          <TableCell className="text-right text-emerald-600">
                            {m.debit > 0 ? formatCurrency(m.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-rose-600">
                            {m.credit > 0 ? formatCurrency(m.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(m.balance)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {ledgerData.mutations.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
                  <div className="text-xs text-slate-500">
                    Menampilkan <strong>{((currentPage - 1) * rowsPerPage) + 1}</strong> -{" "}
                    <strong>{Math.min(currentPage * rowsPerPage, ledgerData.mutations.length)}</strong> dari{" "}
                    <strong>{ledgerData.mutations.length}</strong> entri
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {getPageNumbers().map((page) => {
                      const isActive = page === currentPage;
                      return (
                        <Button
                          key={page}
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 p-0 text-xs ${
                            isActive ? "bg-indigo-600 hover:bg-indigo-700 text-white font-medium animate-fade-in" : ""
                          }`}
                        >
                          {page}
                        </Button>
                      );
                    })}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
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
