"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, KeyRound, Loader2, Plus, Power, Shield, UserCheck, UserX, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
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
import { roleLabels, userRoles } from "@/lib/roles";

const roleSchema = z.enum(userRoles);
const userFormSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  email: z.email("Email tidak valid").trim().toLowerCase(),
  password: z.string().optional(),
  role: roleSchema,
  isActive: z.coerce.boolean(),
});
const createUserFormSchema = userFormSchema.extend({
  password: z.string().min(6, "Password minimal 6 karakter"),
});
const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password minimal 6 karakter"),
});

type UserRole = z.infer<typeof roleSchema>;
type UserFormInput = z.input<typeof userFormSchema>;
type UserFormValues = z.output<typeof userFormSchema>;
type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
type ResetPasswordValues = z.output<typeof resetPasswordSchema>;

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type UsersResponse = {
  users: UserRow[];
  options: {
    roles: UserRole[];
  };
};

const defaultValues: UserFormInput = {
  name: "",
  email: "",
  password: "",
  role: "staff_bauk",
  isActive: true,
};

async function fetchUsers() {
  const response = await fetch("/api/users");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Gagal memuat user.");
  }

  return data as UsersResponse;
}

async function saveUser(values: UserFormValues & { id?: string }) {
  const body = values.id
    ? {
        name: values.name,
        email: values.email,
        role: values.role,
        isActive: values.isActive,
      }
    : values;
  const response = await fetch(values.id ? `/api/users/${values.id}` : "/api/users", {
    method: values.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "User gagal disimpan.");
  }

  return data;
}

async function resetUserPassword(values: { id: string; password: string }) {
  const response = await fetch(`/api/users/${values.id}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: values.password }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Reset password gagal.");
  }

  return data;
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "super_admin";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: isSuperAdmin,
  });

  const form = useForm<UserFormInput, unknown, UserFormValues>({
    resolver: zodResolver(editingId ? userFormSchema : createUserFormSchema),
    defaultValues,
  });

  const resetForm = useForm<ResetPasswordInput, unknown, ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  });

  const saveMutation = useMutation({
    mutationFn: saveUser,
    onSuccess: async () => {
      setEditingId(null);
      setShowForm(false);
      form.reset(defaultValues);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: async () => {
      setResetPasswordUserId(null);
      resetForm.reset({ password: "" });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const summary = useMemo(() => {
    const users = data?.users ?? [];

    return {
      total: users.length,
      active: users.filter((user) => user.isActive).length,
      inactive: users.filter((user) => !user.isActive).length,
      superAdmin: users.filter((user) => user.role === "super_admin").length,
    };
  }, [data?.users]);

  const resetPasswordUser = useMemo(
    () => data?.users.find((user) => user._id === resetPasswordUserId) ?? null,
    [data?.users, resetPasswordUserId]
  );

  function startAdd() {
    setEditingId(null);
    setShowForm(true);
    form.reset(defaultValues);
  }

  function startEdit(user: UserRow) {
    setEditingId(user._id);
    setShowForm(true);
    form.reset({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      isActive: user.isActive,
    });
  }

  function cancelForm() {
    setEditingId(null);
    setShowForm(false);
    form.reset(defaultValues);
  }

  function toggleActive(user: UserRow) {
    saveMutation.mutate({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: !user.isActive,
      password: "",
    });
  }

  function submitResetPassword(values: ResetPasswordValues) {
    if (!resetPasswordUserId) {
      return;
    }

    resetPasswordMutation.mutate({ id: resetPasswordUserId, password: values.password });
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="User & Role" description="Pengelolaan pengguna dan hak akses FINARA." />
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Hanya super admin yang dapat mengakses manajemen user.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <PageHeader title="User & Role" description="Kelola user, role, status akses, dan reset password FINARA." />
        <Button type="button" onClick={startAdd}>
          <Plus />
          Tambah User
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Total User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">{summary.total}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-700">{summary.active}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Nonaktif</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">{summary.inactive}</div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Super Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-blue-700">{summary.superAdmin}</div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit User" : "Tambah User"}</CardTitle>
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nama user" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="user@finara.local" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!editingId && (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} placeholder="Minimal 6 karakter" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <select className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" {...field}>
                          {data?.options.roles.map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
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
                          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
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
                <div className="flex flex-wrap items-end gap-2 md:col-span-4">
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    {editingId ? "Simpan Perubahan" : "Simpan User"}
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
          <CardTitle>Tabel User</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-slate-500">Memuat user...</p>}
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Nama</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Diperbarui</th>
                  <th className="py-2 pr-4 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user) => {
                  const isCurrentUser = user._id === session?.user?.id;
                  const canDeactivate = !(isCurrentUser && user.role === "super_admin" && user.isActive);

                  return (
                    <tr key={user._id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium text-slate-900">{user.name}</td>
                      <td className="py-3 pr-4">{user.email}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1">
                          <Shield className="size-4 text-slate-400" />
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {user.isActive ? (
                          <span className="text-emerald-700">Aktif</span>
                        ) : (
                          <span className="text-red-600">Nonaktif</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">{formatDate(user.updatedAt)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => startEdit(user)}>
                            <Edit2 />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setResetPasswordUserId(user._id)}
                          >
                            <KeyRound />
                            Reset Password
                          </Button>
                          <Button
                            type="button"
                            variant={user.isActive ? "destructive" : "outline"}
                            size="sm"
                            disabled={saveMutation.isPending || !canDeactivate}
                            onClick={() => toggleActive(user)}
                          >
                            {user.isActive ? <UserX /> : <UserCheck />}
                            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data?.users.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={6}>
                      Belum ada user.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {resetPasswordUser && (
        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
              Reset password untuk <strong>{resetPasswordUser.name}</strong> ({resetPasswordUser.email}).
            </div>
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(submitResetPassword)} className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
                <FormField
                  control={resetForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password Baru</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} placeholder="Minimal 6 karakter" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button type="submit" disabled={resetPasswordMutation.isPending}>
                    {resetPasswordMutation.isPending ? <Loader2 className="animate-spin" /> : <Power />}
                    Reset
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" onClick={() => setResetPasswordUserId(null)}>
                    <X />
                    Batal
                  </Button>
                </div>
                {resetPasswordMutation.error && (
                  <div className="md:col-span-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    {resetPasswordMutation.error.message}
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
