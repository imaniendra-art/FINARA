import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "FINARA - Finance Administration and Reporting Application",
  description: "Aplikasi Akuntansi dan Keuangan BAUK STIMI YAPMI Makassar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans text-base antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
