"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Loader2, Plus, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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

const feeTypeFormSchema = z.object({
  name: z.string().trim().min(1, "Nama jenis tagihan wajib diisi"),
  description: z.string().trim().optional(),
  defaultAmount: z.coerce.number().nonnegative("Nominal default tidak boleh negatif"),
  revenueAccountId: z.string().min(1, "Akun pendapatan wajib dipilih"),
  isActive: z.coerce.boolean(),
});

type FeeTypeFormInput = z.input<typeof feeTypeFormSchema>;
type FeeTypeFormValues = z.output<typeof feeTypeFormSchema>;
type ToastState = { type: "success" | "error"; message: string } | null;

type RevenueAccount = {
  _id: string;
  code: string;
  name: string;
};

type FeeTypeRow = {
  _id: string;
  name: string;
  description?: string;
  defaultAmount: number;
  revenueAccountId?: RevenueAccount;
  isActive: boolean;
  isUsed: boolean;
};

type FeeTypesResponse = {
  feeTypes: FeeTypeRow[];
  revenueAccounts: RevenueAccount[];
};

const defaultValues: FeeTypeFormInput = {
  name: "",
  description: "",
  defaultAmount: 0,
  revenueAccountId: "",
  isActive: true,
};

const writeRoles = ["super_admin", "admin_bauk"];

async function parseResponse<T>(response: Response, fallbackMessage: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage);
  }
  return data as T;
}

async function fetchFeeTypes() {
  const response = await fetch("/api/fee-types", { cache: "no-store" });
  return parseResponse<FeeTypesResponse>(response, "Gagal memuat jenis tagihan.");
}

async function saveFeeType(values: FeeTypeFormValues & { id?: string }) {
  const response = await fetch(values.id ? `/api/fee-types/${values.id}` : "/api/fee-types", {
    method: values.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: values.name,
      description: values.description,
      defaultAmount: values.defaultAmount,
      revenueAccountId: values.revenueAccountId,
      isActive: values.isActive,
    }),
  });

  return parseResponse<{ feeType: FeeTypeRow }>(response, "Jenis tagihan gagal disimpan.");
}

async function deactivateFeeType(id: string) {
  const response = await fetch(`/api/fee-types/${id}/deactivate`, { method: "POST" });
  return parseResponse<{ feeType: FeeTypeRow }>(response, "Jenis tagihan gagal dinonaktifkan.");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function FeeTypesPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canManage = writeRoles.includes(session?.user?.role ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fee-types"],
    queryFn: fetchFeeTypes,
  });

  const form = useForm<FeeTypeFormInput, unknown, FeeTypeFormValues>({
    resolver: zodResolver(feeTypeFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const invalidateFeeTypeConsumers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["fee-types"] }),
      queryClient.invalidateQueries({ queryKey: ["bills"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: saveFeeType,
    onSuccess: async () => {
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      setIsFormOpen(false);
      form.reset(defaultValues);
      await invalidateFeeTypeConsumers();
      setToast({
        type: "success",
        message: wasEditing ? "Jenis tagihan berhasil diperbarui." : "Jenis tagihan berhasil ditambahkan.",
      });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Jenis tagihan gagal disimpan.",
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateFeeType,
    onSuccess: async () => {
      await invalidateFeeTypeConsumers();
      setToast({ type: "success", message: "Jenis tagihan berhasil dinonaktifkan." });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Jenis tagihan gagal dinonaktifkan.",
      });
    },
  });

  const activeFeeTypeCount = useMemo(
    () => data?.feeTypes.filter((feeType) => feeType.isActive).length ?? 0,
    [data?.feeTypes]
  );
  const usedFeeTypeCount = useMemo(
    () => data?.feeTypes.filter((feeType) => feeType.isUsed).length ?? 0,
    [data?.feeTypes]
  );

  function startAdd() {
    setEditingId(null);
    form.reset(defaultValues);
    saveMutation.reset();
    setIsFormOpen(true);
  }

  function startEdit(feeType: FeeTypeRow) {
    setEditingId(feeType._id);
    form.reset({
      name: feeType.name,
      description: feeType.description ?? "",
      defaultAmount: feeType.defaultAmount,
      revenueAccountId: feeType.revenueAccountId?._id ?? "",
      isActive: feeType.isActive,
    });
    saveMutation.reset();
    setIsFormOpen(true);
  }

  function closeFormDialog(open: boolean) {
    setIsFormOpen(open);
    if (!open) {
      setEditingId(null);
      form.reset(defaultValues);
      saveMutation.reset();
    }
  }

  function confirmDeactivate(feeType: FeeTypeRow) {
    if (window.confirm(`Nonaktifkan jenis tagihan ${feeType.name}?`)) {
      deactivateMutation.mutate(feeType._id);
    }
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
        <PageHeader title="Jenis Tagihan" description="Kelola master biaya dan akun pendapatan untuk penagihan mahasiswa." />
        {canManage && (
          <Button type="button" onClick={startAdd}>
            <Plus />
            Tambah Jenis Tagihan
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total Jenis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">{data?.feeTypes.length ?? 0}</div>
            <p className="text-sm text-slate-500">Semua jenis tagihan</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-700">{activeFeeTypeCount}</div>
            <p className="text-sm text-slate-500">Tersedia saat membuat tagihan</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Akun Pendapatan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">{data?.revenueAccounts.length ?? 0}</div>
            <p className="text-sm text-slate-500">Akun aktif yang bisa dipilih</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Terpakai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-700">{usedFeeTypeCount}</div>
            <p className="text-sm text-slate-500">Sudah dipakai tagihan</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={closeFormDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Ubah Jenis Tagihan" : "Tambah Jenis Tagihan"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => saveMutation.mutate({ ...values, id: editingId ?? undefined }))}
              className="grid gap-4 md:grid-cols-2"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="SPP" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nominal Default</FormLabel>
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
                name="revenueAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Akun Pendapatan</FormLabel>
                    <FormControl>
                      <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" {...field}>
                        <option value="">Pilih akun</option>
                        {data?.revenueAccounts.map((account) => (
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
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <select
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        value={field.value ? "true" : "false"}
                        onChange={(event) => field.onChange(event.target.value === "true")}
                      >
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                      </select>
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
                    <FormLabel>Keterangan</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Opsional" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {saveMutation.error && (
                <div className="md:col-span-2 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  {saveMutation.error.message}
                </div>
              )}
              <DialogFooter className="md:col-span-2">
                <Button type="button" variant="outline" onClick={() => closeFormDialog(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  {editingId ? "Simpan Perubahan" : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Jenis Tagihan</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-slate-500">Memuat jenis tagihan...</p>}
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          {deactivateMutation.error && (
            <div className="mb-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {deactivateMutation.error.message}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Akun Pendapatan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Referensi</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.feeTypes.map((feeType) => (
                <TableRow key={feeType._id}>
                  <TableCell className="font-medium text-slate-900">{feeType.name}</TableCell>
                  <TableCell>{formatCurrency(feeType.defaultAmount)}</TableCell>
                  <TableCell className="min-w-56 whitespace-normal">
                    {feeType.revenueAccountId
                      ? `${feeType.revenueAccountId.code} - ${feeType.revenueAccountId.name}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={feeType.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                      {feeType.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={feeType.isUsed ? "text-blue-700" : "text-slate-500"}>
                      {feeType.isUsed ? "Sudah dipakai" : "Belum dipakai"}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-48 whitespace-normal text-slate-500">{feeType.description || "-"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canManage && (
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(feeType)}>
                          <Edit2 />
                          Ubah
                        </Button>
                      )}
                      {canManage && feeType.isActive && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deactivateMutation.isPending}
                          onClick={() => confirmDeactivate(feeType)}
                        >
                          {deactivateMutation.isPending ? <Loader2 className="animate-spin" /> : <X />}
                          Nonaktifkan
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data?.feeTypes.length === 0 && (
                <TableRow>
                  <TableCell className="py-6 text-center text-slate-500" colSpan={7}>
                    Belum ada jenis tagihan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
