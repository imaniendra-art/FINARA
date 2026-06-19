"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Edit2, FileSpreadsheet, Loader2, Plus, Save, Search, Upload, UserX, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const studentFormSchema = z.object({
  nim: z.string().trim().min(1, "NIM wajib diisi"),
  name: z.string().trim().min(1, "Nama wajib diisi"),
  gender: z
    .enum(["L", "P"], { message: "Jenis kelamin tidak valid" })
    .optional()
    .or(z.literal(""))
    .transform((val) => val || undefined),
  programStudy: z.string().trim().min(1, "Program studi wajib diisi"),
  className: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((val) => val || undefined),
  entryYear: z.coerce
    .number()
    .int("Tahun masuk harus berupa angka")
    .min(1900, "Tahun masuk tidak valid")
    .max(3000, "Tahun masuk tidak valid"),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "graduated", "dropped_out"], {
    message: "Status wajib dipilih",
  }),
  biayaPendidikan: z.enum(["KIP", "Reguler"], {
    message: "Biaya Pendidikan wajib dipilih",
  }),
});

type StudentFormInput = z.input<typeof studentFormSchema>;
type StudentFormValues = z.output<typeof studentFormSchema>;

type StudentStatus = "active" | "inactive" | "graduated" | "dropped_out";

type StudentRow = {
  _id: string;
  nim: string;
  name: string;
  gender?: "L" | "P";
  programStudy: string;
  className?: string;
  entryYear: number;
  phone?: string;
  address?: string;
  status: StudentStatus;
  biayaPendidikan: "KIP" | "Reguler";
  createdAt?: string;
  updatedAt?: string;
};

type StudentsResponse = {
  students: StudentRow[];
  options: {
    entryYears: number[];
    programStudies: string[];
    statuses: StudentStatus[];
  };
};

type ToastState = { type: "success" | "error"; message: string } | null;

const writeRoles = ["super_admin", "admin_bauk", "staff_bauk"];
const importRoles = ["super_admin", "admin_bauk"];
const statusLabels: Record<StudentStatus, string> = {
  active: "Aktif",
  inactive: "Nonaktif",
  graduated: "Lulus",
  dropped_out: "Drop Out",
};

type ImportStudentData = StudentFormValues;

type ImportPreviewRow = {
  rowNumber: number;
  data: Partial<ImportStudentData>;
  isValid: boolean;
  exists: boolean;
  existingStudentId: string | null;
  errors: string[];
};

type ImportPreviewResponse = {
  rows: ImportPreviewRow[];
  summary: {
    total: number;
    valid: number;
    errors: number;
    existing: number;
  };
};

type ImportResultResponse = {
  summary: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  skipped: { rowNumber: number; nim: string; name: string; reason: string }[];
  failed: { rowNumber: number; nim: string; name: string; reason: string }[];
};

const defaultValues: StudentFormInput = {
  nim: "",
  name: "",
  gender: "",
  programStudy: "",
  className: "",
  entryYear: new Date().getFullYear(),
  phone: "",
  address: "",
  status: "active",
  biayaPendidikan: "Reguler",
};

function buildStudentsUrl(filters: {
  search: string;
  entryYear: string;
  programStudy: string;
  status: string;
}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return `/api/students${query ? `?${query}` : ""}`;
}

async function fetchStudents(filters: {
  search: string;
  entryYear: string;
  programStudy: string;
  status: string;
}) {
  const response = await fetch(buildStudentsUrl(filters));
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat data mahasiswa.");
  }

  return data as StudentsResponse;
}

async function saveStudent(values: StudentFormValues & { id?: string }) {
  const response = await fetch(values.id ? `/api/students/${values.id}` : "/api/students", {
    method: values.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Mahasiswa gagal disimpan.");
  }

  return data;
}

async function deactivateStudent(id: string) {
  const response = await fetch(`/api/students/${id}/deactivate`, { method: "POST" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Mahasiswa gagal dinonaktifkan.");
  }

  return data;
}

async function previewStudentImport(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/students/import/preview", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Preview import mahasiswa gagal.");
  }

  return data as ImportPreviewResponse;
}

async function importStudents(values: {
  duplicateStrategy: "skip" | "update";
  rows: (ImportStudentData & { rowNumber: number })[];
}) {
  const response = await fetch("/api/students/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Import mahasiswa gagal.");
  }

  return data as ImportResultResponse;
}

function statusClass(status: StudentStatus) {
  if (status === "active") {
    return "text-emerald-700";
  }

  if (status === "inactive") {
    return "text-slate-500";
  }

  if (status === "graduated") {
    return "text-blue-700";
  }

  return "text-red-600";
}


export default function StudentsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canManage = writeRoles.includes(session?.user?.role ?? "");
  const canImport = importRoles.includes(session?.user?.role ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update">("skip");
  const [importResult, setImportResult] = useState<ImportResultResponse | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    entryYear: "",
    programStudy: "",
    status: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [toast, setToast] = useState<ToastState>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["students", filters],
    queryFn: () => fetchStudents(filters),
  });

  const paginatedStudents = useMemo(() => {
    if (!data?.students) return [];
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return data.students.slice(start, end);
  }, [data?.students, currentPage, rowsPerPage]);

  const totalPages = Math.ceil((data?.students?.length || 0) / rowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, rowsPerPage]);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  const form = useForm<StudentFormInput, unknown, StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues,
  });

  const saveMutation = useMutation({
    mutationFn: saveStudent,
    onSuccess: async () => {
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      setShowForm(false);
      form.reset(defaultValues);
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
      setToast({
        type: "success",
        message: wasEditing ? "Data mahasiswa berhasil diperbarui." : "Data mahasiswa berhasil ditambahkan.",
      });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Mahasiswa gagal disimpan.",
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateStudent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
      setToast({ type: "success", message: "Mahasiswa berhasil dinonaktifkan." });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Mahasiswa gagal dinonaktifkan.",
      });
    },
  });

  const previewImportMutation = useMutation({
    mutationFn: previewStudentImport,
    onSuccess: (preview) => {
      setImportPreview(preview);
      setImportResult(null);
      setDuplicateStrategy("skip");
    },
  });

  const confirmImportMutation = useMutation({
    mutationFn: importStudents,
    onSuccess: async (result) => {
      setImportResult(result);
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
      setToast({ type: "success", message: "Import mahasiswa selesai diproses." });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Import mahasiswa gagal.",
      });
    },
  });

  const summary = useMemo(() => {
    const students = data?.students ?? [];
    return {
      total: students.length,
      active: students.filter((student) => student.status === "active").length,
      inactive: students.filter((student) => student.status === "inactive").length,
      graduated: students.filter((student) => student.status === "graduated").length,
    };
  }, [data?.students]);



  const validImportRows = useMemo(() => {
    return (importPreview?.rows ?? [])
      .filter((row): row is ImportPreviewRow & { data: ImportStudentData } => row.isValid)
      .map((row) => ({ ...row.data, rowNumber: row.rowNumber }));
  }, [importPreview?.rows]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: "", entryYear: "", programStudy: "", status: "" });
  }

  function startAdd() {
    setEditingId(null);
    setShowForm(true);
    saveMutation.reset();
    form.reset(defaultValues);
  }

  function startEdit(student: StudentRow) {
    setEditingId(student._id);
    setShowForm(true);
    saveMutation.reset();
    form.reset({
      nim: student.nim,
      name: student.name,
      gender: student.gender ?? "",
      programStudy: student.programStudy,
      className: student.className ?? "",
      entryYear: student.entryYear,
      phone: student.phone ?? "",
      address: student.address ?? "",
      status: student.status,
      biayaPendidikan: student.biayaPendidikan ?? "Reguler",
    });
  }

  function cancelForm() {
    setEditingId(null);
    setShowForm(false);
    saveMutation.reset();
    form.reset(defaultValues);
  }

  function handleDeactivate(student: StudentRow) {
    if (student.status === "inactive") {
      return;
    }

    deactivateMutation.mutate(student._id);
  }

  function downloadTemplate() {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["nim", "name", "gender", "programStudy", "className", "entryYear", "phone", "address", "status", "biayaPendidikan", "spp"],
      ["2024001", "Nama Mahasiswa", "L", "Manajemen", "A", new Date().getFullYear(), "08123456789", "Alamat", "active", "Reguler", 2500000],
    ]);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Mahasiswa");
    XLSX.writeFile(workbook, "template-import-mahasiswa-finara.xlsx");
  }

  function handleImportFile(file?: File) {
    setSelectedImportFile(file ?? null);
  }

  function confirmImport() {
    confirmImportMutation.mutate({
      duplicateStrategy,
      rows: validImportRows,
    });
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={[
            "fixed right-6 top-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg",
            toast.type === "success" ? "bg-emerald-700" : "bg-red-700",
          ].join(" ")}
          role="status"
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Mahasiswa" description="Kelola master mahasiswa untuk penagihan dan pembayaran FINARA." />
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {canImport && (
              <Button type="button" variant="outline" onClick={() => setShowImport((current) => !current)}>
                <Upload />
                Import Excel
              </Button>
            )}
            <Button type="button" onClick={startAdd}>
              <Plus />
              Tambah Mahasiswa
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">{summary.total}</div>
            <p className="text-sm text-slate-500">Data sesuai filter</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-700">{summary.active}</div>
            <p className="text-sm text-slate-500">Dapat ditagihkan</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Nonaktif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-700">{summary.inactive}</div>
            <p className="text-sm text-slate-500">Tidak dihapus</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Lulus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-700">{summary.graduated}</div>
            <p className="text-sm text-slate-500">Status alumni</p>
          </CardContent>
        </Card>
      </div>

      {canImport && showImport && (
        <Card>
          <CardHeader>
            <CardTitle>Import Mahasiswa dari Excel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">File Excel</label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => handleImportFile(event.target.files?.[0])}
                />
              </div>
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                <Download />
                Download Template
              </Button>
              <Button
                type="button"
                disabled={!selectedImportFile || previewImportMutation.isPending}
                onClick={() => selectedImportFile && previewImportMutation.mutate(selectedImportFile)}
              >
                {previewImportMutation.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
                Upload untuk Preview
              </Button>
            </div>

            {previewImportMutation.error && (
              <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {previewImportMutation.error.message}
              </div>
            )}

            {importPreview && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-500">Total Baris</p>
                    <p className="text-lg font-semibold text-slate-900">{importPreview.summary.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Valid</p>
                    <p className="text-lg font-semibold text-emerald-700">{importPreview.summary.valid}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Error</p>
                    <p className="text-lg font-semibold text-red-600">{importPreview.summary.errors}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">NIM Sudah Ada</p>
                    <p className="text-lg font-semibold text-amber-700">{importPreview.summary.existing}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <span>Jika NIM sudah ada</span>
                    <select
                      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={duplicateStrategy}
                      onChange={(event) => setDuplicateStrategy(event.target.value as "skip" | "update")}
                    >
                      <option value="skip">Skip</option>
                      <option value="update">Update</option>
                    </select>
                  </label>
                  <Button
                    type="button"
                    disabled={validImportRows.length === 0 || confirmImportMutation.isPending}
                    onClick={confirmImport}
                  >
                    {confirmImportMutation.isPending ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                    Konfirmasi Import {validImportRows.length} Baris Valid
                  </Button>
                </div>

                {confirmImportMutation.error && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {confirmImportMutation.error.message}
                  </div>
                )}

                {importResult && (
                  <div className="grid gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm md:grid-cols-4">
                    <div>Dibuat: <strong>{importResult.summary.created}</strong></div>
                    <div>Diupdate: <strong>{importResult.summary.updated}</strong></div>
                    <div>Dilewati: <strong>{importResult.summary.skipped}</strong></div>
                    <div>Gagal: <strong>{importResult.summary.failed}</strong></div>
                  </div>
                )}

                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b bg-card text-left text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Baris</th>
                        <th className="py-2 pr-4 font-medium">NIM</th>
                        <th className="py-2 pr-4 font-medium">Nama</th>
                        <th className="py-2 pr-4 font-medium">Angkatan</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Validasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.map((row) => (
                        <tr key={row.rowNumber} className="border-b last:border-0">
                          <td className="py-3 pr-4">{row.rowNumber}</td>
                          <td className="py-3 pr-4">{row.data.nim || "-"}</td>
                          <td className="py-3 pr-4">{row.data.name || "-"}</td>
                          <td className="py-3 pr-4">{row.data.entryYear || "-"}</td>
                          <td className="py-3 pr-4">
                            {row.errors.length > 0 ? (
                              <span className="text-destructive">Error</span>
                            ) : row.exists ? (
                              <span className="text-amber-600 dark:text-amber-400">NIM sudah ada</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">Siap import</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            {row.errors.length > 0 ? row.errors.join(", ") : row.exists ? "Default skip, bisa update" : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Dialog open={showForm} onOpenChange={(open) => (open ? setShowForm(true) : cancelForm())}>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Mahasiswa" : "Tambah Mahasiswa"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) =>
                  saveMutation.mutate({ ...values, id: editingId ?? undefined })
                )}
                className="grid gap-4 md:grid-cols-4"
              >
                <FormField
                  control={form.control}
                  name="nim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIM</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="2024001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nama mahasiswa" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="entryYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tahun Masuk</FormLabel>
                      <FormControl>
                        <Input
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={String(field.value ?? "")}
                          onChange={(event) => field.onChange(event.target.value)}
                          type="number"
                          min="1900"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="programStudy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program Studi</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Manajemen" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="biayaPendidikan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Biaya Pendidikan</FormLabel>
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          <option value="Reguler">Reguler</option>
                          <option value="KIP">KIP</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          <option value="active">Aktif</option>
                          <option value="inactive">Nonaktif</option>
                          <option value="graduated">Lulus</option>
                          <option value="dropped_out">Drop Out</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jenis Kelamin (Opsional)</FormLabel>
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          <option value="">Pilih...</option>
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="className"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kelas (Opsional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="A / Reguler Pagi" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. Telepon (Opsional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="08..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>Alamat (Opsional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Alamat mahasiswa" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="md:col-span-4">
                  <Button type="button" variant="outline" onClick={cancelForm}>
                    <X />
                    Batal
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                    {editingId ? "Simpan Perubahan" : "Simpan"}
                  </Button>
                </DialogFooter>
                {saveMutation.error && (
                  <div className="md:col-span-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {saveMutation.error.message}
                  </div>
                )}
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filter Mahasiswa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_1fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Cari NIM atau nama"
                className="pl-8"
              />
            </div>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={filters.entryYear}
              onChange={(event) => updateFilter("entryYear", event.target.value)}
            >
              <option value="">Semua angkatan</option>
              {data?.options.entryYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={filters.programStudy}
              onChange={(event) => updateFilter("programStudy", event.target.value)}
            >
              <option value="">Semua program studi</option>
              {data?.options.programStudies.map((programStudy) => (
                <option key={programStudy} value={programStudy}>
                  {programStudy}
                </option>
              ))}
            </select>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="graduated">Lulus</option>
              <option value="dropped_out">Drop Out</option>
            </select>
            <Button type="button" variant="outline" onClick={resetFilters}>
              <X />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Daftar Mahasiswa</CardTitle>
            {!isLoading && !error && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
          {isLoading && <p className="text-sm text-muted-foreground">Memuat mahasiswa...</p>}
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {deactivateMutation.error && (
            <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {deactivateMutation.error.message}
            </div>
          )}
          
          {!isLoading && !error && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>NIM</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Program Studi</TableHead>
                    <TableHead>Angkatan</TableHead>
                    <TableHead>Biaya Pendidikan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedStudents.map((student, index) => (
                      <TableRow key={student._id}>
                        <TableCell className="text-muted-foreground">{((currentPage - 1) * rowsPerPage) + index + 1}</TableCell>
                        <TableCell className="font-medium text-foreground">{student.nim}</TableCell>
                        <TableCell className="min-w-48 whitespace-normal">{student.name}</TableCell>
                        <TableCell className="text-slate-600">{student.programStudy}</TableCell>
                        <TableCell className="text-slate-600">{student.entryYear}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={student.biayaPendidikan === "KIP" ? "text-indigo-600 dark:text-indigo-400 font-semibold border-indigo-200 dark:border-indigo-500/30" : "text-muted-foreground"}>
                            {student.biayaPendidikan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClass(student.status)}>{statusLabels[student.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {canManage && (
                              <Button type="button" variant="outline" size="sm" onClick={() => startEdit(student)} className="h-8 text-xs gap-1">
                                <Edit2 className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            )}
                            {canManage && student.status !== "inactive" && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={deactivateMutation.isPending}
                                onClick={() => handleDeactivate(student)}
                                className="h-8 text-xs gap-1"
                              >
                                {deactivateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                                Nonaktifkan
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data?.students.length === 0 && (
                      <TableRow>
                        <TableCell className="py-6 text-center text-muted-foreground" colSpan={8}>
                          Tidak ada mahasiswa yang sesuai filter.
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {data?.students && data.students.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
                  <div className="text-xs text-muted-foreground">
                    Menampilkan <strong>{((currentPage - 1) * rowsPerPage) + 1}</strong> -{" "}
                    <strong>{Math.min(currentPage * rowsPerPage, data.students.length)}</strong> dari{" "}
                    <strong>{data.students.length}</strong> entri
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
