# Rancangan dokumen dan formulir

Versi 1.0, 25 September 2026. Dokumen ini merinci setiap dokumen sumber dan catatan akuntansi yang dipakai SIAPKas. Semua dokumen dibuat dan disetujui secara elektronik. Salinan cetak hanya dibuat bila harus diserahkan ke pihak luar, ditandatangani basah, atau diarsipkan bersama bukti fisik.

## 1. Daftar dokumen

| No | Dokumen | Kode nomor | Dibuat oleh | Disetujui oleh | Formulir cetak |
|---|---|---|---|---|---|
| 1 | Pesanan pembelian | PO | Staf Pembelian | Kepala Dept. Pembelian, Direktur (di atas Rp100 juta) | Ya, untuk pemasok; versi tanpa harga untuk Gudang |
| 2 | Laporan penerimaan barang | LPB | Staf Gudang | | Ya |
| 3 | Berita acara serah terima jasa | BAST | Staf Gudang atas nama pengguna jasa | | Ya |
| 4 | Register faktur pemasok | FB | Staf Akuntansi Utang | Manajer Keuangan (bila berselisih) | Tidak; faktur asli dari pemasok yang diarsip |
| 5 | Permintaan pembayaran | PP | Pemohon | Kepala Departemen | Ya |
| 6 | Permintaan uang muka | PUM | Pemohon | Kepala Departemen | Ya |
| 7 | Pertanggungjawaban uang muka | PJUM | Pemohon | Kepala Departemen, Kepala Bagian Akuntansi | Ya |
| 8 | Pengeluaran kas kecil (permintaan dan bukti) | PKK | Pemohon; dibayar Pemegang Kas Kecil | Kepala Departemen | Ya, dua versi: permintaan dan bukti pengeluaran |
| 9 | Permintaan pengisian kembali kas kecil | PDK | Pemegang Kas Kecil | Melalui BKK | Ya |
| 10 | Berita acara opname kas kecil | OPN | Auditor Internal atau Kepala Bagian Akuntansi | | Ya |
| 11 | Bukti kas keluar | BKK | Staf Akuntansi Utang | Kepala Bagian Akuntansi, Manajer Keuangan, Direktur (di atas Rp50 juta) | Ya |
| 12 | Pembayaran (tanda terima cek/BG atau instruksi transfer) | BYR | Kasir | | Ya |
| 13 | Bukti kas masuk | BKM | Kasir | | Ya |
| 14 | Bukti memorial (jurnal manual) | JM | Staf Akuntansi Utang, Kepala Bagian Akuntansi | Manajer Keuangan | Ya |
| 15 | Laporan rekonsiliasi bank | RB | Kepala Bagian Akuntansi | Diketahui Manajer Keuangan | Ya |

## 2. Penomoran

Format nomor: `KODE/TAHUN/BULAN/URUT`, misalnya `BKK/2026/10/0007`. Urutan dimulai dari 0001 setiap bulan untuk setiap kode. Nomor diberikan saat dokumen pertama kali disimpan, dari tabel `penomoran` yang dikunci per baris, sehingga tidak ada nomor ganda walau puluhan pengguna menyimpan bersamaan. Dokumen tidak pernah dihapus; dokumen yang dibatalkan tetap ada dengan status BATAL, sehingga setiap nomor dalam urutan dapat ditelusuri.

Jurnal memakai kode sendiri: `JP` (pembelian), `JKK` (kas keluar), `JKM` (kas masuk), dan `JU` (umum, termasuk pembalik dan penyesuaian).

## 3. Tanda pada formulir cetak

| Tanda | Kapan muncul | Tujuan |
|---|---|---|
| ASLI | Cetakan pertama | Menandai satu-satunya dokumen asli |
| SALINAN KE-n | Cetakan kedua dan seterusnya | Mencegah salinan diajukan sebagai dokumen asli |
| LUNAS | BKK, PP, PUM, PDK yang sudah dibayar | Mencegah dokumen pendukung dipakai untuk pembayaran ulang |
| BATAL | Dokumen berstatus BATAL | Menandai dokumen yang tidak berlaku |
| DRAF | Dokumen yang belum disetujui | Mencegah dokumen dipakai sebelum disetujui |

Setiap cetakan memuat kop perusahaan dari menu Pengaturan, nomor dan tanggal dokumen, riwayat persetujuan elektronik (nama, jabatan, waktu), kolom tanda tangan basah, nama pencetak, dan waktu cetak.

## 4. Rincian dokumen

### 4.1 Pesanan pembelian (PO)

Fungsi: perintah pembelian kepada pemasok dan dasar pencocokan faktur.

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, pemasok (nama, alamat, NPWP), departemen peminta, tanggal kirim, termin pembayaran, keterangan |
| Baris | Uraian, jenis (barang atau jasa), kuantitas, satuan, harga satuan, jumlah, akun pembebanan |
| Jumlah | Subtotal (DPP), PPN, total |
| Status | Draf, diajukan, disetujui, diterima sebagian, diterima penuh, ditutup, ditolak, batal |

Distribusi: cetakan asli dikirim ke pemasok. Gudang mencetak versi tanpa harga bila perlu. Akuntansi dan Pembelian memakai data elektronik.

### 4.2 Laporan penerimaan barang (LPB) dan berita acara serah terima (BAST)

Fungsi: bukti bahwa barang atau jasa sudah diterima dalam kuantitas dan kondisi tertentu.

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal terima, jenis (LPB atau BAST), nomor PO, pemasok, nomor surat jalan, keterangan |
| Baris | Uraian dari PO, kuantitas dipesan, sudah diterima sebelumnya, diterima sekarang, satuan, catatan kondisi |

Distribusi: satu cetakan ditandatangani pengirim atau wakil pemasok dan penerima, diarsip di Gudang bersama surat jalan.

### 4.3 Register faktur pemasok (FB)

Fungsi: mencatat utang dan hasil pencocokan tiga arah. Faktur asli dan faktur pajak dari pemasok diunggah sebagai lampiran lalu diarsip fisik oleh Akuntansi.

| Bagian | Isi |
|---|---|
| Kepala | Nomor register, jenis (PO atau saldo awal), pemasok, nomor faktur pemasok, nomor faktur pajak, tanggal faktur, tanggal diterima, jatuh tempo, nomor PO |
| Baris | Baris PO, uraian, kuantitas ditagih, harga ditagih, jumlah, akun, hasil cocok (cocok, selisih kuantitas, selisih harga) |
| Jumlah | DPP, PPN, kode dan jumlah PPh dipotong, total tagihan, total utang (tagihan dikurangi PPh), terbayar, sisa |

### 4.4 Permintaan pembayaran (PP)

Fungsi: permintaan dari departemen untuk membayar kewajiban di luar PO.

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, pemohon, departemen, tanggal dibutuhkan, penerima (pemasok terdaftar atau nama pihak lain), rekening penerima, keterangan dokumen pendukung |
| Baris | Uraian, akun, jumlah |
| Jumlah | Total dan terbilang |
| Tanda tangan | Pemohon, atasan |

### 4.5 Permintaan uang muka (PUM)

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, pemohon, departemen, keperluan, tanggal kegiatan selesai, tenggat pertanggungjawaban |
| Jumlah | Jumlah uang muka dan terbilang |
| Tanda tangan | Pemohon, atasan, penerima uang |

### 4.6 Pertanggungjawaban uang muka (PJUM)

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, nomor PUM, pemohon, departemen, jumlah uang muka |
| Baris | Tanggal, uraian, akun, nomor bukti, jumlah |
| Jumlah | Total realisasi, selisih, dan hasil penyelesaian: pas, sisa dikembalikan, atau kekurangan dibayar |
| Tanda tangan | Pemohon, atasan, verifikator akuntansi |

### 4.7 Pengeluaran kas kecil (PKK)

Satu dokumen dengan dua cetakan. Cetakan "Permintaan Pengeluaran Kas Kecil" dipakai sebelum dibayar; cetakan "Bukti Pengeluaran Kas Kecil" dipakai setelah dibayar dan ditandatangani penerima uang.

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, dana kas kecil, pemohon, departemen, keperluan, akun |
| Jumlah | Jumlah dan terbilang |
| Pembayaran | Tanggal dibayar, pemegang kas kecil, nomor nota atau kuitansi |
| Tanda tangan | Pemohon, atasan, pemegang kas kecil, penerima uang |

### 4.8 Permintaan pengisian kembali kas kecil (PDK)

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, dana kas kecil, pemegang, dana tetap |
| Baris | Nomor PKK, tanggal, keperluan, akun, jumlah |
| Rekap | Jumlah per akun, total pengisian |
| Tanda tangan | Pemegang kas kecil, pemeriksa akuntansi |

### 4.9 Berita acara opname kas kecil (OPN)

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal dan jam opname, dana kas kecil, pemegang, pemeriksa |
| Rincian fisik | Pecahan kertas Rp100.000, 50.000, 20.000, 10.000, 5.000, 2.000, 1.000 dan logam Rp1.000, 500, 200, 100, masing-masing jumlah lembar atau keping dan nilainya |
| Perhitungan | Dana tetap, bukti belum diganti, saldo tunai seharusnya, uang tunai fisik, selisih |
| Tanda tangan | Pemeriksa, pemegang kas kecil |

### 4.10 Bukti kas keluar (BKK)

Fungsi: perintah bayar dari fungsi akuntansi kepada fungsi kas. Setelah dibayar, salinan BKK juga menjadi pemberitahuan pembayaran bagi penerima.

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, jenis (pembayaran faktur, permintaan pembayaran, uang muka, kekurangan uang muka, pembentukan kas kecil, pengisian kas kecil), dokumen sumber, penerima, rekening penerima, rekening sumber, metode bayar, tanggal rencana bayar |
| Rincian | Uraian per baris beserta referensi dokumen (nomor faktur, PP, PKK) |
| Distribusi akun | Akun, departemen, debit; potongan pajak di sisi kredit; bank di sisi kredit |
| Jumlah | Bruto, potongan, dibayar, terbilang |
| Pembayaran | Tanggal bayar, nomor cek, bilyet giro, atau referensi transfer |
| Tanda tangan | Dibuat (Akuntansi), diperiksa (Kepala Bagian Akuntansi), disetujui (Manajer Keuangan), disetujui (Direktur, bila perlu), dibayar (Kasir), diterima (penerima) |

### 4.11 Pembayaran: tanda terima cek atau bilyet giro, dan instruksi transfer (BYR)

Tanda terima dicetak untuk pembayaran dengan cek atau bilyet giro dan ditandatangani penerima saat mengambil warkat. Instruksi transfer dicetak untuk pembayaran transfer dan ditandatangani pejabat yang mengeksekusi transaksi di internet banking.

| Bagian | Isi |
|---|---|
| Kepala | Nomor pembayaran, tanggal, nomor BKK, penerima |
| Warkat | Jenis, nomor, rekening sumber, tanggal jatuh tempo (bilyet giro) |
| Transfer | Bank dan nomor rekening tujuan, atas nama, nomor referensi |
| Jumlah | Jumlah dan terbilang |

### 4.12 Bukti kas masuk (BKM)

Fungsi: mencatat uang yang kembali ke rekening Perusahaan dalam siklus pengeluaran: sisa uang muka, pengembalian dana kas kecil, dan pengembalian kelebihan bayar oleh pemasok.

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, rekening penerima, sumber, dokumen rujukan, diterima dari |
| Jumlah | Jumlah dan terbilang, akun lawan |
| Tanda tangan | Kasir, penyetor |

### 4.13 Bukti memorial (JM)

Fungsi: dasar jurnal manual, misalnya saldo awal, koreksi, dan penyelesaian selisih opname.

| Bagian | Isi |
|---|---|
| Kepala | Nomor, tanggal, jenis (umum, saldo awal, penyesuaian), keterangan |
| Baris | Akun, departemen, pemasok (untuk akun utang usaha), keterangan, debit, kredit |
| Tanda tangan | Dibuat, disetujui |

### 4.14 Laporan rekonsiliasi bank (RB)

| Bagian | Isi |
|---|---|
| Kepala | Nomor, rekening, periode, tanggal akhir |
| Sisi bank | Saldo rekening koran, ditambah setoran dalam perjalanan, dikurangi cek dan bilyet giro beredar (rinci per warkat), ditambah atau dikurangi koreksi bank, saldo bank disesuaikan |
| Sisi buku | Saldo buku besar, dikurangi biaya bank, ditambah jasa giro, ditambah atau dikurangi koreksi buku, saldo buku disesuaikan |
| Hasil | Selisih (harus nol untuk difinalkan) |
| Tanda tangan | Dibuat (Kepala Bagian Akuntansi), diketahui (Manajer Keuangan) |

## 5. Catatan akuntansi

| Catatan | Sumber | Bentuk di SIAPKas |
|---|---|---|
| Register faktur (jurnal pembelian) | Faktur terverifikasi | Jurnal jenis JP dan daftar faktur |
| Register BKK | BKK | LAP-01 |
| Register cek | Lembar warkat dan pembayaran | LAP-02 dan menu Register Cek |
| Jurnal pengeluaran kas | Pembayaran | Jurnal jenis JKK, disajikan kolom (LAP-03) |
| Jurnal penerimaan kas | BKM | Jurnal jenis JKM |
| Jurnal umum | PJUM, jurnal manual, rekonsiliasi, pembalik | Jurnal jenis JU |
| Buku pembantu utang | Baris jurnal akun Utang Usaha per pemasok | LAP-04 dan LAP-05 |
| Buku besar | Semua jurnal | LAP-10 dan LAP-11 |

## 6. Matriks akses dokumen

B = buat dan ubah draf, S = setujui atau tolak, P = proses lanjutan (bayar, verifikasi, batal), L = lihat.

| Dokumen | PEMOHON | KEPALA_DEPT | PEMBELIAN | GUDANG | AKUNTANSI | SPV_AKUNTANSI | MANAJER_KEUANGAN | DIREKTUR | KASIR | KAS_KECIL | AUDITOR |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PO | | S, L dept | B, L | L | L | L | L | S, L | | | L |
| LPB/BAST | | | L | B, P, L | L | L | L | | | | L |
| Faktur | | | | | B, P, L | P, L | S, L | L | L | | L |
| PP | B milik sendiri | S, L dept | | | P, L | L | L | S, L | L | | L |
| PUM, PJUM | B milik sendiri | S, L dept | | | P, L | S, L | L | S, L | P (BKM), L | | L |
| PKK | B milik sendiri | S, L dept | | | L | L | S, L | | | P, L dana sendiri | L |
| PDK | | | | | P, L | L | L | | L | B, L | L |
| Opname | | | | | | B, L | L | | | L dana sendiri | B, L |
| BKK | | | | | B, L | S, L | S, P, L | S, L | P, L | | L |
| Pembayaran | | | | | L | L | P (batal), L | L | B, L | | L |
| BKM | | | | | L | L | P (batal), L | | B, L | | L |
| Jurnal manual | | | | | B, L | B, L | S, L | L | | | L |
| Rekonsiliasi | | | | | L | B, P, L | L | L | | | L |

## 7. Prosedur formulir darurat

Bila server tidak dapat diakses lebih dari 2 jam pada jam kerja, Manajer Keuangan dapat mengaktifkan prosedur darurat:

1. Pengguna mencetak blanko formulir kosong dari persediaan yang dicetak sebelumnya (menu Blanko Formulir).
2. Formulir diberi nomor sementara `DARURAT-TANGGAL-URUT` dan ditandatangani basah sesuai matriks otorisasi.
3. Hanya pembayaran yang tidak dapat ditunda yang diproses.
4. Setelah sistem pulih, Staf Akuntansi memasukkan seluruh transaksi darurat paling lambat 1 hari kerja, mencantumkan nomor darurat di keterangan, dan melampirkan pindaian formulir basah.
5. Kepala Bagian Akuntansi mencocokkan daftar formulir darurat dengan transaksi yang dimasukkan.
