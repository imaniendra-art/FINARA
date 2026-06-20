"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Receipt = {
  id: string;
  receiptNumber: string;
  paymentNumber: string;
  paymentDate: string;
  studentName: string;
  nim: string;
  programStudy: string;
  feeTypeName: string;
  academicYear: string;
  semester: string;
  amount: number;
  paymentMethod: string;
  cashOrBankAccount: string;
  officerName: string;
  notes: string;
};

type ReceiptResponse = {
  receipt: Receipt;
};

async function fetchReceipt(paymentId: string) {
  const response = await fetch(`/api/payments/${paymentId}/receipt`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Kwitansi gagal dimuat.");
  }

  return data as ReceiptResponse;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 border-b border-slate-100 py-2 text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

export function ReceiptClient({ paymentId }: { paymentId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["payment-receipt", paymentId],
    queryFn: () => fetchReceipt(paymentId),
  });
  const receipt = data?.receipt;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Kwitansi Pembayaran</h1>
          <p className="text-slate-500">Cetak atau simpan kwitansi pembayaran sebagai PDF.</p>
        </div>
        <Button onClick={() => window.print()} disabled={!receipt}>
          <Printer />
          Cetak / PDF
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Memuat kwitansi...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {receipt && (
        <Card className="print:rounded-none print:ring-0 print:shadow-none">
          <CardHeader className="border-b text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              FINARA - Finance Administration and Reporting Application STIMI
            </p>
            <CardTitle className="text-xl font-bold">STIMI YAPMI Makassar</CardTitle>
            <p className="text-sm text-slate-500">Kwitansi Pembayaran Mahasiswa</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border border-slate-200 p-4">
              <ReceiptRow label="Nomor Kwitansi" value={receipt.receiptNumber} />
              <ReceiptRow label="Nomor Pembayaran" value={receipt.paymentNumber} />
              <ReceiptRow label="Tanggal Pembayaran" value={formatDate(receipt.paymentDate)} />
              <ReceiptRow label="Nama Mahasiswa" value={receipt.studentName} />
              <ReceiptRow label="NIM" value={receipt.nim} />
              <ReceiptRow label="Program Studi" value={receipt.programStudy} />
              <ReceiptRow label="Jenis Tagihan" value={receipt.feeTypeName} />
              <ReceiptRow label="Tahun Akademik" value={receipt.academicYear} />
              <ReceiptRow label="Semester" value={receipt.semester} />
              <ReceiptRow label="Nominal Pembayaran" value={formatCurrency(receipt.amount)} />
              <ReceiptRow label="Metode Pembayaran" value={receipt.paymentMethod} />
              <ReceiptRow label="Akun Kas/Bank" value={receipt.cashOrBankAccount} />
              <ReceiptRow label="Petugas Penerima" value={receipt.officerName} />
              <ReceiptRow label="Catatan" value={receipt.notes} />
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-sm">
              <div>
                <p className="text-slate-500">Mahasiswa</p>
                <div className="h-20" />
                <p className="font-medium text-slate-900 dark:text-slate-100">{receipt.studentName}</p>
              </div>
              <div>
                <p className="text-slate-500">Petugas BAUK</p>
                <div className="h-20" />
                <p className="font-medium text-slate-900 dark:text-slate-100">{receipt.officerName}</p>
              </div>
            </div>

            <div className="hidden print:block border-t pt-3 text-center text-xs text-slate-500">
              Dokumen ini dicetak dari FINARA STIMI YAPMI Makassar.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end print:hidden">
        <Button variant="outline" onClick={() => window.print()} disabled={!receipt}>
          <Download />
          Download PDF
        </Button>
      </div>
    </div>
  );
}
