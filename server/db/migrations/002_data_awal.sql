-- SIAPKas: data awal (dapat disesuaikan saat implementasi)
SET NAMES utf8mb4;

INSERT INTO pengaturan (kunci, nilai, keterangan) VALUES
('perusahaan_nama', 'PT Sejahtera Abadi Nusantara', 'Nama perusahaan pada kop formulir (nama fiktif untuk studi kasus)'),
('perusahaan_alamat', 'Jl. Industri Raya No. 17', 'Alamat pada kop formulir'),
('perusahaan_kota', 'Bandung', 'Kota pada kop dan tempat tanda tangan'),
('perusahaan_telepon', '(022) 1234-5678', 'Telepon pada kop formulir'),
('perusahaan_npwp', '01.234.567.8-424.000', 'NPWP perusahaan'),
('perusahaan_email', 'keuangan@sejahtera-abadi.local', 'Email bagian keuangan'),
('toleransi_harga_persen', '0', 'Toleransi selisih harga faktur terhadap PO (%)'),
('toleransi_qty_persen', '0', 'Toleransi kelebihan kuantitas faktur terhadap LPB (%)'),
('hari_batas_pj_uang_muka', '7', 'Hari setelah kegiatan selesai sebagai tenggat pertanggungjawaban uang muka'),
('wajib_lampiran', '1', 'PP dan PJUM wajib punya lampiran sebelum diajukan (1 = ya, 0 = tidak)'),
('batas_lampiran_mb', '5', 'Ukuran maksimal satu berkas lampiran (MB)'),
('sesi_timeout_menit', '30', 'Sesi berakhir setelah sekian menit tanpa aktivitas'),
('sesi_maks_jam', '12', 'Umur maksimal sesi sejak masuk (jam)'),
('maks_gagal_login', '5', 'Jumlah gagal masuk berturut-turut sebelum akun dikunci'),
('durasi_kunci_menit', '15', 'Lama akun terkunci (menit)'),
('min_panjang_password', '8', 'Panjang minimal kata sandi'),
('ambang_kas_kecil_persen', '25', 'Beri tanda bila saldo tunai kas kecil di bawah persentase dana tetap'),
('pajak_ppn_bawaan', 'PPN11', 'Kode pajak PPN bawaan untuk PO dan faktur'),
('akun_utang_usaha', '2-1101', 'Akun Utang Usaha'),
('akun_uang_muka_karyawan', '1-1401', 'Akun Uang Muka Kerja Karyawan'),
('akun_piutang_karyawan', '1-1202', 'Akun Piutang Karyawan (sisa uang muka)'),
('akun_utang_karyawan', '2-1301', 'Akun Utang kepada Karyawan (kekurangan uang muka)'),
('akun_beban_adm_bank', '6-1116', 'Akun beban administrasi bank (rekonsiliasi)'),
('akun_pendapatan_jasa_giro', '4-2101', 'Akun pendapatan jasa giro (rekonsiliasi)'),
('akun_beban_pajak', '6-1114', 'Akun beban pajak atas jasa giro (rekonsiliasi)');

INSERT INTO departemen (kode, nama) VALUES
('DIR', 'Direksi'),
('KEU', 'Keuangan dan Akuntansi'),
('PBL', 'Pembelian'),
('GDG', 'Gudang'),
('PRD', 'Produksi'),
('PMS', 'Pemasaran'),
('UMS', 'Umum dan SDM'),
('TI', 'Teknologi Informasi'),
('SPI', 'Satuan Pengawasan Intern');

INSERT INTO peran (kode, nama, fungsi, deskripsi, urutan) VALUES
('PEMOHON', 'Pemohon', 'Fungsi yang memerlukan pembayaran', 'Membuat permintaan pembayaran, uang muka, pertanggungjawaban, dan pengeluaran kas kecil', 1),
('KEPALA_DEPT', 'Kepala Departemen', 'Otorisasi departemen', 'Menyetujui dokumen dari departemennya', 2),
('PEMBELIAN', 'Staf Pembelian', 'Fungsi pembelian', 'Membuat pesanan pembelian dan memelihara data pemasok', 3),
('GUDANG', 'Staf Gudang', 'Fungsi penerimaan', 'Mencatat LPB dan BAST', 4),
('AKUNTANSI', 'Staf Akuntansi Utang', 'Fungsi akuntansi (pencatat utang)', 'Mencatat faktur, membuat BKK, memproses pengisian kas kecil, jurnal manual', 5),
('SPV_AKUNTANSI', 'Kepala Bagian Akuntansi', 'Fungsi akuntansi (penyelia)', 'Memeriksa BKK, verifikasi PJUM dan rekening pemasok, rekonsiliasi bank, bagan akun dan pajak', 6),
('MANAJER_KEUANGAN', 'Manajer Keuangan', 'Otorisasi keuangan', 'Menyetujui BKK, jurnal manual, selisih pencocokan; membatalkan pembayaran; menutup periode', 7),
('DIREKTUR', 'Direktur Keuangan', 'Otorisasi tertinggi', 'Menyetujui BKK dan PO bernilai besar', 8),
('KASIR', 'Kasir', 'Fungsi kas', 'Membayar BKK, mengelola buku cek, mencatat kas masuk', 9),
('KAS_KECIL', 'Pemegang Kas Kecil', 'Fungsi kas kecil', 'Membayar pengeluaran kas kecil dan mengajukan pengisian kembali', 10),
('AUDITOR', 'Auditor Internal', 'Fungsi pemeriksa intern', 'Membaca seluruh data, opname kas kecil, log audit, laporan pengecualian', 11),
('ADMIN', 'Administrator Sistem', 'Fungsi teknologi informasi', 'Mengelola akun pengguna, aturan persetujuan, dan pengaturan', 12);

INSERT INTO konflik_peran (peran_a, peran_b, alasan) VALUES
('KASIR', 'AKUNTANSI', 'Penyimpan kas tidak boleh mencatat utang dan membuat perintah bayar'),
('KASIR', 'SPV_AKUNTANSI', 'Penyimpan kas tidak boleh memeriksa BKK dan merekonsiliasi bank'),
('KASIR', 'MANAJER_KEUANGAN', 'Penyimpan kas tidak boleh mengotorisasi pembayaran'),
('KASIR', 'DIREKTUR', 'Penyimpan kas tidak boleh mengotorisasi pembayaran'),
('KASIR', 'KAS_KECIL', 'Dua fungsi penyimpanan kas dipisah agar pengisian kas kecil diuji pihak lain'),
('KASIR', 'PEMBELIAN', 'Penyimpan kas tidak boleh memesan barang'),
('KASIR', 'GUDANG', 'Penyimpan kas tidak boleh menerima barang'),
('KAS_KECIL', 'AKUNTANSI', 'Pemegang dana tidak boleh memproses pengisian dananya sendiri'),
('KAS_KECIL', 'SPV_AKUNTANSI', 'Pemegang dana tidak boleh memeriksa atau mengopname dananya sendiri'),
('KAS_KECIL', 'MANAJER_KEUANGAN', 'Pemegang dana tidak boleh menyetujui pengisian dananya sendiri'),
('PEMBELIAN', 'GUDANG', 'Pemesan tidak boleh sekaligus menerima barang'),
('PEMBELIAN', 'AKUNTANSI', 'Pemesan dan pemelihara data pemasok tidak boleh mencatat utang'),
('GUDANG', 'AKUNTANSI', 'Penerima barang tidak boleh mencatat utang'),
('AKUNTANSI', 'MANAJER_KEUANGAN', 'Pencatat tidak boleh mengotorisasi'),
('AKUNTANSI', 'DIREKTUR', 'Pencatat tidak boleh mengotorisasi'),
('ADMIN', 'AKUNTANSI', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'SPV_AKUNTANSI', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'MANAJER_KEUANGAN', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'DIREKTUR', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'KASIR', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'KAS_KECIL', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'PEMBELIAN', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'GUDANG', 'Pengelola sistem tidak boleh bertransaksi'),
('ADMIN', 'AUDITOR', 'Pengelola sistem tidak boleh mengaudit sistem yang dikelolanya'),
('AUDITOR', 'AKUNTANSI', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'SPV_AKUNTANSI', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'MANAJER_KEUANGAN', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'DIREKTUR', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'KASIR', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'KAS_KECIL', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'PEMBELIAN', 'Pemeriksa harus independen dari operasi'),
('AUDITOR', 'GUDANG', 'Pemeriksa harus independen dari operasi');

CREATE TEMPORARY TABLE tmp_akun (
  kode VARCHAR(20), nama VARCHAR(150), kategori VARCHAR(20), saldo_normal CHAR(1), tipe VARCHAR(10), induk VARCHAR(20)
);

INSERT INTO tmp_akun VALUES
('1-0000', 'ASET', 'ASET', 'D', 'INDUK', NULL),
('1-1000', 'Aset Lancar', 'ASET', 'D', 'INDUK', '1-0000'),
('1-1100', 'Kas dan Setara Kas', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1102', 'Kas Kecil Kantor Pusat', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1103', 'Kas Kecil Pabrik', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1104', 'Kas Kecil Gudang', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1111', 'Bank BCA Giro Operasional', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1112', 'Bank Mandiri Giro', 'ASET', 'D', 'DETAIL', '1-1100'),
('1-1200', 'Piutang', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1201', 'Piutang Usaha', 'ASET', 'D', 'DETAIL', '1-1200'),
('1-1202', 'Piutang Karyawan', 'ASET', 'D', 'DETAIL', '1-1200'),
('1-1203', 'Piutang Lain-lain', 'ASET', 'D', 'DETAIL', '1-1200'),
('1-1300', 'Persediaan', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1301', 'Persediaan Bahan Baku', 'ASET', 'D', 'DETAIL', '1-1300'),
('1-1302', 'Persediaan Bahan Pembantu', 'ASET', 'D', 'DETAIL', '1-1300'),
('1-1303', 'Persediaan Suku Cadang', 'ASET', 'D', 'DETAIL', '1-1300'),
('1-1400', 'Uang Muka dan Biaya Dibayar di Muka', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1401', 'Uang Muka Kerja Karyawan', 'ASET', 'D', 'DETAIL', '1-1400'),
('1-1402', 'Uang Muka Pembelian', 'ASET', 'D', 'DETAIL', '1-1400'),
('1-1403', 'Sewa Dibayar di Muka', 'ASET', 'D', 'DETAIL', '1-1400'),
('1-1404', 'Asuransi Dibayar di Muka', 'ASET', 'D', 'DETAIL', '1-1400'),
('1-1500', 'Pajak Dibayar di Muka', 'ASET', 'D', 'INDUK', '1-1000'),
('1-1501', 'PPN Masukan', 'ASET', 'D', 'DETAIL', '1-1500'),
('1-2000', 'Aset Tetap', 'ASET', 'D', 'INDUK', '1-0000'),
('1-2101', 'Bangunan', 'ASET', 'D', 'DETAIL', '1-2000'),
('1-2102', 'Mesin dan Peralatan Produksi', 'ASET', 'D', 'DETAIL', '1-2000'),
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
('2-1301', 'Utang kepada Karyawan', 'LIABILITAS', 'K', 'DETAIL', '2-1000'),
('2-1401', 'Biaya yang Masih Harus Dibayar', 'LIABILITAS', 'K', 'DETAIL', '2-1000'),
('3-0000', 'EKUITAS', 'EKUITAS', 'K', 'INDUK', NULL),
('3-1101', 'Modal Disetor', 'EKUITAS', 'K', 'DETAIL', '3-0000'),
('3-2101', 'Saldo Laba', 'EKUITAS', 'K', 'DETAIL', '3-0000'),
('4-0000', 'PENDAPATAN', 'PENDAPATAN', 'K', 'INDUK', NULL),
('4-1101', 'Penjualan', 'PENDAPATAN', 'K', 'DETAIL', '4-0000'),
('4-2101', 'Pendapatan Jasa Giro', 'PENDAPATAN', 'K', 'DETAIL', '4-0000'),
('4-2102', 'Pendapatan Lain-lain', 'PENDAPATAN', 'K', 'DETAIL', '4-0000'),
('5-0000', 'BEBAN POKOK PRODUKSI', 'BEBAN', 'D', 'INDUK', NULL),
('5-1101', 'Beban Pemeliharaan Mesin Produksi', 'BEBAN', 'D', 'DETAIL', '5-0000'),
('5-1102', 'Beban Listrik Pabrik', 'BEBAN', 'D', 'DETAIL', '5-0000'),
('5-1103', 'Beban Perlengkapan Produksi', 'BEBAN', 'D', 'DETAIL', '5-0000'),
('6-0000', 'BEBAN OPERASIONAL', 'BEBAN', 'D', 'INDUK', NULL),
('6-1000', 'Beban Umum dan Administrasi', 'BEBAN', 'D', 'INDUK', '6-0000'),
('6-1101', 'Beban Listrik, Air, dan Telepon', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1102', 'Beban Internet dan Langganan Perangkat Lunak', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1103', 'Beban Sewa', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1104', 'Beban Alat Tulis Kantor', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1105', 'Beban Fotokopi dan Cetakan', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1106', 'Beban Pemeliharaan dan Perbaikan', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1107', 'Beban Kebersihan dan Keamanan', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1108', 'Beban Jasa Profesional', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1109', 'Beban Pos dan Pengiriman', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1110', 'Beban Konsumsi dan Rapat', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1111', 'Beban Perjalanan Dinas', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1112', 'Beban Transportasi', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1113', 'Beban Pelatihan', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1114', 'Beban Pajak dan Perizinan', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1115', 'Beban Asuransi', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1116', 'Beban Administrasi Bank', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-1199', 'Beban Umum Lain-lain', 'BEBAN', 'D', 'DETAIL', '6-1000'),
('6-2000', 'Beban Pemasaran', 'BEBAN', 'D', 'INDUK', '6-0000'),
('6-2101', 'Beban Iklan dan Promosi', 'BEBAN', 'D', 'DETAIL', '6-2000'),
('6-2102', 'Beban Pameran dan Kegiatan Pemasaran', 'BEBAN', 'D', 'DETAIL', '6-2000'),
('6-2103', 'Beban Pengiriman Penjualan', 'BEBAN', 'D', 'DETAIL', '6-2000'),
('6-9000', 'Beban Lain-lain', 'BEBAN', 'D', 'INDUK', '6-0000'),
('6-9101', 'Beban Selisih Kas', 'BEBAN', 'D', 'DETAIL', '6-9000');

INSERT INTO akun (kode, nama, kategori, saldo_normal, tipe)
SELECT kode, nama, kategori, saldo_normal, tipe FROM tmp_akun ORDER BY kode;

UPDATE akun a
  JOIN tmp_akun t ON t.kode = a.kode
  JOIN akun p ON p.kode = t.induk
SET a.induk_id = p.id;

DROP TEMPORARY TABLE tmp_akun;

INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, naik_tanpa_npwp)
SELECT 'PPN11', 'PPN Masukan 11%', 'PPN', 11.000, id, 0 FROM akun WHERE kode = '1-1501';
INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, naik_tanpa_npwp)
SELECT 'PPH23', 'PPh Pasal 23 atas jasa 2%', 'PPH', 2.000, id, 1 FROM akun WHERE kode = '2-1202';
INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, naik_tanpa_npwp)
SELECT 'PPH42SEWA', 'PPh Pasal 4 ayat (2) sewa tanah dan bangunan 10%', 'PPH', 10.000, id, 0 FROM akun WHERE kode = '2-1203';

INSERT INTO rekening_kas (kode, nama, bank_nama, nomor_rekening, atas_nama, akun_id)
SELECT 'BCA-OPS', 'Bank BCA Giro Operasional', 'BCA', '0123456789', 'PT Sejahtera Abadi Nusantara', id FROM akun WHERE kode = '1-1111';
INSERT INTO rekening_kas (kode, nama, bank_nama, nomor_rekening, atas_nama, akun_id)
SELECT 'MDR-GIRO', 'Bank Mandiri Giro', 'Bank Mandiri', '1300012345678', 'PT Sejahtera Abadi Nusantara', id FROM akun WHERE kode = '1-1112';

INSERT INTO aturan_persetujuan (jenis_dokumen, urutan, nama_langkah, peran_kode, lingkup, batas_bawah, peran_pengganti_kode) VALUES
('PO', 1, 'Persetujuan Kepala Departemen', 'KEPALA_DEPT', 'DEPARTEMEN', 0, 'DIREKTUR'),
('PO', 2, 'Persetujuan Direktur', 'DIREKTUR', 'GLOBAL', 100000000, NULL),
('FB', 1, 'Persetujuan selisih pencocokan', 'MANAJER_KEUANGAN', 'GLOBAL', 0, NULL),
('PP', 1, 'Persetujuan atasan', 'KEPALA_DEPT', 'DEPARTEMEN', 0, 'DIREKTUR'),
('PUM', 1, 'Persetujuan atasan', 'KEPALA_DEPT', 'DEPARTEMEN', 0, 'DIREKTUR'),
('PJUM', 1, 'Persetujuan atasan', 'KEPALA_DEPT', 'DEPARTEMEN', 0, 'DIREKTUR'),
('PJUM', 2, 'Verifikasi akuntansi', 'SPV_AKUNTANSI', 'GLOBAL', 0, NULL),
('PKK', 1, 'Persetujuan atasan', 'KEPALA_DEPT', 'DEPARTEMEN', 0, 'MANAJER_KEUANGAN'),
('BKK', 1, 'Pemeriksaan kelengkapan', 'SPV_AKUNTANSI', 'GLOBAL', 0, NULL),
('BKK', 2, 'Persetujuan Manajer Keuangan', 'MANAJER_KEUANGAN', 'GLOBAL', 0, NULL),
('BKK', 3, 'Persetujuan Direktur', 'DIREKTUR', 'GLOBAL', 50000000, NULL),
('JM', 1, 'Persetujuan jurnal', 'MANAJER_KEUANGAN', 'GLOBAL', 0, NULL);
