"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
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
  DialogDescription,
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

const accountFormSchema = z.object({
  code: z.string().trim().min(1, "Kode akun wajib diisi"),
  name: z.string().trim().min(1, "Nama akun wajib diisi"),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"], {
    message: "Tipe akun wajib dipilih",
  }),
  parentId: z.string().optional(),
  normalBalance: z.enum(["debit", "credit"], {
    message: "Saldo normal wajib dipilih",
  }),
  isActive: z.coerce.boolean(),
});

type AccountFormInput = z.input<typeof accountFormSchema>;
type AccountFormValues = z.output<typeof accountFormSchema>;
type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
type NormalBalance = "debit" | "credit";

type ParentAccount = {
  _id: string;
  code: string;
  name: string;
};

type AccountRow = {
  _id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: ParentAccount | null;
  normalBalance: NormalBalance;
  isActive: boolean;
  isUsed: boolean;
};

type AccountsResponse = {
  accounts: AccountRow[];
  options: {
    types: AccountType[];
    normalBalances: NormalBalance[];
  };
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

const writeRoles = ["super_admin", "admin_bauk"];
const allAccountTypes: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];
const allNormalBalances: NormalBalance[] = ["debit", "credit"];

const typeLabels: Record<AccountType, string> = {
  asset: "Aset",
  liability: "Kewajiban",
  equity: "Ekuitas",
  revenue: "Pendapatan",
  expense: "Beban",
};

const normalBalanceLabels: Record<NormalBalance, string> = {
  debit: "Debit",
  credit: "Kredit",
};

const defaultValues: AccountFormInput = {
  code: "",
  name: "",
  type: "asset",
  parentId: "",
  normalBalance: "debit",
  isActive: true,
};

function buildAccountsUrl(type: string) {
  const params = new URLSearchParams();
  if (type) {
    params.set("type", type);
  }

  const query = params.toString();
  return `/api/accounts${query ? `?${query}` : ""}`;
}

async function parseResponse<T>(response: Response, fallbackMessage: string) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage);
  }

  return data as T;
}

async function fetchAccounts(type: string) {
  const response = await fetch(buildAccountsUrl(type), { cache: "no-store" });
  return parseResponse<AccountsResponse>(response, "Gagal memuat kode akun.");
}

async function saveAccount(values: AccountFormValues & { id?: string }) {
  const response = await fetch(values.id ? `/api/accounts/${values.id}` : "/api/accounts", {
    method: values.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: values.code,
      name: values.name,
      type: values.type,
      parentId: values.parentId || undefined,
      normalBalance: values.normalBalance,
      isActive: values.isActive,
    }),
  });

  return parseResponse<{ account: AccountRow }>(response, "Kode akun gagal disimpan.");
}

async function deactivateAccount(id: string) {
  const response = await fetch(`/api/accounts/${id}/deactivate`, { method: "POST" });
  return parseResponse<{ account: AccountRow }>(response, "Kode akun gagal dinonaktifkan.");
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canManage = writeRoles.includes(session?.user?.role ?? "");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["accounts", typeFilter],
    queryFn: () => fetchAccounts(typeFilter),
  });

  const form = useForm<AccountFormInput, unknown, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const invalidateAccountConsumers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["fee-types"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: saveAccount,
    onSuccess: async () => {
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      setIsFormOpen(false);
      form.reset(defaultValues);
      await invalidateAccountConsumers();
      setToast({
        type: "success",
        message: wasEditing ? "Kode akun berhasil diperbarui." : "Kode akun berhasil ditambahkan.",
      });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Kode akun gagal disimpan.",
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateAccount,
    onSuccess: async () => {
      await invalidateAccountConsumers();
      setToast({ type: "success", message: "Kode akun berhasil dinonaktifkan." });
    },
    onError: (mutationError) => {
      setToast({
        type: "error",
        message: mutationError instanceof Error ? mutationError.message : "Kode akun gagal dinonaktifkan.",
      });
    },
  });

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const accounts = data?.accounts ?? [];

    if (!keyword) {
      return accounts;
    }

    return accounts.filter(
      (account) =>
        account.code.toLowerCase().includes(keyword) ||
        account.name.toLowerCase().includes(keyword)
    );
  }, [data?.accounts, search]);

  const summary = useMemo(() => {
    const accounts = data?.accounts ?? [];
    return {
      total: accounts.length,
      active: accounts.filter((account) => account.isActive).length,
      inactive: accounts.filter((account) => !account.isActive).length,
      used: accounts.filter((account) => account.isUsed).length,
    };
  }, [data?.accounts]);

  const parentOptions = useMemo(
    () => (data?.accounts ?? []).filter((account) => account._id !== editingId),
    [data?.accounts, editingId]
  );

  function openAddDialog() {
    setEditingId(null);
    form.reset(defaultValues);
    setIsFormOpen(true);
  }

  function openEditDialog(account: AccountRow) {
    setEditingId(account._id);
    form.reset({
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId?._id ?? "",
      normalBalance: account.normalBalance,
      isActive: account.isActive,
    });
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

  function submitForm(values: AccountFormValues) {
    saveMutation.mutate({ ...values, id: editingId ?? undefined });
  }

  function confirmDeactivate(account: AccountRow) {
    const isConfirmed = window.confirm(`Nonaktifkan kode akun ${account.code} - ${account.name}?`);
    if (isConfirmed) {
      deactivateMutation.mutate(account._id);
    }
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
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Kode Akun" description="Kelola chart of accounts untuk pencatatan FINARA." />
        {canManage && (
          <Button type="button" onClick={openAddDialog}>
            <Plus />
            Tambah Kode Akun
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">{summary.total}</div>
            <p className="text-sm text-slate-500">Akun sesuai filter</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-700">{summary.active}</div>
            <p className="text-sm text-slate-500">Tersedia dipilih</p>
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
            <CardTitle>Terpakai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-700">{summary.used}</div>
            <p className="text-sm text-slate-500">Punya referensi transaksi</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={closeFormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Kode Akun" : "Tambah Kode Akun"}</DialogTitle>
            <DialogDescription>
              Isi kode, tipe, saldo normal, dan status akun untuk chart of accounts.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(submitForm)} className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1000" />
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
                      <Input {...field} placeholder="Kas" />
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
                    <FormLabel>Tipe</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih tipe akun" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allAccountTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {typeLabels[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="normalBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo Normal</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih saldo normal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allNormalBalances.map((balance) => (
                          <SelectItem key={balance} value={balance}>
                            {normalBalanceLabels[balance]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Akun Induk</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tanpa induk" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Tanpa induk</SelectItem>
                        {parentOptions.map((account) => (
                          <SelectItem key={account._id} value={account._id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select
                      value={field.value ? "true" : "false"}
                      onValueChange={(value) => field.onChange(value === "true")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Aktif</SelectItem>
                        <SelectItem value="false">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
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
          <CardTitle>Filter Kode Akun</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari kode atau nama akun"
                className="pl-8"
              />
            </div>
            <Select value={typeFilter || "all"} onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Semua tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua tipe</SelectItem>
                {allAccountTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {typeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                setTypeFilter("");
              }}
            >
              <X />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Kode Akun</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-slate-500">Memuat kode akun...</p>}
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          {deactivateMutation.error && (
            <div className="mb-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {deactivateMutation.error.message}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Akun Induk</TableHead>
                <TableHead>Saldo Normal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Referensi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account._id}>
                  <TableCell className="font-medium text-slate-900">{account.code}</TableCell>
                  <TableCell className="min-w-52 whitespace-normal">{account.name}</TableCell>
                  <TableCell>{typeLabels[account.type]}</TableCell>
                  <TableCell className="min-w-52 whitespace-normal text-slate-500">
                    {account.parentId ? `${account.parentId.code} - ${account.parentId.name}` : "-"}
                  </TableCell>
                  <TableCell>{normalBalanceLabels[account.normalBalance]}</TableCell>
                  <TableCell>
                    <Badge
                      variant={account.isActive ? "default" : "outline"}
                      className={account.isActive ? "bg-emerald-100 text-emerald-700" : "text-slate-500"}
                    >
                      {account.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={account.isUsed ? "text-blue-700" : "text-slate-500"}>
                      {account.isUsed ? "Terpakai" : "Belum dipakai"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canManage && (
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(account)}>
                          <Edit2 />
                          Edit
                        </Button>
                      )}
                      {canManage && account.isActive && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deactivateMutation.isPending}
                          onClick={() => confirmDeactivate(account)}
                        >
                          {deactivateMutation.isPending ? <Loader2 className="animate-spin" /> : <X />}
                          Nonaktifkan
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filteredAccounts.length === 0 && (
                <TableRow>
                  <TableCell className="py-6 text-center text-slate-500" colSpan={8}>
                    Tidak ada kode akun yang sesuai filter.
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
