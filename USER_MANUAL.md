# Panduan Pengguna FINARA (User Manual)

Selamat datang di **FINARA (Finance Administration and Reporting Application)**. Dokumen ini dirancang untuk membimbing Staf Administrasi Keuangan/BAUK dalam menggunakan sistem akuntansi dengan urutan operasional yang tepat dan aman.

## BAB 1: PENGATURAN AWAL SISTEM

Sebelum Anda mulai memasukkan transaksi keuangan atau menerima pembayaran mahasiswa, Anda WAJIB memastikan bahwa pengaturan awal sistem sudah benar.

### 1.1. Mengaktifkan Tahun Akademik (Periode Berjalan)
Langkah mendasar yang paling pertama adalah memastikan periode tahun akademik aktif diatur dengan benar agar seluruh pencatatan tagihan mahasiswa terkunci pada siklus tersebut.
1. Navigasi ke menu **Pengaturan** di sidebar sebelah kiri.
2. Pada tab **Tahun Akademik**, periksa daftar periode yang ada.
3. Klik tombol **Set Aktif** pada periode/tahun akademik yang sedang berjalan (contoh: "Ganjil 2026/2027"). Hanya boleh ada satu periode yang aktif pada satu waktu.

### 1.2. Memeriksa Chart of Accounts (COA) / Kode Akun
Sistem akuntansi FINARA bertumpu pada Kode Akun. Pastikan daftar akun ini sesuai dengan standar pembukuan institusi.
1. Masuk ke menu **Kode Akun**.
2. Periksa hierarki akun (Kepala 1 untuk Aset, Kepala 2 untuk Kewajiban, Kepala 3 untuk Ekuitas, Kepala 4 untuk Pendapatan, Kepala 5 untuk Beban).
3. Anda dapat mengedit nama atau menambahkan kode akun baru jika diperlukan. Pastikan akun "Kas" dan "Bank" telah ditandai sebagai tipe Aset dan dalam keadaan *Active*.

---

## BAB 2: MANAJEMEN TRANSAKSI KAS

Modul Kas Masuk/Keluar digunakan untuk mengelola pergerakan dana kas yang **bukan** berasal dari tagihan rutin mahasiswa (seperti SPP).

### 2.1. Mencatat Kas Masuk dan Keluar
1. Buka menu **Kas Masuk/Keluar**.
2. Klik tombol **Tambah Kas Masuk** (misal: Penerimaan Uang PMB, Uang Wisuda) atau **Tambah Kas Keluar** (misal: Pembelian ATK, Pembayaran Listrik).
3. Isi formulir transaksi:
   - Pilih **Akun Kas/Bank** (di mana uang tersebut masuk/keluar).
   - Pilih **Akun Lawan** (misal: "Pendapatan PMB" untuk kas masuk, atau "Beban Listrik" untuk kas keluar).
   - Masukkan nominal secara akurat dan deskripsi transaksi.
4. Klik **Simpan Draft**. Transaksi akan muncul di tabel dengan status `Draft`.

### 2.2. Mengunggah Bukti Transaksi (Wajib Audit)
Sebagai bentuk kelengkapan audit administrasi, sistem mengharuskan/menyarankan Anda untuk melampirkan nota atau kuitansi fisik dari transaksi.
1. Pada tabel transaksi kas, temukan transaksi yang baru Anda buat, lalu klik tombol detail (**ikon mata**).
2. Di dalam panel detail, klik tombol **Upload Bukti Transaksi** (ikon *Plus*).
3. Pilih file gambar (.jpg, .png) atau dokumen (.pdf) dari komputer Anda.
4. Jika berhasil, tombol akan berubah menjadi **Lihat Bukti Transaksi**. Anda dapat mengkliknya kapan saja untuk memvalidasi lampiran fisik secara *real-time*.

### 2.3. Mem-posting Transaksi
Transaksi yang berstatus `Draft` belum masuk ke dalam Buku Besar. Agar resmi tercatat:
1. Buka detail transaksi atau lihat kolom aksi pada tabel.
2. Klik **Posting** (ikon centang).
3. FINARA akan secara otomatis membuatkan entri **Jurnal Umum** ganda (Debit dan Kredit yang seimbang) di latar belakang. Status akan berubah hijau menjadi `Posted`.
> **Catatan:** Anda masih dapat melampirkan/mengubah Bukti Transaksi meskipun statusnya sudah *Posted*.

---

## BAB 3: PEMANTAUAN & AUDIT INTERNAL

Untuk memastikan pencatatan keuangan akurat setiap harinya, Anda dapat memantau dua modul analitik kunci.

### 3.1. Melacak Mutasi pada Buku Besar (General Ledger)
Buku Besar digunakan untuk melihat rincian setiap pergerakan (Debit/Kredit) pada satu kode akun tertentu.
1. Buka menu **Buku Besar**.
2. Pilih satu **Akun** (misalnya: "Kas di Tangan").
3. Tentukan Rentang Tanggal awal dan akhir.
4. Klik **Tampilkan**. Tabel akan menampilkan rincian Mutasi, mulai dari Saldo Awal, penambahan debit/kredit setiap hari, hingga Saldo Akhir akun tersebut.

### 3.2. Memeriksa Keseimbangan di Neraca Saldo (Trial Balance)
Neraca Saldo memastikan bahwa *Double-Entry Accounting* di FINARA berjalan sempurna.
1. Buka menu **Neraca Saldo**.
2. Tentukan **Tanggal Cut-off** (Per tanggal berapa neraca ditarik).
3. Pastikan indikator status di bagian bawah tabel menunjukkan teks hijau tebal: **SEIMBANG (BALANCED)**.
4. Jika statusnya *UNBALANCED*, segera laporkan ke Super Admin, karena hal tersebut mengindikasikan adanya inkonsistensi penjurnalan.

---

## BAB 4: PELAPORAN AKHIR & PENUTUPAN SIKLUS

### 4.1. Laporan Laba/Rugi (Income Statement)
Evaluasi kinerja operasional dapat dilakukan secara presisi dengan melihat Laba/Rugi.
1. Buka menu **Laporan Keuangan** (Laba/Rugi).
2. Tentukan Rentang Tanggal operasional (misalnya satu semester penuh).
3. Sistem akan memisahkan perhitungan menjadi dua kelompok:
   - **Total Pendapatan** (dari akun kepala 4)
   - **Total Beban** (dari akun kepala 5)
4. Perhatikan bagian bawah panel yang menunjukkan kotak besar **LABA BERSIH (Hijau)** atau **RUGI BERSIH (Merah)**.
5. Klik **Export Excel** untuk mengunduh laporan ini ke format Spreadsheet yang siap diserahkan kepada pimpinan kampus.

### 4.2. Pengosongan Data dengan Aman (Reset All)
Apabila Anda telah selesai melakukan simulasi/pengujian (*testing*) dan bersiap untuk menggunakan aplikasi untuk tahap Produksi murni (*Go-Live*), Anda dapat membersihkan data dummy.
1. Buka menu **Pengaturan**, lalu pilih tab **Hapus/Reset All Data** (khusus Super Admin).
2. Pahami bahwa sistem akan **membersihkan seluruh data transaksi operasional** (tagihan, jurnal, kas, mahasiswa).
3. *Jangan khawatir*, data **Akun Pengguna**, **Password**, dan **Profil Sistem** tetap dipertahankan.
4. Masukkan password Super Admin Anda untuk konfirmasi kriptografi.
5. Centang kotak persetujuan dan klik **Backup dan Reset All**.
6. **Sangat Penting:** Saat Anda mengklik, browser Anda akan **otomatis mengunduh satu file JSON** berisi rekam cadang (Backup) seluruh data operasional sebelum sistem menghapusnya secara permanen dari server. Simpan file JSON ini baik-baik!
