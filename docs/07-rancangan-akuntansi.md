# Rancangan akuntansi

Versi 1.0, 25 September 2026. Dokumen ini menetapkan bagan akun, akun yang dipakai otomatis oleh sistem, pola jurnal setiap transaksi beserta contohnya, dan aturan periode.

## 1. Dasar

Perusahaan diasumsikan tidak memiliki akuntabilitas publik sehingga menerapkan SAK Entitas Privat (SAK EP) yang berlaku efektif 1 Januari 2025. Perlakuan pada dokumen ini bersifat dasar (pengakuan beban, uang muka sebagai aset, PPN Masukan sebagai pajak dibayar di muka, PPh yang dipotong sebagai utang pajak) sehingga juga sesuai bila Perusahaan memakai SAK Indonesia.

SIAPKas adalah subsistem. Buku besar di dalamnya memuat akun yang tersentuh siklus pengeluaran dan saldo awalnya. Jurnal penutup akhir tahun tetap dikerjakan di sistem akuntansi utama; untuk itu setiap jurnal SIAPKas dapat diekspor ke CSV.

## 2. Bagan akun

Format kode `K-GGNN`: K = kelompok, GG = golongan, NN = rincian. Akun bertipe induk hanya untuk pengelompokan laporan; transaksi hanya boleh memakai akun detail.

| Kode | Nama akun | Kategori | Saldo normal | Tipe |
|---|---|---|---|---|
| 1-0000 | ASET | Aset | D | Induk |
| 1-1000 | Aset Lancar | Aset | D | Induk |
| 1-1100 | Kas dan Setara Kas | Aset | D | Induk |
| 1-1102 | Kas Kecil Kantor Pusat | Aset | D | Detail |
| 1-1103 | Kas Kecil Pabrik | Aset | D | Detail |
| 1-1104 | Kas Kecil Gudang | Aset | D | Detail |
| 1-1111 | Bank BCA Giro Operasional | Aset | D | Detail |
| 1-1112 | Bank Mandiri Giro | Aset | D | Detail |
| 1-1200 | Piutang | Aset | D | Induk |
| 1-1201 | Piutang Usaha | Aset | D | Detail |
| 1-1202 | Piutang Karyawan | Aset | D | Detail |
| 1-1203 | Piutang Lain-lain | Aset | D | Detail |
| 1-1300 | Persediaan | Aset | D | Induk |
| 1-1301 | Persediaan Bahan Baku | Aset | D | Detail |
| 1-1302 | Persediaan Bahan Pembantu | Aset | D | Detail |
| 1-1303 | Persediaan Suku Cadang | Aset | D | Detail |
| 1-1400 | Uang Muka dan Biaya Dibayar di Muka | Aset | D | Induk |
| 1-1401 | Uang Muka Kerja Karyawan | Aset | D | Detail |
| 1-1402 | Uang Muka Pembelian | Aset | D | Detail |
| 1-1403 | Sewa Dibayar di Muka | Aset | D | Detail |
| 1-1404 | Asuransi Dibayar di Muka | Aset | D | Detail |
| 1-1500 | Pajak Dibayar di Muka | Aset | D | Induk |
| 1-1501 | PPN Masukan | Aset | D | Detail |
| 1-2000 | Aset Tetap | Aset | D | Induk |
| 1-2101 | Bangunan | Aset | D | Detail |
| 1-2102 | Mesin dan Peralatan Produksi | Aset | D | Detail |
| 1-2103 | Kendaraan | Aset | D | Detail |
| 1-2104 | Peralatan Kantor | Aset | D | Detail |
| 1-2105 | Komputer dan Perangkat TI | Aset | D | Detail |
| 1-2199 | Akumulasi Penyusutan | Aset | K | Detail |
| 2-0000 | LIABILITAS | Liabilitas | K | Induk |
| 2-1000 | Liabilitas Jangka Pendek | Liabilitas | K | Induk |
| 2-1101 | Utang Usaha | Liabilitas | K | Detail |
| 2-1200 | Utang Pajak | Liabilitas | K | Induk |
| 2-1201 | Utang PPh Pasal 21 | Liabilitas | K | Detail |
| 2-1202 | Utang PPh Pasal 23 | Liabilitas | K | Detail |
| 2-1203 | Utang PPh Pasal 4 Ayat (2) | Liabilitas | K | Detail |
| 2-1301 | Utang kepada Karyawan | Liabilitas | K | Detail |
| 2-1401 | Biaya yang Masih Harus Dibayar | Liabilitas | K | Detail |
| 3-0000 | EKUITAS | Ekuitas | K | Induk |
| 3-1101 | Modal Disetor | Ekuitas | K | Detail |
| 3-2101 | Saldo Laba | Ekuitas | K | Detail |
| 4-0000 | PENDAPATAN | Pendapatan | K | Induk |
| 4-1101 | Penjualan | Pendapatan | K | Detail |
| 4-2101 | Pendapatan Jasa Giro | Pendapatan | K | Detail |
| 4-2102 | Pendapatan Lain-lain | Pendapatan | K | Detail |
| 5-0000 | BEBAN POKOK PRODUKSI | Beban | D | Induk |
| 5-1101 | Beban Pemeliharaan Mesin Produksi | Beban | D | Detail |
| 5-1102 | Beban Listrik Pabrik | Beban | D | Detail |
| 5-1103 | Beban Perlengkapan Produksi | Beban | D | Detail |
| 6-0000 | BEBAN OPERASIONAL | Beban | D | Induk |
| 6-1000 | Beban Umum dan Administrasi | Beban | D | Induk |
| 6-1101 | Beban Listrik, Air, dan Telepon | Beban | D | Detail |
| 6-1102 | Beban Internet dan Langganan Perangkat Lunak | Beban | D | Detail |
| 6-1103 | Beban Sewa | Beban | D | Detail |
| 6-1104 | Beban Alat Tulis Kantor | Beban | D | Detail |
| 6-1105 | Beban Fotokopi dan Cetakan | Beban | D | Detail |
| 6-1106 | Beban Pemeliharaan dan Perbaikan | Beban | D | Detail |
| 6-1107 | Beban Kebersihan dan Keamanan | Beban | D | Detail |
| 6-1108 | Beban Jasa Profesional | Beban | D | Detail |
| 6-1109 | Beban Pos dan Pengiriman | Beban | D | Detail |
| 6-1110 | Beban Konsumsi dan Rapat | Beban | D | Detail |
| 6-1111 | Beban Perjalanan Dinas | Beban | D | Detail |
| 6-1112 | Beban Transportasi | Beban | D | Detail |
| 6-1113 | Beban Pelatihan | Beban | D | Detail |
| 6-1114 | Beban Pajak dan Perizinan | Beban | D | Detail |
| 6-1115 | Beban Asuransi | Beban | D | Detail |
| 6-1116 | Beban Administrasi Bank | Beban | D | Detail |
| 6-1199 | Beban Umum Lain-lain | Beban | D | Detail |
| 6-2000 | Beban Pemasaran | Beban | D | Induk |
| 6-2101 | Beban Iklan dan Promosi | Beban | D | Detail |
| 6-2102 | Beban Pameran dan Kegiatan Pemasaran | Beban | D | Detail |
| 6-2103 | Beban Pengiriman Penjualan | Beban | D | Detail |
| 6-9000 | Beban Lain-lain | Beban | D | Induk |
| 6-9101 | Beban Selisih Kas | Beban | D | Detail |

## 3. Akun sistem

Akun berikut dipakai otomatis oleh mesin jurnal. Pemetaannya disimpan di menu Pengaturan agar dapat diubah bila bagan akun Perusahaan berbeda.

| Kunci pengaturan | Akun bawaan | Dipakai pada |
|---|---|---|
| `akun_utang_usaha` | 2-1101 Utang Usaha | Faktur dan pembayaran faktur |
| `akun_uang_muka_karyawan` | 1-1401 Uang Muka Kerja Karyawan | Pembayaran uang muka dan PJUM |
| `akun_piutang_karyawan` | 1-1202 Piutang Karyawan | Sisa uang muka yang harus dikembalikan |
| `akun_utang_karyawan` | 2-1301 Utang kepada Karyawan | Kekurangan uang muka yang harus dibayar |
| `akun_beban_adm_bank` | 6-1116 Beban Administrasi Bank | Rekonsiliasi: biaya bank |
| `akun_pendapatan_jasa_giro` | 4-2101 Pendapatan Jasa Giro | Rekonsiliasi: jasa giro |
| `akun_beban_pajak` | 6-1114 Beban Pajak dan Perizinan | Rekonsiliasi: pajak atas jasa giro |

Akun kas dan bank diambil dari master rekening, akun kas kecil dari master dana, dan akun pajak dari master pajak.

## 4. Master pajak

| Kode | Nama | Jenis | Tarif | Akun | Tarif naik 100% tanpa NPWP |
|---|---|---|---|---|---|
| PPN11 | PPN Masukan | PPN | 11% | 1-1501 | Tidak |
| PPH23 | PPh Pasal 23 atas jasa | PPh | 2% | 2-1202 | Ya |
| PPH42SEWA | PPh Pasal 4 ayat (2) sewa tanah dan bangunan | PPh | 10% | 2-1203 | Tidak |

Tarif PPN 11% di atas adalah tarif efektif untuk barang dan jasa yang bukan barang mewah menurut ketentuan per 2025 (tarif 12% dikali DPP nilai lain 11/12 dari harga jual). Tim pajak Perusahaan perlu mengonfirmasi tarif sebelum go-live; perubahan cukup dilakukan di master pajak. PPN hanya boleh dicatat untuk pemasok berstatus PKP.

## 5. Pola jurnal otomatis

Setiap contoh memakai angka yang juga dipakai dalam skenario UAT.

### 5.1 Faktur pemasok terverifikasi (jurnal JP)

Contoh barang: 80 unit bahan baku seharga Rp50.000, PPN 11%.

| Akun | Debit | Kredit |
|---|---|---|
| 1-1301 Persediaan Bahan Baku | 4.000.000 | |
| 1-1501 PPN Masukan | 440.000 | |
| 2-1101 Utang Usaha (pemasok) | | 4.440.000 |

Contoh jasa: pemeliharaan mesin Rp10.000.000, PPN 11%, PPh Pasal 23 2%.

| Akun | Debit | Kredit |
|---|---|---|
| 5-1101 Beban Pemeliharaan Mesin Produksi | 10.000.000 | |
| 1-1501 PPN Masukan | 1.100.000 | |
| 2-1101 Utang Usaha (pemasok) | | 10.900.000 |
| 2-1202 Utang PPh Pasal 23 | | 200.000 |

Bila pemasok jasa tidak ber-NPWP, PPh Pasal 23 menjadi 4% (Rp400.000) dan Utang Usaha Rp10.700.000.

### 5.2 Pembayaran faktur (jurnal JKK)

| Akun | Debit | Kredit |
|---|---|---|
| 2-1101 Utang Usaha (pemasok) | 10.900.000 | |
| 1-1111 Bank BCA Giro Operasional | | 10.900.000 |

### 5.3 Pembayaran permintaan pembayaran (jurnal JKK)

Contoh: jasa konsultan pajak Rp15.000.000 dengan PPh Pasal 23 2%.

| Akun | Debit | Kredit |
|---|---|---|
| 6-1108 Beban Jasa Profesional | 15.000.000 | |
| 2-1202 Utang PPh Pasal 23 | | 300.000 |
| 1-1111 Bank BCA Giro Operasional | | 14.700.000 |

### 5.4 Uang muka dan pertanggungjawaban

Pembayaran uang muka Rp3.000.000 (JKK):

| Akun | Debit | Kredit |
|---|---|---|
| 1-1401 Uang Muka Kerja Karyawan | 3.000.000 | |
| 1-1111 Bank BCA Giro Operasional | | 3.000.000 |

PJUM dengan realisasi Rp2.750.000, sisa Rp250.000 (JU):

| Akun | Debit | Kredit |
|---|---|---|
| 6-1111 Beban Perjalanan Dinas | 2.750.000 | |
| 1-1202 Piutang Karyawan | 250.000 | |
| 1-1401 Uang Muka Kerja Karyawan | | 3.000.000 |

Setoran sisa oleh karyawan (JKM):

| Akun | Debit | Kredit |
|---|---|---|
| 1-1111 Bank BCA Giro Operasional | 250.000 | |
| 1-1202 Piutang Karyawan | | 250.000 |

PJUM dengan realisasi Rp3.400.000, kurang Rp400.000 (JU), lalu pembayaran kekurangan (JKK):

| Akun | Debit | Kredit |
|---|---|---|
| 6-1111 Beban Perjalanan Dinas | 3.400.000 | |
| 1-1401 Uang Muka Kerja Karyawan | | 3.000.000 |
| 2-1301 Utang kepada Karyawan | | 400.000 |
| 2-1301 Utang kepada Karyawan (saat BKK dibayar) | 400.000 | |
| 1-1111 Bank BCA Giro Operasional (saat BKK dibayar) | | 400.000 |

### 5.5 Kas kecil

Pembentukan dana Rp10.000.000 (JKK):

| Akun | Debit | Kredit |
|---|---|---|
| 1-1102 Kas Kecil Kantor Pusat | 10.000.000 | |
| 1-1111 Bank BCA Giro Operasional | | 10.000.000 |

Pembayaran PKK oleh pemegang dana tidak dijurnal (sistem imprest). Pengisian kembali atas tiga kelompok bukti (JKK):

| Akun | Debit | Kredit |
|---|---|---|
| 6-1104 Beban Alat Tulis Kantor | 1.250.000 | |
| 6-1110 Beban Konsumsi dan Rapat | 2.100.000 | |
| 6-1112 Beban Transportasi | 900.000 | |
| 1-1111 Bank BCA Giro Operasional | | 4.250.000 |

Penurunan atau penutupan dana dicatat dengan BKM sumber pengembalian kas kecil: debit bank, kredit akun kas kecil. Selisih opname diselesaikan Manajer Keuangan melalui jurnal manual: kekurangan kas didebit ke Piutang Karyawan (bila dibebankan ke pemegang dana) atau Beban Selisih Kas, dan dikredit ke akun kas kecil.

### 5.6 Pembatalan

Pembatalan pembayaran, faktur, dan BKM membuat jurnal pembalik: jenis jurnal sama dengan jurnal asal, debit dan kredit ditukar, bertanggal hari pembatalan, dan mencantumkan nomor jurnal asal. Jurnal asal ditandai "dibalik" dan tidak pernah dihapus.

### 5.7 Rekonsiliasi bank (JU)

Biaya administrasi Rp25.000 dan jasa giro Rp150.000 dengan pajak Rp30.000 yang belum tercatat di buku:

| Akun | Debit | Kredit |
|---|---|---|
| 6-1116 Beban Administrasi Bank | 25.000 | |
| 1-1111 Bank BCA Giro Operasional | | 25.000 |
| 1-1111 Bank BCA Giro Operasional | 150.000 | |
| 4-2101 Pendapatan Jasa Giro | | 150.000 |
| 6-1114 Beban Pajak dan Perizinan | 30.000 | |
| 1-1111 Bank BCA Giro Operasional | | 30.000 |

### 5.8 Saldo awal (JU melalui bukti memorial jenis saldo awal)

Saldo awal per 31 Maret 2027 dimasukkan satu kali sebelum transaksi pertama. Baris akun Utang Usaha diisi per pemasok agar buku pembantu utang langsung benar. Faktur yang belum lunas dicatat sebagai faktur jenis saldo awal tanpa jurnal, sehingga dapat dibayar melalui BKK tanpa menggandakan saldo.

## 6. Aturan mesin jurnal

1. Total debit harus sama dengan total kredit sampai satuan sen.
2. Setiap baris memakai akun detail yang aktif; nilai tidak boleh negatif, dan satu baris hanya berisi debit atau kredit.
3. Tanggal jurnal harus jatuh pada periode berstatus BUKA.
4. Baris akun Utang Usaha wajib mencantumkan pemasok.
5. Jurnal tercatat bersama sumbernya (jenis dan nomor dokumen) sehingga setiap angka di buku besar dapat ditelusuri ke dokumennya.
6. Jurnal tidak pernah diubah atau dihapus. Koreksi selalu melalui jurnal pembalik atau jurnal manual yang disetujui.

## 7. Periode

Periode berbentuk bulan kalender dan dibuat otomatis saat transaksi pertama pada bulan itu. Manajer Keuangan menutup periode setelah daftar periksa tutup buku (D03 bagian 10) selesai. Membuka kembali periode yang sudah ditutup hanya untuk koreksi yang disetujui tertulis, tercatat di log audit, lalu periode ditutup lagi.
