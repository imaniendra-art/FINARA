"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileCheck2,
  Loader2,
  MoreHorizontal,
  Plus,
  Send,
  WalletCards,
  CreditCard,
  ReceiptText,
  X,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";

const requestTypes = ["proker", "incidental", "operational", "other"] as const;
const statuses = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "rejected",
  "disbursed",
  "lpj_submitted",
  "completed",
  "cancelled",
] as const;

const requestSchema = z.object({
  requestDate: z.string().min(1, "Tanggal wajib diisi"),
  requesterName: z.string().trim().min(1, "Pemohon wajib diisi"),
  unitId: z.string().min(1, "Unit wajib dipilih"),
  periodId: z.string().optional(),
  requestType: z.enum(requestTypes),
  activityName: z.string().trim().min(1, "Nama kegiatan wajib diisi"),
  description: z.string().optional(),
  items: z.array(
    z.object({
      itemName: z.string().trim().min(1, "Item wajib diisi"),
      quantity: z.coerce.number().positive("Jumlah harus > 0"),
      unit: z.string().trim().min(1, "Satuan wajib diisi"),
      unitPrice: z.coerce.number().nonnegative("Harga tidak boleh negatif"),
      note: z.string().optional(),
      referenceUrl: z.string().optional(),
    })
  ).min(1, "Minimal 1 item RAB"),
});

type UserRole =
  | "super_admin"
  | "admin_bauk"
  | "staff_bauk"
  | "unit"
  | "tendik"
  | "dosen"
  | "mahasiswa"
  | "organisasi"
  | "pimpinan"
  | "auditor";
type RequestFormInput = z.input<typeof requestSchema>;
type RequestFormValues = z.output<typeof requestSchema>;
type BudgetStatus = (typeof statuses)[number];
type RequestType = (typeof requestTypes)[number];

type WorkUnit = { _id: string; name: string; code: string; isActive: boolean };
type Period = { _id: string; name: string; isActive: boolean };
type BudgetRequestRow = {
  _id: string;
  requestNumber: string;
  requestDate: string;
  requesterName: string;
  unitId?: WorkUnit;
  periodId?: Period;
  requestType: RequestType;
  activityName: string;
  description?: string;
  totalRequestedAmount: number;
  totalApprovedAmount: number;
  status: BudgetStatus;
  adminNote?: string;
  leaderNote?: string;
  userNote?: string;
  rejectionReason?: string;
  disbursementNote?: string;
  disbursementProofUrl?: string;
  lpjNote?: string;
  lpjProofUrl?: string;
  createdBy?: { _id: string; name: string };
  verifiedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  disbursedAt?: string;
  lpjSubmittedAt?: string;
};
type BudgetItem = {
  _id?: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  note?: string;
  referenceUrl?: string;
};
type ListResponse = { requests: BudgetRequestRow[]; workUnits: WorkUnit[]; periods: Period[] };
type DetailResponse = { budgetRequest: BudgetRequestRow; items: BudgetItem[] };
type ToastState = { type: "success" | "error"; message: string } | null;

const statusLabels: Record<BudgetStatus, string> = {
  draft: "Draft",
  submitted: "Menunggu Verifikasi",
  verified: "Menunggu Approval",
  approved: "Disetujui",
  rejected: "Ditolak",
  disbursed: "Dicairkan",
  lpj_submitted: "LPJ Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const statusClasses: Record<BudgetStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-700",
  verified: "bg-indigo-100 text-indigo-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  disbursed: "bg-emerald-100 text-emerald-700",
  lpj_submitted: "bg-amber-100 text-amber-700",
  completed: "bg-green-200 text-green-900",
  cancelled: "bg-rose-100 text-rose-700",
};

const typeLabels: Record<RequestType, string> = {
  proker: "Proker",
  incidental: "Insidentil",
  operational: "Operasional",
  other: "Lainnya",
};

const defaultValues: RequestFormInput = {
  requestDate: new Date().toISOString().slice(0, 10),
  requesterName: "",
  unitId: "",
  periodId: "",
  requestType: "operational",
  activityName: "",
  description: "",
  items: [{ itemName: "", quantity: 1, unit: "unit", unitPrice: 0, note: "", referenceUrl: "" }],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function roleCanCreate(role?: string) {
  return ["super_admin", "admin_bauk", "staff_bauk", "unit", "tendik", "dosen", "organisasi"].includes(role ?? "");
}

function roleCanManage(role?: string) {
  return role === "super_admin" || role === "admin_bauk";
}

function roleCanApprove(role?: string) {
  return role === "super_admin" || role === "admin_bauk" || role === "pimpinan";
}

async function fetchRequests(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const response = await fetch(`/api/budget-requests${params.toString() ? `?${params}` : ""}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat permintaan anggaran.");
  return data as ListResponse;
}

async function fetchDetail(id: string) {
  const response = await fetch(`/api/budget-requests/${id}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Gagal memuat detail.");
  return data as DetailResponse;
}

async function saveRequest(values: RequestFormValues & { id?: string }) {
  const response = await fetch(values.id ? `/api/budget-requests/${values.id}` : "/api/budget-requests", {
    method: values.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...values, periodId: values.periodId || undefined }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Permintaan anggaran gagal disimpan.");
  return data;
}

async function postAction({ id, action, body = {} }: { id: string; action: string; body?: Record<string, unknown> }) {
  const response = await fetch(`/api/budget-requests/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Aksi gagal diproses.");
  return data;
}

function toFormValues(detail: DetailResponse): RequestFormInput {
  return {
    requestDate: detail.budgetRequest.requestDate.slice(0, 10),
    requesterName: detail.budgetRequest.requesterName,
    unitId: detail.budgetRequest.unitId?._id || "",
    periodId: detail.budgetRequest.periodId?._id || "",
    requestType: detail.budgetRequest.requestType,
    activityName: detail.budgetRequest.activityName,
    description: detail.budgetRequest.description || "",
    items: detail.items.map((item) => ({
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      note: item.note || "",
      referenceUrl: item.referenceUrl || "",
    })),
  };
}

export function BudgetRequestsClient() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const [filters, setFilters] = useState({ status: "", unitId: "", periodId: "", startDate: "", endDate: "", search: "" });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [approvalTarget, setApprovalTarget] = useState<BudgetRequestRow | null>(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [approvalNote, setApprovalNote] = useState("");

  const listQuery = useQuery({ queryKey: ["budget-requests", filters], queryFn: () => fetchRequests(filters) });
  const detailQuery = useQuery({
    queryKey: ["budget-request", selectedId],
    queryFn: () => fetchDetail(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const form = useForm<RequestFormInput, unknown, RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues,
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const watchedItems = useWatch({ control: form.control, name: "items" }) ?? [];
  const total = watchedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const invalidateBudgetData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["budget-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: saveRequest,
    onSuccess: async () => {
      const wasEditing = Boolean(editingId);
      setShowForm(false);
      setEditingId(null);
      form.reset(defaultValues);
      await invalidateBudgetData();
      setToast({
        type: "success",
        message: wasEditing ? "Draft pengajuan berhasil diperbarui." : "Draft pengajuan berhasil dibuat.",
      });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Permintaan anggaran gagal disimpan.",
      });
    },
  });
  const actionMutation = useMutation({
    mutationFn: postAction,
    onSuccess: async () => {
      setActionMessage(null);
      setApprovalTarget(null);
      setApprovedAmount("");
      setApprovalNote("");
      await invalidateBudgetData();
      await queryClient.invalidateQueries({ queryKey: ["budget-request"] });
      setToast({ type: "success", message: "Aksi permintaan anggaran berhasil diproses." });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Aksi gagal diproses.",
      });
    },
  });

  const requests = useMemo(() => listQuery.data?.requests ?? [], [listQuery.data?.requests]);
  const summary = useMemo(() => {
    return statuses.map((status) => ({
      status,
      count: requests.filter((request) => request.status === status).length,
    }));
  }, [requests]);
  const detail = detailQuery.data?.budgetRequest;

  function openAdd() {
    setEditingId(null);
    form.reset(defaultValues);
    saveMutation.reset();
    setShowForm(true);
  }

  async function openEdit(id: string) {
    const detailData = await fetchDetail(id);
    setEditingId(id);
    form.reset(toFormValues(detailData));
    saveMutation.reset();
    setShowForm(true);
  }

  function submit(values: RequestFormValues) {
    saveMutation.mutate({ ...values, id: editingId || undefined });
  }

  function runAction(action: string, body: Record<string, unknown> = {}) {
    if (!selectedId) return;
    actionMutation.mutate({ id: selectedId, action, body });
  }

  function runRowAction(request: BudgetRequestRow, action: string, body: Record<string, unknown> = {}) {
    actionMutation.mutate({ id: request._id, action, body });
  }

  function openApprovalDialog(request: BudgetRequestRow) {
    setApprovalTarget(request);
    setApprovedAmount(String(request.totalApprovedAmount || request.totalRequestedAmount || 0));
    setApprovalNote(request.leaderNote || "");
  }

  function submitApproval() {
    if (!approvalTarget) return;

    const amount = Number(approvedAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setToast({ type: "error", message: "Nominal ACC tidak valid." });
      return;
    }

    actionMutation.mutate({
      id: approvalTarget._id,
      action: "approve",
      body: {
        totalApprovedAmount: amount,
        leaderNote: approvalNote || undefined,
      },
    });
  }

  function hasWorkflowAction(request: BudgetRequestRow) {
    if (request.status === "draft") return roleCanCreate(role);
    if (request.status === "submitted") return roleCanManage(role);
    if (request.status === "verified") return roleCanApprove(role);
    if (request.status === "approved") return roleCanManage(role);
    if (request.status === "disbursed") return roleCanCreate(role);
    if (request.status === "lpj_submitted") return roleCanManage(role);
    return false;
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={[
            "fixed right-6 top-6 z-50 flex max-w-sm items-start gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg",
            toast.type === "success" ? "bg-emerald-700" : "bg-red-700",
          ].join(" ")}
          role="status"
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Permintaan Anggaran"
          description="Kelola pengajuan anggaran, verifikasi, approval, pencairan, dan LPJ."
        />
        {roleCanCreate(role) && (
          <Button type="button" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Buat Pengajuan
          </Button>
        )}
      </div>

      {/* Hero Section Pagu Anggaran (Serapan SIPUANG) */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-tr from-[#0f2942] via-[#163a5c] to-[#1e4c78] p-5 text-white shadow-[0_12px_36px_-6px_rgba(15,41,66,0.3)] md:p-6">
        {/* Glow elements */}
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />

        <div className="relative mb-6">
          <h1 className="text-xl font-black tracking-tight md:text-2xl leading-tight text-white">
            Ringkasan <span className="text-emerald-300">Pagu Anggaran</span>
          </h1>
          <p className="text-[11px] font-medium text-slate-300 mt-1 max-w-sm">
            Pantau sisa pagu, total realisasi kas, dan komitmen anggaran yang sedang berjalan.
          </p>
        </div>

        <div className="relative grid gap-4 md:grid-cols-3">
          {/* Card 1: Sisa Saldo Pagu */}
          <div className="flex flex-col justify-between rounded-[20px] bg-white/5 backdrop-blur-md border border-white/10 p-5 transition-all hover:bg-white/10 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
                <WalletCards className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white leading-none">Sisa Saldo Pagu</h4>
                <p className="text-[9px] text-blue-300/80 font-bold uppercase tracking-wider mt-0.5">Budget Tersedia</p>
              </div>
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-white">Rp 0</h2>
              <div className="mt-3 border-t border-white/10 pt-3 flex justify-between items-center text-[10px] font-medium text-slate-300">
                <span>Total Pagu</span>
                <span className="font-bold text-white">Rp 0</span>
              </div>
            </div>
            <WalletCards className="absolute -bottom-4 -right-4 h-24 w-24 text-blue-400/10 pointer-events-none" />
          </div>

          {/* Card 2: Total Realisasi (Cair) */}
          <div className="flex flex-col justify-between rounded-[20px] bg-white/5 backdrop-blur-md border border-white/10 p-5 transition-all hover:bg-white/10 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white leading-none">Total Realisasi</h4>
                <p className="text-[9px] text-emerald-300/80 font-bold uppercase tracking-wider mt-0.5">Sudah Cair</p>
              </div>
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-white">Rp 0</h2>
              <div className="mt-3 border-t border-white/10 pt-3 flex items-center text-[10px] font-medium text-slate-300">
                <span>Dana tersalurkan ke Unit</span>
              </div>
            </div>
            <CreditCard className="absolute -bottom-4 -right-4 h-24 w-24 text-emerald-400/10 pointer-events-none" />
          </div>

          {/* Card 3: Komitmen Anggaran (Proker) */}
          <div className="flex flex-col justify-between rounded-[20px] bg-white/5 backdrop-blur-md border border-white/10 p-5 transition-all hover:bg-white/10 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                <ReceiptText className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white leading-none">Komitmen Anggaran</h4>
                <p className="text-[9px] text-violet-300/80 font-bold uppercase tracking-wider mt-0.5">Rencana Proker</p>
              </div>
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-white">Rp 0</h2>
              <div className="mt-3 border-t border-white/10 pt-3 flex justify-between items-center text-[10px] font-medium text-slate-300">
                <span>0 Proker menunggu validasi</span>
              </div>
            </div>
            <ReceiptText className="absolute -bottom-4 -right-4 h-24 w-24 text-violet-400/10 pointer-events-none" />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.filter((item) => item.status !== "cancelled").map((item) => (
          <Card key={item.status}>
            <CardContent className="p-4">
              <div className="text-xs font-semibold uppercase text-slate-500">{statusLabels[item.status]}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{item.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6">
            <select className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Semua status</option>
              {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
            <select className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={filters.unitId} onChange={(event) => setFilters({ ...filters, unitId: event.target.value })}>
              <option value="">Semua unit</option>
              {listQuery.data?.workUnits.map((unit) => <option key={unit._id} value={unit._id}>{unit.name}</option>)}
            </select>
            <select className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={filters.periodId} onChange={(event) => setFilters({ ...filters, periodId: event.target.value })}>
              <option value="">Semua periode</option>
              {listQuery.data?.periods.map((period) => <option key={period._id} value={period._id}>{period.name}</option>)}
            </select>
            <Input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} />
            <Input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} />
            <Input placeholder="Cari nomor/pemohon/kegiatan" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) {
            setEditingId(null);
            form.reset(defaultValues);
            saveMutation.reset();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Draft Pengajuan" : "Buat Draft Pengajuan"}</DialogTitle>
            <DialogDescription>
              Lengkapi judul, deskripsi, jumlah dana, dan unit kerja terkait sebelum menyimpan draft.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField control={form.control} name="requestDate" render={({ field }) => (
                  <FormItem><FormLabel>Tanggal</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="requesterName" render={({ field }) => (
                  <FormItem><FormLabel>Pemohon</FormLabel><FormControl><Input {...field} placeholder="Nama pemohon/unit" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="activityName" render={({ field }) => (
                  <FormItem><FormLabel>Judul Pengajuan</FormLabel><FormControl><Input {...field} placeholder="Judul kegiatan atau kebutuhan" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unitId" render={({ field }) => (
                  <FormItem><FormLabel>Unit Kerja</FormLabel><FormControl><select className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" {...field}><option value="">Pilih unit kerja</option>{listQuery.data?.workUnits.filter((unit) => unit.isActive).map((unit) => <option key={unit._id} value={unit._id}>{unit.name}</option>)}</select></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="periodId" render={({ field }) => (
                  <FormItem><FormLabel>Periode</FormLabel><FormControl><select className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" {...field}><option value="">Gunakan periode aktif</option>{listQuery.data?.periods.map((period) => <option key={period._id} value={period._id}>{period.name}{period.isActive ? " (aktif)" : ""}</option>)}</select></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="requestType" render={({ field }) => (
                  <FormItem><FormLabel>Jenis</FormLabel><FormControl><select className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" {...field}>{requestTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Deskripsi</FormLabel><FormControl><Input {...field} placeholder="Keterangan singkat pengajuan dana" /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Rincian Jumlah Dana</h3>
                    <p className="text-xs text-slate-500">Total pengajuan dihitung dari seluruh item RAB.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => items.append({ itemName: "", quantity: 1, unit: "unit", unitPrice: 0, note: "", referenceUrl: "" })}>
                    <Plus className="h-4 w-4" /> Item
                  </Button>
                </div>
                {items.fields.map((item, index) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-12">
                    <FormField control={form.control} name={`items.${index}.itemName`} render={({ field }) => <FormItem className="md:col-span-3"><FormLabel>Item</FormLabel><FormControl><Input {...field} placeholder="Nama kebutuhan" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => <FormItem className="md:col-span-2"><FormLabel>Jumlah</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name={`items.${index}.unit`} render={({ field }) => <FormItem className="md:col-span-1"><FormLabel>Satuan</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => <FormItem className="md:col-span-2"><FormLabel>Nominal</FormLabel><FormControl><Input type="number" {...field} value={String(field.value ?? "")} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name={`items.${index}.note`} render={({ field }) => <FormItem className="md:col-span-2"><FormLabel>Catatan</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                    <div className="md:col-span-2 flex items-end justify-between gap-2">
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(Number(watchedItems[index]?.quantity || 0) * Number(watchedItems[index]?.unitPrice || 0))}</div>
                      <Button type="button" variant="outline" onClick={() => items.remove(index)} disabled={items.fields.length === 1}>Hapus</Button>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg bg-slate-900 p-4 text-right text-lg font-bold text-white">
                  Jumlah Dana Diajukan: {formatCurrency(total)}
                </div>
              </div>

              {saveMutation.error && <p className="text-sm font-semibold text-red-600">{saveMutation.error.message}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Simpan Perubahan" : "Simpan Draft"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(approvalTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setApprovalTarget(null);
            setApprovedAmount("");
            setApprovalNote("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Setujui Pengajuan</DialogTitle>
            <DialogDescription>
              Pastikan nominal yang disetujui sesuai hasil verifikasi sebelum melanjutkan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {approvalTarget && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{approvalTarget.activityName}</div>
                <div className="mt-1 text-slate-500">
                  Diajukan: {formatCurrency(approvalTarget.totalRequestedAmount)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="approvedAmount">
                Nominal ACC
              </label>
              <Input
                id="approvedAmount"
                type="number"
                min="0"
                value={approvedAmount}
                onChange={(event) => setApprovedAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="approvalNote">
                Catatan Approval
              </label>
              <Input
                id="approvalNote"
                value={approvalNote}
                onChange={(event) => setApprovalNote(event.target.value)}
                placeholder="Opsional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApprovalTarget(null)}>
              Batal
            </Button>
            <Button type="button" onClick={submitApproval} disabled={actionMutation.isPending}>
              {actionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Permintaan</CardTitle>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">Memuat permintaan...</div>
          ) : listQuery.error ? (
            <div className="py-10 text-center text-sm text-red-600">{listQuery.error.message}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="py-3">Nomor</th><th>Tanggal</th><th>Pemohon</th><th>Unit</th><th>Kegiatan</th><th className="text-right">Diajukan</th><th className="text-right">Disetujui</th><th>Status</th><th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request._id} className="border-b last:border-0">
                      <td className="py-3 font-semibold">{request.requestNumber}</td>
                      <td>{formatDate(request.requestDate)}</td>
                      <td>{request.requesterName}</td>
                      <td>{request.unitId?.name || "-"}</td>
                      <td>{request.activityName}</td>
                      <td className="text-right">{formatCurrency(request.totalRequestedAmount)}</td>
                      <td className="text-right">{formatCurrency(request.totalApprovedAmount)}</td>
                      <td><Badge className={statusClasses[request.status]}>{statusLabels[request.status]}</Badge></td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          {request.status === "draft" && roleCanCreate(role) && <Button type="button" size="sm" variant="outline" onClick={() => openEdit(request._id)}>Edit</Button>}
                          <Button type="button" size="sm" onClick={() => setSelectedId(request._id)}><Eye className="h-4 w-4" /> Detail</Button>
                          {hasWorkflowAction(request) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" size="icon-sm" variant="outline" disabled={actionMutation.isPending}>
                                  {actionMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">Buka menu aksi</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Aksi Pengajuan</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {request.status === "draft" && roleCanCreate(role) && (
                                  <DropdownMenuItem onClick={() => runRowAction(request, "submit")}>
                                    <Send className="h-4 w-4" />
                                    Ajukan
                                  </DropdownMenuItem>
                                )}
                                {request.status === "submitted" && roleCanManage(role) && (
                                  <DropdownMenuItem onClick={() => runRowAction(request, "verify")}>
                                    <ClipboardCheck className="h-4 w-4" />
                                    Verifikasi
                                  </DropdownMenuItem>
                                )}
                                {request.status === "verified" && roleCanApprove(role) && (
                                  <DropdownMenuItem onClick={() => openApprovalDialog(request)}>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Setujui
                                  </DropdownMenuItem>
                                )}
                                {request.status === "approved" && roleCanManage(role) && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      runRowAction(request, "disburse", {
                                        disbursementNote: "Dana dicairkan melalui alur persetujuan.",
                                      })
                                    }
                                  >
                                    <WalletCards className="h-4 w-4" />
                                    Cairkan Dana
                                  </DropdownMenuItem>
                                )}
                                {request.status === "disbursed" && roleCanCreate(role) && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      runRowAction(request, "submit-lpj", {
                                        lpjNote: "LPJ dikirim melalui alur persetujuan.",
                                      })
                                    }
                                  >
                                    <FileCheck2 className="h-4 w-4" />
                                    Kirim LPJ
                                  </DropdownMenuItem>
                                )}
                                {request.status === "lpj_submitted" && roleCanManage(role) && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      runRowAction(request, "complete", {
                                        adminNote: "Permintaan anggaran diselesaikan.",
                                      })
                                    }
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Selesaikan
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-slate-500">Belum ada permintaan anggaran.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedId && detail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
          <div className="mx-auto max-w-5xl rounded-xl bg-white dark:bg-slate-900 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{detail.requestNumber}</h2>
                <p className="text-sm text-slate-500">{detail.activityName} - {detail.requesterName}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setSelectedId(null)}><X className="h-4 w-4" /> Tutup</Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Status</div><Badge className={`mt-2 ${statusClasses[detail.status]}`}>{statusLabels[detail.status]}</Badge></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total Diajukan</div><div className="mt-2 font-bold">{formatCurrency(detail.totalRequestedAmount)}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs uppercase text-slate-500">Total Disetujui</div><div className="mt-2 font-bold">{formatCurrency(detail.totalApprovedAmount)}</div></CardContent></Card>
            </div>

            {["disbursed", "lpj_submitted", "completed"].includes(detail.status) ? (
              <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm font-medium text-amber-800 dark:text-amber-400">
                Pencairan dana sudah ditandai. Silakan catat realisasi pencairan pada modul Kas Keluar agar masuk jurnal dan laporan kas.
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-3">Item</th><th>Jumlah</th><th>Satuan</th><th className="text-right">Harga</th><th className="text-right">Total</th><th>Catatan</th></tr></thead>
                <tbody>
                  {detailQuery.data?.items.map((item) => <tr key={item._id || item.itemName} className="border-b last:border-0"><td className="py-3 font-semibold">{item.itemName}</td><td>{item.quantity}</td><td>{item.unit}</td><td className="text-right">{formatCurrency(item.unitPrice)}</td><td className="text-right">{formatCurrency(item.total)}</td><td>{item.note || "-"}</td></tr>)}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input placeholder="Catatan/nominal/URL sesuai aksi" value={actionMessage || ""} onChange={(event) => setActionMessage(event.target.value)} />
              {actionMutation.error && <p className="text-sm font-semibold text-red-600">{actionMutation.error.message}</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.status === "draft" && roleCanCreate(role) && <Button type="button" onClick={() => runAction("submit")}><Send className="h-4 w-4" /> Submit</Button>}
              {detail.status === "submitted" && roleCanManage(role) && <Button type="button" onClick={() => runAction("verify", { adminNote: actionMessage || undefined })}><ClipboardCheck className="h-4 w-4" /> Verifikasi</Button>}
              {detail.status === "verified" && roleCanApprove(role) && <Button type="button" onClick={() => runAction("approve", { leaderNote: actionMessage || undefined })}><CheckCircle2 className="h-4 w-4" /> Approve</Button>}
              {detail.status === "verified" && roleCanApprove(role) && <Button type="button" variant="outline" onClick={() => runAction("reject", { rejectionReason: actionMessage || "Ditolak" })}><XCircle className="h-4 w-4" /> Reject</Button>}
              {detail.status === "approved" && roleCanManage(role) && <Button type="button" onClick={() => runAction("disburse", { disbursementNote: actionMessage || "Dicairkan oleh BAUK" })}><WalletCards className="h-4 w-4" /> Cairkan</Button>}
              {detail.status === "disbursed" && roleCanCreate(role) && <Button type="button" onClick={() => runAction("submit-lpj", { lpjNote: actionMessage || "LPJ dikirim" })}><FileCheck2 className="h-4 w-4" /> Submit LPJ</Button>}
              {detail.status === "lpj_submitted" && roleCanManage(role) && <Button type="button" onClick={() => runAction("complete", { adminNote: actionMessage || undefined })}>Selesaikan</Button>}
              {["draft", "submitted"].includes(detail.status) && roleCanCreate(role) && <Button type="button" variant="outline" onClick={() => runAction("cancel", { userNote: actionMessage || undefined })}>Batalkan</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
