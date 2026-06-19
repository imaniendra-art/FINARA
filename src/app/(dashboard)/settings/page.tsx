"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Edit2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Fragment } from "react";
import { type FieldValues, type Path, type UseFormReturn, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
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

const settingSchema = z.object({
  campusName: z.string().trim().min(1, "Nama kampus wajib diisi"),
  appName: z.string().trim().min(1, "Nama aplikasi wajib diisi"),
  appFullName: z.string().trim().min(1, "Nama lengkap aplikasi wajib diisi"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  leaderName: z.string().optional(),
  leaderPosition: z.string().optional(),
  logoUrl: z.string().optional(),
  currency: z.string().trim().min(1).default("IDR"),
  timezone: z.string().trim().min(1).default("Asia/Makassar"),
  dateFormat: z.string().trim().min(1).default("dd/MM/yyyy"),
  defaultTheme: z.enum(["light", "dark", "system"]),
  receiptPrefix: z.string().trim().min(1, "Prefix kwitansi wajib diisi"),
  receiptFooterText: z.string().optional(),
  receiptSignerName: z.string().optional(),
  receiptSignerPosition: z.string().optional(),
  showCampusLogo: z.coerce.boolean(),
});
const academicPeriodSchema = z.object({
  academicYear: z.string().trim().min(1, "Tahun akademik wajib diisi"),
  semester: z.enum(["ganjil", "genap"], { message: "Semester wajib dipilih" }),
  isActive: z.coerce.boolean(),
});

type SettingFormInput = z.input<typeof settingSchema>;
type SettingFormValues = z.output<typeof settingSchema>;
type AcademicPeriodInput = z.input<typeof academicPeriodSchema>;
type AcademicPeriodValues = z.output<typeof academicPeriodSchema>;
type UserRole = "super_admin" | "admin_bauk" | "staff_bauk" | "pimpinan" | "auditor";
type TabKey = "profile" | "app" | "receipt" | "academic" | "backup" | "reset" | "system" | "logs";

type AuditLogEntry = {
  _id: string;
  user: {
    name: string;
    email: string;
    role: string;
  };
  action: string;
  module: string;
  documentId: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

type AuditLogsResponse = {
  logs: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type AppSetting = SettingFormValues & {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
};

type AcademicPeriod = {
  _id: string;
  academicYear: string;
  semester: "ganjil" | "genap";
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type SystemInfo = {
  appName: string;
  appFullName: string;
  version: string;
  environment: string;
  databaseStatus: string;
  counts: {
    students: number;
    users: number;
    payments: number;
    journals: number;
  };
};

const defaultSettingValues: SettingFormInput = {
  campusName: "STIMI YAPMI Makassar",
  appName: "FINARA",
  appFullName: "Finance Administration and Reporting Application STIMI",
  address: "Makassar",
  phone: "",
  email: "-",
  website: "-",
  leaderName: "",
  leaderPosition: "",
  logoUrl: "",
  currency: "IDR",
  timezone: "Asia/Makassar",
  dateFormat: "dd/MM/yyyy",
  defaultTheme: "light",
  receiptPrefix: "KWT",
  receiptFooterText: "Terima kasih telah melakukan pembayaran.",
  receiptSignerName: "",
  receiptSignerPosition: "Petugas BAUK",
  showCampusLogo: true,
};
const defaultPeriodValues: AcademicPeriodInput = {
  academicYear: "2025/2026",
  semester: "ganjil",
  isActive: false,
};

async function fetchSettings() {
  const response = await fetch("/api/settings");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat pengaturan.");
  }

  return data.setting as AppSetting;
}

async function saveSettings(values: SettingFormValues) {
  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Pengaturan gagal disimpan.");
  }

  return data.setting as AppSetting;
}

async function fetchAcademicPeriods() {
  const response = await fetch("/api/academic-periods");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat tahun akademik.");
  }

  return data.periods as AcademicPeriod[];
}

async function saveAcademicPeriod(values: AcademicPeriodValues & { id?: string }) {
  const response = await fetch(values.id ? `/api/academic-periods/${values.id}` : "/api/academic-periods", {
    method: values.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Tahun akademik gagal disimpan.");
  }

  return data.period as AcademicPeriod;
}

async function setActivePeriod(id: string) {
  const response = await fetch(`/api/academic-periods/${id}/set-active`, { method: "POST" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Tahun akademik aktif gagal disimpan.");
  }

  return data.period as AcademicPeriod;
}

async function fetchSystemInfo() {
  const response = await fetch("/api/settings/system-info");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat informasi sistem.");
  }

  return data.system as SystemInfo;
}

async function fetchAuditLogs({
  page,
  limit,
  search,
  module,
  action,
}: {
  page: number;
  limit: number;
  search: string;
  module: string;
  action: string;
}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
    module,
    action,
  });
  const response = await fetch(`/api/settings/audit-logs?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat log aktivitas.");
  }

  return data as AuditLogsResponse;
}

async function resetAllOperationalData(password: string) {
  const response = await fetch("/api/settings/reset-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Reset data gagal.");
  }

  return response.blob();
}

function canReadSettings(role?: string) {
  return role === "super_admin" || role === "admin_bauk" || role === "pimpinan";
}

function canWriteSettings(role?: string) {
  return role === "super_admin" || role === "admin_bauk";
}

function canExport(role?: string) {
  return role === "super_admin" || role === "admin_bauk";
}

function canReset(role?: string) {
  return role === "super_admin";
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const readableSettings = canReadSettings(role);
  const writableSettings = canWriteSettings(role);
  const exportable = canExport(role);
  const resettable = canReset(role);
  // Audit Logs states
  const [logSearch, setLogSearch] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("");
  const [logModuleFilter, setLogModuleFilter] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const tabs = useMemo(() => {
    if (role === "auditor") {
      return [
        { key: "system" as const, label: "Informasi Sistem" },
        { key: "logs" as const, label: "Log Aktivitas" },
      ];
    }

    if (role === "pimpinan") {
      return [
        { key: "profile" as const, label: "Profil Kampus" },
        { key: "system" as const, label: "Informasi Sistem" },
      ];
    }

    if (role === "super_admin" || role === "admin_bauk") {
      return [
        { key: "profile" as const, label: "Profil Kampus" },
        { key: "app" as const, label: "Aplikasi" },
        { key: "receipt" as const, label: "Kwitansi" },
        { key: "academic" as const, label: "Tahun Akademik" },
        { key: "backup" as const, label: "Backup/Export" },
        ...(role === "super_admin" ? [{ key: "reset" as const, label: "Reset Data" }] : []),
        { key: "system" as const, label: "Informasi Sistem" },
        ...(role === "super_admin" ? [{ key: "logs" as const, label: "Log Aktivitas" }] : []),
      ];
    }

    return [];
  }, [role]);

  const visibleTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0]?.key;

  const settingQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    enabled: readableSettings,
  });
  const periodsQuery = useQuery({
    queryKey: ["academic-periods"],
    queryFn: fetchAcademicPeriods,
    enabled: writableSettings,
  });
  const systemQuery = useQuery({
    queryKey: ["settings", "system-info"],
    queryFn: fetchSystemInfo,
    enabled: role === "super_admin" || role === "admin_bauk" || role === "pimpinan" || role === "auditor",
  });

  const showLogs = role === "super_admin" || role === "auditor";
  const auditLogsQuery = useQuery({
    queryKey: ["settings", "audit-logs", { page: logPage, search: logSearch, action: logActionFilter, module: logModuleFilter }],
    queryFn: () => fetchAuditLogs({ page: logPage, limit: 50, search: logSearch, action: logActionFilter, module: logModuleFilter }),
    enabled: showLogs && visibleTab === "logs",
  });
  const settingForm = useForm<SettingFormInput, unknown, SettingFormValues>({
    resolver: zodResolver(settingSchema),
    defaultValues: defaultSettingValues,
  });
  const periodForm = useForm<AcademicPeriodInput, unknown, AcademicPeriodValues>({
    resolver: zodResolver(academicPeriodSchema),
    defaultValues: defaultPeriodValues,
  });

  useEffect(() => {
    if (settingQuery.data) {
      settingForm.reset({
        ...defaultSettingValues,
        ...settingQuery.data,
      });
    }
  }, [settingForm, settingQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: async () => {
      setToast("Pengaturan berhasil disimpan.");
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => setToast(error.message),
  });
  const savePeriodMutation = useMutation({
    mutationFn: saveAcademicPeriod,
    onSuccess: async () => {
      setToast("Tahun akademik berhasil disimpan.");
      setEditingPeriodId(null);
      periodForm.reset(defaultPeriodValues);
      await queryClient.invalidateQueries({ queryKey: ["academic-periods"] });
    },
    onError: (error) => setToast(error.message),
  });
  const setActiveMutation = useMutation({
    mutationFn: setActivePeriod,
    onSuccess: async () => {
      setToast("Tahun akademik aktif berhasil diperbarui.");
      await queryClient.invalidateQueries({ queryKey: ["academic-periods"] });
    },
    onError: (error) => setToast(error.message),
  });
  const resetMutation = useMutation({
    mutationFn: resetAllOperationalData,
    onSuccess: async (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = url;
      link.download = `finara-reset-backup-${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setResetPassword("");
      setResetConfirmed(false);
      setToast("Backup otomatis sudah diunduh dan data operasional berhasil di-reset.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "system-info"] }),
        queryClient.invalidateQueries({ queryKey: ["academic-periods"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => setToast(error.message),
  });

  function startEditPeriod(period: AcademicPeriod) {
    setEditingPeriodId(period._id);
    periodForm.reset({
      academicYear: period.academicYear,
      semester: period.semester,
      isActive: period.isActive,
    });
  }

  async function downloadExport(kind: string) {
    try {
      const response = await fetch(`/api/settings/export/${kind}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export gagal.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `finara-${kind}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setToast("Export berhasil dibuat.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Export gagal.");
    }
  }

  if (tabs.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Role Anda tidak memiliki akses ke menu Pengaturan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle />
      <Button type="button" variant="outline" onClick={() => router.back()}>
        <ArrowLeft />
        Back
      </Button>
      {toast && (
        <div className="fixed right-6 top-6 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-100">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant={visibleTab === tab.key ? "default" : "ghost"}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {settingQuery.isLoading && readableSettings && <p className="text-sm text-slate-500">Memuat pengaturan...</p>}
      {settingQuery.error && <p className="text-sm text-red-600">{settingQuery.error.message}</p>}

      {visibleTab === "profile" && (
        <SettingFormShell
          title="Profil Kampus"
          disabled={!writableSettings}
          isPending={saveSettingsMutation.isPending}
          onSubmit={settingForm.handleSubmit((values) => saveSettingsMutation.mutate(values))}
        >
          <Form {...settingForm}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField form={settingForm} name="campusName" label="Nama Kampus" disabled={!writableSettings} />
              <TextField form={settingForm} name="appName" label="Nama Aplikasi" disabled={!writableSettings} />
              <TextField form={settingForm} name="address" label="Alamat Kampus" disabled={!writableSettings} />
              <TextField form={settingForm} name="phone" label="Telepon" disabled={!writableSettings} />
              <TextField form={settingForm} name="email" label="Email" disabled={!writableSettings} />
              <TextField form={settingForm} name="website" label="Website" disabled={!writableSettings} />
              <TextField form={settingForm} name="leaderName" label="Nama Pimpinan" disabled={!writableSettings} />
              <TextField form={settingForm} name="leaderPosition" label="Jabatan Pimpinan" disabled={!writableSettings} />
              <TextField form={settingForm} name="logoUrl" label="Logo URL" disabled={!writableSettings} />
            </div>
          </Form>
        </SettingFormShell>
      )}

      {visibleTab === "app" && writableSettings && (
        <SettingFormShell
          title="Pengaturan Aplikasi"
          disabled={false}
          isPending={saveSettingsMutation.isPending}
          onSubmit={settingForm.handleSubmit((values) => saveSettingsMutation.mutate(values))}
        >
          <Form {...settingForm}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField form={settingForm} name="appName" label="App Name" />
              <TextField form={settingForm} name="appFullName" label="App Full Name" />
              <TextField form={settingForm} name="currency" label="Currency" />
              <TextField form={settingForm} name="timezone" label="Timezone" />
              <TextField form={settingForm} name="dateFormat" label="Date Format" />
              <SelectField
                form={settingForm}
                name="defaultTheme"
                label="Default Theme"
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
              />
            </div>
          </Form>
        </SettingFormShell>
      )}

      {visibleTab === "receipt" && writableSettings && (
        <SettingFormShell
          title="Pengaturan Kwitansi"
          disabled={false}
          isPending={saveSettingsMutation.isPending}
          onSubmit={settingForm.handleSubmit((values) => saveSettingsMutation.mutate(values))}
        >
          <Form {...settingForm}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField form={settingForm} name="receiptPrefix" label="Prefix Kwitansi" />
              <TextField form={settingForm} name="receiptFooterText" label="Footer Kwitansi" />
              <TextField form={settingForm} name="receiptSignerName" label="Nama Penandatangan" />
              <TextField form={settingForm} name="receiptSignerPosition" label="Jabatan Penandatangan" />
              <FormField
                control={settingForm.control}
                name="showCampusLogo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tampilkan Logo Kampus</FormLabel>
                    <FormControl>
                      <label className="flex h-8 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(field.value)}
                          onChange={(event) => field.onChange(event.target.checked)}
                        />
                        Aktif
                      </label>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
        </SettingFormShell>
      )}

      {visibleTab === "academic" && writableSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Tahun Akademik dan Semester</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Form {...periodForm}>
              <form
                onSubmit={periodForm.handleSubmit((values) =>
                  savePeriodMutation.mutate({ ...values, id: editingPeriodId ?? undefined })
                )}
                className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]"
              >
                <TextField form={periodForm} name="academicYear" label="Tahun Akademik" />
                <SelectField
                  form={periodForm}
                  name="semester"
                  label="Semester"
                  options={[
                    { value: "ganjil", label: "Ganjil" },
                    { value: "genap", label: "Genap" },
                  ]}
                />
                <FormField
                  control={periodForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aktif</FormLabel>
                      <FormControl>
                        <label className="flex h-8 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(field.value)}
                            onChange={(event) => field.onChange(event.target.checked)}
                          />
                          Aktif
                        </label>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button type="submit" disabled={savePeriodMutation.isPending}>
                    {savePeriodMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    {editingPeriodId ? "Update" : "Tambah"}
                  </Button>
                </div>
              </form>
            </Form>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Tahun Akademik</th>
                    <th className="py-2 pr-4 font-medium">Semester</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {periodsQuery.data?.map((period) => (
                    <tr key={period._id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium text-slate-900">{period.academicYear}</td>
                      <td className="py-3 pr-4 capitalize">{period.semester}</td>
                      <td className="py-3 pr-4">
                        {period.isActive ? <Badge>Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => startEditPeriod(period)}>
                            <Edit2 />
                            Edit
                          </Button>
                          {!period.isActive && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={setActiveMutation.isPending}
                              onClick={() => setActiveMutation.mutate(period._id)}
                            >
                              <CheckCircle2 />
                              Set Aktif
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {periodsQuery.data?.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-slate-500" colSpan={4}>
                        Belum ada tahun akademik.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {visibleTab === "backup" && exportable && (
        <Card>
          <CardHeader>
            <CardTitle>Backup/Export Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["students", "Export Mahasiswa"],
                ["bills", "Export Tagihan"],
                ["payments", "Export Pembayaran"],
                ["journals", "Export Jurnal"],
                ["cash-transactions", "Export Kas Transaksi"],
              ].map(([kind, label]) => (
                <Button key={kind} type="button" variant="outline" onClick={() => void downloadExport(kind)}>
                  <Download />
                  {label}
                </Button>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">Restore data belum tersedia demi keamanan operasional.</p>
          </CardContent>
        </Card>
      )}

      {visibleTab === "reset" && resettable && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Hapus/Reset All Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Backup otomatis dibuat sebelum reset.</p>
              <p className="mt-1">
                Tombol ini menghapus data operasional: mahasiswa, kode akun, jenis tagihan,
                tagihan, pembayaran, kas transaksi, jurnal, dan tahun akademik. Akun pengguna,
                password, pengaturan aplikasi, dan audit log tetap dipertahankan agar FINARA
                masih bisa diakses setelah reset.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Password super admin
                </label>
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="Masukkan password akun saat ini"
                  autoComplete="current-password"
                />
              </div>
              <label className="flex items-end gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={resetConfirmed}
                  onChange={(event) => setResetConfirmed(event.target.checked)}
                />
                Saya sudah memahami bahwa data operasional akan dihapus setelah backup dibuat.
              </label>
            </div>

            <Button
              type="button"
              variant="destructive"
              disabled={!resetPassword || !resetConfirmed || resetMutation.isPending}
              onClick={() => resetMutation.mutate(resetPassword)}
            >
              {resetMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Backup dan Reset All
            </Button>
          </CardContent>
        </Card>
      )}

      {visibleTab === "system" && (
        <Card>
          <CardHeader>
            <CardTitle>Informasi Sistem</CardTitle>
          </CardHeader>
          <CardContent>
            {systemQuery.isLoading && <p className="text-sm text-slate-500">Memuat informasi sistem...</p>}
            {systemQuery.error && <p className="text-sm text-red-600">{systemQuery.error.message}</p>}
            {systemQuery.data && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="Nama Aplikasi" value={systemQuery.data.appName} />
                <InfoItem label="Versi" value={systemQuery.data.version} />
                <InfoItem label="Environment" value={systemQuery.data.environment} />
                <InfoItem label="Database" value={systemQuery.data.databaseStatus} />
                <InfoItem label="Mahasiswa" value={String(systemQuery.data.counts.students)} />
                <InfoItem label="User" value={String(systemQuery.data.counts.users)} />
                <InfoItem label="Pembayaran" value={String(systemQuery.data.counts.payments)} />
                <InfoItem label="Jurnal" value={String(systemQuery.data.counts.journals)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {visibleTab === "logs" && showLogs && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Log Aktivitas (Audit History)</CardTitle>
              <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full w-fit">
                Khusus Auditor & Super Admin
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter Panel */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Cari Pelaku / Detail</label>
                <Input
                  type="text"
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setLogPage(1); // reset to page 1 on search
                  }}
                  placeholder="Nama, email, atau modul..."
                  className="h-9 text-sm rounded-lg"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Aksi</label>
                <select
                  value={logActionFilter}
                  onChange={(e) => {
                    setLogActionFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Semua Aksi</option>
                  <option value="create">Tambah (Create)</option>
                  <option value="update">Ubah (Update)</option>
                  <option value="delete">Hapus (Delete)</option>
                  <option value="post">Posting (Post)</option>
                  <option value="cancel">Batalkan (Cancel)</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Modul</label>
                <select
                  value={logModuleFilter}
                  onChange={(e) => {
                    setLogModuleFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Semua Modul</option>
                  <option value="Student">Mahasiswa</option>
                  <option value="FeeType">Jenis Tagihan</option>
                  <option value="Payment">Pembayaran</option>
                  <option value="JournalEntry">Jurnal</option>
                  <option value="CashTransaction">Kas Transaksi</option>
                  <option value="AcademicPeriod">Tahun Akademik</option>
                  <option value="User">User / Akun</option>
                  <option value="AppSetting">Pengaturan Sistem</option>
                </select>
              </div>
            </div>

            {/* Error or Loading State */}
            {auditLogsQuery.isLoading && <p className="py-8 text-center text-sm text-slate-500">Memuat log aktivitas...</p>}
            {auditLogsQuery.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {auditLogsQuery.error.message}
              </div>
            )}

            {/* Logs Table */}
            {auditLogsQuery.data && (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="p-3 font-medium">Waktu</th>
                        <th className="p-3 font-medium">Akun / Pelaku</th>
                        <th className="p-3 font-medium">Aksi</th>
                        <th className="p-3 font-medium">Modul</th>
                        <th className="p-3 font-medium">ID Dokumen</th>
                        <th className="p-3 font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogsQuery.data.logs.map((log) => {
                        const isExpanded = expandedLogId === log._id;
                        
                        // Action Badge styling
                        let actionBadgeColor = "bg-slate-100 text-slate-700";
                        let actionLabel = log.action;
                        if (log.action === "create") {
                          actionBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                          actionLabel = "Tambah";
                        } else if (log.action === "update") {
                          actionBadgeColor = "bg-blue-100 text-blue-800 border-blue-200";
                          actionLabel = "Ubah";
                        } else if (log.action === "delete") {
                          actionBadgeColor = "bg-red-100 text-red-800 border-red-200";
                          actionLabel = "Hapus";
                        } else if (log.action === "post") {
                          actionBadgeColor = "bg-amber-100 text-amber-800 border-amber-200";
                          actionLabel = "Posting";
                        } else if (log.action === "cancel") {
                          actionBadgeColor = "bg-rose-100 text-rose-800 border-rose-200";
                          actionLabel = "Batalkan";
                        }

                        // Module translation helper
                        const moduleLabels: Record<string, string> = {
                          Student: "Mahasiswa",
                          FeeType: "Jenis Tagihan",
                          Payment: "Pembayaran",
                          JournalEntry: "Jurnal",
                          CashTransaction: "Kas Transaksi",
                          AcademicPeriod: "Tahun Akademik",
                          User: "User / Akun",
                          AppSetting: "Pengaturan",
                        };
                        const moduleLabel = moduleLabels[log.module] || log.module;

                        return (
                          <Fragment key={log._id}>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3 whitespace-nowrap text-xs text-slate-500 font-mono">
                                {new Intl.DateTimeFormat("id-ID", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }).format(new Date(log.createdAt))}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="font-medium text-slate-900">{log.user.name}</div>
                                <div className="text-xs text-slate-400">{log.user.email}</div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${actionBadgeColor}`}>
                                  {actionLabel}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap text-slate-700 font-medium">
                                {moduleLabel}
                              </td>
                              <td className="p-3 whitespace-nowrap text-xs font-mono text-slate-400">
                                {log.documentId}
                              </td>
                              <td className="p-3 whitespace-nowrap text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs font-medium text-blue-600 hover:text-blue-700"
                                  onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                                >
                                  {isExpanded ? "Sembunyikan" : "Lihat Detail"}
                                </Button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="bg-slate-50 p-4 border-l-2 border-blue-500">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Sebelum Perubahan (Before)</h4>
                                      {log.before ? (
                                        <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-auto max-h-60 shadow-inner">
                                          {JSON.stringify(log.before, null, 2)}
                                        </pre>
                                      ) : (
                                        <div className="p-3 bg-slate-100 text-slate-400 text-xs italic rounded-lg">Tidak ada data sebelumnya (Data baru)</div>
                                      )}
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Sesudah Perubahan (After)</h4>
                                      {log.after ? (
                                        <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-auto max-h-60 shadow-inner">
                                          {JSON.stringify(log.after, null, 2)}
                                        </pre>
                                      ) : (
                                        <div className="p-3 bg-slate-100 text-slate-400 text-xs italic rounded-lg">Data dihapus</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {auditLogsQuery.data.logs.length === 0 && (
                        <tr>
                          <td className="p-8 text-center text-slate-500" colSpan={6}>
                            Tidak ditemukan log aktivitas yang sesuai.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {auditLogsQuery.data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4 text-sm text-slate-500">
                    <div>
                      Menampilkan halaman {auditLogsQuery.data.pagination.page} dari {auditLogsQuery.data.pagination.totalPages} ({auditLogsQuery.data.pagination.total} total log)
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={logPage === 1}
                        onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={logPage === auditLogsQuery.data.pagination.totalPages}
                        onClick={() => setLogPage((p) => Math.min(auditLogsQuery.data.pagination.totalPages, p + 1))}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengaturan</h1>
      <p className="text-slate-500">Konfigurasi dasar aplikasi FINARA.</p>
    </div>
  );
}

function SettingFormShell({
  title,
  disabled,
  isPending,
  onSubmit,
  children,
}: {
  title: string;
  disabled: boolean;
  isPending: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          {!disabled && (
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Simpan Pengaturan
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function TextField<TValues extends FieldValues>({
  form,
  name,
  label,
  disabled = false,
}: {
  form: UseFormReturn<TValues>;
  name: Path<TValues>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={String(field.value ?? "")} disabled={disabled} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectField<TValues extends FieldValues>({
  form,
  name,
  label,
  options,
}: {
  form: UseFormReturn<TValues>;
  name: Path<TValues>;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={String(field.value ?? "")}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}
