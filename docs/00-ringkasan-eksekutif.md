# Ringkasan eksekutif

| Butir | Keterangan |
|---|---|
| Proyek | Pengembangan SIAPKas (Sistem Informasi Akuntansi Pengeluaran Kas), Fase 1 Siklus Pengeluaran |
| Klien | PT Sejahtera Abadi Nusantara, selanjutnya disebut "Perusahaan" (nama fiktif untuk studi kasus; dapat diganti di menu Pengaturan) |
| Penyusun | Tim Konsultan Sistem Informasi Akuntansi |
| Versi | 1.0, 25 September 2026 |
| Acuan awal | System Architecture Document (SAD) v1.1 Desktop/LAN, berkas `gemini-code-1790339611374.md` di akar repositori |

## 1. Latar belakang

Perusahaan bergerak di bidang manufaktur dan distribusi kemasan, dengan 200 pegawai di kantor pusat, pabrik, dan gudang di Bandung. Setiap uang yang keluar dari rekening bank atau brankas saat ini melewati formulir kertas, tanda tangan basah, dan lembar kerja Excel yang dipegang masing-masing bagian. SAD v1.1 sudah menetapkan arah teknologinya (aplikasi desktop Electron, server Node.js, basis data MariaDB, seluruhnya di LAN). Yang belum ada adalah rancangan bisnisnya: siapa mengerjakan apa, dokumen apa yang dipakai, kontrol apa yang harus dipasang, dan jurnal apa yang terbentuk.

Dokumen ini membuka rangkaian hasil kerja konsultan untuk mengisi celah tersebut, lalu mewujudkannya menjadi aplikasi yang siap diuji.

## 2. Masalah yang ingin diselesaikan

Hipotesis awal di bawah ini disusun dari SAD v1.1 dan pola yang umum dijumpai pada perusahaan sejenis. Setiap butir divalidasi melalui wawancara pada Fase Analisis (panduan wawancara ada di Lampiran A dokumen [02-kebutuhan-pengguna.md](02-kebutuhan-pengguna.md)).

1. Pencocokan pesanan pembelian, laporan penerimaan barang, dan faktur pemasok dikerjakan manual di tiga berkas berbeda, sehingga faktur yang sama berisiko dibayar dua kali.
2. Persetujuan pembayaran bergantung pada berpindahnya berkas dari meja ke meja. Satu faktur butuh sekitar 9 hari kerja sejak diterima sampai siap dibayar.
3. Jatuh tempo utang tidak terpantau, sehingga Perusahaan terkena denda keterlambatan dan kehilangan potongan tunai.
4. Nomor cek dan bilyet giro dicatat tangan. Lembar yang rusak atau batal tidak selalu dicatat.
5. Pengisian kembali kas kecil terlambat dan bukti pengeluaran kerap tercecer, sehingga opname kas sering menemukan selisih.
6. Uang muka kerja karyawan tidak dipertanggungjawabkan tepat waktu dan tidak ada daftar umur uang muka.
7. Rekonsiliasi bank memakan 4 sampai 5 hari kerja karena daftar cek beredar disusun ulang setiap bulan.
8. Jurnal diketik ulang dari formulir ke perangkat lunak akuntansi, sehingga terjadi input ganda dan salah ketik.
9. Tidak ada jejak audit yang menunjukkan siapa mengubah data apa dan kapan.

## 3. Tujuan dan ukuran keberhasilan

| No | Tujuan | Ukuran keberhasilan (target 3 bulan setelah go-live) |
|---|---|---|
| T1 | Mempercepat proses dari faktur diterima sampai pembayaran siap | Rata-rata dari ±9 hari kerja menjadi paling lama 3 hari kerja |
| T2 | Menghilangkan pembayaran ganda | 0 kejadian; sistem menolak nomor faktur yang sama dari pemasok yang sama |
| T3 | Memastikan setiap pengeluaran kas diotorisasi | 100% bukti kas keluar (BKK) disetujui sesuai matriks otorisasi sebelum dibayar |
| T4 | Mengamankan warkat bank | 100% nomor cek dan bilyet giro berstatus jelas: tersedia, terpakai, atau batal |
| T5 | Mempercepat rekonsiliasi bank | Selesai paling lama 3 hari kerja setelah rekening koran diterima |
| T6 | Mengendalikan uang muka karyawan | Uang muka yang lewat tenggat pertanggungjawaban kurang dari 5% dari total uang muka beredar |
| T7 | Menghapus input ganda | 100% jurnal pengeluaran kas terbentuk otomatis dari transaksi |

## 4. Ruang lingkup Fase 1

Termasuk dalam lingkup:

1. Pembayaran utang pemasok dengan sistem voucher: pesanan pembelian (PO), laporan penerimaan barang atau berita acara serah terima jasa (LPB/BAST), pencatatan faktur dengan pencocokan tiga arah (*three-way match*), BKK, dan pembayaran dengan cek, bilyet giro, atau transfer.
2. Permintaan pembayaran nonpembelian, misalnya tagihan listrik, sewa, dan jasa profesional, termasuk pemotongan PPh Pasal 23 dan Pasal 4 ayat (2).
3. Uang muka kerja dan pertanggungjawabannya, termasuk pengembalian sisa dan pembayaran kekurangan.
4. Dana kas kecil sistem imprest: pembentukan, pengeluaran, pengisian kembali, dan opname.
5. Register cek, pembatalan pembayaran, rekonsiliasi bank, dan jurnal otomatis ke buku besar.
6. Laporan pengeluaran kas, buku pembantu utang, umur utang, neraca saldo, dan laporan pengecualian untuk auditor.
7. Pengamanan: hak akses berbasis peran, pemisahan tugas, matriks otorisasi, dan log audit.

Di luar lingkup Fase 1 (kandidat fase berikutnya): permintaan pembelian dan tender pemasok, persediaan dan kartu gudang, aset tetap, penggajian dan PPh Pasal 21, anggaran, integrasi e-Faktur/e-Bupot, integrasi *host-to-host* dengan bank, siklus pendapatan, dan mata uang asing.

## 5. Pendekatan

Pekerjaan dibagi tujuh fase selama 32 minggu, mulai 5 Oktober 2026. Go-live ditargetkan 1 April 2027 (minggu ke-26), yaitu awal periode akuntansi, lalu diikuti 6 minggu pendampingan dan serah terima. Fase analisis dan perancangan memakai pendekatan berurutan agar kebutuhan dan kontrol disepakati sebelum kode ditulis. Fase pengembangan memakai lima sprint dua mingguan; setiap akhir sprint pengguna kunci mencoba fitur yang sudah jadi. Rinciannya ada di [01-rencana-proyek.md](01-rencana-proyek.md).

## 6. Keputusan rancangan utama

Keputusan berikut diambil konsultan dan perlu dikonfirmasi Pemilik Proses (Manajer Keuangan) pada rapat tinjauan rancangan.

| No | Keputusan | Alasan |
|---|---|---|
| K1 | Semua pengeluaran kas, kecuali pengeluaran dari dana kas kecil, wajib melalui BKK yang diotorisasi | BKK menjadi satu-satunya perintah bayar dari fungsi akuntansi kepada fungsi kas |
| K2 | Kas kecil memakai sistem imprest dengan batas Rp1.000.000 per transaksi | Saldo dana selalu dapat dicocokkan: uang tunai + bukti belum diganti = dana tetap |
| K3 | Pencocokan tiga arah PO, LPB/BAST, dan faktur dengan toleransi harga dan kuantitas 0% | Selisih apa pun butuh persetujuan Manajer Keuangan; toleransi dapat diubah di Pengaturan |
| K4 | BKK di atas Rp50.000.000 dan PO di atas Rp100.000.000 wajib disetujui Direktur | Batas awal usulan konsultan; seluruh batas dapat diubah di menu Aturan Persetujuan |
| K5 | Pembuat dokumen tidak dapat menyetujui dokumennya sendiri, dan satu orang hanya menyetujui satu langkah per dokumen | Prinsip *maker-checker* dipaksakan oleh sistem |
| K6 | Kombinasi peran yang bertentangan (misalnya Kasir dengan Staf Akuntansi) tidak dapat diberikan kepada satu akun | Pemisahan fungsi penyimpanan, pencatatan, dan otorisasi |
| K7 | Aplikasi Electron berperan sebagai *thin client* yang memuat antarmuka dari server aplikasi di LAN | Ke-200 PC selalu menjalankan versi yang sama; pembaruan cukup dilakukan di satu server |
| K8 | Teknologi: Node.js 24 LTS dengan Express 5, React 19, MariaDB LTS (10.11 atau 11.4) | Sesuai SAD v1.1; semua pustaka dibundel sehingga tidak butuh internet |

## 7. Hasil kerja

| Kode | Hasil kerja | Lokasi |
|---|---|---|
| D00 | Ringkasan eksekutif (dokumen ini) | `docs/00-ringkasan-eksekutif.md` |
| D01 | Rencana proyek | `docs/01-rencana-proyek.md` |
| D02 | Spesifikasi kebutuhan pengguna | `docs/02-kebutuhan-pengguna.md` |
| D03 | Analisis dan rancangan proses bisnis | `docs/03-proses-bisnis.md` |
| D04 | Rancangan pengendalian intern | `docs/04-pengendalian-intern.md` |
| D05 | Rancangan dokumen dan formulir | `docs/05-dokumen-dan-formulir.md` |
| D06 | Rancangan basis data | `docs/06-rancangan-basis-data.md` |
| D07 | Rancangan akuntansi (bagan akun dan jurnal) | `docs/07-rancangan-akuntansi.md` |
| D08 | Arsitektur sistem (SAD v2.0) | `docs/08-arsitektur-sistem.md` |
| D09 | Spesifikasi API | `docs/09-spesifikasi-api.md` |
| D10 | Rencana pengujian dan UAT | `docs/10-rencana-pengujian-uat.md` |
| D11 | Rencana implementasi dan pelatihan | `docs/11-rencana-implementasi.md` |
| D12 | Prosedur operasi standar (SOP) | `docs/12-sop-pengeluaran-kas.md` |
| D13 | Manual pengguna | `docs/13-manual-pengguna.md` |
| D14 | Panduan instalasi dan operasi TI | `docs/14-panduan-instalasi.md` |
| A01 | Server aplikasi (API) dan skema basis data | `server/` |
| A02 | Aplikasi klien (antarmuka dan cetak formulir) | `client/` |
| A03 | Aplikasi desktop (Electron) | `desktop/` |

## 8. Urutan membaca

Pimpinan cukup membaca dokumen ini, bagian jadwal dan risiko di D01, serta matriks otorisasi di D04. Pemilik proses dan pengguna kunci membaca D02, D03, D05, dan D12 karena keempatnya menjadi dasar persetujuan kebutuhan dan UAT. Tim TI membaca D06, D08, D09, dan D14.
