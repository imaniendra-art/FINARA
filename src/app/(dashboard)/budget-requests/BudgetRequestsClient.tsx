"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function BudgetRequestsClient() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Permintaan Anggaran (SIPUANG)" 
        description="Modul pengajuan dan pencairan anggaran" 
      />

      <Card>
        <CardHeader>
          <CardTitle>Arsitektur Integrasi Baru</CardTitle>
          <CardDescription>
            Halaman ini sedang dikosongkan untuk persiapan refactor struktur agar selaras dengan modul Keuangan PMB dan Wisuda. Modul ini siap diintegrasikan menggunakan standarisasi API penagihan/kas yang baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-slate-500 dark:text-slate-400">Dalam proses pengembangan...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
