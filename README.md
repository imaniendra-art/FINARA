# FINARA (Finance Administration and Reporting Application)

Aplikasi Akuntansi dan Keuangan untuk BAUK STIMI YAPMI Makassar.

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
5. Jalankan server lokal:
   ```bash
   npm run dev
   ```
6. Buka `http://localhost:3000` di browser Anda.

## Verifikasi Sebelum Testing
Jalankan pemeriksaan lint, tipe, dan production build sebelum menyerahkan aplikasi ke tester:
```bash
npm run verify
```

Untuk smoke test alur finance berbasis database, pastikan `MONGODB_URI` sudah mengarah ke database uji, lalu jalankan:
```bash
npm run test:finance
```

Checklist smoke test manual tersedia di [`TESTING.md`](./TESTING.md).

## Akun Default (Setelah Seeding)
- **Email:** `admin@stimi.edu`
- **Role:** Super Admin

Segera ganti password setelah seed pertama.

## Struktur Aplikasi
- **app/**: Berisi routing aplikasi (Next.js App Router). Terdapat `/login` dan `/(dashboard)/*`.
- **components/**: Berisi komponen UI (Shadcn UI), Layout (Sidebar, Header), dll.
- **lib/**: Berisi konfigurasi (db, auth).
- **models/**: Skema database Mongoose (User, Student, Account, dll).
- **scripts/**: Script untuk melakukan proses tertentu (contoh: `seed.ts`).

## Pengembangan Berikutnya
Implementasi awal ini telah meletakkan fondasi (Next.js, NextAuth, Mongoose Models, Tailwind, Shadcn, Sidebar Layout, Login Page, Dashboard Placeholder, dan Seeder). 
Langkah selanjutnya adalah membangun API internal menggunakan Next.js Route Handler dan membangun halaman interaktif menggunakan React Query untuk CRUD master data (Mahasiswa, Akun, Jenis Tagihan).
