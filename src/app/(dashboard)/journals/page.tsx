"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Edit2, Eye, FileText, Loader2, Plus, RotateCcw, Save, Trash2, X, ChevronLeft, ChevronRight, FileSpreadsheet, Upload, AlertCircle, Check, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useState, useEffect } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import * as XLSX from "xlsx";
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
import type { JournalImportRowInput } from "@/lib/validation";

const journalLineFormSchema = z
  .object({
    accountId: z.string().min(1, "Akun wajib dipilih"),
    debit: z.coerce.number().nonnegative("Debit tidak boleh negatif"),
    credit: z.coerce.number().nonnegative("Kredit tidak boleh negatif"),
    description: z.string().optional(),
  })
  .superRefine((line, context) => {
    if (line.debit > 0 && line.credit > 0) {
      context.addIssue({ code: "custom", message: "Pilih debit atau kredit saja", path: ["debit"] });
    }

    if (line.debit === 0 && line.credit === 0) {
      context.addIssue({ code: "custom", message: "Isi debit atau kredit", path: ["debit"] });
    }
  });
const journalFormSchema = z
  .object({
    date: z.string().min(1, "Tanggal wajib diisi"),
    description: z.string().trim().min(1, "Deskripsi wajib diisi"),
    lines: z.array(journalLineFormSchema).min(2, "Minimal 2 baris"),
  })
  .superRefine((journal, context) => {
    const totalDebit = journal.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = journal.lines.reduce((sum, line) => sum + line.credit, 0);

    if (totalDebit <= 0 || totalCredit <= 0) {
      context.addIssue({ code: "custom", message: "Total debit dan kredit harus lebih dari 0", path: ["lines"] });
    }

    if (totalDebit !== totalCredit) {
      context.addIssue({ code: "custom", message: "Debit dan kredit harus balance", path: ["lines"] });
    }
  });

type JournalFormInput = z.input<typeof journalFormSchema>;
type JournalFormValues = z.output<typeof journalFormSchema>;
type JournalStatus = "draft" | "posted" | "cancelled";
type SourceType = "payment" | "cash_transaction" | "manual";
type UserRole = "super_admin" | "admin_bauk" | "staff_bauk" | "pimpinan" | "auditor";

type AccountOption = {
  _id: string;
  code: string;
  name: string;
  type: string;
};

type JournalRow = {
  _id: string;
  entryNumber: string;
  date: string;
  description: string;
  sourceType: SourceType;
  sourceId?: string;
  status: JournalStatus;
  createdBy?: { name: string };
  createdAt: string;
  updatedAt: string;
  totals: {
    totalDebit: number;
    totalCredit: number;
    lineCount: number;
  };
};

type JournalLineRow = {
  _id: string;
  accountId?: AccountOption;
  debit: number;
  credit: number;
  description?: string;
};

type JournalsResponse = {
  journals: JournalRow[];
  accounts: AccountOption[];
  options: {
    statuses: JournalStatus[];
    sourceTypes: SourceType[];
  };
};

type JournalDetailResponse = {
  journal: Omit<JournalRow, "totals">;
  lines: JournalLineRow[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    lineCount: number;
  };
};

type ImportLinePreview = {
  rowNumber: number;
  kodeAkun: string;
  accountId: string | null;
  accountName: string | null;
  debit: number;
  credit: number;
  description: string;
  isValid: boolean;
  errors: string[];
};

type ImportGroupPreview = {
  noJurnal: string;
  tanggal: string;
  keteranganJurnal: string;
  lines: ImportLinePreview[];
  totalDebit: number;
  totalCredit: number;
  isValid: boolean;
  errors: string[];
};

type ImportPreviewData = {
  groups: ImportGroupPreview[];
  summary: {
    total: number;
    valid: number;
    errors: number;
  };
};

type ImportResultData = {
  summary: {
    created: number;
    failed: number;
  };
};
type JournalImportConfirmRow = JournalImportRowInput & {
  rowNumber: number;
};

const statusLabels: Record<JournalStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  cancelled: "Cancelled",
};
const sourceLabels: Record<SourceType, string> = {
  payment: "Pembayaran",
  cash_transaction: "Kas",
  manual: "Manual",
};
const defaultValues: JournalFormInput = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  lines: [
    { accountId: "", debit: 0, credit: 0, description: "" },
    { accountId: "", debit: 0, credit: 0, description: "" },
  ],
};

function buildJournalsUrl(filters: {
  dateFrom: string;
  dateTo: string;
  status: string;
  sourceType: string;
  search: string;
}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return `/api/journals${query ? `?${query}` : ""}`;
}

async function fetchJournals(filters: {
  dateFrom: string;
  dateTo: string;
  status: string;
  sourceType: string;
  search: string;
}) {
  const response = await fetch(buildJournalsUrl(filters));
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat jurnal.");
  }

  return data as JournalsResponse;
}

async function fetchJournalDetail(id: string) {
  const response = await fetch(`/api/journals/${id}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat detail jurnal.");
  }

  return data as JournalDetailResponse;
}

async function saveJournal(values: JournalFormValues & { id?: string }) {
  const response = await fetch(values.id ? `/api/journals/${values.id}` : "/api/journals", {
    method: values.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Jurnal manual gagal disimpan.");
  }

  return data;
}

async function postJournal(id: string) {
  const response = await fetch(`/api/journals/${id}/post`, { method: "POST" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Jurnal gagal diposting.");
  }

  return data;
}

async function cancelJournal(id: string) {
  const response = await fetch(`/api/journals/${id}/cancel`, { method: "POST" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Jurnal gagal dicancel.");
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

function statusClass(status: JournalStatus) {
  if (status === "posted") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-600 ring-red-100";
  }

  return "bg-slate-50 text-slate-600 ring-slate-200";
}

function sourceClass(sourceType: SourceType) {
  if (sourceType === "manual") {
    return "bg-blue-50 text-blue-700 ring-blue-100";
  }

  if (sourceType === "payment") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function badge(className: string, label: string) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${className}`}>
      {label}
    </span>
  );
}

export default function JournalsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const canCreate = role === "super_admin" || role === "admin_bauk" || role === "staff_bauk";
  const canApprove = role === "super_admin" || role === "admin_bauk";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    status: "",
    sourceType: "",
    search: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data, isLoading, error } = useQuery({
    queryKey: ["journals", filters],
    queryFn: () => fetchJournals(filters),
  });

  const paginatedJournals = useMemo(() => {
    const journals = data?.journals || [];
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return journals.slice(start, end);
  }, [data?.journals, currentPage, rowsPerPage]);

  const totalPages = Math.ceil((data?.journals.length || 0) / rowsPerPage) || 1;

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
  }, [filters, rowsPerPage]);

  const detailQuery = useQuery({
    queryKey: ["journal-detail", selectedId],
    queryFn: () => fetchJournalDetail(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const form = useForm<JournalFormInput, unknown, JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues,
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  const watchedLines = useWatch({
    control: form.control,
    name: "lines",
  });
  const totals = useMemo(() => {
    const lines = watchedLines ?? [];
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

    return {
      totalDebit,
      totalCredit,
      isBalanced: totalDebit > 0 && totalDebit === totalCredit,
    };
  }, [watchedLines]);

  const saveMutation = useMutation({
    mutationFn: saveJournal,
    onSuccess: async () => {
      setEditingId(null);
      setShowForm(false);
      form.reset(defaultValues);
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
      await queryClient.invalidateQueries({ queryKey: ["journal-detail"] });
    },
  });
  const postMutation = useMutation({
    mutationFn: postJournal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
      await queryClient.invalidateQueries({ queryKey: ["journal-detail"] });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: cancelJournal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
      await queryClient.invalidateQueries({ queryKey: ["journal-detail"] });
    },
  });

  async function previewJournalImport(file: File) {
    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch("/api/journals/import/preview", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Preview import gagal.");
    }

    return data as ImportPreviewData;
  }

  async function importJournals(rows: JournalImportConfirmRow[]) {
    const response = await fetch("/api/journals/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Import gagal.");
    }

    return data as ImportResultData;
  }

  const previewImportMutation = useMutation({
    mutationFn: previewJournalImport,
    onSuccess: (preview) => {
      setImportPreview(preview);
      setImportResult(null);
      const initialExpanded: Record<string, boolean> = {};
      preview.groups.forEach((g) => {
        initialExpanded[g.noJurnal] = !g.isValid;
      });
      setExpandedGroups(initialExpanded);
    },
  });

  const confirmImportMutation = useMutation({
    mutationFn: importJournals,
    onSuccess: async (result) => {
      setImportResult(result);
      setImportPreview(null);
      setSelectedImportFile(null);
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
      await queryClient.invalidateQueries({ queryKey: ["journal-detail"] });
    },
  });

  function handleImportFile(file?: File) {
    if (file) {
      setSelectedImportFile(file);
      setImportPreview(null);
      setImportResult(null);
    }
  }

  function downloadTemplate() {
    const headers = [
      ["No. Jurnal", "Tanggal", "Keterangan Jurnal", "Kode Akun", "Debit", "Kredit", "Deskripsi Baris"]
    ];
    const sampleRows = [
      ["1", "2026-05-21", "Setoran Modal Awal", "1010", "50000000", "0", "Kas di Tangan"],
      ["1", "2026-05-21", "Setoran Modal Awal", "3000", "0", "50000000", "Setoran Modal Iman"],
      ["2", "2026-05-22", "Pembelian ATK Kantor", "5030", "250000", "0", "Kertas & Tinta Printer"],
      ["2", "2026-05-22", "Pembelian ATK Kantor", "1010", "0", "250000", "Pembayaran Kas"],
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Jurnal");
    
    worksheet["!cols"] = [
      { wch: 12 }, // No. Jurnal
      { wch: 12 }, // Tanggal
      { wch: 25 }, // Keterangan Jurnal
      { wch: 12 }, // Kode Akun
      { wch: 15 }, // Debit
      { wch: 15 }, // Kredit
      { wch: 30 }, // Deskripsi Baris
    ];
    
    XLSX.writeFile(workbook, "template-import-jurnal.xlsx");
  }

  const validImportRows = useMemo(() => {
    if (!importPreview) return [];
    const rows: JournalImportConfirmRow[] = [];
    importPreview.groups.forEach((group) => {
      if (group.isValid) {
        group.lines.forEach((line) => {
          rows.push({
            noJurnal: group.noJurnal,
            tanggal: group.tanggal,
            keteranganJurnal: group.keteranganJurnal,
            kodeAkun: line.kodeAkun,
            debit: line.debit,
            kredit: line.credit,
            deskripsiBaris: line.description,
            rowNumber: line.rowNumber,
          });
        });
      }
    });
    return rows;
  }, [importPreview]);

  function confirmImport() {
    if (validImportRows.length > 0) {
      confirmImportMutation.mutate(validImportRows);
    }
  }

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ dateFrom: "", dateTo: "", status: "", sourceType: "", search: "" });
  }

  function startAdd() {
    setEditingId(null);
    setShowForm(true);
    setShowImport(false);
    form.reset(defaultValues);
  }

  async function startEdit(id: string) {
    const detail = await fetchJournalDetail(id);

    if (detail.journal.sourceType !== "manual" || detail.journal.status !== "draft") {
      return;
    }

    setEditingId(id);
    setShowForm(true);
    setShowImport(false);
    form.reset({
      date: new Date(detail.journal.date).toISOString().slice(0, 10),
      description: detail.journal.description,
      lines: detail.lines.map((line) => ({
        accountId: line.accountId?._id ?? "",
        debit: line.debit,
        credit: line.credit,
        description: line.description ?? "",
      })),
    });
  }

  function cancelForm() {
    setEditingId(null);
    setShowForm(false);
    form.reset(defaultValues);
  }

  async function exportExcel() {
    const response = await fetch(buildJournalsUrl(filters).replace("/api/journals", "/api/journals/export"));

    if (!response.ok) {
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jurnal-umum-finara.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  const selectedJournal = detailQuery.data?.journal ?? null;
  const sourceHref =
    selectedJournal?.sourceType === "payment"
      ? `/payments/${selectedJournal.sourceId}/receipt`
      : selectedJournal?.sourceType === "cash_transaction"
        ? "/cash-transactions"
        : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Jurnal Umum" description="Lihat jurnal otomatis dan buat jurnal manual koreksi bila diperlukan." />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportExcel}>
            <Download />
            Export Excel
          </Button>
          {canCreate && (
            <>
              <Button type="button" variant="outline" onClick={() => { setShowImport(!showImport); setShowForm(false); }}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import Jurnal (Excel)
              </Button>
              <Button type="button" onClick={startAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Jurnal Manual
              </Button>
            </>
          )}
        </div>
      </div>

      {showForm && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Jurnal Manual Draft" : "Tambah Jurnal Manual"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => saveMutation.mutate({ ...values, id: editingId ?? undefined }))}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deskripsi Jurnal</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Deskripsi jurnal manual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="py-2 pl-3 pr-4 font-medium">Akun</th>
                        <th className="py-2 pr-4 font-medium">Debit</th>
                        <th className="py-2 pr-4 font-medium">Kredit</th>
                        <th className="py-2 pr-4 font-medium">Deskripsi Baris</th>
                        <th className="py-2 pr-3 font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => (
                        <tr key={field.id} className="border-b last:border-0">
                          <td className="py-3 pl-3 pr-4">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.accountId`}
                              render={({ field: lineField }) => (
                                <FormItem>
                                  <FormControl>
                                    <select
                                      className="h-8 w-full min-w-56 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                                      {...lineField}
                                    >
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
                          </td>
                          <td className="py-3 pr-4">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.debit`}
                              render={({ field: lineField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      name={lineField.name}
                                      ref={lineField.ref}
                                      onBlur={lineField.onBlur}
                                      value={String(lineField.value ?? "")}
                                      onChange={(event) => lineField.onChange(event.target.value)}
                                      type="number"
                                      min="0"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.credit`}
                              render={({ field: lineField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      name={lineField.name}
                                      ref={lineField.ref}
                                      onBlur={lineField.onBlur}
                                      value={String(lineField.value ?? "")}
                                      onChange={(event) => lineField.onChange(event.target.value)}
                                      type="number"
                                      min="0"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.description`}
                              render={({ field: lineField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input {...lineField} placeholder="Opsional" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="py-3 pr-3">
                            <Button type="button" variant="destructive" size="icon-sm" onClick={() => remove(index)}>
                              <Trash2 />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ accountId: "", debit: 0, credit: 0, description: "" })}
                  >
                    <Plus />
                    Tambah Baris
                  </Button>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>Total Debit: <strong>{formatCurrency(totals.totalDebit)}</strong></span>
                    <span>Total Kredit: <strong>{formatCurrency(totals.totalCredit)}</strong></span>
                    <span className={totals.isBalanced ? "text-emerald-700" : "text-red-600"}>
                      {totals.isBalanced ? "Balance" : "Belum balance"}
                    </span>
                  </div>
                </div>

                {!totals.isBalanced && (
                  <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
                    Debit dan kredit harus sama, dan total harus lebih dari 0 sebelum jurnal bisa disimpan.
                  </div>
                )}
                {saveMutation.error && (
                  <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    {saveMutation.error.message}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!totals.isBalanced || saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                    Simpan Draft
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelForm}>
                    <X />
                    Batal
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {showImport && canCreate && (
        <Card className="border-indigo-100 bg-white/80 backdrop-blur-md shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              Import Jurnal Umum dari Excel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-slate-500" />
                  Pilih File Excel
                </label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    className="cursor-pointer file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all pr-10"
                    onChange={(event) => handleImportFile(event.target.files?.[0])}
                  />
                  {selectedImportFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImportFile(null);
                        setImportPreview(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={downloadTemplate} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all font-medium">
                <Download className="h-4 w-4 mr-2" />
                Unduh Template Excel
              </Button>
              <Button
                type="button"
                disabled={!selectedImportFile || previewImportMutation.isPending}
                onClick={() => selectedImportFile && previewImportMutation.mutate(selectedImportFile)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium transition-all"
              >
                {previewImportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Preview
                  </>
                )}
              </Button>
            </div>

            {previewImportMutation.error && (
              <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm text-red-700 flex items-start gap-2.5 shadow-sm animate-fade-in">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-800">Gagal memproses file</p>
                  <p className="text-red-600">{previewImportMutation.error.message}</p>
                </div>
              </div>
            )}

            {importPreview && (
              <div className="space-y-4 animate-fade-in">
                {/* Stats Panel */}
                <div className="grid gap-3 grid-cols-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="text-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Entri</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{importPreview.summary.total}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Siap di-import</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{importPreview.summary.valid}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50/50 border border-red-100">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Eror</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">{importPreview.summary.errors}</p>
                  </div>
                </div>

                {/* Collapsible cards list */}
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {importPreview.groups.map((group) => {
                    const isExpanded = expandedGroups[group.noJurnal] ?? false;
                    return (
                      <div
                        key={group.noJurnal}
                        className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-sm ${
                          group.isValid
                            ? "border-emerald-100 bg-emerald-50/10 hover:bg-emerald-50/20"
                            : "border-red-100 bg-red-50/10 hover:bg-red-50/20"
                        }`}
                      >
                        {/* Header */}
                        <div
                          onClick={() =>
                            setExpandedGroups((prev) => ({
                              ...prev,
                              [group.noJurnal]: !isExpanded,
                            }))
                          }
                          className="flex items-center justify-between p-4 cursor-pointer select-none"
                        >
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 min-w-0">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${
                                group.isValid
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                  : "bg-red-50 text-red-700 ring-red-200"
                              }`}
                            >
                              {group.isValid ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                              No. Jurnal: {group.noJurnal}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              {group.tanggal}
                            </span>
                            <span className="text-sm font-semibold text-slate-800 truncate max-w-xs md:max-w-md">
                              {group.keteranganJurnal}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 shrink-0 pl-2">
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-slate-400">Total Debit/Kredit</p>
                              <p className="text-sm font-bold text-slate-800">
                                {formatCurrency(group.totalDebit)}
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Collapsible Body */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-white/90 p-4 space-y-3">
                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-50 border-b border-slate-100 text-left text-slate-500 font-medium">
                                  <tr>
                                    <th className="py-2 px-3">Baris</th>
                                    <th className="py-2 px-3">Kode Akun</th>
                                    <th className="py-2 px-3">Nama Akun</th>
                                    <th className="py-2 px-3 text-right">Debit</th>
                                    <th className="py-2 px-3 text-right">Kredit</th>
                                    <th className="py-2 px-3">Deskripsi Baris</th>
                                    <th className="py-2 px-3">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.lines.map((line) => (
                                    <tr key={line.rowNumber} className="border-b last:border-0 border-slate-100 text-slate-700">
                                      <td className="py-2.5 px-3 font-semibold text-slate-500">{line.rowNumber}</td>
                                      <td className="py-2.5 px-3 font-mono">{line.kodeAkun}</td>
                                      <td className="py-2.5 px-3 font-medium text-slate-900">{line.accountName || "-"}</td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                                        {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-amber-600">
                                        {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                                      </td>
                                      <td className="py-2.5 px-3 truncate max-w-[150px]">{line.description || "-"}</td>
                                      <td className="py-2.5 px-3">
                                        {line.isValid ? (
                                          <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                            <Check className="h-3.5 w-3.5" /> Ok
                                          </span>
                                        ) : (
                                          <div className="text-red-600 font-semibold space-y-0.5">
                                            {line.errors.map((e, idx) => (
                                              <p key={idx} className="flex items-center gap-0.5">
                                                <AlertCircle className="h-3 w-3 shrink-0" /> {e}
                                              </p>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Group-level errors */}
                            {group.errors.length > 0 && (
                              <div className="rounded-lg border border-red-100 bg-red-50/50 p-3 text-xs text-red-700 space-y-1 shadow-sm">
                                <p className="font-bold flex items-center gap-1">
                                  <AlertCircle className="h-4 w-4 text-red-500" /> Masalah Jurnal:
                                </p>
                                <ul className="list-disc pl-5 space-y-0.5">
                                  {group.errors.map((e, idx) => (
                                    <li key={idx}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Import Confirmation & Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-5">
                  <div className="text-sm text-slate-500 text-center sm:text-left">
                    {importPreview.summary.errors > 0 ? (
                      <p className="text-amber-600 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Terdapat {importPreview.summary.errors} jurnal eror. Jurnal eror akan dilewati secara otomatis.
                      </p>
                    ) : (
                      <p className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <Check className="h-4 w-4 shrink-0" />
                        Semua jurnal ({importPreview.summary.valid}) siap di-import.
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedImportFile(null);
                        setImportPreview(null);
                      }}
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      disabled={validImportRows.length === 0 || confirmImportMutation.isPending}
                      onClick={confirmImport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all"
                    >
                      {confirmImportMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Mengimport...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Import Sekarang ({importPreview.summary.valid} Jurnal)
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {confirmImportMutation.error && (
                  <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm text-red-700 flex items-start gap-2.5 shadow-sm animate-fade-in">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-red-800">Gagal melakukan import</p>
                      <p className="text-red-600">{confirmImportMutation.error.message}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {importResult && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-800 flex items-start gap-2.5 shadow-sm animate-fade-in">
                <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-900">Import Berhasil Selesai!</p>
                  <p className="text-emerald-700">
                    Sistem berhasil mengimport <strong>{importResult.summary.created}</strong> entri jurnal baru ke dalam database secara otomatis sebagai <strong>Draft</strong>.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filter Jurnal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_1.4fr_auto]">
            <Input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            <Input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
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
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={filters.sourceType}
              onChange={(event) => updateFilter("sourceType", event.target.value)}
            >
              <option value="">Semua sumber</option>
              <option value="payment">Pembayaran</option>
              <option value="cash_transaction">Kas</option>
              <option value="manual">Manual</option>
            </select>
            <Input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Cari nomor atau deskripsi"
            />
            <Button type="button" variant="outline" onClick={resetFilters}>
              <RotateCcw />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Daftar Jurnal</CardTitle>
              {!isLoading && !error && (
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
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-slate-500">Memuat jurnal...</p>}
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
                    <th className="py-2 pr-4 font-medium">Deskripsi</th>
                    <th className="py-2 pr-4 font-medium">Sumber</th>
                    <th className="py-2 pr-4 font-medium">Debit</th>
                    <th className="py-2 pr-4 font-medium">Kredit</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedJournals.map((journal) => (
                    <tr key={journal._id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 pr-4">{formatDate(journal.date)}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900">{journal.entryNumber}</td>
                      <td className="py-3 pr-4">{journal.description}</td>
                      <td className="py-3 pr-4">{badge(sourceClass(journal.sourceType), sourceLabels[journal.sourceType])}</td>
                      <td className="py-3 pr-4">{formatCurrency(journal.totals.totalDebit)}</td>
                      <td className="py-3 pr-4">{formatCurrency(journal.totals.totalCredit)}</td>
                      <td className="py-3 pr-4">{badge(statusClass(journal.status), statusLabels[journal.status])}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(journal._id)}>
                            <Eye />
                            Detail
                          </Button>
                          {journal.sourceType === "manual" && journal.status === "draft" && canCreate && (
                            <Button type="button" variant="outline" size="sm" onClick={() => void startEdit(journal._id)}>
                              <Edit2 />
                              Edit
                            </Button>
                          )}
                          {journal.sourceType === "manual" && journal.status === "draft" && canApprove && (
                            <>
                              <Button type="button" size="sm" onClick={() => postMutation.mutate(journal._id)}>
                                {postMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                                Posting
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => cancelMutation.mutate(journal._id)}
                              >
                                {cancelMutation.isPending ? <Loader2 className="animate-spin" /> : <X />}
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedJournals.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-slate-500" colSpan={8}>
                        Belum ada jurnal sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!isLoading && !error && (data?.journals.length || 0) > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
                <div className="text-xs text-slate-500">
                  Menampilkan <strong>{((currentPage - 1) * rowsPerPage) + 1}</strong> -{" "}
                  <strong>{Math.min(currentPage * rowsPerPage, data?.journals.length || 0)}</strong> dari{" "}
                  <strong>{data?.journals.length}</strong> entri
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
            <CardTitle>Detail Jurnal</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedId && <p className="text-sm text-slate-500">Pilih jurnal dari tabel untuk melihat detail.</p>}
            {detailQuery.isLoading && <p className="text-sm text-slate-500">Memuat detail...</p>}
            {detailQuery.error && <p className="text-sm text-red-600">{detailQuery.error.message}</p>}
            {selectedJournal && detailQuery.data && (
              <div className="space-y-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{selectedJournal.entryNumber}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {badge(sourceClass(selectedJournal.sourceType), sourceLabels[selectedJournal.sourceType])}
                    {badge(statusClass(selectedJournal.status), statusLabels[selectedJournal.status])}
                  </div>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-slate-500">Tanggal</span>
                    <span>{formatDate(selectedJournal.date)}</span>
                  </div>
                  <div className="space-y-1 border-b pb-2">
                    <span className="text-slate-500">Deskripsi</span>
                    <p>{selectedJournal.description}</p>
                  </div>
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-slate-500">Total Debit</span>
                    <span>{formatCurrency(detailQuery.data.totals.totalDebit)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-b pb-2">
                    <span className="text-slate-500">Total Kredit</span>
                    <span>{formatCurrency(detailQuery.data.totals.totalCredit)}</span>
                  </div>
                </div>

                {sourceHref && (
                  <Button asChild type="button" variant="outline">
                    <Link href={sourceHref}>
                      <FileText />
                      Lihat Sumber Transaksi
                    </Link>
                  </Button>
                )}

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="py-2 pl-3 pr-4 font-medium">Akun</th>
                        <th className="py-2 pr-4 font-medium">Debit</th>
                        <th className="py-2 pr-4 font-medium">Kredit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailQuery.data.lines.map((line) => (
                        <tr key={line._id} className="border-b last:border-0">
                          <td className="py-3 pl-3 pr-4">
                            <div className="font-medium text-slate-900">
                              {line.accountId ? `${line.accountId.code} - ${line.accountId.name}` : "-"}
                            </div>
                            <div className="text-xs text-slate-500">{line.description || "-"}</div>
                          </td>
                          <td className="py-3 pr-4">{formatCurrency(line.debit)}</td>
                          <td className="py-3 pr-4">{formatCurrency(line.credit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedJournal.sourceType === "manual" && selectedJournal.status === "draft" && (
                  <div className="flex flex-wrap gap-2">
                    {canCreate && (
                      <Button type="button" variant="outline" onClick={() => void startEdit(selectedJournal._id)}>
                        <Edit2 />
                        Edit
                      </Button>
                    )}
                    {canApprove && (
                      <>
                        <Button type="button" onClick={() => postMutation.mutate(selectedJournal._id)}>
                          <CheckCircle2 />
                          Posting
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => cancelMutation.mutate(selectedJournal._id)}
                        >
                          <X />
                          Cancel
                        </Button>
                      </>
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
