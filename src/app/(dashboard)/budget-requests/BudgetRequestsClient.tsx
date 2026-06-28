"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function BudgetRequestsClient() {
  const [requests, setRequests] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [processModal, setProcessModal] = useState<any>(null);
  const [validateModal, setValidateModal] = useState<any>(null);
  
  const [selectedKasBank, setSelectedKasBank] = useState("");
  const [selectedLawan, setSelectedLawan] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchRequests();
    fetchAccounts();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/kaspro-requests");
      const data = await res.json();
      setRequests(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data.accounts || []);
  };

  const handleProcess = async () => {
    if (!selectedKasBank || !selectedLawan) return alert("Pilih akun terlebih dahulu!");
    await fetch(`/api/kaspro-requests/${processModal._id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selectedLawan, cashOrBankAccountId: selectedKasBank })
    });
    setProcessModal(null);
    fetchRequests();
  };

  const handleValidate = async (action: "approve" | "reject") => {
    if (action === "reject" && !rejectionReason) return alert("Alasan penolakan wajib diisi");
    const res = await fetch(`/api/kaspro-requests/${validateModal._id}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: rejectionReason })
    });
    if (!res.ok) {
      const data = await res.json();
      alert("Error: " + data.error);
      return;
    }
    setValidateModal(null);
    setRejectionReason("");
    fetchRequests();
  };

  const isKasBank = (code: string) => {
    if (!code || !code.startsWith("1-")) return false;
    const num = parseInt(code.split("-")[1]);
    return num >= 100 && num <= 203;
  };

  const isAkunLawan = (code: string) => {
    if (!code || !code.startsWith("5-")) return false;
    const num = parseInt(code.split("-")[1]);
    return num >= 100 && num <= 116;
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "pending_akun": return <Badge variant="destructive">Pilih Akun</Badge>;
      case "menunggu_lpj": return <Badge variant="outline" className="text-amber-600">Menunggu LPJ</Badge>;
      case "pending_validasi": return <Badge className="bg-blue-500">Validasi LPJ</Badge>;
      case "selesai": return <Badge variant="default" className="bg-emerald-500">Selesai</Badge>;
      case "ditolak": return <Badge variant="secondary">Ditolak</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Kotak Masuk KASPRO" description="Validasi dan alokasi akun untuk pengajuan KASPRO" />

      <Card>
        <CardContent className="p-4 sm:p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pengusul</TableHead>
                <TableHead>Judul</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-4">Loading...</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-4">Belum ada pengajuan masuk</TableCell></TableRow>
              ) : (
                requests.map(req => (
                  <TableRow key={req._id}>
                    <TableCell>{new Date(req.tanggal).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell>{req.pengusul}</TableCell>
                    <TableCell>{req.judul}</TableCell>
                    <TableCell>Rp {req.nominal.toLocaleString("id-ID")}</TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell>
                      {req.status === "pending_akun" && (
                        <Button size="sm" onClick={() => setProcessModal(req)}>Proses</Button>
                      )}
                      {req.status === "pending_validasi" && (
                        <Button size="sm" variant="default" onClick={() => setValidateModal(req)}>Cek LPJ</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Pilih Akun */}
      <Dialog open={!!processModal} onOpenChange={() => setProcessModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilih Akun untuk: {processModal?.judul}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sumber Kas/Bank (Kredit)</Label>
              <Select onValueChange={setSelectedKasBank}>
                <SelectTrigger><SelectValue placeholder="Pilih Kas/Bank" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => isKasBank(a.code)).map(a => (
                    <SelectItem key={a._id} value={a._id}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Akun Lawan / Beban (Debit)</Label>
              <Select onValueChange={setSelectedLawan}>
                <SelectTrigger><SelectValue placeholder="Pilih Akun Beban" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => isAkunLawan(a.code)).map(a => (
                    <SelectItem key={a._id} value={a._id}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessModal(null)}>Batal</Button>
            <Button onClick={handleProcess}>Simpan & Buat Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Validasi LPJ */}
      <Dialog open={!!validateModal} onOpenChange={() => setValidateModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Validasi LPJ: {validateModal?.judul}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {validateModal?.buktiUrl && (
              <div className="border rounded-lg overflow-hidden flex justify-center bg-slate-50 dark:bg-slate-900 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={validateModal.buktiUrl} alt="Bukti LPJ" className="max-h-96 object-contain" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Alasan Penolakan (Hanya jika ditolak)</Label>
              <Textarea 
                placeholder="Misal: Foto nota tidak terbaca..." 
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between w-full">
            <Button variant="destructive" onClick={() => handleValidate("reject")}>Tolak LPJ</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleValidate("approve")}>Setujui & Posting Transaksi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
