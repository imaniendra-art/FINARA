"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ReportOptions = {
  entryYears: number[];
  programStudies: string[];
  semesters: string[];
  statuses: string[];
};

type ReceivableRow = {
  id: string;
  nim: string;
  studentName: string;
  entryYear: number | null;
  programStudy: string;
  feeTypeName: string;
  academicYear: string;
  semester: string;
  status: string;
  dueDate: string;
  totalBill: number;
  paidAmount: number;
  remainingAmount: number;
};

type PaymentRow = {
  id: string;
  paymentNumber: string;
  receiptNumber: string;
  nim: string;
  studentName: string;
  entryYear: number | null;
  programStudy: string;
  academicYear: string;
  semester: string;
  billStatus: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
};

type ReceivablesResponse = {
  rows: ReceivableRow[];
  totals: {
    totalBill: number;
    paidAmount: number;
    remainingAmount: number;
  };
};

type PaymentsResponse = {
  rows: PaymentRow[];
  totals: {
    totalPayment: number;
  };
};

type Filters = {
  entryYear: string;
  programStudy: string;
  semester: string;
  status: string;
};

async function fetchJson<T>(url: string) {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Laporan gagal dimuat.");
  }

  return data as T;
}

function buildQuery(filters: Filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function exportExcel(filename: string, sheetName: string, rows: Record<string, string | number | null>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

const billStatusLabels: Record<string, string> = {
  unpaid: "Belum Lunas",
  partial: "Dicicil",
  paid: "Lunas",
  cancelled: "Dibatalkan",
  belum_lunas: "Belum Lunas",
};

export function ReportsClient() {
  const [filters, setFilters] = useState<Filters>({
    entryYear: "",
    programStudy: "",
    semester: "",
    status: "",
  });
  const [receivablesCurrentPage, setReceivablesCurrentPage] = useState(1);
  const [receivablesRowsPerPage, setReceivablesRowsPerPage] = useState(10);
  const [paymentsCurrentPage, setPaymentsCurrentPage] = useState(1);
  const [paymentsRowsPerPage, setPaymentsRowsPerPage] = useState(10);

  const query = useMemo(() => buildQuery(filters), [filters]);
  const optionsQuery = useQuery({
    queryKey: ["report-options"],
    queryFn: () => fetchJson<ReportOptions>("/api/reports/options"),
  });
  const receivablesQuery = useQuery({
    queryKey: ["receivables-report", filters],
    queryFn: () => fetchJson<ReceivablesResponse>(`/api/reports/receivables${query}`),
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments-report", filters],
    queryFn: () => fetchJson<PaymentsResponse>(`/api/reports/payments${query}`),
  });

  const paginatedReceivables = useMemo(() => {
    const rows = receivablesQuery.data?.rows || [];
    const start = (receivablesCurrentPage - 1) * receivablesRowsPerPage;
    const end = start + receivablesRowsPerPage;
    return rows.slice(start, end);
  }, [receivablesQuery.data?.rows, receivablesCurrentPage, receivablesRowsPerPage]);

  const receivablesTotalPages = Math.ceil((receivablesQuery.data?.rows.length || 0) / receivablesRowsPerPage) || 1;

  const getReceivablesPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (receivablesTotalPages <= maxVisible) {
      for (let i = 1; i <= receivablesTotalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, receivablesCurrentPage - 2);
      let end = Math.min(receivablesTotalPages, receivablesCurrentPage + 2);
      if (start === 1) {
        end = 5;
      } else if (end === receivablesTotalPages) {
        start = receivablesTotalPages - 4;
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const paginatedPayments = useMemo(() => {
    const rows = paymentsQuery.data?.rows || [];
    const start = (paymentsCurrentPage - 1) * paymentsRowsPerPage;
    const end = start + paymentsRowsPerPage;
    return rows.slice(start, end);
  }, [paymentsQuery.data?.rows, paymentsCurrentPage, paymentsRowsPerPage]);

  const paymentsTotalPages = Math.ceil((paymentsQuery.data?.rows.length || 0) / paymentsRowsPerPage) || 1;

  const getPaymentsPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (paymentsTotalPages <= maxVisible) {
      for (let i = 1; i <= paymentsTotalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, paymentsCurrentPage - 2);
      let end = Math.min(paymentsTotalPages, paymentsCurrentPage + 2);
      if (start === 1) {
        end = 5;
      } else if (end === paymentsTotalPages) {
        start = paymentsTotalPages - 4;
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  useEffect(() => {
    setReceivablesCurrentPage(1);
    setPaymentsCurrentPage(1);
  }, [filters, receivablesRowsPerPage, paymentsRowsPerPage]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const exportReceivables = () => {
    exportExcel(
      "laporan-piutang-mahasiswa.xlsx",
      "Piutang Mahasiswa",
      (receivablesQuery.data?.rows || []).map((row) => ({
        NIM: row.nim,
        Mahasiswa: row.studentName,
        Angkatan: row.entryYear,
        Prodi: row.programStudy,
        Tagihan: row.feeTypeName,
        Tahun: row.academicYear,
        Semester: row.semester,
        Status: billStatusLabels[row.status] || row.status,
        "Jatuh Tempo": new Date(row.dueDate).toLocaleDateString("id-ID"),
        "Total Tagihan": row.totalBill,
        Terbayar: row.paidAmount,
        Sisa: row.remainingAmount,
      }))
    );
  };

  const exportPayments = () => {
    exportExcel(
      "laporan-pembayaran-mahasiswa.xlsx",
      "Pembayaran Mahasiswa",
      (paymentsQuery.data?.rows || []).map((row) => ({
        "No. Pembayaran": row.paymentNumber,
        Kuitansi: row.receiptNumber,
        NIM: row.nim,
        Mahasiswa: row.studentName,
        Angkatan: row.entryYear,
        Prodi: row.programStudy,
        Tahun: row.academicYear,
        Semester: row.semester,
        "Status Tagihan": billStatusLabels[row.billStatus] || row.billStatus,
        Tanggal: new Date(row.paymentDate).toLocaleDateString("id-ID"),
        Metode: row.paymentMethod.replace("_", " "),
        Nominal: row.amount,
      }))
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan Tagihan & Piutang Mahasiswa" description="Pantau performa pembayaran dan sisa piutang mahasiswa (Accounts Receivable)." />

      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Angkatan</label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={filters.entryYear}
                onChange={(event) => updateFilter("entryYear", event.target.value)}
              >
                <option value="">Semua</option>
                {optionsQuery.data?.entryYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prodi</label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={filters.programStudy}
                onChange={(event) => updateFilter("programStudy", event.target.value)}
              >
                <option value="">Semua</option>
                {optionsQuery.data?.programStudies.map((programStudy) => (
                  <option key={programStudy} value={programStudy}>
                    {programStudy}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Semester</label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={filters.semester}
                onChange={(event) => updateFilter("semester", event.target.value)}
              >
                <option value="">Semua</option>
                {optionsQuery.data?.semesters.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
              >
                <option value="">Semua Status</option>
                <option value="belum_lunas">Belum Lunas</option>
                {optionsQuery.data?.statuses.map((status) => (
                  <option key={status} value={status}>
                    {billStatusLabels[status] || status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Tagihan</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(receivablesQuery.data?.totals.totalBill || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Terbayar</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(receivablesQuery.data?.totals.paidAmount || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Sisa</p>
            <p className="mt-1 text-2xl font-bold text-orange-500">{formatCurrency(receivablesQuery.data?.totals.remainingAmount || 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Laporan Piutang Mahasiswa</CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Tampilkan:</span>
                <select
                  value={receivablesRowsPerPage}
                  onChange={(e) => setReceivablesRowsPerPage(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={exportReceivables} disabled={!receivablesQuery.data?.rows.length}>
                <Download className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {receivablesQuery.isLoading && <p className="text-sm text-slate-500">Memuat laporan piutang...</p>}
          {receivablesQuery.error && <p className="text-sm text-red-600">{receivablesQuery.error.message}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Mahasiswa</th>
                  <th className="py-2 pr-4 font-medium">Angkatan</th>
                  <th className="py-2 pr-4 font-medium">Prodi</th>
                  <th className="py-2 pr-4 font-medium">Tagihan</th>
                  <th className="py-2 pr-4 font-medium">Semester</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Terbayar</th>
                  <th className="py-2 pr-4 font-medium">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReceivables.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pr-4">{row.nim} - {row.studentName}</td>
                    <td className="py-3 pr-4">{row.entryYear || "-"}</td>
                    <td className="py-3 pr-4">{row.programStudy}</td>
                    <td className="py-3 pr-4">{row.feeTypeName}</td>
                    <td className="py-3 pr-4">{row.semester}</td>
                    <td className="py-3 pr-4">{billStatusLabels[row.status] || row.status}</td>
                    <td className="py-3 pr-4">{formatCurrency(row.totalBill)}</td>
                    <td className="py-3 pr-4">{formatCurrency(row.paidAmount)}</td>
                    <td className="py-3 pr-4">{formatCurrency(row.remainingAmount)}</td>
                  </tr>
                ))}
                {paginatedReceivables.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-500">
                      Tidak ada data piutang yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!receivablesQuery.isLoading && !receivablesQuery.error && (receivablesQuery.data?.rows.length || 0) > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
              <div className="text-xs text-slate-500">
                Menampilkan <strong>{((receivablesCurrentPage - 1) * receivablesRowsPerPage) + 1}</strong> -{" "}
                <strong>{Math.min(receivablesCurrentPage * receivablesRowsPerPage, receivablesQuery.data?.rows.length || 0)}</strong> dari{" "}
                <strong>{receivablesQuery.data?.rows.length}</strong> entri
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReceivablesCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={receivablesCurrentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {getReceivablesPageNumbers().map((page) => {
                  const isActive = page === receivablesCurrentPage;
                  return (
                    <Button
                      key={page}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReceivablesCurrentPage(page)}
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
                  onClick={() => setReceivablesCurrentPage((prev) => Math.min(receivablesTotalPages, prev + 1))}
                  disabled={receivablesCurrentPage === receivablesTotalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Laporan Pembayaran</CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Tampilkan:</span>
                <select
                  value={paymentsRowsPerPage}
                  onChange={(e) => setPaymentsRowsPerPage(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={exportPayments} disabled={!paymentsQuery.data?.rows.length}>
                <Download className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">Total Pembayaran</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(paymentsQuery.data?.totals.totalPayment || 0)}</p>
          </div>
          {paymentsQuery.isLoading && <p className="text-sm text-slate-500">Memuat laporan pembayaran...</p>}
          {paymentsQuery.error && <p className="text-sm text-red-600">{paymentsQuery.error.message}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Tanggal</th>
                  <th className="py-2 pr-4 font-medium">Kuitansi</th>
                  <th className="py-2 pr-4 font-medium">Mahasiswa</th>
                  <th className="py-2 pr-4 font-medium">Prodi</th>
                  <th className="py-2 pr-4 font-medium">Semester</th>
                  <th className="py-2 pr-4 font-medium">Metode</th>
                  <th className="py-2 pr-4 font-medium">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pr-4">{new Date(row.paymentDate).toLocaleDateString("id-ID")}</td>
                    <td className="py-3 pr-4">{row.receiptNumber}</td>
                    <td className="py-3 pr-4">{row.nim} - {row.studentName}</td>
                    <td className="py-3 pr-4">{row.programStudy}</td>
                    <td className="py-3 pr-4">{row.semester}</td>
                    <td className="py-3 pr-4 capitalize">{row.paymentMethod.replace("_", " ")}</td>
                    <td className="py-3 pr-4">{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
                {paginatedPayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      Tidak ada data pembayaran yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!paymentsQuery.isLoading && !paymentsQuery.error && (paymentsQuery.data?.rows.length || 0) > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
              <div className="text-xs text-slate-500">
                Menampilkan <strong>{((paymentsCurrentPage - 1) * paymentsRowsPerPage) + 1}</strong> -{" "}
                <strong>{Math.min(paymentsCurrentPage * paymentsRowsPerPage, paymentsQuery.data?.rows.length || 0)}</strong> dari{" "}
                <strong>{paymentsQuery.data?.rows.length}</strong> entri
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentsCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={paymentsCurrentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {getPaymentsPageNumbers().map((page) => {
                  const isActive = page === paymentsCurrentPage;
                  return (
                    <Button
                      key={page}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentsCurrentPage(page)}
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
                  onClick={() => setPaymentsCurrentPage((prev) => Math.min(paymentsTotalPages, prev + 1))}
                  disabled={paymentsCurrentPage === paymentsTotalPages}
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
  );
}
