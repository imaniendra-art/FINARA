"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";

type FinaraQueue = {
  _id: string;
  transactionNumber: string;
  amount: number;
  description: string;
  status: string;
  metadata: {
    nim: string;
    nama: string;
    wisuda_ke: string;
  };
};

export default function WisudaFinanceClient() {
  const [queue, setQueue] = useState<FinaraQueue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/finara/keuangan-wisuda", {
        headers: {
          "x-api-key": process.env.NEXT_PUBLIC_PANDAWA_FINARA_SECRET || "pandawa-secret-key-123",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } catch (err) {
      console.error("Failed to fetch queue", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleValidate = async (id: string) => {
    setValidatingId(id);
    try {
      const res = await fetch(`/api/finara/keuangan-wisuda/${id}`, {
        method: "PATCH",
      });
      if (res.ok) {
        // Optimistic update
        setQueue((prev) =>
          prev.map((item) => (item._id === id ? { ...item, status: "posted" } : item))
        );
      }
    } catch (error) {
      console.error("Validation failed", error);
    } finally {
      setValidatingId(null);
    }
  };

  if (isLoading && queue.length === 0) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Keuangan Wisuda</h2>
          <p className="text-muted-foreground">
            Validasi pembayaran dan tagihan wisuda mahasiswa (Terintegrasi PANDAWA).
          </p>
        </div>
        <Button variant="outline" onClick={fetchQueue} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Segarkan Data
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Antrean Pembayaran</CardTitle>
          <CardDescription>
            Daftar transaksi yang dikirimkan secara otomatis oleh sistem pendaftaran wisuda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                Belum ada antrean pendaftaran wisuda saat ini.
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Semua tagihan telah divalidasi atau sistem belum menerima data baru dari PANDAWA.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NIM</TableHead>
                    <TableHead>Nama Mahasiswa</TableHead>
                    <TableHead>Gelombang Wisuda</TableHead>
                    <TableHead>No. Transaksi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium font-mono">{item.metadata?.nim || "-"}</TableCell>
                      <TableCell>{item.metadata?.nama || "-"}</TableCell>
                      <TableCell>Ke-{item.metadata?.wisuda_ke || "-"}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {item.transactionNumber}
                      </TableCell>
                      <TableCell>
                        {item.status === "draft" ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            Menunggu Validasi
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Verified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={item.status === "draft" ? "default" : "outline"}
                          size="sm"
                          disabled={item.status === "posted" || validatingId === item._id}
                          onClick={() => handleValidate(item._id)}
                        >
                          {validatingId === item._id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : item.status === "draft" ? (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                          )}
                          {item.status === "draft" ? "Validasi" : "Tervalidasi"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
