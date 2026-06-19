"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Loader2, Plus, Search, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
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

const billFormSchema = z
  .object({
    studentId: z.string().min(1, "Mahasiswa wajib dipilih"),
    feeTypeId: z.string().min(1, "Jenis tagihan wajib dipilih"),
    academicYear: z.string().min(4, "Tahun akademik wajib diisi"),
    semester: z.string().min(1, "Semester wajib diisi"),
    amount: z.coerce.number().nonnegative("Nominal tagihan tidak boleh negatif"),
    discount: z.coerce.number().nonnegative("Diskon tidak boleh negatif"),
    dueDate: z.string().min(1, "Tanggal jatuh tempo wajib diisi"),
    notes: z.string().optional(),
  })
  .refine((data) => data.discount <= data.amount, {
    message: "Diskon tidak boleh lebih besar dari nominal tagihan",
    path: ["discount"],
  });

const bulkBillFormSchema = z
  .object({
    feeTypeId: z.string().min(1, "Jenis tagihan wajib dipilih"),
    academicYear: z.string().trim().min(4, "Tahun akademik wajib diisi"),
    semester: z.string().trim().min(1, "Semester wajib diisi"),
    entryYear: z.string().optional(),
    programStudy: z.string().optional(),
    className: z.string().optional(),
    status: z.literal("active", { message: "Status mahasiswa harus aktif" }),
    biayaPendidikan: z.string().optional(),
    amount: z.coerce.number().nonnegative("Nominal tagihan tidak boleh negatif"),
    discount: z.coerce.number().nonnegative("Diskon tidak boleh negatif"),
    dueDate: z.string().min(1, "Tanggal jatuh tempo wajib diisi"),
    notes: z.string().optional(),
  })
  .refine((data) => data.discount <= data.amount, {
    message: "Diskon tidak boleh lebih besar dari nominal tagihan",
    path: ["discount"],
  });

type BillFormInput = z.input<typeof billFormSchema>;
type BillFormValues = z.output<typeof billFormSchema>;
type BulkBillFormInput = z.input<typeof bulkBillFormSchema>;
type BulkBillFormValues = z.output<typeof bulkBillFormSchema>;

type StudentOption = {
  _id: string;
  nim: string;
  name: string;
};

type FeeTypeOption = {
  _id: string;
  name: string;
  defaultAmount: number;
};

type BillRow = {
  _id: string;
  studentId?: StudentOption;
  feeTypeId?: FeeTypeOption;
  academicYear: string;
  semester: string;
  amount: number;
  discount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
};

type BillsResponse = {
  bills: BillRow[];
  students: StudentOption[];
  feeTypes: FeeTypeOption[];
  options: {
    entryYears: number[];
    programStudies: string[];
    classNames: string[];
  };
};

type BulkPreviewStudent = {
  _id: string;
  nim: string;
  name: string;
  entryYear: number;
  programStudy: string;
  className: string;
  status: string;
  canGenerate: boolean;
  reason: string | null;
};

type BulkPreviewResponse = {
  feeType: FeeTypeOption;
  students: BulkPreviewStudent[];
  summary: {
    total: number;
    available: number;
    duplicate: number;
  };
};

type BulkGenerateResponse = {
  summary: {
    created: number;
    skipped: number;
    failed: number;
  };
  skipped: { studentId: string; nim?: string; name?: string; reason: string }[];
  failed: { studentId: string; nim?: string; name?: string; reason: string }[];
};

const writeRoles = ["super_admin", "admin_bauk", "staff_bauk"];

const defaultBillValues: BillFormInput = {
  studentId: "",
  feeTypeId: "",
  academicYear: "2025/2026",
  semester: "Ganjil",
  amount: 0,
  discount: 0,
  dueDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

const defaultBulkValues: BulkBillFormInput = {
  feeTypeId: "",
  academicYear: "2025/2026",
  semester: "Ganjil",
  entryYear: "",
  programStudy: "",
  className: "",
  status: "active",
  biayaPendidikan: "",
  amount: 0,
  discount: 0,
  dueDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

async function fetchBills() {
  const response = await fetch("/api/bills");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat tagihan.");
  }

  return data as BillsResponse;
}

async function createBill(values: BillFormValues) {
  const response = await fetch("/api/bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Tagihan gagal disimpan.");
  }

  return data;
}

function buildBulkPreviewUrl(values: BulkBillFormValues) {
  const params = new URLSearchParams({
    feeTypeId: values.feeTypeId,
    academicYear: values.academicYear,
    semester: values.semester,
    status: values.status,
  });

  if (values.entryYear) {
    params.set("entryYear", values.entryYear);
  }

  if (values.programStudy) {
    params.set("programStudy", values.programStudy);
  }

  if (values.className) {
    params.set("className", values.className);
  }

  if (values.biayaPendidikan) {
    params.set("biayaPendidikan", values.biayaPendidikan);
  }

  return `/api/bills/bulk/preview?${params.toString()}`;
}

async function fetchBulkPreview(values: BulkBillFormValues) {
  const response = await fetch(buildBulkPreviewUrl(values));
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat preview tagihan massal.");
  }

  return data as BulkPreviewResponse;
}

async function generateBulkBills(values: BulkBillFormValues & { studentIds: string[] }) {
  const response = await fetch("/api/bills/bulk/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Generate tagihan massal gagal.");
  }

  return data as BulkGenerateResponse;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function BillsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canGenerateBulk = writeRoles.includes(session?.user?.role ?? "");
  const [previewValues, setPreviewValues] = useState<BulkBillFormValues | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [generateResult, setGenerateResult] = useState<BulkGenerateResponse | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [billSearchTerm, setBillSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data, isLoading, error } = useQuery({
    queryKey: ["bills"],
    queryFn: fetchBills,
  });

  const filteredBills = useMemo(() => {
    if (!data?.bills) return [];
    const search = billSearchTerm.toLowerCase().trim();
    if (!search) return data.bills;
    return data.bills.filter((bill) => {
      const studentName = bill.studentId?.name?.toLowerCase() || "";
      const studentNim = bill.studentId?.nim?.toLowerCase() || "";
      const feeTypeName = bill.feeTypeId?.name?.toLowerCase() || "";
      const period = `${bill.academicYear} ${bill.semester}`.toLowerCase();
      return (
        studentName.includes(search) ||
        studentNim.includes(search) ||
        feeTypeName.includes(search) ||
        period.includes(search)
      );
    });
  }, [data?.bills, billSearchTerm]);

  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredBills.slice(start, end);
  }, [filteredBills, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredBills.length / rowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [billSearchTerm, rowsPerPage]);

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

  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    const search = studentSearch.toLowerCase().trim();
    if (!search) return data.students;
    return data.students.filter(
      (s) =>
        s.nim.toLowerCase().includes(search) ||
        s.name.toLowerCase().includes(search)
    );
  }, [data, studentSearch]);

  const previewQuery = useQuery({
    queryKey: ["bills", "bulk-preview", previewValues],
    queryFn: () => fetchBulkPreview(previewValues as BulkBillFormValues),
    enabled: Boolean(previewValues),
  });

  const form = useForm<BillFormInput, unknown, BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues: defaultBillValues,
  });

  const bulkForm = useForm<BulkBillFormInput, unknown, BulkBillFormValues>({
    resolver: zodResolver(bulkBillFormSchema),
    defaultValues: defaultBulkValues,
  });

  const mutation = useMutation({
    mutationFn: createBill,
    onSuccess: async () => {
      form.reset(defaultBillValues);
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: generateBulkBills,
    onSuccess: async (result) => {
      setGenerateResult(result);
      setSelectedStudentIds([]);
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
      await queryClient.invalidateQueries({ queryKey: ["bills", "bulk-preview"] });
    },
  });

  const availablePreviewIds = useMemo(
    () => previewQuery.data?.students.filter((student) => student.canGenerate).map((student) => student._id) ?? [],
    [previewQuery.data?.students]
  );

  const selectedCount = selectedStudentIds.length;

  function syncAmountFromFeeType(feeTypeId: string, target: "single" | "bulk") {
    const feeType = data?.feeTypes.find((item) => item._id === feeTypeId);

    if (!feeType) {
      return;
    }

    if (target === "single") {
      form.setValue("amount", feeType.defaultAmount);
      return;
    }

    bulkForm.setValue("amount", feeType.defaultAmount);
  }

  function toggleStudent(studentId: string, checked: boolean) {
    setSelectedStudentIds((current) => {
      if (checked) {
        return current.includes(studentId) ? current : [...current, studentId];
      }

      return current.filter((id) => id !== studentId);
    });
  }

  function toggleAllAvailable(checked: boolean) {
    setSelectedStudentIds(checked ? availablePreviewIds : []);
  }

  function submitPreview(values: BulkBillFormValues) {
    setGenerateResult(null);
    setPreviewValues(values);
  }

  function submitBulkGenerate() {
    void bulkForm.handleSubmit((values) => {
      bulkGenerateMutation.mutate({ ...values, studentIds: selectedStudentIds });
    })();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tagihan Mahasiswa" description="Kelola tagihan, generate massal, dan sisa pembayaran mahasiswa." />

      <Card>
        <CardHeader>
          <CardTitle>Generate Tagihan Massal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canGenerateBulk && (
            <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
              Role Anda tidak memiliki akses generate tagihan massal.
            </div>
          )}

          <Form {...bulkForm}>
            <form onSubmit={bulkForm.handleSubmit(submitPreview)} className="grid gap-4 md:grid-cols-4">
              <FormField
                control={bulkForm.control}
                name="feeTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis Tagihan</FormLabel>
                    <FormControl>
                      <select
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          syncAmountFromFeeType(event.target.value, "bulk");
                        }}
                      >
                        <option value="">Pilih jenis</option>
                        {data?.feeTypes.map((feeType) => (
                          <option key={feeType._id} value={feeType._id}>
                            {feeType.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="academicYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tahun Akademik</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="semester"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semester</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="entryYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Angkatan</FormLabel>
                    <FormControl>
                      <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                        <option value="">Semua angkatan</option>
                        {data?.options.entryYears.map((entryYear) => (
                          <option key={entryYear} value={entryYear}>
                            {entryYear}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="programStudy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program Studi</FormLabel>
                    <FormControl>
                      <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                        <option value="">Semua prodi</option>
                        {data?.options.programStudies.map((programStudy) => (
                          <option key={programStudy} value={programStudy}>
                            {programStudy}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="className"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kelas</FormLabel>
                    <FormControl>
                      <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                        <option value="">Semua kelas</option>
                        {data?.options.classNames.map((className) => (
                          <option key={className} value={className}>
                            {className}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                        <option value="active">Aktif</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="biayaPendidikan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biaya Pendidikan</FormLabel>
                    <FormControl>
                      <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                        <option value="">Semua</option>
                        <option value="KIP">KIP</option>
                        <option value="Reguler">Reguler</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
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
                        min="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diskon</FormLabel>
                    <FormControl>
                      <Input
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={String(field.value ?? "")}
                        onChange={(event) => field.onChange(event.target.value)}
                        type="number"
                        min="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jatuh Tempo</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bulkForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Catatan</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Opsional" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end">
                <Button type="submit" disabled={!canGenerateBulk || previewQuery.isFetching} className="w-full">
                  {previewQuery.isFetching ? <Loader2 className="animate-spin" /> : <Search />}
                  Preview
                </Button>
              </div>
              {previewQuery.error && (
                <div className="md:col-span-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  {previewQuery.error.message}
                </div>
              )}
            </form>
          </Form>

          {previewQuery.data && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Total Preview</p>
                  <p className="text-lg font-semibold text-slate-900">{previewQuery.data.summary.total}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Siap Dibuat</p>
                  <p className="text-lg font-semibold text-emerald-700">{previewQuery.data.summary.available}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Duplikat</p>
                  <p className="text-lg font-semibold text-amber-700">{previewQuery.data.summary.duplicate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Dipilih</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedCount}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={availablePreviewIds.length > 0 && selectedCount === availablePreviewIds.length}
                    onChange={(event) => toggleAllAvailable(event.target.checked)}
                  />
                  Pilih semua yang siap dibuat
                </label>
                <Button
                  type="button"
                  onClick={submitBulkGenerate}
                  disabled={!canGenerateBulk || selectedCount === 0 || bulkGenerateMutation.isPending}
                >
                  {bulkGenerateMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckSquare />}
                  Generate {selectedCount} Tagihan
                </Button>
              </div>

              {bulkGenerateMutation.error && (
                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  {bulkGenerateMutation.error.message}
                </div>
              )}

              {generateResult && (
                <div className="grid gap-3 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm md:grid-cols-3">
                  <div>Berhasil dibuat: <strong>{generateResult.summary.created}</strong></div>
                  <div>Dilewati duplikat: <strong>{generateResult.summary.skipped}</strong></div>
                  <div>Gagal: <strong>{generateResult.summary.failed}</strong></div>
                </div>
              )}

              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b bg-white text-left text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Pilih</th>
                      <th className="py-2 pr-4 font-medium">NIM</th>
                      <th className="py-2 pr-4 font-medium">Nama</th>
                      <th className="py-2 pr-4 font-medium">Angkatan</th>
                      <th className="py-2 pr-4 font-medium">Prodi</th>
                      <th className="py-2 pr-4 font-medium">Kelas</th>
                      <th className="py-2 pr-4 font-medium">Status Generate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewQuery.data.students.map((student) => (
                      <tr key={student._id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <input
                            type="checkbox"
                            disabled={!student.canGenerate}
                            checked={selectedStudentIds.includes(student._id)}
                            onChange={(event) => toggleStudent(student._id, event.target.checked)}
                          />
                        </td>
                        <td className="py-3 pr-4">{student.nim}</td>
                        <td className="py-3 pr-4">{student.name}</td>
                        <td className="py-3 pr-4">{student.entryYear}</td>
                        <td className="py-3 pr-4">{student.programStudy}</td>
                        <td className="py-3 pr-4">{student.className}</td>
                        <td className="py-3 pr-4">
                          {student.canGenerate ? (
                            <span className="text-emerald-700">Siap dibuat</span>
                          ) : (
                            <span className="text-amber-700">{student.reason}</span>
                          )}
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

      <Card>
        <CardHeader>
          <CardTitle>Buat Tagihan Satuan</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid gap-4 md:grid-cols-4">
              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mahasiswa</FormLabel>
                    <div className="space-y-1.5">
                      <Input
                        type="text"
                        placeholder="Cari NIM atau Nama..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          <option value="">Pilih mahasiswa ({filteredStudents.length} ditemukan)</option>
                          {filteredStudents.map((student) => (
                            <option key={student._id} value={student._id}>
                              {student.nim} - {student.name}
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
                name="feeTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis Tagihan</FormLabel>
                    <FormControl>
                      <select
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          syncAmountFromFeeType(event.target.value, "single");
                        }}
                      >
                        <option value="">Pilih jenis</option>
                        {data?.feeTypes.map((feeType) => (
                          <option key={feeType._id} value={feeType._id}>
                            {feeType.name}
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
                name="academicYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tahun Akademik</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="semester"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semester</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                        min="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diskon</FormLabel>
                    <FormControl>
                      <Input
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={String(field.value ?? "")}
                        onChange={(event) => field.onChange(event.target.value)}
                        type="number"
                        min="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jatuh Tempo</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Daftar Tagihan</CardTitle>
            
            {/* Search & Rows Per Page Controls */}
            {!isLoading && !error && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Cari mahasiswa, NIM, jenis..."
                    value={billSearchTerm}
                    onChange={(e) => setBillSearchTerm(e.target.value)}
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
              <Users className="size-4 animate-pulse" />
              Memuat tagihan...
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          
          {!isLoading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Mahasiswa</th>
                      <th className="py-2 pr-4 font-medium">Jenis</th>
                      <th className="py-2 pr-4 font-medium">Periode</th>
                      <th className="py-2 pr-4 font-medium">Tagihan</th>
                      <th className="py-2 pr-4 font-medium">Dibayar</th>
                      <th className="py-2 pr-4 font-medium">Sisa</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBills.map((bill) => (
                      <tr key={bill._id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {bill.studentId ? (
                            <div>
                              <div>{bill.studentId.name}</div>
                              <div className="text-xs text-slate-500 font-mono">{bill.studentId.nim}</div>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{bill.feeTypeId?.name || "-"}</td>
                        <td className="py-3 pr-4 text-slate-600">{bill.academicYear} / {bill.semester}</td>
                        <td className="py-3 pr-4 font-medium text-slate-900">{formatCurrency(bill.amount - bill.discount)}</td>
                        <td className="py-3 pr-4 text-emerald-700 font-semibold">{formatCurrency(bill.paidAmount)}</td>
                        <td className="py-3 pr-4 text-red-600 font-semibold">{formatCurrency(bill.remainingAmount)}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                              bill.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : bill.status === "partially_paid"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {bill.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredBills.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Tidak ada data tagihan yang ditemukan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredBills.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
                  <div className="text-xs text-slate-500">
                    Menampilkan <strong>{((currentPage - 1) * rowsPerPage) + 1}</strong> -{" "}
                    <strong>{Math.min(currentPage * rowsPerPage, filteredBills.length)}</strong> dari{" "}
                    <strong>{filteredBills.length}</strong> entri
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
