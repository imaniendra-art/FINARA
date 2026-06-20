"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FileText, Loader2, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const paymentFormSchema = z.object({
  billId: z.string().min(1, "Tagihan wajib dipilih"),
  paymentDate: z.string().min(1, "Tanggal pembayaran wajib diisi"),
  amount: z.coerce.number().positive("Nominal pembayaran harus lebih besar dari nol"),
  paymentMethod: z.enum(["cash", "bank_transfer", "qris", "other"]),
  cashOrBankAccountId: z.string().min(1, "Akun kas/bank wajib dipilih"),
  notes: z.string().optional(),
});

type PaymentFormInput = z.input<typeof paymentFormSchema>;
type PaymentFormValues = z.output<typeof paymentFormSchema>;

type AccountOption = {
  _id: string;
  code: string;
  name: string;
};

type BillOption = {
  _id: string;
  studentId?: {
    nim: string;
    name: string;
  };
  feeTypeId?: {
    name: string;
  };
  academicYear: string;
  semester: string;
  remainingAmount: number;
};

type KipBillOption = {
  _id: string;
  studentId?: {
    _id: string;
    nim: string;
    name: string;
    entryYear: number;
    programStudy: string;
  };
  feeTypeId?: {
    _id: string;
    name: string;
  };
  semester: string;
  remainingAmount: number;
};

type PaymentRow = {
  _id: string;
  paymentNumber: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  studentId?: {
    nim: string;
    name: string;
  };
};

type PaymentsResponse = {
  payments: PaymentRow[];
  bills: BillOption[];
  accounts: AccountOption[];
};

async function fetchPayments() {
  const response = await fetch("/api/payments");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat pembayaran.");
  }

  return data as PaymentsResponse;
}

async function createPayment(values: PaymentFormValues) {
  const response = await fetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Pembayaran gagal diproses.");
  }

  return data;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
  const [batchEntryYear, setBatchEntryYear] = useState("");
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [batchCashOrBankAccountId, setBatchCashOrBankAccountId] = useState("");
  const [batchPaymentDate, setBatchPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchPaymentMethod, setBatchPaymentMethod] = useState("bank_transfer");
  const [batchNotes, setBatchNotes] = useState("");
  const [billSearch, setBillSearch] = useState("");
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payments"],
    queryFn: fetchPayments,
  });

  const filteredPayments = useMemo(() => {
    if (!data?.payments) return [];
    const search = paymentSearchTerm.toLowerCase().trim();
    if (!search) return data.payments;
    return data.payments.filter((payment) => {
      const studentName = payment.studentId?.name?.toLowerCase() || "";
      const studentNim = payment.studentId?.nim?.toLowerCase() || "";
      const paymentNum = payment.paymentNumber?.toLowerCase() || "";
      const receiptNum = payment.receiptNumber?.toLowerCase() || "";
      return (
        studentName.includes(search) ||
        studentNim.includes(search) ||
        paymentNum.includes(search) ||
        receiptNum.includes(search)
      );
    });
  }, [data?.payments, paymentSearchTerm]);

  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredPayments.slice(start, end);
  }, [filteredPayments, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredPayments.length / rowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [paymentSearchTerm, rowsPerPage]);

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

  const filteredBills = useMemo(() => {
    if (!data?.bills) return [];
    const search = billSearch.toLowerCase().trim();
    if (!search) return data.bills;
    return data.bills.filter(
      (b) =>
        b.studentId?.nim.toLowerCase().includes(search) ||
        b.studentId?.name.toLowerCase().includes(search) ||
        b.feeTypeId?.name.toLowerCase().includes(search)
    );
  }, [data, billSearch]);

  const kipBillsQuery = useQuery({
    queryKey: ["kip-bills", batchEntryYear],
    queryFn: async () => {
      if (!batchEntryYear) return { bills: [] as KipBillOption[] };
      const response = await fetch(`/api/payments/kip-bills?entryYear=${batchEntryYear}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal memuat tagihan KIP.");
      }
      return data as { bills: KipBillOption[] };
    },
    enabled: !!batchEntryYear,
  });

  const batchMutation = useMutation({
    mutationFn: async (values: {
      billIds: string[];
      paymentDate: string;
      paymentMethod: string;
      cashOrBankAccountId: string;
      notes?: string;
    }) => {
      const response = await fetch("/api/payments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal memproses pembayaran massal.");
      }
      return data;
    },
    onSuccess: async () => {
      setSelectedBillIds([]);
      setBatchEntryYear("");
      setBatchNotes("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["bills"] }),
        queryClient.invalidateQueries({ queryKey: ["kip-bills"] }),
      ]);
    },
  });

  const form = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      billId: "",
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      paymentMethod: "cash",
      cashOrBankAccountId: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: createPayment,
    onSuccess: async () => {
      form.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
        queryClient.invalidateQueries({ queryKey: ["bills"] }),
      ]);
    },
  });

  const handleEntryYearChange = (year: string) => {
    setBatchEntryYear(year);
    setSelectedBillIds([]);
    if (year) {
      setBatchNotes(`Pembayaran Massal KIP Angkatan ${year}`);
    } else {
      setBatchNotes("");
    }
  };

  const billsList = kipBillsQuery.data?.bills || [];
  const isAllSelected = billsList.length > 0 && selectedBillIds.length === billsList.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(billsList.map((bill) => bill._id));
    }
  };

  const handleSelectToggle = (id: string) => {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalBatchAmount = useMemo(() => {
    const bills = kipBillsQuery.data?.bills || [];
    return bills
      .filter((bill) => selectedBillIds.includes(bill._id))
      .reduce((sum, bill) => sum + bill.remainingAmount, 0);
  }, [kipBillsQuery.data?.bills, selectedBillIds]);

  return (
    <div className="space-y-6">
      <PageHeader title="Pembayaran Mahasiswa" description="Catat pembayaran dan buat jurnal otomatis." />

      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("single")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "single"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300"
          }`}
        >
          Pembayaran Tunggal
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("batch")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "batch"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-300"
          }`}
        >
          Pembayaran KIP Massal
        </button>
      </div>

      {activeTab === "single" ? (
        <Card>
          <CardHeader>
            <CardTitle>Catat Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid gap-4 md:grid-cols-4">
                <FormField
                  control={form.control}
                  name="billId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tagihan</FormLabel>
                      <div className="space-y-1.5">
                        <Input
                          type="text"
                          placeholder="Cari NIM, Nama, atau Jenis..."
                          value={billSearch}
                          onChange={(e) => setBillSearch(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <FormControl>
                          <select
                            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                            {...field}
                            onChange={(event) => {
                              field.onChange(event);
                              const bill = data?.bills.find((item) => item._id === event.target.value);
                              if (bill) {
                                form.setValue("amount", bill.remainingAmount);
                              }
                            }}
                          >
                            <option value="">Pilih tagihan ({filteredBills.length} ditemukan)</option>
                            {filteredBills.map((bill) => (
                              <option key={bill._id} value={bill._id}>
                                {bill.studentId?.nim ? `${bill.studentId.nim} - ` : ""}{bill.studentId?.name || "-"} - {bill.feeTypeId?.name || "-"} - {formatCurrency(bill.remainingAmount)}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cashOrBankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Akun Kas/Bank</FormLabel>
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          <option value="">Pilih akun</option>
                          {data?.accounts.map((account) => (
                            <option key={account._id} value={account._id}>
                              {account.code} - {account.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metode</FormLabel>
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="qris">QRIS</option>
                          <option value="other">Lainnya</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nominal</FormLabel>
                      <FormControl>
                        <Input
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={String(field.value ?? "")}
                          onChange={(event) => field.onChange(event.target.value)}
                          type="number"
                          min="1"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button type="submit" disabled={mutation.isPending} className="w-full">
                    {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    Simpan
                  </Button>
                </div>
                {mutation.error && (
                  <div className="md:col-span-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    {mutation.error.message}
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pembayaran Massal Mahasiswa KIP</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (selectedBillIds.length === 0) return;
                if (!batchCashOrBankAccountId) return;
                batchMutation.mutate({
                  billIds: selectedBillIds,
                  paymentDate: batchPaymentDate,
                  paymentMethod: batchPaymentMethod,
                  cashOrBankAccountId: batchCashOrBankAccountId,
                  notes: batchNotes,
                });
              }}
              className="space-y-6"
            >
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Angkatan Mahasiswa KIP</label>
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    value={batchEntryYear}
                    onChange={(event) => handleEntryYearChange(event.target.value)}
                  >
                    <option value="">Pilih angkatan</option>
                    <option value="2022">Angkatan 2022</option>
                    <option value="2023">Angkatan 2023</option>
                    <option value="2024">Angkatan 2024</option>
                    <option value="2025">Angkatan 2025</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Akun Kas/Bank Penerima</label>
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    value={batchCashOrBankAccountId}
                    onChange={(event) => setBatchCashOrBankAccountId(event.target.value)}
                    required
                  >
                    <option value="">Pilih akun</option>
                    {data?.accounts.map((account) => (
                      <option key={account._id} value={account._id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Transfer</label>
                  <Input
                    type="date"
                    value={batchPaymentDate}
                    onChange={(event) => setBatchPaymentDate(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Metode</label>
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    value={batchPaymentMethod}
                    onChange={(event) => setBatchPaymentMethod(event.target.value)}
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="qris">QRIS</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan Transaksi</label>
                  <Input
                    type="text"
                    placeholder="Contoh: Pembayaran KIP Batch SPP Genap"
                    value={batchNotes}
                    onChange={(event) => setBatchNotes(event.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={selectedBillIds.length === 0 || !batchCashOrBankAccountId || batchMutation.isPending}
                    className="w-full"
                  >
                    {batchMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    Proses Pembayaran Massal
                  </Button>
                </div>
              </div>

              {batchMutation.error && (
                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  {batchMutation.error.message}
                </div>
              )}

              {batchMutation.isSuccess && (
                <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 font-medium">
                  {batchMutation.data?.message} (Total: {formatCurrency(batchMutation.data?.totalAmountPaid || 0)})
                </div>
              )}

              {batchEntryYear && (
                <div className="border-t pt-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">
                      Daftar Tagihan Mahasiswa KIP Angkatan {batchEntryYear}
                    </h3>
                    <div className="text-sm text-slate-600 bg-slate-50 px-3 py-1 rounded-md border">
                      Terpilih: <strong className="text-indigo-600">{selectedBillIds.length}</strong> mahasiswa | Total Nominal: <strong className="text-emerald-600">{formatCurrency(totalBatchAmount)}</strong>
                    </div>
                  </div>

                  {kipBillsQuery.isLoading && <p className="text-sm text-slate-500">Memuat tagihan KIP...</p>}
                  {kipBillsQuery.error && <p className="text-sm text-red-600">{kipBillsQuery.error.message}</p>}

                  {billsList.length > 0 ? (
                    <div className="overflow-x-auto max-h-96 rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 border-b text-left text-slate-500 z-10">
                          <tr>
                            <th className="py-2.5 px-4 w-12 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={isAllSelected}
                                onChange={handleSelectAll}
                              />
                            </th>
                            <th className="py-2.5 pr-4 font-medium">NIM</th>
                            <th className="py-2.5 pr-4 font-medium">Nama Mahasiswa</th>
                            <th className="py-2.5 pr-4 font-medium">Prodi</th>
                            <th className="py-2.5 pr-4 font-medium">Tagihan</th>
                            <th className="py-2.5 pr-4 font-medium text-right">Nominal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billsList.map((bill) => {
                            const isChecked = selectedBillIds.includes(bill._id);
                            return (
                              <tr
                                key={bill._id}
                                className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${
                                  isChecked ? "bg-indigo-50/20" : ""
                                }`}
                              >
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={isChecked}
                                    onChange={() => handleSelectToggle(bill._id)}
                                  />
                                </td>
                                <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{bill.studentId?.nim || "-"}</td>
                                <td className="py-3 pr-4">{bill.studentId?.name || "-"}</td>
                                <td className="py-3 pr-4 text-slate-500">{bill.studentId?.programStudy || "-"}</td>
                                <td className="py-3 pr-4">{bill.feeTypeId?.name || "-"} ({bill.semester})</td>
                                <td className="py-3 pr-4 text-right font-medium text-slate-950">
                                  {formatCurrency(bill.remainingAmount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    !kipBillsQuery.isLoading && (
                      <div className="rounded-lg border-2 border-dashed p-6 text-center text-slate-500">
                        Tidak ada tagihan SPP berjalan untuk mahasiswa KIP angkatan {batchEntryYear}.
                      </div>
                    )
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Daftar Pembayaran</CardTitle>
            
            {/* Search & Rows Per Page Controls */}
            {!isLoading && !error && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Cari nama, NIM, kuitansi..."
                    value={paymentSearchTerm}
                    onChange={(e) => setPaymentSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                
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
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-slate-500">Memuat pembayaran...</p>}
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          
          {!isLoading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">No. Pembayaran</th>
                      <th className="py-2 pr-4 font-medium">Kuitansi</th>
                      <th className="py-2 pr-4 font-medium">Mahasiswa</th>
                      <th className="py-2 pr-4 font-medium">Tanggal</th>
                      <th className="py-2 pr-4 font-medium">Metode</th>
                      <th className="py-2 pr-4 font-medium">Nominal</th>
                      <th className="py-2 pr-4 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.map((payment) => (
                      <tr key={payment._id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{payment.paymentNumber}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{payment.receiptNumber}</td>
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{payment.studentId?.name || "-"}</td>
                        <td className="py-3 pr-4 text-slate-600">{new Date(payment.paymentDate).toLocaleDateString("id-ID")}</td>
                        <td className="py-3 pr-4 capitalize text-slate-600">{payment.paymentMethod.replace("_", " ")}</td>
                        <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(payment.amount)}</td>
                        <td className="py-3 pr-4">
                          <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
                            <Link href={`/payments/${payment._id}/receipt`}>
                              <FileText className="h-3.5 w-3.5" />
                              Kwitansi
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredPayments.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Tidak ada data pembayaran yang ditemukan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredPayments.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
                  <div className="text-xs text-slate-500">
                    Menampilkan <strong>{((currentPage - 1) * rowsPerPage) + 1}</strong> -{" "}
                    <strong>{Math.min(currentPage * rowsPerPage, filteredPayments.length)}</strong> dari{" "}
                    <strong>{filteredPayments.length}</strong> entri
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
