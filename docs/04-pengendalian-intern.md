# Rancangan pengendalian intern

Versi 1.0, 25 September 2026. Dokumen ini menetapkan kontrol yang dipasang pada siklus pengeluaran kas: siapa boleh melakukan apa, siapa harus menyetujui apa, risiko apa yang dicegah, dan bagaimana setiap kontrol diuji. Kontrol bertanda "otomatis" ditegakkan oleh SIAPKas dan tidak dapat dilewati dari antarmuka maupun dari API.

## 1. Kerangka

Rancangan mengikuti lima komponen COSO *Internal Control: Integrated Framework* (2013): lingkungan pengendalian, penilaian risiko, aktivitas pengendalian, informasi dan komunikasi, serta pemantauan. Untuk aktivitas pengendalian, dokumen ini memakai empat unsur pengendalian intern yang lazim dalam literatur sistem akuntansi Indonesia (misalnya Mulyadi, *Sistem Akuntansi*): struktur organisasi yang memisahkan fungsi, sistem otorisasi dan prosedur pencatatan, praktik yang sehat, serta karyawan yang mutunya sesuai tanggung jawab.

## 2. Pemisahan fungsi

Setiap transaksi pengeluaran kas melewati empat jenis fungsi yang dipegang orang berbeda.

| Peran | Otorisasi | Pencatatan | Penyimpanan aset | Pemeriksaan dan rekonsiliasi |
|---|---|---|---|---|
| Pemohon | | Membuat permintaan | | |
| Kepala Departemen | Menyetujui dokumen departemen | | | |
| Staf Pembelian | | PO, data pemasok | | |
| Staf Gudang | | LPB, BAST | Barang di gudang | |
| Staf Akuntansi Utang | | Faktur, BKK, jurnal manual | | |
| Kepala Bagian Akuntansi | Memeriksa BKK, verifikasi PJUM dan rekening pemasok | | | Rekonsiliasi bank, opname |
| Manajer Keuangan | Menyetujui BKK, jurnal manual, selisih pencocokan; membatalkan pembayaran; menutup periode | | | Meninjau neraca saldo dan pengecualian |
| Direktur | Menyetujui BKK dan PO bernilai besar | | | |
| Kasir | | Mencatat pembayaran dan BKM | Rekening bank, buku cek | |
| Pemegang Kas Kecil | | Mencatat pembayaran PKK | Uang tunai kas kecil | |
| Auditor Internal | | | | Opname, log audit, laporan pengecualian |
| Administrator | Mengelola akun dan konfigurasi | | | |

## 3. Matriks konflik peran

SIAPKas menolak pemberian dua peran berikut kepada satu akun (aturan AB-05). Daftar ini tersimpan di tabel `konflik_peran` dan dapat dibaca Auditor.

| Peran A | Peran B | Alasan |
|---|---|---|
| KASIR | AKUNTANSI | Penyimpan kas tidak boleh mencatat utang dan membuat perintah bayar |
| KASIR | SPV_AKUNTANSI | Penyimpan kas tidak boleh memeriksa BKK dan merekonsiliasi bank |
| KASIR | MANAJER_KEUANGAN | Penyimpan kas tidak boleh mengotorisasi pembayaran |
| KASIR | DIREKTUR | Penyimpan kas tidak boleh mengotorisasi pembayaran |
| KASIR | KAS_KECIL | Dua fungsi penyimpanan kas dipisah agar pengisian kas kecil diuji pihak lain |
| KASIR | PEMBELIAN | Penyimpan kas tidak boleh memesan barang |
| KASIR | GUDANG | Penyimpan kas tidak boleh menerima barang |
| KAS_KECIL | AKUNTANSI | Pemegang dana tidak boleh memproses pengisian dananya sendiri |
| KAS_KECIL | SPV_AKUNTANSI | Pemegang dana tidak boleh memeriksa atau mengopname dananya sendiri |
| KAS_KECIL | MANAJER_KEUANGAN | Pemegang dana tidak boleh menyetujui pengisian dananya sendiri |
| PEMBELIAN | GUDANG | Pemesan tidak boleh sekaligus menerima barang |
| PEMBELIAN | AKUNTANSI | Pemesan dan pemelihara data pemasok tidak boleh mencatat utang |
| GUDANG | AKUNTANSI | Penerima barang tidak boleh mencatat utang |
| AKUNTANSI | MANAJER_KEUANGAN | Pencatat tidak boleh mengotorisasi |
| AKUNTANSI | DIREKTUR | Pencatat tidak boleh mengotorisasi |
| ADMIN | AKUNTANSI, SPV_AKUNTANSI, MANAJER_KEUANGAN, DIREKTUR, KASIR, KAS_KECIL, PEMBELIAN, GUDANG, AUDITOR | Pengelola akun dan konfigurasi tidak boleh bertransaksi atau mengaudit |
| AUDITOR | AKUNTANSI, SPV_AKUNTANSI, MANAJER_KEUANGAN, DIREKTUR, KASIR, KAS_KECIL, PEMBELIAN, GUDANG | Pemeriksa harus independen dari operasi |

Peran PEMOHON dan KEPALA_DEPT tidak berkonflik dengan peran mana pun, karena pembatasannya sudah diatur lewat aturan *maker-checker* dan lingkup departemen.

## 4. Matriks otorisasi

### 4.1 Persetujuan dokumen

Langkah berlaku bila nilai dokumen **lebih besar dari** batas bawah. Lingkup "departemen" berarti penyetuju harus Kepala Departemen dari departemen dokumen. Peran pengganti dipakai bila pembuat dokumen sendiri adalah pemegang peran langkah itu pada departemen yang sama. Seluruh angka dapat diubah Administrator di menu Aturan Persetujuan (tercatat di log audit).

| Dokumen | Urutan | Langkah | Peran | Lingkup | Batas bawah (Rp) | Peran pengganti |
|---|---|---|---|---|---|---|
| PO | 1 | Persetujuan Kepala Departemen | KEPALA_DEPT | Departemen | 0 | DIREKTUR |
| PO | 2 | Persetujuan Direktur | DIREKTUR | Global | 100.000.000 | |
| Faktur berselisih | 1 | Persetujuan selisih pencocokan | MANAJER_KEUANGAN | Global | 0 | |
| PP | 1 | Persetujuan atasan | KEPALA_DEPT | Departemen | 0 | DIREKTUR |
| PUM | 1 | Persetujuan atasan | KEPALA_DEPT | Departemen | 0 | DIREKTUR |
| PJUM | 1 | Persetujuan atasan | KEPALA_DEPT | Departemen | 0 | DIREKTUR |
| PJUM | 2 | Verifikasi akuntansi | SPV_AKUNTANSI | Global | 0 | |
| PKK | 1 | Persetujuan atasan | KEPALA_DEPT | Departemen | 0 | MANAJER_KEUANGAN |
| BKK | 1 | Pemeriksaan kelengkapan | SPV_AKUNTANSI | Global | 0 | |
| BKK | 2 | Persetujuan Manajer Keuangan | MANAJER_KEUANGAN | Global | 0 | |
| BKK | 3 | Persetujuan Direktur | DIREKTUR | Global | 50.000.000 | |
| Jurnal manual | 1 | Persetujuan jurnal | MANAJER_KEUANGAN | Global | 0 | |

Aturan tambahan yang ditegakkan mesin persetujuan:

1. Langkah dijalankan berurutan. Langkah berikutnya baru dapat ditindak setelah langkah sebelumnya disetujui.
2. Pembuat dokumen tidak dapat menyetujui dokumennya sendiri (AB-02).
3. Satu pengguna hanya menyetujui satu langkah pada satu dokumen (AB-03).
4. Saat dokumen diajukan, sistem memastikan setiap langkah punya minimal satu penyetuju aktif yang memenuhi syarat. Bila tidak ada, pengajuan ditolak dengan pesan yang menyebut peran dan departemen yang kosong.
5. Penolakan wajib disertai alasan dan mengembalikan dokumen ke pembuatnya. Pengajuan ulang memulai putaran persetujuan baru; riwayat putaran lama tetap tersimpan.

### 4.2 Otorisasi tindakan khusus

| Tindakan | Peran yang berwenang | Syarat |
|---|---|---|
| Membatalkan pembayaran | MANAJER_KEUANGAN | Wajib alasan; jurnal pembalik |
| Membatalkan BKK yang sudah disetujui | MANAJER_KEUANGAN | Belum dibayar |
| Membatalkan faktur terverifikasi | SPV_AKUNTANSI | Belum dibayar dan tidak sedang diproses di BKK |
| Memverifikasi rekening bank pemasok | SPV_AKUNTANSI | Bukan pengguna yang terakhir mengubah rekening itu |
| Membatalkan lembar warkat kosong | KASIR | Wajib alasan |
| Membatalkan BKM | MANAJER_KEUANGAN | Wajib alasan; jurnal pembalik |
| Menutup dan membuka periode | MANAJER_KEUANGAN | Tercatat di log audit |
| Memfinalkan rekonsiliasi bank | SPV_AKUNTANSI | Selisih nol; pembuat bukan Kasir |
| Mencatat opname kas kecil | AUDITOR, SPV_AKUNTANSI | Bukan pemegang dana yang diopname |
| Mengubah aturan persetujuan dan pengaturan | ADMIN | Atas permintaan tertulis Direktur Keuangan |

## 5. Matriks risiko dan kontrol

Jenis: P = preventif, D = detektif. Sifat: O = otomatis oleh sistem, M = manual.

| Risiko | Kontrol | Jenis | Sifat | Pelaksana | Bukti dan cara uji |
|---|---|---|---|---|---|
| R01 Membayar barang atau jasa yang tidak dipesan | Faktur wajib merujuk PO yang disetujui dari pemasok yang sama | P | O | Sistem | Uji: faktur tanpa PO disetujui ditolak |
| R02 Membayar barang yang belum diterima | Kuantitas ditagih dibatasi kuantitas diterima dikurangi yang sudah ditagih | P | O | Sistem | Uji US-01 kriteria 2 |
| R03 Harga faktur di atas harga PO | Pencocokan harga dengan toleransi; selisih wajib disetujui Manajer Keuangan | P | O dan M | Sistem, Manajer Keuangan | Laporan pengecualian: selisih yang disetujui |
| R04 Faktur dicatat atau dibayar dua kali | Nomor faktur unik per pemasok; jumlah bayar dibatasi sisa utang; cap LUNAS; baris dikunci saat dibayar | P | O | Sistem | Uji US-02; uji bayar dua kali serentak |
| R05 Pembayaran tanpa otorisasi | Hanya BKK berstatus DISETUJUI yang dapat dibayar; jumlah bayar sama dengan jumlah BKK | P | O | Sistem | Uji US-06 |
| R06 Transfer ke rekening yang dipalsukan | Perubahan rekening pemasok wajib diverifikasi pihak lain; transfer hanya ke rekening terverifikasi | P dan D | O | Staf Pembelian, Kepala Bagian Akuntansi | Log audit perubahan rekening; laporan pengecualian |
| R07 Pemasok fiktif | Pemasok dipelihara Staf Pembelian yang tidak dapat mencatat utang; BKK utang butuh faktur, PO, dan LPB | P | O | Sistem | Uji konflik PEMBELIAN dan AKUNTANSI |
| R08 Cek hilang atau dipakai di luar BKK | Setiap lembar warkat tercatat sejak buku diterima; pembatalan beralasan; rekonsiliasi bulanan | P dan D | O dan M | Kasir, Kepala Bagian Akuntansi | Register cek; lembar yang hilang terlihat sebagai tersedia di luar urutan |
| R09 Penyetuju menyetujui dokumen sendiri | *Maker-checker*; satu orang satu langkah | P | O | Sistem | Uji API: pembuat menyetujui ditolak |
| R10 Kepala Departemen menyetujui dokumen departemen lain | Lingkup departemen pada langkah persetujuan | P | O | Sistem | Uji US-09 |
| R11 Transaksi dicatat di periode yang sudah ditutup | Kunci periode pada mesin jurnal | P | O | Sistem | Uji US-16 |
| R12 Jurnal tidak seimbang atau memakai akun induk | Validasi mesin jurnal: debit sama dengan kredit, hanya akun detail aktif | P | O | Sistem | Uji otomatis mesin jurnal |
| R13 Penyalahgunaan kas kecil | Batas per transaksi, validasi saldo tunai, persetujuan atasan, opname mendadak | P dan D | O dan M | Sistem, Auditor | Uji US-12; berita acara opname |
| R14 Uang muka tidak dipertanggungjawabkan | Tenggat otomatis, blokir pengajuan baru, laporan uang muka beredar | P dan D | O | Sistem | Uji US-10; LAP-09 |
| R15 Selisih bank tidak terdeteksi | Rekonsiliasi bulanan oleh bukan Kasir, final hanya bila selisih nol | D | O dan M | Kepala Bagian Akuntansi | Laporan rekonsiliasi bertanda tangan |
| R16 Akses tidak sah | Kata sandi, kunci akun, batas waktu sesi, hak akses per peran, konflik peran | P | O | Sistem | Uji KF-ADM-01 s.d. 05 |
| R17 Perubahan data tanpa jejak | Log audit untuk setiap perubahan; tidak dapat diubah dari aplikasi | D | O | Sistem | Uji US-18 |
| R18 Data hilang | Cadangan harian ke NAS, uji pemulihan triwulanan | P dan D | M | TI | Catatan uji pemulihan |
| R19 Matriks otorisasi diubah tanpa izin | Hanya Administrator; tercatat di log; ditinjau Audit Internal tiap triwulan | P dan D | O dan M | Administrator, Auditor | Log audit entitas `aturan_persetujuan` |
| R20 Dokumen dicetak ulang lalu diajukan kembali | Tanda ASLI dan SALINAN KE-n; cap LUNAS | P | O | Sistem | Uji cetak dua kali |
| R21 Salah hitung pajak | Tarif dari master pajak; tarif naik otomatis untuk pemasok tanpa NPWP | P | O | Sistem | Uji perhitungan PPh Pasal 23 |

## 6. Kontrol aplikasi

**Kontrol masukan.** Kolom wajib, tipe data, dan rentang nilai divalidasi di server. Pilihan akun, pemasok, departemen, dan rekening hanya menampilkan data master yang aktif. Nilai harus lebih besar dari nol. Tanggal transaksi harus jatuh pada periode yang berstatus BUKA. Nomor faktur diperiksa terhadap duplikasi. NPWP harus 15 atau 16 digit.

**Kontrol proses.** Nomor dokumen dibuat sistem dengan penguncian baris sehingga dua pengguna tidak pernah mendapat nomor sama. Pencocokan tiga arah, perhitungan pajak, validasi saldo kas kecil, dan pembentukan jurnal berjalan di server. Setiap perubahan status berjalan dalam satu transaksi basis data; bila satu langkah gagal, seluruh perubahan dibatalkan. Dokumen dikunci (`SELECT ... FOR UPDATE`) saat disetujui atau dibayar.

**Kontrol keluaran.** Formulir mencantumkan tanda ASLI atau SALINAN, cap LUNAS, riwayat persetujuan, nama pencetak, dan waktu cetak. Laporan menampilkan total kontrol. Hak membuka laporan mengikuti peran.

## 7. Kontrol umum teknologi informasi

| Area | Kontrol |
|---|---|
| Akses | Satu akun untuk satu orang, tanpa akun bersama. Kata sandi minimal 8 karakter berisi huruf dan angka, wajib diganti saat pertama masuk. Kunci akun setelah 5 kali gagal. Sesi berakhir setelah 30 menit tanpa aktivitas. Akun karyawan yang keluar dinonaktifkan pada hari terakhir kerja berdasarkan memo SDM. Hak akses ditinjau setiap triwulan oleh Manajer Keuangan dan Audit Internal |
| Perubahan program | Kode disimpan di repositori git. Skema basis data berubah hanya melalui berkas migrasi bernomor. Uji otomatis wajib lulus sebelum rilis. Perubahan yang memengaruhi kontrol melewati UAT. Lingkungan uji dan produksi dipisah |
| Operasi | Cadangan penuh harian ke NAS pukul 22.00 WIB, retensi 30 harian dan 12 bulanan. Uji pemulihan setiap triwulan. Server dilindungi UPS |
| Keamanan fisik | Ruang server terkunci dengan daftar orang yang berwenang. Uang tunai kas kecil disimpan di brankas |

## 8. Pemetaan unsur pengendalian intern pengeluaran kas

| Unsur | Penerapan di SIAPKas |
|---|---|
| Fungsi penyimpanan kas terpisah dari fungsi akuntansi | Konflik peran KASIR dengan AKUNTANSI dan SPV_AKUNTANSI |
| Transaksi pengeluaran kas tidak dikerjakan satu fungsi dari awal sampai akhir | Alur melibatkan pemohon, pencatat, penyetuju, dan Kasir yang berbeda; *maker-checker* |
| Pengeluaran kas diotorisasi pejabat berwenang | Mesin persetujuan berjenjang sesuai nilai |
| Pembukaan dan penutupan rekening bank disetujui pejabat berwenang | Master rekening hanya dikelola Manajer Keuangan; perubahan tercatat di log |
| Jurnal pengeluaran kas didasarkan pada BKK yang diotorisasi dan dilampiri dokumen pendukung | Jurnal JKK hanya terbentuk dari pembayaran atas BKK berstatus DISETUJUI; lampiran wajib untuk PP dan PJUM |
| Saldo kas di tangan dilindungi | Kas kecil imprest dengan batas per transaksi, brankas, opname mendadak |
| Pembayaran dengan cek atas nama | Nama penerima di BKK dan tanda terima cek |
| Dokumen pendukung dicap lunas setelah dibayar | Cap LUNAS otomatis pada cetakan BKK |
| Rekening koran dipakai untuk menguji catatan kas oleh pihak independen | Rekonsiliasi bank oleh Kepala Bagian Akuntansi, bukan Kasir |
| Semua nomor cek dipertanggungjawabkan | Register warkat per lembar dengan status tersedia, terpakai, batal |
| Penerimaan kas segera disetor ke bank | Pengembalian uang muka dicatat sebagai BKM ke rekening bank |

## 9. Kontrol kompensasi

Bila jumlah staf tidak memungkinkan pemisahan penuh, misalnya saat salah satu Kasir cuti panjang, kontrol berikut dipakai sebagai pengganti dan harus disetujui tertulis oleh Manajer Keuangan:

1. Manajer Keuangan meninjau register cek dan laporan pengecualian setiap minggu, bukan setiap bulan.
2. Audit Internal melakukan opname tambahan tanpa pemberitahuan.
3. Pengguna pengganti diberi peran sementara dengan tanggal berakhir yang dicatat di memo penugasan, lalu perannya dicabut tepat waktu.

## 10. Pemantauan

| Kegiatan | Frekuensi | Pelaksana | Sumber data |
|---|---|---|---|
| Tinjauan laporan pengecualian | Bulanan | Audit Internal, Manajer Keuangan | LAP-13 |
| Opname kas kecil mendadak | Minimal sekali per triwulan per dana | Audit Internal | Menu Opname |
| Tinjauan hak akses dan konflik peran | Triwulanan | Manajer Keuangan, Audit Internal | Daftar pengguna dan peran |
| Tinjauan perubahan aturan persetujuan dan rekening pemasok | Triwulanan | Audit Internal | Log audit |
| Uji pemulihan cadangan | Triwulanan | TI | Catatan uji pemulihan |
