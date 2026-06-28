"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Edit2, Eye, Loader2, Plus, RotateCcw, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const cashTransactionFormSchema = z
  .object({
    date: z.string().min(1, "Tanggal wajib diisi"),
    type: z.enum(["cash_in", "cash_out"], { message: "Tipe transaksi wajib dipilih" }),
    cashOrBankAccountId: z.string().min(1, "Akun kas/bank wajib dipilih"),
    accountId: z.string().min(1, "Akun lawan wajib dipilih"),
    amount: z.coerce.number().positive("Nominal wajib lebih dari 0"),
    description: z.string().trim().min(1, "Deskripsi wajib diisi"),
    notes: z.string().optional(),
  })
  .refine((data) => data.cashOrBankAccountId !== data.accountId, {
    message: "Akun kas/bank dan akun lawan harus berbeda",
    path: ["accountId"],
  });

type CashTransactionFormInput = z.input<typeof cashTransactionFormSchema>;
type CashTransactionFormValues = z.output<typeof cashTransactionFormSchema>;
type CashTransactionType = "cash_in" | "cash_out";
type CashTransactionStatus = "draft" | "posted" | "cancelled";

type AccountOption = {
  _id: string;
  code: string;
  name: string;
  type: string;
};

type CashTransactionRow = {
  _id: string;
  transactionNumber: string;
  date: string;
  type: CashTransactionType;
  cashOrBankAccountId?: AccountOption;
  accountId?: AccountOption;
  amount: number;
  description: string;
  notes?: string;
  status: CashTransactionStatus;
  attachmentUrl?: string;
  journalEntryId?: {
    _id: string;
    entryNumber: string;
    status: string;
  };
};

type CashTransactionsResponse = {
  transactions: CashTransactionRow[];
  cashAccounts: AccountOption[];
  counterAccounts: AccountOption[];
  options: {
    types: CashTransactionType[];
    statuses: CashTransactionStatus[];
  };
};

const writeRoles = ["super_admin", "admin_bauk", "staff_bauk"];
const typeLabels: Record<CashTransactionType, string> = {
  cash_in: "Kas Masuk",
  cash_out: "Kas Keluar",
};
const statusLabels: Record<CashTransactionStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  cancelled: "Cancelled",
};
const defaultValues: CashTransactionFormInput = {
  date: new Date().toISOString().slice(0, 10),
  type: "cash_in",
  cashOrBankAccountId: "",
  accountId: "",
  amount: 0,
  description: "",
  notes: "",
};

function buildCashTransactionsUrl(filters: {
  dateFrom: string;
  dateTo: string;
  type: string;
  status: string;
}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return `/api/cash-transactions${query ? `?${query}` : ""}`;
}

async function fetchCashTransactions(filters: {
  dateFrom: string;
  dateTo: string;
  type: string;
  status: string;
}) {
  const response = await fetch(buildCashTransactionsUrl(filters));
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat transaksi kas.");
  }

  return data as CashTransactionsResponse;
}

async function saveCashTransaction(values: CashTransactionFormValues & { id?: string }) {
  const response = await fetch(values.id ? `/api/cash-transactions/${values.id}` : "/api/cash-transactions", {
    method: values.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Transaksi kas gagal disimpan.");
  }

  return data;
}

async function postCashTransaction(id: string) {
  const response = await fetch(`/api/cash-transactions/${id}/post`, { method: "POST" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Transaksi kas gagal diposting.");
  }

  return data;
}

async function cancelCashTransaction(id: string) {
  const response = await fetch(`/api/cash-transactions/${id}/cancel`, { method: "POST" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Transaksi kas gagal dibatalkan.");
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status: CashTransactionStatus) {
  if (status === "posted") {
    return "text-emerald-700";
  }

  if (status === "cancelled") {
    return "text-red-600";
  }

  return "text-slate-600";
}

export default function CashTransactionsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canManage = writeRoles.includes(session?.user?.role ?? "");
  const isSuperAdmin = session?.user?.role === "super_admin";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    type: "",
    status: "",
  });
  const [cashSearchTerm, setCashSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["cash-transactions", filters],
    queryFn: () => fetchCashTransactions(filters),
  });

  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    const search = cashSearchTerm.toLowerCase().trim();
    if (!search) return data.transactions;
    return data.transactions.filter((transaction) => {
      const txNum = transaction.transactionNumber?.toLowerCase() || "";
      const desc = transaction.description?.toLowerCase() || "";
      const notes = transaction.notes?.toLowerCase() || "";
      const cashAccount = transaction.cashOrBankAccountId?.name?.toLowerCase() || "";
      const counterAccount = transaction.accountId?.name?.toLowerCase() || "";
      return (
        txNum.includes(search) ||
        desc.includes(search) ||
        notes.includes(search) ||
        cashAccount.includes(search) ||
        counterAccount.includes(search)
      );
    });
  }, [data?.transactions, cashSearchTerm]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredTransactions.slice(start, end);
  }, [filteredTransactions, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [cashSearchTerm, filters, rowsPerPage]);

  useEffect(() => {
    setIsDeleteConfirming(false);
    setDeleteConfirmText("");
  }, [selectedId]);


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

  const form = useForm<CashTransactionFormInput, unknown, CashTransactionFormValues>({
    resolver: zodResolver(cashTransactionFormSchema),
    defaultValues,
  });

  const saveMutation = useMutation({
    mutationFn: saveCashTransaction,
    onSuccess: async () => {
      setEditingId(null);
      setShowForm(false);
      form.reset(defaultValues);
      await queryClient.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
  });

  const postMutation = useMutation({
    mutationFn: postCashTransaction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelCashTransaction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cash-transactions/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menghapus transaksi.");
      }
      return data;
    },
    onSuccess: async () => {
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`/api/cash-transactions/${id}/upload-receipt`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Gagal mengunggah bukti transaksi.");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, transactionId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadReceiptMutation.mutate({ id: transactionId, file });
      // Reset input
      e.target.value = '';
    }
  };


  const summary = useMemo(() => {
    const transactions = data?.transactions ?? [];

    return {
      totalIn: transactions
        .filter((transaction) => transaction.type === "cash_in" && transaction.status === "posted")
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      totalOut: transactions
        .filter((transaction) => transaction.type === "cash_out" && transaction.status === "posted")
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      draft: transactions.filter((transaction) => transaction.status === "draft").length,
      posted: transactions.filter((transaction) => transaction.status === "posted").length,
    };
  }, [data?.transactions]);

  const selectedTransaction = useMemo(
    () => data?.transactions.find((transaction) => transaction._id === selectedId) ?? null,
    [data?.transactions, selectedId]
  );

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ dateFrom: "", dateTo: "", type: "", status: "" });
  }

  function startAdd(type: CashTransactionType) {
    setEditingId(null);
    setShowForm(true);
    form.reset({ ...defaultValues, type });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const type = params.get("type");
    if (action === "create" && (type === "cash_in" || type === "cash_out")) {
      startAdd(type as CashTransactionType);
      
      // Clean up the URL search params so reloading doesn't keep opening it if they close it
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
    // startAdd intentionally stays outside dependencies to avoid reopening the form after local state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(transaction: CashTransactionRow) {
    if (transaction.status !== "draft") {
      return;
    }

    setEditingId(transaction._id);
    setShowForm(true);
    form.reset({
      date: new Date(transaction.date).toISOString().slice(0, 10),
      type: transaction.type,
      cashOrBankAccountId: transaction.cashOrBankAccountId?._id ?? "",
      accountId: transaction.accountId?._id ?? "",
      amount: transaction.amount,
      description: transaction.description,
      notes: transaction.notes ?? "",
    });
  }

  function cancelForm() {
    setEditingId(null);
    setShowForm(false);
    form.reset(defaultValues);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Kas Masuk/Keluar" description="Catat transaksi kas dan bank di luar pembayaran mahasiswa." />
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => startAdd("cash_in")}>
              <Plus />
              Tambah Kas Masuk
            </Button>
            <Button type="button" variant="outline" onClick={() => startAdd("cash_out")}>
              <Plus />
              Tambah Kas Keluar
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Kas Masuk Posted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-emerald-700">{formatCurrency(summary.totalIn)}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Kas Keluar Posted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold text-red-600">{formatCurrency(summary.totalOut)}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.draft}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Posted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.posted}</div>
          </CardContent>
        </Card>
      </div>

      {showForm && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Transaksi Draft" : "Tambah Transaksi Kas"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) =>
                  saveMutation.mutate({ ...values, id: editingId ?? undefined })
                )}
                className="grid gap-4 md:grid-cols-4"
              >
                <FormField
                  control={form.control}
                  name="date"
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe Transaksi</FormLabel>
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          <option value="cash_in">Kas Masuk</option>
                          <option value="cash_out">Kas Keluar</option>
                        </select>
                      </FormControl>
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
                          {data?.cashAccounts.map((account) => (
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
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Akun Lawan</FormLabel>
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          <option value="">Pilih akun</option>
                          {data?.counterAccounts.map((account) => (
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
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Deskripsi</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Deskripsi transaksi" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catatan</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opsional" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-wrap items-end gap-2 md:col-span-4">
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    {editingId ? "Simpan Perubahan" : "Simpan Draft"}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelForm}>
                    <X />
                    Batal
                  </Button>
                </div>
                {saveMutation.error && (
                  <div className="md:col-span-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    {saveMutation.error.message}
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filter Transaksi Kas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={filters.type}
              onChange={(event) => updateFilter("type", event.target.value)}
            >
              <option value="">Semua tipe</option>
              <option value="cash_in">Kas Masuk</option>
              <option value="cash_out">Kas Keluar</option>
            </select>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">Semua status</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button type="button" variant="outline" onClick={resetFilters}>
              <RotateCcw />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>Tabel Transaksi Kas</CardTitle>
              
              {!isLoading && !error && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Cari no. transaksi, deskripsi, bank..."
                      value={cashSearchTerm}
                      onChange={(e) => setCashSearchTerm(e.target.value)}
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
            {isLoading && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Memuat transaksi kas...
              </p>
            )}
            {error && <p className="text-sm text-red-600">{error.message}</p>}
            {(postMutation.error || cancelMutation.error) && (
              <div className="mb-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {postMutation.error?.message || cancelMutation.error?.message}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Tanggal</th>
                    <th className="py-2 pr-4 font-medium">Nomor</th>
                    <th className="py-2 pr-4 font-medium">Tipe</th>
                    <th className="py-2 pr-4 font-medium">Kas/Bank</th>
                    <th className="py-2 pr-4 font-medium">Akun Lawan</th>
                    <th className="py-2 pr-4 font-medium">Nominal</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((transaction) => (
                    <tr key={transaction._id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 pr-4">{formatDate(transaction.date)}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{transaction.transactionNumber}</td>
                      <td className="py-3 pr-4">{typeLabels[transaction.type]}</td>
                      <td className="py-3 pr-4">{transaction.cashOrBankAccountId?.name || "-"}</td>
                      <td className="py-3 pr-4">{transaction.accountId?.name || "-"}</td>
                      <td className="py-3 pr-4">{formatCurrency(transaction.amount)}</td>
                      <td className="py-3 pr-4">
                        <span className={statusClass(transaction.status)}>{statusLabels[transaction.status]}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(transaction._id)}>
                            <Eye />
                            Detail
                          </Button>
                          {canManage && transaction.status === "draft" && (
                            <>
                              <Button type="button" variant="outline" size="sm" onClick={() => startEdit(transaction)}>
                                <Edit2 />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={postMutation.isPending}
                                onClick={() => postMutation.mutate(transaction._id)}
                              >
                                {postMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                                Posting
                              </Button>
                            </>
                          )}
                          {canManage && transaction.status !== "cancelled" && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={cancelMutation.isPending}
                              onClick={() => cancelMutation.mutate(transaction._id)}
                            >
                              {cancelMutation.isPending ? <Loader2 className="animate-spin" /> : <Ban />}
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-slate-500" colSpan={8}>
                        Belum ada transaksi kas sesuai filter/pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!isLoading && !error && filteredTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
                <div className="text-xs text-slate-500">
                  Menampilkan <strong>{((currentPage - 1) * rowsPerPage) + 1}</strong> -{" "}
                  <strong>{Math.min(currentPage * rowsPerPage, filteredTransactions.length)}</strong> dari{" "}
                  <strong>{filteredTransactions.length}</strong> entri
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

        <Card>
          <CardHeader>
            <CardTitle>Detail Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedTransaction && (
              <p className="text-sm text-slate-500">Pilih transaksi dari tabel untuk melihat detail.</p>
            )}
            {selectedTransaction && (
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedTransaction.transactionNumber}</div>
                  <div className="text-sm text-slate-500">{typeLabels[selectedTransaction.type]}</div>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-slate-500">Tanggal</span>
                    <span>{formatDate(selectedTransaction.date)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-slate-500">Status</span>
                    <span className={statusClass(selectedTransaction.status)}>
                      {statusLabels[selectedTransaction.status]}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-slate-500">Nominal</span>
                    <span className="font-medium">{formatCurrency(selectedTransaction.amount)}</span>
                  </div>
                  <div className="space-y-1 border-b pb-2">
                    <span className="text-slate-500">Akun Kas/Bank</span>
                    <p>
                      {selectedTransaction.cashOrBankAccountId
                        ? `${selectedTransaction.cashOrBankAccountId.code} - ${selectedTransaction.cashOrBankAccountId.name}`
                        : "-"}
                    </p>
                  </div>
                  <div className="space-y-1 border-b pb-2">
                    <span className="text-slate-500">Akun Lawan</span>
                    <p>
                      {selectedTransaction.accountId
                        ? `${selectedTransaction.accountId.code} - ${selectedTransaction.accountId.name}`
                        : "-"}
                    </p>
                  </div>
                  <div className="space-y-1 border-b pb-2">
                    <span className="text-slate-500">Deskripsi</span>
                    <p>{selectedTransaction.description}</p>
                  </div>
                  <div className="space-y-1 border-b pb-2">
                    <span className="text-slate-500">Catatan</span>
                    <p>{selectedTransaction.notes || "-"}</p>
                  </div>
                  <div className="space-y-1 border-b pb-2">
                    <span className="text-slate-500">Jurnal</span>
                    <p>{selectedTransaction.journalEntryId?.entryNumber || "-"}</p>
                  </div>
                  
                  {uploadReceiptMutation.error && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
                      {uploadReceiptMutation.error.message}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedTransaction.attachmentUrl ? (
                    <div className="mt-4 border rounded-md overflow-hidden">
                      <p className="p-2 text-sm font-semibold bg-gray-50 border-b">Bukti Transaksi:</p>
                      <img src={selectedTransaction.attachmentUrl} alt="Bukti Transaksi" className="w-full h-auto object-contain max-h-[500px]" />
                    </div>
                  ) : null}
                  
                  {canManage && (
                    <div className="relative overflow-hidden inline-block">
                      <Button type="button" variant="outline" disabled={uploadReceiptMutation.isPending}>
                        {uploadReceiptMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Upload Bukti Transaksi
                      </Button>
                      <input 
                        type="file" 
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={(e) => handleFileUpload(e, selectedTransaction._id)}
                        disabled={uploadReceiptMutation.isPending}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="Upload Bukti"
                      />
                    </div>
                  )}
                </div>

                {canManage && selectedTransaction.status === "draft" && (
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Button type="button" variant="outline" onClick={() => startEdit(selectedTransaction)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      disabled={postMutation.isPending}
                      onClick={() => postMutation.mutate(selectedTransaction._id)}
                    >
                      {postMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Posting
                    </Button>
                  </div>
                )}
                {isSuperAdmin && selectedTransaction.status === "cancelled" && (
                  <div className="border-t pt-4 mt-4 space-y-3">
                    {!isDeleteConfirming ? (
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full"
                        onClick={() => setIsDeleteConfirming(true)}
                      >
                        Hapus Transaksi
                      </Button>
                    ) : (
                      <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="text-xs font-semibold text-slate-600 block">
                          ketik hapus untuk menghapus
                        </label>
                        <Input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="ketik hapus"
                          className="h-8 text-xs placeholder:text-slate-400"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="flex-1 text-xs"
                            disabled={deleteConfirmText.trim().toLowerCase() !== "hapus" || deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(selectedTransaction._id)}
                          >
                            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ya, Hapus"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => {
                              setIsDeleteConfirming(false);
                              setDeleteConfirmText("");
                            }}
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}
                    {deleteMutation.error && (
                      <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md border border-red-100 mt-2">
                        {deleteMutation.error.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
