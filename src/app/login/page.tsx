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
    <div className="w-full min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* SISI KIRI (VISUAL) */}
      <div className="relative hidden md:flex flex-col justify-between bg-slate-900 dark:bg-slate-950 p-12 overflow-hidden">
        {/* Pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        {/* Animated Graph Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <svg className="w-full h-full opacity-70" viewBox="0 0 800 600" fill="none" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="lineGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0" />
                <stop offset="40%" stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#93c5fd" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
              </linearGradient>
              <style>
                {`
                  @keyframes drawLine {
                    from { stroke-dashoffset: 1200; }
                    to { stroke-dashoffset: 0; }
                  }
                  @keyframes floatUp {
                    0% { transform: translateY(30px) scale(0.5); opacity: 0; }
                    20% { opacity: 0.8; }
                    80% { opacity: 0.8; }
                    100% { transform: translateY(-80px) scale(1.2); opacity: 0; }
                  }
                  @keyframes pulseGlow {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 1; }
                  }
                  .trend-line {
                    stroke-dasharray: 1200;
                    animation: drawLine 3s ease-out forwards, pulseGlow 4s ease-in-out infinite alternate;
                  }
                  .particle {
                    animation: floatUp 4s infinite ease-in-out;
                  }
                  .p-1 { animation-delay: 0s; cx: 150px; cy: 450px; }
                  .p-2 { animation-delay: 1.2s; cx: 300px; cy: 380px; }
                  .p-3 { animation-delay: 2.4s; cx: 500px; cy: 250px; }
                  .p-4 { animation-delay: 0.8s; cx: 650px; cy: 150px; }
                  .p-5 { animation-delay: 2s; cx: 400px; cy: 310px; }
                `}
              </style>
            </defs>
            
            {/* Area under the line */}
            <path 
              d="M -50 550 C 200 500, 300 400, 450 300 C 600 200, 700 150, 850 50 L 850 650 L -50 650 Z" 
              fill="url(#areaGrad)" 
            />
            
            {/* Increasing Trend Line */}
            <path 
              className="trend-line"
              d="M -50 550 C 200 500, 300 400, 450 300 C 600 200, 700 150, 850 50" 
              stroke="url(#lineGrad)" 
              strokeWidth="4" 
              strokeLinecap="round"
              fill="none"
              filter="url(#glow)"
            />
            
            {/* Particles */}
            <circle r="4" fill="#93c5fd" className="particle p-1" filter="url(#glow)"/>
            <circle r="5" fill="#60a5fa" className="particle p-2" filter="url(#glow)"/>
            <circle r="3" fill="#bfdbfe" className="particle p-3" filter="url(#glow)"/>
            <circle r="6" fill="#93c5fd" className="particle p-4" filter="url(#glow)"/>
            <circle r="4" fill="#3b82f6" className="particle p-5" filter="url(#glow)"/>
          </svg>
        </div>
        
        {/* Content Top */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full mt-8">
            <div className="mb-6 flex items-center justify-center rounded-[24px] bg-white/5 p-4 backdrop-blur-sm shadow-[0_0_40px_rgba(59,130,246,0.3)] ring-1 ring-white/10">
              <img src="/logo.png" alt="Logo FINARA" className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2 drop-shadow-md">
              FINARA
            </h1>
            <p className="text-lg font-medium text-blue-100/80 text-center max-w-md drop-shadow-sm">
              Finance Administration and Reporting Application
            </p>
        </div>

        {/* Content Bottom */}
        <div className="relative z-10 mt-auto">
          <blockquote className="space-y-2 border-l-2 border-blue-500/50 pl-4 bg-slate-900/40 p-4 rounded-r-xl backdrop-blur-sm">
            <p className="text-sm md:text-base text-slate-300 italic">
              "Precision in numbers, transparency in reporting. Empowering institutional financial management with integrity."
            </p>
          </blockquote>
        </div>
      </div>

      {/* SISI KANAN (FORM) */}
      <div className="flex items-center justify-center p-8 bg-white dark:bg-slate-900">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
          <div className="flex flex-col space-y-2 text-center mb-6">
            {/* Show logo only on mobile */}
            <div className="md:hidden mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#1d4ed8] shadow-lg">
              <span className="text-3xl font-bold leading-none text-white">F</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Selamat Datang Kembali
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Silakan masuk ke akun Anda
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Global Error */}
            {error && (
              <div className="rounded-[18px] bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Email
              </label>
              <div className="flex h-14 items-center gap-3 rounded-[18px] bg-[#f1f5fb] dark:bg-slate-800 px-4 ring-1 ring-transparent transition-all focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-blue-600 dark:focus-within:ring-blue-500">
                <Mail className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="admin@stimi.edu"
                  autoComplete="email"
                  {...register("email")}
                  className="h-full w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              {errors.email && (
                <p className="pl-1 text-xs font-medium text-red-600 dark:text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="flex h-14 items-center gap-3 rounded-[18px] bg-[#f1f5fb] dark:bg-slate-800 px-4 ring-1 ring-transparent transition-all focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-blue-600 dark:focus-within:ring-blue-500">
                <Lock className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register("password")}
                  className="h-full w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              {errors.password && (
                <p className="pl-1 text-xs font-medium text-red-600 dark:text-red-400">
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
          <p className="mt-8 text-center text-xs font-medium text-slate-400">
            PUSDATIN — STIMI YAPMI {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
