"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(1, { message: "Password wajib diisi" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { register, handleSubmit, formState: { errors } } = form;

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan sistem. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbfcff] p-4">
      {/* M3 Elevated Card */}
      <div className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-[0_14px_40px_rgba(15,23,42,0.12)] ring-1 ring-slate-100">

        {/* Header Area — Tonal Surface */}
        <div className="mb-8 flex flex-col items-center rounded-[28px] bg-[#f7f9ff] px-6 py-8 ring-1 ring-[#e7edff]">
          {/* Logo */}
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#1d4ed8] shadow-lg">
            <span className="text-3xl font-bold leading-none text-white">F</span>
          </div>
          {/* Title */}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            FINARA
          </h1>
          {/* Subtitle */}
          <p className="mt-1.5 text-center text-sm font-medium leading-relaxed text-slate-500">
            Finance Administration &amp; Reporting Application
            <br />
            <span className="text-slate-400">STIMI YAPMI Makassar</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Global Error */}
          {error && (
            <div className="rounded-[18px] bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
              Email
            </label>
            <div className="flex h-14 items-center gap-3 rounded-[18px] bg-[#f1f5fb] px-4 ring-1 ring-transparent transition-all focus-within:bg-white focus-within:ring-[#1d4ed8]">
              <Mail className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                id="email"
                type="email"
                placeholder="admin@stimi.edu"
                autoComplete="email"
                {...register("email")}
                className="h-full w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            {errors.email && (
              <p className="pl-1 text-xs font-medium text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="flex h-14 items-center gap-3 rounded-[18px] bg-[#f1f5fb] px-4 ring-1 ring-transparent transition-all focus-within:bg-white focus-within:ring-[#1d4ed8]">
              <Lock className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register("password")}
                className="h-full w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            {errors.password && (
              <p className="pl-1 text-xs font-medium text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[#1d4ed8] text-base font-bold text-white shadow-[0_10px_24px_rgba(29,78,216,0.28)] transition-colors hover:bg-[#1e40af] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Masuk
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer Watermark */}
        <p className="mt-8 text-center text-xs font-medium text-slate-300">
          PUSDATIN — STIMI YAPMI {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
