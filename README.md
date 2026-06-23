# FINARA (Finance Administration and Reporting Application)

Aplikasi Akuntansi dan Keuangan yang kuat dan siap digunakan secara penuh (production-ready) untuk BAUK STIMI YAPMI Makassar.

## Fitur Utama Terintegrasi (100% Fungsional)
- **Dashboard Dinamis (Hero Section)**: Memberikan wawasan cepat tentang kinerja keuangan institusi dan saldo secara real-time.
- **Jurnal Umum Otomatis & Manual**: Mesin akuntansi yang mencatat transaksi secara otomatis, dengan fleksibilitas entri jurnal manual beserta validasi *balancing* debit/kredit yang kokoh.
- **Buku Besar (General Ledger)**: Pelacakan riwayat mutasi per Kode Akun lengkap dengan perhitungan saldo awal dan akhir.
- **Neraca Saldo (Trial Balance)**: Memastikan kesehatan persamaan dasar akuntansi seluruh siklus pencatatan sebelum tutup buku.
- **Laporan Laba/Rugi (Income Statement)**: Laporan detail perhitungan *Net Income* (Pendapatan vs Beban Operasional) yang dapat diekspor ke Excel.
- **Fitur Unggah Bukti Transaksi (Kuitansi/Nota)**: Mendukung pelampiran dokumen (.jpg, .png, .pdf) untuk menunjang audit internal.
- **Sistem Reset Data Aman**: Pengosongan siklus data operasional lama dengan pengamanan *Password Kriptografi* & Auto-Backup format JSON, tanpa kehilangan data krusial seperti Akun Pengguna dan Profil Institusi.

## Arsitektur Siap Integrasi (API Gateway)
Sistem ini dibangun dengan visi ekspansi. Basis data dan arsitektur route FINARA sudah disiapkan untuk menerima integrasi penuh dari aplikasi hulu di masa mendatang, seperti:
- **PANDAWA**: Integrasi untuk otomatisasi penerimaan uang wisuda.
- **PMB**: Integrasi data penerimaan mahasiswa baru.

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- MongoDB + Mongoose
- NextAuth.js
- Tailwind CSS v4 + Shadcn UI
- React Hook Form + Zod
- TanStack React Query

## Cara Setup dan Install
1. Pastikan Anda sudah menginstall Node.js (minimal v20.9) dan memiliki server MongoDB (lokal atau Atlas).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Salin file `.env.local` atau buat file baru dan isi variabel environment-nya. Gunakan nilai lokal masing-masing dan jangan commit file `.env.local`.
   ```env
   MONGODB_URI=<isi_dengan_uri_mongodb_lokal_atau_atlas>
   NEXTAUTH_SECRET=<isi_dengan_secret_aman>
   NEXTAUTH_URL=http://localhost:3000
   ```
   Buat `NEXTAUTH_SECRET` yang kuat, misalnya:
   ```bash
   openssl rand -base64 32
   ```
4. Jalankan script seeder untuk membuat Super Admin awal dan Chart of Account:
   ```bash
   npm run seed
   ```
5. Untuk mengisi data dummy jurnal transaksi (opsional):
   ```bash
   npm run seed:journals
   ```
6. Jalankan server lokal:
   ```bash
   npm run dev
   ```
7. Buka `http://localhost:3000` di browser Anda.

## Akun Default (Setelah Seeding)
- **Email:** `admin@stimi.edu`
- **Role:** Super Admin

*Segera ganti password setelah seed pertama.*

## Struktur Aplikasi
- **app/**: Berisi routing aplikasi (Next.js App Router). Terdapat `/login` dan `/(dashboard)/*`.
- **components/**: Berisi komponen UI (Shadcn UI), Layout (Sidebar, Header), dll.
- **lib/**: Berisi konfigurasi (db, auth).
- **models/**: Skema database Mongoose (User, Student, Account, dll).
- **scripts/**: Script untuk melakukan proses tertentu (contoh: `seed.ts` dan `seed-dummy-journals.ts`).

## Panduan Penggunaan Lengkap
Untuk panduan langkah demi langkah penggunaan operasional oleh tim BAUK/Admin, silakan merujuk ke file [USER_MANUAL.md](./USER_MANUAL.md).
