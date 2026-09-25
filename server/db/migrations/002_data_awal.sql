-- SIAPKas: data awal Fakultas Ekonomi dan Bisnis Universitas Pasundan (dapat disesuaikan saat implementasi)
SET NAMES utf8mb4;

INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES
('institusi_induk', 'Universitas Pasundan', 'Nama institusi induk pada kop formulir'),
('institusi_nama', 'Fakultas Ekonomi dan Bisnis', 'Nama fakultas pada kop formulir'),
('institusi_subjudul', 'Program Studi: Manajemen (Unggul), Akuntansi (Unggul), Ekonomi (Unggul), Bisnis Digital (Baik)', 'Baris keterangan di bawah nama fakultas pada kop'),
('institusi_alamat', 'Jl. Tamansari No. 4–8, Bandung 40116', 'Alamat pada kop formulir'),
('institusi_kota', 'Bandung', 'Kota tempat tanda tangan'),
('institusi_telepon', '022-4233646; 4208363', 'Telepon pada kop formulir'),
('institusi_email', 'fekon@unpas.ac.id', 'Email pada kop formulir'),
('institusi_npwp', '', 'NPWP pemotong pajak (Universitas/Yayasan), dicetak pada bukti potong'),
('toleransi_harga_persen', '0', 'Toleransi selisih harga faktur terhadap PO (%)'),
('toleransi_qty_persen', '0', 'Toleransi kelebihan kuantitas faktur terhadap LPB (%)'),
('hari_batas_pj_uang_muka', '7', 'Hari setelah kegiatan selesai sebagai tenggat pertanggungjawaban uang muka kegiatan'),
('wajib_lampiran', '1', 'PP dan PJUM wajib punya lampiran sebelum diajukan (1 = ya, 0 = tidak)'),
('batas_lampiran_mb', '5', 'Ukuran maksimal satu berkas lampiran (MB)'),
('sesi_timeout_menit', '30', 'Sesi berakhir setelah sekian menit tanpa aktivitas'),
('sesi_maks_jam', '12', 'Umur maksimal sesi sejak masuk (jam)'),
('maks_gagal_login', '5', 'Jumlah gagal masuk berturut-turut sebelum akun dikunci'),
('durasi_kunci_menit', '15', 'Lama akun terkunci (menit)'),
('min_panjang_password', '8', 'Panjang minimal kata sandi'),
('peran_pimpinan_tertinggi', 'DEKAN', 'Peran tujuan eskalasi bila pembuat dokumen juga memegang peran pengganti'),
('ambang_kas_kecil_persen', '25', 'Beri tanda bila saldo tunai kas kecil di bawah persentase dana tetap'),
('pajak_ppn_bawaan', 'PPN11', 'Kode pajak PPN yang ditagihkan pemasok PKP pada PO dan faktur'),
('ppn_dapat_dikreditkan', '0', 'PPN masukan dapat dikreditkan (1) atau menjadi bagian biaya karena fakultas bukan PKP (0)'),
('akun_utang_usaha', '2-1101', 'Akun Utang Usaha (pemasok)'),
('akun_uang_muka_karyawan', '1-1401', 'Akun Uang Muka Kegiatan (panjar)'),
('akun_piutang_karyawan', '1-1202', 'Akun Piutang Pegawai (sisa uang muka)'),
('akun_utang_karyawan', '2-1301', 'Akun Utang kepada Pegawai (kekurangan uang muka)'),
('akun_beban_adm_bank', '6-1116', 'Akun beban administrasi bank (rekonsiliasi)'),
('akun_pendapatan_jasa_giro', '4-2101', 'Akun pendapatan jasa giro (rekonsiliasi)'),
('akun_beban_pajak', '6-1114', 'Akun beban pajak atas jasa giro (rekonsiliasi)');

INSERT INTO departemen (kode, nama) VALUES
('DKN', 'Dekanat'),
('KEU', 'Subbagian Keuangan'),
('TU', 'Tata Usaha dan Rumah Tangga'),
('MNJ', 'Program Studi Manajemen'),
('AKT', 'Program Studi Akuntansi'),
('EKO', 'Program Studi Ekonomi'),
('BDG', 'Program Studi Bisnis Digital'),
('RPM', 'Unit Riset dan Pengabdian kepada Masyarakat'),
('KMH', 'Unit Kemahasiswaan dan Alumni'),
('PUS', 'Perpustakaan'),
('TI', 'Unit Sistem Teknologi Informasi'),
('SPI', 'Satuan Pengawasan Internal Universitas');

INSERT INTO peran (kode, nama, fungsi, deskripsi, urutan) VALUES
('PEMOHON', 'Pemohon', 'Fungsi yang memerlukan pembayaran', 'Dosen, tenaga kependidikan, atau panitia kegiatan yang membuat permintaan pembayaran, uang muka kegiatan, pertanggungjawaban, dan pengeluaran kas kecil', 1),
('PIMPINAN_UNIT', 'Pimpinan Unit', 'Otorisasi unit kerja', 'Ketua program studi atau kepala unit yang menyetujui dokumen dari unitnya', 2),
('PEMBELIAN', 'Staf Pengadaan', 'Fungsi pengadaan', 'Membuat pesanan pembelian dan memelihara data pemasok', 3),
('GUDANG', 'Penerima Barang', 'Fungsi penerimaan', 'Staf rumah tangga yang mencatat LPB dan BAST', 4),
('STAF_KEUANGAN', 'Staf Keuangan', 'Fungsi akuntansi (pencatat)', 'Mencatat faktur, membuat BKK, menyusun daftar honorarium, memproses pengisian kas kecil, jurnal manual', 5),
('KASUBAG_KEUANGAN', 'Kepala Subbagian Keuangan', 'Fungsi akuntansi (penyelia)', 'Memeriksa BKK, verifikasi pertanggungjawaban dan rekening pemasok, rekonsiliasi bank, bagan akun dan pajak', 6),
('WAKIL_DEKAN_1', 'Wakil Dekan I', 'Otorisasi bidang pembelajaran dan kemahasiswaan', 'Wakil Dekan bidang pembelajaran, kemahasiswaan, dan alumni: menyetujui pengeluaran pos anggaran bidangnya', 7),
('WAKIL_DEKAN_2', 'Wakil Dekan II', 'Otorisasi keuangan', 'Wakil Dekan bidang perencanaan, sumber daya, keuangan, dan sistem teknologi informasi: menyetujui BKK, jurnal manual, selisih pencocokan; membatalkan pembayaran; menutup periode', 8),
('WAKIL_DEKAN_3', 'Wakil Dekan III', 'Otorisasi bidang riset dan kerja sama', 'Wakil Dekan bidang riset dan kerja sama: menyetujui pengeluaran pos anggaran bidangnya, termasuk honorarium penelitian dan PPM', 9),
('DEKAN', 'Dekan', 'Otorisasi tertinggi fakultas', 'Menyetujui BKK dan pesanan bernilai besar serta pengeluaran yang melampaui anggaran', 10),
('KASIR', 'Kasir Fakultas', 'Fungsi kas', 'Membayar BKK, mengelola buku cek, mencatat kas masuk termasuk penerimaan dana operasional', 11),
('KAS_KECIL', 'Pemegang Kas Kecil', 'Fungsi kas kecil', 'Membayar pengeluaran kas kecil dan mengajukan pengisian kembali', 12),
('AUDITOR', 'Auditor Internal', 'Fungsi pemeriksa intern', 'Satuan Pengawasan Internal Universitas: membaca seluruh data, opname kas kecil, log audit, laporan pengecualian', 13),
('ADMIN', 'Administrator Sistem', 'Fungsi teknologi informasi', 'Mengelola akun pengguna, aturan persetujuan, dan pengaturan', 14);

INSERT INTO konflik_peran (peran_a, peran_b, alasan) VALUES
('KASIR', 'STAF_KEUANGAN', 'Penyimpan kas tidak boleh mencatat utang dan membuat perintah bayar'),
('KASIR', 'KASUBAG_KEUANGAN', 'Penyimpan kas tidak boleh memeriksa BKK dan merekonsiliasi bank'),
('KASIR', 'WAKIL_DEKAN_1', 'Penyimpan kas tidak boleh mengotorisasi pembayaran'),
('KASIR', 'WAKIL_DEKAN_2', 'Penyimpan kas tidak boleh mengotorisasi pembayaran'),
('KASIR', 'WAKIL_DEKAN_3', 'Penyimpan kas tidak boleh mengotorisasi pembayaran'),
('KASIR', 'DEKAN', 'Penyimpan kas tidak boleh mengotorisasi pembayaran'),
('KASIR', 'KAS_KECIL', 'Dua fungsi penyimpanan kas dipisah agar pengisian kas kecil diuji pihak lain'),
('KASIR', 'PEMBELIAN', 'Penyimpan kas tidak boleh memesan barang'),
('KASIR', 'GUDANG', 'Penyimpan kas tidak boleh menerima barang'),
('KAS_KECIL', 'STAF_KEUANGAN', 'Pemegang dana tidak boleh memproses pengisian dananya sendiri'),
('KAS_KECIL', 'KASUBAG_KEUANGAN', 'Pemegang dana tidak boleh memeriksa atau mengopname dananya sendiri'),
('KAS_KECIL', 'WAKIL_DEKAN_2', 'Pemegang dana tidak boleh menyetujui pengisian dananya sendiri'),
('PEMBELIAN', 'GUDANG', 'Pemesan tidak boleh sekaligus menerima barang'),
('PEMBELIAN', 'STAF_KEUANGAN', 'Pemesan dan pemelihara data pemasok tidak boleh mencatat utang'),
('GUDANG', 'STAF_KEUANGAN', 'Penerima barang tidak boleh mencatat utang'),
('STAF_KEUANGAN', 'WAKIL_DEKAN_1', 'Pencatat tidak boleh mengotorisasi'),
('STAF_KEUANGAN', 'WAKIL_DEKAN_2', 'Pencatat tidak boleh mengotorisasi'),
('STAF_KEUANGAN', 'WAKIL_DEKAN_3', 'Pencatat tidak boleh mengotorisasi'),
('STAF_KEUANGAN', 'DEKAN', 'Pencatat tidak boleh mengotorisasi'),
('ADMIN', 'STAF_KEUANGAN', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'KASUBAG_KEUANGAN', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'WAKIL_DEKAN_1', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'WAKIL_DEKAN_2', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'WAKIL_DEKAN_3', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'DEKAN', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'KASIR', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'KAS_KECIL', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'PEMBELIAN', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'GUDANG', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'AUDITOR', 'Pengelola sistem tidak boleh mengaudit sistem yang dikelolanya'),
('AUDITOR', 'STAF_KEUANGAN', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'KASUBAG_KEUANGAN', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'WAKIL_DEKAN_1', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'WAKIL_DEKAN_2', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'WAKIL_DEKAN_3', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'DEKAN', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'KASIR', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'KAS_KECIL', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'PEMBELIAN', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'GUDANG', 'Pemeriksa harus independen dari operasi');

CREATE TEMPORARY TABLE tmp_akun (
  kode VARCHAR(20), nama VARCHAR(150), kategori VARCHAR(20), saldo_normal CHAR(1), tipe VARCHAR(10), induk VARCHAR(20)
);

-- Bagan akun menurut sifat biaya. Klasifikasi fungsi (untuk LPJ ke Universitas) memakai pos anggaran.
INSERT INTO tmp_akun VALUES
('1-0000', 'ASET', 'ASET', 'D', 'INDUK', NULL),
('1-1000', 'Aset Lancar', 'ASET', 'D', 'INDUK', '1-0000'),
('1-1100', 'Kas dan Bank', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1102', 'Kas Kecil Dekanat', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1103', 'Kas Kecil Tata Usaha', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1104', 'Kas Kecil Program Studi', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1111', 'Bank BJB Rekening Operasional FEB', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1112', 'Bank BSI Rekening Kegiatan dan Hibah FEB', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1200', 'Piutang', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1201', 'Piutang kepada Universitas', 'ASET', 'D', 'DETAIL', '1-1200'),
('1-1202', 'Piutang Pegawai', 'ASET', 'D', 'DETAIL', '1-1200'),
('1-1203', 'Piutang Lain-lain', 'ASET', 'D', 'DETAIL', '1-1200'),
('1-1300', 'Persediaan', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1301', 'Persediaan Alat Tulis dan Bahan Habis Pakai', 'ASET', 'D', 'DETAIL', '1-1300'),
('1-1302', 'Persediaan Bahan Praktikum dan Laboratorium', 'ASET', 'D', 'DETAIL', '1-1300'),
('1-1303', 'Persediaan Barang Cetakan', 'ASET', 'D', 'DETAIL', '1-1300'),
('1-1400', 'Uang Muka dan Biaya Dibayar di Muka', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1401', 'Uang Muka Kegiatan', 'ASET', 'D', 'DETAIL', '1-1400'),
('1-1402', 'Uang Muka Pembelian', 'ASET', 'D', 'DETAIL', '1-1400'),
('1-1403', 'Sewa Dibayar di Muka', 'ASET', 'D', 'DETAIL', '1-1400'),
('1-1404', 'Asuransi Dibayar di Muka', 'ASET', 'D', 'DETAIL', '1-1400'),
('1-1500', 'Pajak Dibayar di Muka', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1501', 'PPN Masukan', 'ASET', 'D', 'DETAIL', '1-1500'),
('1-2000', 'Aset Tetap', 'ASET', 'D', 'INDUK', '1-0000'),
('1-2101', 'Bangunan', 'ASET', 'D', 'DETAIL', '1-2000'),
('1-2102', 'Peralatan Pembelajaran dan Laboratorium', 'ASET', 'D', 'DETAIL', '1-2000'),
('1-2103', 'Kendaraan', 'ASET', 'D', 'DETAIL', '1-2000'),
('1-2104', 'Peralatan Kantor', 'ASET', 'D', 'DETAIL', '1-2000'),
('1-2105', 'Komputer dan Perangkat TI', 'ASET', 'D', 'DETAIL', '1-2000'),
('1-2199', 'Akumulasi Penyusutan', 'ASET', 'K', 'DETAIL', '1-2000'),
('2-0000', 'LIABILITAS', 'LIABILITAS', 'K', 'INDUK', NULL),
('2-1000', 'Liabilitas Jangka Pendek', 'LIABILITAS', 'K', 'INDUK', '2-0000'),
('2-1101', 'Utang Usaha', 'LIABILITAS', 'K', 'DETAIL', '2-1000'),
('2-1200', 'Utang Pajak', 'LIABILITAS', 'K', 'INDUK', '2-1000'),
('2-1201', 'Utang PPh Pasal 21', 'LIABILITAS', 'K', 'DETAIL', '2-1200'),
('2-1202', 'Utang PPh Pasal 23', 'LIABILITAS', 'K', 'DETAIL', '2-1200'),
('2-1203', 'Utang PPh Pasal 4 Ayat (2)', 'LIABILITAS', 'K', 'DETAIL', '2-1200'),
('2-1301', 'Utang kepada Pegawai', 'LIABILITAS', 'K', 'DETAIL', '2-1000'),
('2-1401', 'Biaya yang Masih Harus Dibayar', 'LIABILITAS', 'K', 'DETAIL', '2-1000'),
('2-1501', 'Utang kepada Universitas', 'LIABILITAS', 'K', 'DETAIL', '2-1000'),
('3-0000', 'DANA', 'EKUITAS', 'K', 'INDUK', NULL),
('3-1101', 'Dana Operasional Fakultas', 'EKUITAS', 'K', 'DETAIL', '3-0000'),
('3-2101', 'Surplus (Defisit) Dana Akumulasian', 'EKUITAS', 'K', 'DETAIL', '3-0000'),
('4-0000', 'PENERIMAAN', 'PENDAPATAN', 'K', 'INDUK', NULL),
('4-1000', 'Penerimaan Dana dari Universitas', 'PENDAPATAN', 'K', 'INDUK', '4-0000'),
('4-1101', 'Penerimaan Dana Penyelenggaraan Pendidikan (DPP)', 'PENDAPATAN', 'K', 'DETAIL', '4-1000'),
('4-1102', 'Penerimaan Dana Pengembangan Program Studi (DPPS)', 'PENDAPATAN', 'K', 'DETAIL', '4-1000'),
('4-1103', 'Penerimaan Hibah dan Bantuan Program', 'PENDAPATAN', 'K', 'DETAIL', '4-1000'),
('4-2101', 'Pendapatan Jasa Giro', 'PENDAPATAN', 'K', 'DETAIL', '4-0000'),
('4-2102', 'Penerimaan Lain-lain', 'PENDAPATAN', 'K', 'DETAIL', '4-0000'),
('5-0000', 'BEBAN TRIDHARMA DAN KEMAHASISWAAN', 'BEBAN', 'D', 'INDUK', NULL),
('5-1000', 'Beban Pendidikan dan Pengajaran', 'BEBAN', 'D', 'INDUK', '5-0000'),
('5-1101', 'Beban Honorarium Tenaga Edukatif', 'BEBAN', 'D', 'DETAIL', '5-1000'),
('5-1102', 'Beban Ujian dan Evaluasi Pembelajaran', 'BEBAN', 'D', 'DETAIL', '5-1000'),
('5-1103', 'Beban Perlengkapan Pembelajaran', 'BEBAN', 'D', 'DETAIL', '5-1000'),
('5-1104', 'Beban Akreditasi dan Penjaminan Mutu', 'BEBAN', 'D', 'DETAIL', '5-1000'),
('5-1105', 'Beban Perpustakaan', 'BEBAN', 'D', 'DETAIL', '5-1000'),
('5-1106', 'Beban Studi Lanjut dan Peningkatan Kompetensi Dosen', 'BEBAN', 'D', 'DETAIL', '5-1000'),
('5-2000', 'Beban Riset dan Pengabdian kepada Masyarakat', 'BEBAN', 'D', 'INDUK', '5-0000'),
('5-2101', 'Beban Honorarium Penelitian', 'BEBAN', 'D', 'DETAIL', '5-2000'),
('5-2102', 'Beban Honorarium Pengabdian kepada Masyarakat', 'BEBAN', 'D', 'DETAIL', '5-2000'),
('5-2103', 'Beban Dana Penelitian dan Pengabdian', 'BEBAN', 'D', 'DETAIL', '5-2000'),
('5-2104', 'Beban Seminar, Publikasi, dan Jurnal', 'BEBAN', 'D', 'DETAIL', '5-2000'),
('5-2105', 'Beban Kerja Sama', 'BEBAN', 'D', 'DETAIL', '5-2000'),
('5-3000', 'Beban Kemahasiswaan, Agama, dan Budaya', 'BEBAN', 'D', 'INDUK', '5-0000'),
('5-3101', 'Beban Pembinaan dan Minat Mahasiswa', 'BEBAN', 'D', 'DETAIL', '5-3000'),
('5-3102', 'Beban Lomba dan Prestasi Mahasiswa', 'BEBAN', 'D', 'DETAIL', '5-3000'),
('5-3103', 'Beban Kegiatan Keagamaan dan Budaya', 'BEBAN', 'D', 'DETAIL', '5-3000'),
('5-3104', 'Beban Alumni dan Pengembangan Karier', 'BEBAN', 'D', 'DETAIL', '5-3000'),
('5-4000', 'Beban Kesejahteraan Pegawai', 'BEBAN', 'D', 'INDUK', '5-0000'),
('5-4101', 'Beban Tunjangan dan Bantuan Pegawai', 'BEBAN', 'D', 'DETAIL', '5-4000'),
('5-4102', 'Beban Panitia Ad Hoc dan Insentif', 'BEBAN', 'D', 'DETAIL', '5-4000'),
('5-4103', 'Beban Pembinaan dan Penghargaan Pegawai', 'BEBAN', 'D', 'DETAIL', '5-4000'),
('6-0000', 'BEBAN OPERASIONAL', 'BEBAN', 'D', 'INDUK', NULL),
('6-1000', 'Beban Umum dan Administrasi', 'BEBAN', 'D', 'INDUK', '6-0000'),
('6-1101', 'Beban Listrik, Air, Telepon, dan Gas', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1102', 'Beban Internet dan Layanan Sistem Informasi', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1103', 'Beban Sewa', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1104', 'Beban Alat Tulis Kantor', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1105', 'Beban Fotokopi dan Cetakan', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1106', 'Beban Pemeliharaan dan Perbaikan Sarana Prasarana', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1107', 'Beban Kebersihan, Keamanan, dan Taman', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1108', 'Beban Jasa Profesional', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1109', 'Beban Pos dan Pengiriman', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1110', 'Beban Konsumsi dan Rapat', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1111', 'Beban Perjalanan Dinas', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1112', 'Beban Transportasi dan BBM', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1113', 'Beban Pelatihan', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1114', 'Beban Pajak dan Retribusi', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1115', 'Beban Asuransi dan Dana Pensiun', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1116', 'Beban Administrasi Bank', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1117', 'Beban Kerumahtanggaan', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1199', 'Beban Umum Lain-lain', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-2000', 'Beban Promosi dan Kelembagaan', 'BEBAN', 'D', 'INDUK', '6-0000'),
('6-2101', 'Beban Iklan', 'BEBAN', 'D', 'DETAIL', '6-2000'),
('6-2102', 'Beban Kegiatan Promosi dan Pameran', 'BEBAN', 'D', 'DETAIL', '6-2000'),
('6-2103', 'Beban Bantuan Sosial dan Kelembagaan', 'BEBAN', 'D', 'DETAIL', '6-2000'),
('6-9000', 'Beban Lain-lain', 'BEBAN', 'D', 'INDUK', '6-0000'),
('6-9101', 'Beban Selisih Kas', 'BEBAN', 'D', 'DETAIL', '6-9000');

INSERT INTO akun (kode, nama, kategori, saldo_normal, tipe)
SELECT kode, nama, kategori, saldo_normal, tipe FROM tmp_akun ORDER BY kode;

UPDATE akun a
  JOIN tmp_akun t ON t.kode = a.kode
  JOIN akun p ON p.kode = t.induk
SET a.induk_id = p.id;

DROP TEMPORARY TABLE tmp_akun;

INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, persen_naik_tanpa_npwp)
SELECT 'PPN11', 'PPN 11%', 'PPN', 11.000, id, 0 FROM akun WHERE kode = '1-1501';
INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, persen_naik_tanpa_npwp)
SELECT 'PPH23', 'PPh Pasal 23 atas jasa 2%', 'PPH', 2.000, id, 100 FROM akun WHERE kode = '2-1202';
INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, persen_naik_tanpa_npwp)
SELECT 'PPH42SEWA', 'PPh Pasal 4 ayat (2) sewa tanah dan bangunan 10%', 'PPH', 10.000, id, 0 FROM akun WHERE kode = '2-1203';
-- Tarif PPh 21 honorarium di bawah ini adalah nilai awal dan wajib dikonfirmasi Bagian Keuangan/Pajak Universitas.
INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, persen_naik_tanpa_npwp)
SELECT 'PPH21_PEG', 'PPh Pasal 21 honorarium pegawai tetap', 'PPH', 5.000, id, 20 FROM akun WHERE kode = '2-1201';
INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, persen_naik_tanpa_npwp)
SELECT 'PPH21_BP', 'PPh Pasal 21 bukan pegawai (50% x tarif Pasal 17)', 'PPH', 2.500, id, 20 FROM akun WHERE kode = '2-1201';

INSERT INTO rekening_kas (kode, nama, bank_nama, nomor_rekening, atas_nama, akun_id)
SELECT 'BJB-OPS', 'Bank BJB Rekening Operasional FEB', 'Bank BJB', '0001234567100', 'Fakultas Ekonomi dan Bisnis Universitas Pasundan', id FROM akun WHERE kode = '1-1111';
INSERT INTO rekening_kas (kode, nama, bank_nama, nomor_rekening, atas_nama, akun_id)
SELECT 'BSI-KEG', 'Bank BSI Rekening Kegiatan dan Hibah FEB', 'Bank Syariah Indonesia', '7123456789', 'Fakultas Ekonomi dan Bisnis Universitas Pasundan', id FROM akun WHERE kode = '1-1112';

INSERT INTO aturan_persetujuan (jenis_dokumen, urutan, nama_langkah, peran_kode, lingkup, batas_bawah, peran_pengganti_kode) VALUES
('PO', 1, 'Persetujuan pimpinan unit', 'PIMPINAN_UNIT', 'DEPARTEMEN', 0, 'WAKIL_DEKAN_2'),
('PO', 2, 'Persetujuan Dekan', 'DEKAN', 'GLOBAL', 50000000, NULL),
('FB', 1, 'Persetujuan selisih pencocokan', 'WAKIL_DEKAN_2', 'GLOBAL', 0, NULL),
('PP', 1, 'Persetujuan pimpinan unit', 'PIMPINAN_UNIT', 'DEPARTEMEN', 0, 'WAKIL_DEKAN_2'),
('PUM', 1, 'Persetujuan pimpinan unit', 'PIMPINAN_UNIT', 'DEPARTEMEN', 0, 'WAKIL_DEKAN_2'),
('PJUM', 1, 'Persetujuan pimpinan unit', 'PIMPINAN_UNIT', 'DEPARTEMEN', 0, 'WAKIL_DEKAN_2'),
('PJUM', 2, 'Verifikasi Subbagian Keuangan', 'KASUBAG_KEUANGAN', 'GLOBAL', 0, NULL),
('PKK', 1, 'Persetujuan pimpinan unit', 'PIMPINAN_UNIT', 'DEPARTEMEN', 0, 'WAKIL_DEKAN_2'),
('BKK', 1, 'Pemeriksaan Kepala Subbagian Keuangan', 'KASUBAG_KEUANGAN', 'GLOBAL', 0, NULL),
('BKK', 2, 'Persetujuan Wakil Dekan II', 'WAKIL_DEKAN_2', 'GLOBAL', 0, NULL),
('BKK', 3, 'Persetujuan Dekan', 'DEKAN', 'GLOBAL', 10000000, NULL),
('JM', 1, 'Persetujuan jurnal', 'WAKIL_DEKAN_2', 'GLOBAL', 0, NULL);
