-- SIAPKas: skema basis data siklus pengeluaran kas
-- MariaDB 10.11+ (InnoDB, utf8mb4). Nilai uang DECIMAL(18,2), tanggal DATE, stempel waktu DATETIME (+07:00).

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Administrasi dan keamanan
-- ---------------------------------------------------------------------------

CREATE TABLE pengaturan (
  kunci        VARCHAR(60)  NOT NULL PRIMARY KEY,
  nilai        VARCHAR(500) NOT NULL,
  keterangan   VARCHAR(255) NULL,
  diubah_oleh  INT UNSIGNED NULL,
  diubah_pada  DATETIME     NULL
) ENGINE=InnoDB COMMENT='Parameter sistem: profil perusahaan, toleransi, keamanan, pemetaan akun';

CREATE TABLE departemen (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kode        VARCHAR(10)  NOT NULL,
  nama        VARCHAR(100) NOT NULL,
  aktif       TINYINT(1)   NOT NULL DEFAULT 1,
  dibuat_pada DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_departemen_kode (kode)
) ENGINE=InnoDB COMMENT='Unit kerja / pusat biaya';

CREATE TABLE peran (
  kode      VARCHAR(30)  NOT NULL PRIMARY KEY,
  nama      VARCHAR(100) NOT NULL,
  fungsi    VARCHAR(100) NOT NULL,
  deskripsi VARCHAR(500) NULL,
  urutan    SMALLINT     NOT NULL DEFAULT 0
) ENGINE=InnoDB COMMENT='Peran pengguna (RBAC)';

CREATE TABLE konflik_peran (
  peran_a VARCHAR(30)  NOT NULL,
  peran_b VARCHAR(30)  NOT NULL,
  alasan  VARCHAR(255) NOT NULL,
  PRIMARY KEY (peran_a, peran_b),
  CONSTRAINT fk_konflik_a FOREIGN KEY (peran_a) REFERENCES peran (kode),
  CONSTRAINT fk_konflik_b FOREIGN KEY (peran_b) REFERENCES peran (kode)
) ENGINE=InnoDB COMMENT='Pasangan peran yang tidak boleh dipegang satu akun (pemisahan tugas)';

CREATE TABLE pengguna (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username             VARCHAR(50)  NOT NULL,
  nama_lengkap         VARCHAR(100) NOT NULL,
  jabatan              VARCHAR(100) NULL,
  nomor_pegawai        VARCHAR(30)  NULL COMMENT 'NIPY/NoPeg, dicetak di bawah tanda tangan',
  email                VARCHAR(100) NULL,
  departemen_id        INT UNSIGNED NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  harus_ganti_password TINYINT(1)   NOT NULL DEFAULT 1,
  gagal_login          SMALLINT     NOT NULL DEFAULT 0,
  terkunci_sampai      DATETIME     NULL,
  aktif                TINYINT(1)   NOT NULL DEFAULT 1,
  terakhir_login       DATETIME     NULL,
  password_diubah_pada DATETIME     NULL,
  dibuat_pada          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada          DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pengguna_username (username),
  CONSTRAINT fk_pengguna_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id)
) ENGINE=InnoDB COMMENT='Akun pengguna; tidak pernah dihapus, hanya dinonaktifkan';

CREATE TABLE pengguna_peran (
  pengguna_id INT UNSIGNED NOT NULL,
  peran_kode  VARCHAR(30)  NOT NULL,
  PRIMARY KEY (pengguna_id, peran_kode),
  CONSTRAINT fk_pp_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna (id),
  CONSTRAINT fk_pp_peran FOREIGN KEY (peran_kode) REFERENCES peran (kode)
) ENGINE=InnoDB;

CREATE TABLE sesi (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pengguna_id        INT UNSIGNED NOT NULL,
  token_hash         CHAR(64)     NOT NULL,
  dibuat_pada        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aktivitas_terakhir DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kedaluwarsa        DATETIME     NOT NULL,
  ip                 VARCHAR(45)  NULL,
  user_agent         VARCHAR(255) NULL,
  dicabut_pada       DATETIME     NULL,
  alasan_cabut       VARCHAR(100) NULL,
  UNIQUE KEY uk_sesi_token (token_hash),
  KEY ix_sesi_pengguna (pengguna_id),
  CONSTRAINT fk_sesi_pengguna FOREIGN KEY (pengguna_id) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Sesi masuk; yang disimpan hanya hash token';

CREATE TABLE log_audit (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  waktu        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pengguna_id  INT UNSIGNED NULL,
  username     VARCHAR(50)  NULL,
  ip           VARCHAR(45)  NULL,
  aksi         VARCHAR(40)  NOT NULL,
  entitas      VARCHAR(50)  NOT NULL,
  entitas_id   VARCHAR(40)  NULL,
  ringkasan    VARCHAR(500) NULL,
  data_sebelum JSON         NULL,
  data_sesudah JSON         NULL,
  KEY ix_audit_waktu (waktu),
  KEY ix_audit_entitas (entitas, entitas_id),
  KEY ix_audit_pengguna (pengguna_id)
) ENGINE=InnoDB COMMENT='Jejak audit; hanya ditambah, tidak pernah diubah';

-- ---------------------------------------------------------------------------
-- Data master
-- ---------------------------------------------------------------------------

CREATE TABLE akun (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kode         VARCHAR(20)  NOT NULL,
  nama         VARCHAR(150) NOT NULL,
  kategori     VARCHAR(20)  NOT NULL,
  saldo_normal CHAR(1)      NOT NULL,
  tipe         VARCHAR(10)  NOT NULL,
  induk_id     INT UNSIGNED NULL,
  aktif        TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uk_akun_kode (kode),
  CONSTRAINT ck_akun_kategori CHECK (kategori IN ('ASET','LIABILITAS','EKUITAS','PENDAPATAN','BEBAN')),
  CONSTRAINT ck_akun_saldo CHECK (saldo_normal IN ('D','K')),
  CONSTRAINT ck_akun_tipe CHECK (tipe IN ('INDUK','DETAIL')),
  CONSTRAINT fk_akun_induk FOREIGN KEY (induk_id) REFERENCES akun (id)
) ENGINE=InnoDB COMMENT='Bagan akun';

CREATE TABLE pajak (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kode            VARCHAR(20)  NOT NULL,
  nama            VARCHAR(150) NOT NULL,
  jenis           VARCHAR(10)  NOT NULL,
  tarif           DECIMAL(6,3) NOT NULL,
  akun_id         INT UNSIGNED NOT NULL,
  persen_naik_tanpa_npwp DECIMAL(6,2) NOT NULL DEFAULT 0 COMMENT 'Kenaikan tarif bila penerima tanpa NPWP: 100 untuk PPh 23, 20 untuk PPh 21',
  aktif           TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uk_pajak_kode (kode),
  CONSTRAINT ck_pajak_jenis CHECK (jenis IN ('PPN','PPH')),
  CONSTRAINT fk_pajak_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB COMMENT='Kode pajak: PPN masukan dan PPh yang dipotong';

CREATE TABLE pemasok (
  id                         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kode                       VARCHAR(20)  NOT NULL,
  nama                       VARCHAR(150) NOT NULL,
  alamat                     VARCHAR(255) NULL,
  kota                       VARCHAR(80)  NULL,
  telepon                    VARCHAR(40)  NULL,
  email                      VARCHAR(100) NULL,
  kontak                     VARCHAR(100) NULL,
  npwp                       VARCHAR(20)  NULL,
  pkp                        TINYINT(1)   NOT NULL DEFAULT 0,
  termin_hari                SMALLINT     NOT NULL DEFAULT 30,
  bank_nama                  VARCHAR(60)  NULL,
  bank_nomor_rekening        VARCHAR(40)  NULL,
  bank_atas_nama             VARCHAR(150) NULL,
  rekening_terverifikasi     TINYINT(1)   NOT NULL DEFAULT 0,
  rekening_diubah_oleh       INT UNSIGNED NULL,
  rekening_diubah_pada       DATETIME     NULL,
  rekening_diverifikasi_oleh INT UNSIGNED NULL,
  rekening_diverifikasi_pada DATETIME     NULL,
  catatan                    VARCHAR(255) NULL,
  aktif                      TINYINT(1)   NOT NULL DEFAULT 1,
  dibuat_oleh                INT UNSIGNED NULL,
  dibuat_pada                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada                DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pemasok_kode (kode),
  KEY ix_pemasok_nama (nama),
  CONSTRAINT fk_pemasok_ubah FOREIGN KEY (rekening_diubah_oleh) REFERENCES pengguna (id),
  CONSTRAINT fk_pemasok_verif FOREIGN KEY (rekening_diverifikasi_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Pemasok; rekening bank wajib diverifikasi sebelum transfer';

CREATE TABLE rekening_kas (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kode           VARCHAR(20)  NOT NULL,
  nama           VARCHAR(100) NOT NULL,
  bank_nama      VARCHAR(60)  NOT NULL,
  nomor_rekening VARCHAR(40)  NOT NULL,
  atas_nama      VARCHAR(150) NULL,
  akun_id        INT UNSIGNED NOT NULL,
  aktif          TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uk_rekening_kode (kode),
  UNIQUE KEY uk_rekening_akun (akun_id),
  CONSTRAINT fk_rekening_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB COMMENT='Rekening bank Perusahaan';

CREATE TABLE buku_cek (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rekening_kas_id INT UNSIGNED NOT NULL,
  jenis           VARCHAR(5)   NOT NULL,
  seri            VARCHAR(10)  NOT NULL DEFAULT '',
  nomor_awal      INT UNSIGNED NOT NULL,
  nomor_akhir     INT UNSIGNED NOT NULL,
  digit           TINYINT      NOT NULL DEFAULT 6,
  tanggal_terima  DATE         NOT NULL,
  status          VARCHAR(10)  NOT NULL DEFAULT 'AKTIF',
  dibuat_oleh     INT UNSIGNED NOT NULL,
  dibuat_pada     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_bukucek_jenis CHECK (jenis IN ('CEK','BG')),
  CONSTRAINT ck_bukucek_status CHECK (status IN ('AKTIF','HABIS','DITUTUP')),
  CONSTRAINT ck_bukucek_rentang CHECK (nomor_akhir >= nomor_awal),
  CONSTRAINT fk_bukucek_rekening FOREIGN KEY (rekening_kas_id) REFERENCES rekening_kas (id),
  CONSTRAINT fk_bukucek_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Buku cek dan bilyet giro yang diterima dari bank';

CREATE TABLE warkat (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  buku_cek_id     INT UNSIGNED NOT NULL,
  urut            INT UNSIGNED NOT NULL,
  nomor           VARCHAR(30)  NOT NULL,
  status          VARCHAR(10)  NOT NULL DEFAULT 'TERSEDIA',
  pembayaran_id   INT UNSIGNED NULL,
  keterangan      VARCHAR(255) NULL,
  dibatalkan_oleh INT UNSIGNED NULL,
  dibatalkan_pada DATETIME     NULL,
  UNIQUE KEY uk_warkat_buku_urut (buku_cek_id, urut),
  KEY ix_warkat_status (status),
  CONSTRAINT ck_warkat_status CHECK (status IN ('TERSEDIA','TERPAKAI','BATAL')),
  CONSTRAINT fk_warkat_buku FOREIGN KEY (buku_cek_id) REFERENCES buku_cek (id),
  CONSTRAINT fk_warkat_batal FOREIGN KEY (dibatalkan_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Setiap lembar cek/bilyet giro; nomor dipertanggungjawabkan satu per satu';

CREATE TABLE dana_kas_kecil (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kode            VARCHAR(20)   NOT NULL,
  nama            VARCHAR(100)  NOT NULL,
  pemegang_id     INT UNSIGNED  NOT NULL,
  departemen_id   INT UNSIGNED  NOT NULL,
  akun_id         INT UNSIGNED  NOT NULL,
  dana_diusulkan  DECIMAL(18,2) NOT NULL,
  jumlah_dana     DECIMAL(18,2) NOT NULL DEFAULT 0,
  batas_transaksi DECIMAL(18,2) NOT NULL DEFAULT 1000000,
  aktif           TINYINT(1)    NOT NULL DEFAULT 1,
  dibuat_pada     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dana_kode (kode),
  UNIQUE KEY uk_dana_akun (akun_id),
  CONSTRAINT fk_dana_pemegang FOREIGN KEY (pemegang_id) REFERENCES pengguna (id),
  CONSTRAINT fk_dana_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_dana_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB COMMENT='Dana kas kecil sistem imprest; jumlah_dana = dana yang sudah dibentuk';

CREATE TABLE aturan_persetujuan (
  id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jenis_dokumen        VARCHAR(10)   NOT NULL,
  urutan               SMALLINT      NOT NULL,
  nama_langkah         VARCHAR(100)  NOT NULL,
  peran_kode           VARCHAR(30)   NOT NULL,
  lingkup              VARCHAR(12)   NOT NULL DEFAULT 'GLOBAL',
  batas_bawah          DECIMAL(18,2) NOT NULL DEFAULT 0,
  peran_pengganti_kode VARCHAR(30)   NULL,
  aktif                TINYINT(1)    NOT NULL DEFAULT 1,
  UNIQUE KEY uk_aturan (jenis_dokumen, urutan),
  CONSTRAINT ck_aturan_lingkup CHECK (lingkup IN ('DEPARTEMEN','GLOBAL')),
  CONSTRAINT fk_aturan_peran FOREIGN KEY (peran_kode) REFERENCES peran (kode),
  CONSTRAINT fk_aturan_pengganti FOREIGN KEY (peran_pengganti_kode) REFERENCES peran (kode)
) ENGINE=InnoDB COMMENT='Matriks otorisasi: langkah berlaku bila nilai dokumen > batas_bawah';

CREATE TABLE periode (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tahun        SMALLINT     NOT NULL,
  bulan        TINYINT      NOT NULL,
  status       VARCHAR(5)   NOT NULL DEFAULT 'BUKA',
  ditutup_oleh INT UNSIGNED NULL,
  ditutup_pada DATETIME     NULL,
  UNIQUE KEY uk_periode (tahun, bulan),
  CONSTRAINT ck_periode_status CHECK (status IN ('BUKA','TUTUP')),
  CONSTRAINT ck_periode_bulan CHECK (bulan BETWEEN 1 AND 12),
  CONSTRAINT fk_periode_tutup FOREIGN KEY (ditutup_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Periode akuntansi bulanan';

CREATE TABLE penomoran (
  kode           VARCHAR(10)  NOT NULL,
  tahun          SMALLINT     NOT NULL,
  bulan          TINYINT      NOT NULL,
  nomor_terakhir INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (kode, tahun, bulan)
) ENGINE=InnoDB COMMENT='Penghitung nomor dokumen per kode per bulan (dikunci saat dipakai)';

-- ---------------------------------------------------------------------------
-- Pembelian: pesanan pembelian dan penerimaan
-- ---------------------------------------------------------------------------

CREATE TABLE pesanan_pembelian (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor         VARCHAR(30)   NOT NULL,
  tanggal       DATE          NOT NULL,
  pemasok_id    INT UNSIGNED  NOT NULL,
  departemen_id INT UNSIGNED  NOT NULL,
  tanggal_kirim DATE          NULL,
  termin_hari   SMALLINT      NOT NULL DEFAULT 30,
  pajak_ppn_id  INT UNSIGNED  NULL,
  keterangan    VARCHAR(500)  NULL,
  subtotal      DECIMAL(18,2) NOT NULL DEFAULT 0,
  ppn           DECIMAL(18,2) NOT NULL DEFAULT 0,
  total         DECIMAL(18,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
  jumlah_cetak  INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh   INT UNSIGNED  NOT NULL,
  dibuat_pada   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada   DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  alasan_batal  VARCHAR(255)  NULL,
  UNIQUE KEY uk_po_nomor (nomor),
  KEY ix_po_status (status),
  KEY ix_po_pemasok (pemasok_id),
  CONSTRAINT ck_po_status CHECK (status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK','DITERIMA_SEBAGIAN','DITERIMA_PENUH','DITUTUP','BATAL')),
  CONSTRAINT fk_po_pemasok FOREIGN KEY (pemasok_id) REFERENCES pemasok (id),
  CONSTRAINT fk_po_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_po_ppn FOREIGN KEY (pajak_ppn_id) REFERENCES pajak (id),
  CONSTRAINT fk_po_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Pesanan pembelian (PO)';

CREATE TABLE pesanan_pembelian_detail (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  po_id        INT UNSIGNED  NOT NULL,
  baris        SMALLINT      NOT NULL,
  uraian       VARCHAR(255)  NOT NULL,
  jenis        VARCHAR(6)    NOT NULL DEFAULT 'BARANG',
  qty          DECIMAL(15,2) NOT NULL,
  satuan       VARCHAR(20)   NOT NULL,
  harga        DECIMAL(18,2) NOT NULL,
  jumlah       DECIMAL(18,2) NOT NULL,
  akun_id      INT UNSIGNED  NOT NULL,
  qty_diterima DECIMAL(15,2) NOT NULL DEFAULT 0,
  qty_ditagih  DECIMAL(15,2) NOT NULL DEFAULT 0,
  KEY ix_pod_po (po_id),
  CONSTRAINT ck_pod_jenis CHECK (jenis IN ('BARANG','JASA')),
  CONSTRAINT ck_pod_qty CHECK (qty > 0 AND qty_diterima >= 0 AND qty_ditagih >= 0),
  CONSTRAINT fk_pod_po FOREIGN KEY (po_id) REFERENCES pesanan_pembelian (id),
  CONSTRAINT fk_pod_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB;

CREATE TABLE penerimaan_barang (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor             VARCHAR(30)  NOT NULL,
  jenis             VARCHAR(5)   NOT NULL,
  tanggal           DATE         NOT NULL,
  po_id             INT UNSIGNED NOT NULL,
  nomor_surat_jalan VARCHAR(50)  NULL,
  keterangan        VARCHAR(500) NULL,
  status            VARCHAR(10)  NOT NULL DEFAULT 'DICATAT',
  jumlah_cetak      INT UNSIGNED NOT NULL DEFAULT 0,
  dibuat_oleh       INT UNSIGNED NOT NULL,
  dibuat_pada       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dibatalkan_oleh   INT UNSIGNED NULL,
  dibatalkan_pada   DATETIME     NULL,
  alasan_batal      VARCHAR(255) NULL,
  UNIQUE KEY uk_lpb_nomor (nomor),
  KEY ix_lpb_po (po_id),
  CONSTRAINT ck_lpb_jenis CHECK (jenis IN ('LPB','BAST')),
  CONSTRAINT ck_lpb_status CHECK (status IN ('DICATAT','BATAL')),
  CONSTRAINT fk_lpb_po FOREIGN KEY (po_id) REFERENCES pesanan_pembelian (id),
  CONSTRAINT fk_lpb_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Laporan penerimaan barang (LPB) dan berita acara serah terima jasa (BAST)';

CREATE TABLE penerimaan_barang_detail (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  penerimaan_id  INT UNSIGNED  NOT NULL,
  po_detail_id   INT UNSIGNED  NOT NULL,
  qty            DECIMAL(15,2) NOT NULL,
  catatan        VARCHAR(255)  NULL,
  KEY ix_lpbd_lpb (penerimaan_id),
  CONSTRAINT ck_lpbd_qty CHECK (qty > 0),
  CONSTRAINT fk_lpbd_lpb FOREIGN KEY (penerimaan_id) REFERENCES penerimaan_barang (id),
  CONSTRAINT fk_lpbd_pod FOREIGN KEY (po_detail_id) REFERENCES pesanan_pembelian_detail (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Jurnal (dibuat sebelum dokumen karena dirujuk dokumen)
-- ---------------------------------------------------------------------------

CREATE TABLE jurnal (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor            VARCHAR(30)   NOT NULL,
  tanggal          DATE          NOT NULL,
  jenis            VARCHAR(5)    NOT NULL,
  periode_id       INT UNSIGNED  NOT NULL,
  sumber_tipe      VARCHAR(10)   NOT NULL,
  sumber_id        INT UNSIGNED  NULL,
  sumber_nomor     VARCHAR(30)   NULL,
  keterangan       VARCHAR(500)  NOT NULL,
  total            DECIMAL(18,2) NOT NULL,
  pembalik_dari_id INT UNSIGNED  NULL,
  dibalik_oleh_id  INT UNSIGNED  NULL,
  dibuat_oleh      INT UNSIGNED  NOT NULL,
  dibuat_pada      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_jurnal_nomor (nomor),
  KEY ix_jurnal_tanggal (tanggal),
  KEY ix_jurnal_sumber (sumber_tipe, sumber_id),
  CONSTRAINT ck_jurnal_jenis CHECK (jenis IN ('JP','JKK','JKM','JU')),
  CONSTRAINT fk_jurnal_periode FOREIGN KEY (periode_id) REFERENCES periode (id),
  CONSTRAINT fk_jurnal_pembalik FOREIGN KEY (pembalik_dari_id) REFERENCES jurnal (id),
  CONSTRAINT fk_jurnal_dibalik FOREIGN KEY (dibalik_oleh_id) REFERENCES jurnal (id),
  CONSTRAINT fk_jurnal_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Jurnal terposting; tidak pernah diubah atau dihapus';

CREATE TABLE jurnal_detail (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jurnal_id     INT UNSIGNED  NOT NULL,
  baris         SMALLINT      NOT NULL,
  akun_id       INT UNSIGNED  NOT NULL,
  departemen_id INT UNSIGNED  NULL,
  pemasok_id    INT UNSIGNED  NULL,
  keterangan    VARCHAR(255)  NULL,
  debit         DECIMAL(18,2) NOT NULL DEFAULT 0,
  kredit        DECIMAL(18,2) NOT NULL DEFAULT 0,
  KEY ix_jd_jurnal (jurnal_id),
  KEY ix_jd_akun (akun_id),
  KEY ix_jd_pemasok (pemasok_id),
  CONSTRAINT ck_jd_nilai CHECK (debit >= 0 AND kredit >= 0 AND (debit = 0 OR kredit = 0) AND (debit + kredit) > 0),
  CONSTRAINT fk_jd_jurnal FOREIGN KEY (jurnal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_jd_akun FOREIGN KEY (akun_id) REFERENCES akun (id),
  CONSTRAINT fk_jd_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_jd_pemasok FOREIGN KEY (pemasok_id) REFERENCES pemasok (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Utang: faktur pemasok
-- ---------------------------------------------------------------------------

CREATE TABLE faktur_pemasok (
  id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor               VARCHAR(30)   NOT NULL,
  jenis               VARCHAR(10)   NOT NULL DEFAULT 'PO',
  pemasok_id          INT UNSIGNED  NOT NULL,
  po_id               INT UNSIGNED  NULL,
  nomor_faktur        VARCHAR(50)   NOT NULL,
  nomor_faktur_norm   VARCHAR(50)   NOT NULL,
  nomor_faktur_pajak  VARCHAR(50)   NULL,
  tanggal_faktur      DATE          NOT NULL,
  tanggal_terima      DATE          NOT NULL,
  tanggal_jatuh_tempo DATE          NOT NULL,
  keterangan          VARCHAR(500)  NULL,
  dpp                 DECIMAL(18,2) NOT NULL DEFAULT 0,
  ppn                 DECIMAL(18,2) NOT NULL DEFAULT 0,
  pajak_pph_id        INT UNSIGNED  NULL,
  tarif_pph           DECIMAL(6,3)  NOT NULL DEFAULT 0,
  pph                 DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_tagihan       DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_utang         DECIMAL(18,2) NOT NULL DEFAULT 0,
  terbayar            DECIMAL(18,2) NOT NULL DEFAULT 0,
  hasil_cocok         VARCHAR(10)   NULL,
  catatan_selisih     VARCHAR(500)  NULL,
  status              VARCHAR(25)   NOT NULL DEFAULT 'DRAFT',
  jurnal_id           INT UNSIGNED  NULL,
  jumlah_cetak        INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh         INT UNSIGNED  NOT NULL,
  dibuat_pada         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada         DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  diverifikasi_pada   DATETIME      NULL,
  dibatalkan_oleh     INT UNSIGNED  NULL,
  dibatalkan_pada     DATETIME      NULL,
  alasan_batal        VARCHAR(255)  NULL,
  kunci_duplikat      VARCHAR(80) AS (IF(status = 'BATAL', NULL, CONCAT(pemasok_id, '|', nomor_faktur_norm))) PERSISTENT,
  UNIQUE KEY uk_faktur_nomor (nomor),
  UNIQUE KEY uk_faktur_duplikat (kunci_duplikat),
  KEY ix_faktur_pemasok (pemasok_id),
  KEY ix_faktur_status (status),
  KEY ix_faktur_jatuh_tempo (tanggal_jatuh_tempo),
  CONSTRAINT ck_faktur_jenis CHECK (jenis IN ('PO','SALDO_AWAL')),
  CONSTRAINT ck_faktur_status CHECK (status IN ('DRAFT','MENUNGGU_PERSETUJUAN','TERVERIFIKASI','DIBAYAR_SEBAGIAN','LUNAS','DITOLAK','BATAL')),
  CONSTRAINT ck_faktur_terbayar CHECK (terbayar >= 0 AND terbayar <= total_utang),
  CONSTRAINT fk_faktur_pemasok FOREIGN KEY (pemasok_id) REFERENCES pemasok (id),
  CONSTRAINT fk_faktur_po FOREIGN KEY (po_id) REFERENCES pesanan_pembelian (id),
  CONSTRAINT fk_faktur_pph FOREIGN KEY (pajak_pph_id) REFERENCES pajak (id),
  CONSTRAINT fk_faktur_jurnal FOREIGN KEY (jurnal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_faktur_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Register faktur pemasok; kunci_duplikat mencegah faktur ganda';

CREATE TABLE faktur_pemasok_detail (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  faktur_id     INT UNSIGNED  NOT NULL,
  baris         SMALLINT      NOT NULL,
  po_detail_id  INT UNSIGNED  NULL,
  uraian        VARCHAR(255)  NOT NULL,
  jenis         VARCHAR(6)    NOT NULL DEFAULT 'BARANG',
  qty           DECIMAL(15,2) NOT NULL,
  harga         DECIMAL(18,2) NOT NULL,
  jumlah        DECIMAL(18,2) NOT NULL,
  akun_id       INT UNSIGNED  NOT NULL,
  qty_po        DECIMAL(15,2) NULL,
  harga_po      DECIMAL(18,2) NULL,
  qty_tersedia  DECIMAL(15,2) NULL,
  status_cocok  VARCHAR(20)   NULL,
  catatan_cocok VARCHAR(255)  NULL,
  KEY ix_fd_faktur (faktur_id),
  KEY ix_fd_pod (po_detail_id),
  CONSTRAINT ck_fd_jenis CHECK (jenis IN ('BARANG','JASA')),
  CONSTRAINT fk_fd_faktur FOREIGN KEY (faktur_id) REFERENCES faktur_pemasok (id),
  CONSTRAINT fk_fd_pod FOREIGN KEY (po_detail_id) REFERENCES pesanan_pembelian_detail (id),
  CONSTRAINT fk_fd_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Permintaan pembayaran nonpembelian
-- ---------------------------------------------------------------------------

CREATE TABLE permintaan_pembayaran (
  id                      INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor                   VARCHAR(30)   NOT NULL,
  tanggal                 DATE          NOT NULL,
  departemen_id           INT UNSIGNED  NOT NULL,
  tanggal_dibutuhkan      DATE          NULL,
  pemasok_id              INT UNSIGNED  NULL,
  penerima_nama           VARCHAR(150)  NOT NULL,
  penerima_bank_nama      VARCHAR(60)   NULL,
  penerima_bank_rekening  VARCHAR(40)   NULL,
  penerima_bank_atas_nama VARCHAR(150)  NULL,
  keterangan              VARCHAR(500)  NOT NULL,
  dokumen_pendukung       VARCHAR(255)  NULL,
  total                   DECIMAL(18,2) NOT NULL DEFAULT 0,
  status                  VARCHAR(10)   NOT NULL DEFAULT 'DRAFT',
  bkk_id                  INT UNSIGNED  NULL,
  jumlah_cetak            INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh             INT UNSIGNED  NOT NULL,
  dibuat_pada             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada             DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  alasan_batal            VARCHAR(255)  NULL,
  UNIQUE KEY uk_pp_nomor (nomor),
  KEY ix_pp_status (status),
  KEY ix_pp_pembuat (dibuat_oleh),
  CONSTRAINT ck_pp_status CHECK (status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK','DIPROSES','DIBAYAR','BATAL')),
  CONSTRAINT fk_pp_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_pp_pemasok FOREIGN KEY (pemasok_id) REFERENCES pemasok (id),
  CONSTRAINT fk_pp_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Permintaan pembayaran (PP) untuk pengeluaran tanpa PO';

CREATE TABLE permintaan_pembayaran_detail (
  id      INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pp_id   INT UNSIGNED  NOT NULL,
  baris   SMALLINT      NOT NULL,
  uraian  VARCHAR(255)  NOT NULL,
  akun_id INT UNSIGNED  NOT NULL,
  jumlah  DECIMAL(18,2) NOT NULL,
  KEY ix_ppd_pp (pp_id),
  CONSTRAINT ck_ppd_jumlah CHECK (jumlah > 0),
  CONSTRAINT fk_ppd_pp FOREIGN KEY (pp_id) REFERENCES permintaan_pembayaran (id),
  CONSTRAINT fk_ppd_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Uang muka kerja
-- ---------------------------------------------------------------------------

CREATE TABLE uang_muka (
  id                       INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor                    VARCHAR(30)   NOT NULL,
  tanggal                  DATE          NOT NULL,
  departemen_id            INT UNSIGNED  NOT NULL,
  keperluan                VARCHAR(500)  NOT NULL,
  jumlah                   DECIMAL(18,2) NOT NULL,
  tanggal_selesai_kegiatan DATE          NOT NULL,
  tanggal_batas_pj         DATE          NOT NULL,
  status                   VARCHAR(10)   NOT NULL DEFAULT 'DRAFT',
  bkk_id                   INT UNSIGNED  NULL,
  jumlah_cetak             INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh              INT UNSIGNED  NOT NULL,
  dibuat_pada              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada              DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  alasan_batal             VARCHAR(255)  NULL,
  UNIQUE KEY uk_um_nomor (nomor),
  KEY ix_um_status (status),
  KEY ix_um_pembuat (dibuat_oleh),
  CONSTRAINT ck_um_status CHECK (status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK','DIPROSES','DIBAYAR','SELESAI','BATAL')),
  CONSTRAINT ck_um_jumlah CHECK (jumlah > 0),
  CONSTRAINT fk_um_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_um_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Permintaan uang muka kerja (PUM)';

CREATE TABLE penerimaan_kas (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor           VARCHAR(30)   NOT NULL,
  tanggal         DATE          NOT NULL,
  rekening_kas_id INT UNSIGNED  NOT NULL,
  sumber          VARCHAR(25)   NOT NULL,
  sumber_id       INT UNSIGNED  NULL,
  diterima_dari   VARCHAR(150)  NOT NULL,
  keterangan      VARCHAR(500)  NOT NULL,
  jumlah          DECIMAL(18,2) NOT NULL,
  akun_lawan_id   INT UNSIGNED  NOT NULL,
  status          VARCHAR(10)   NOT NULL DEFAULT 'DICATAT',
  jurnal_id       INT UNSIGNED  NULL,
  jurnal_batal_id INT UNSIGNED  NULL,
  jumlah_cetak    INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh     INT UNSIGNED  NOT NULL,
  dibuat_pada     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dibatalkan_oleh INT UNSIGNED  NULL,
  dibatalkan_pada DATETIME      NULL,
  alasan_batal    VARCHAR(255)  NULL,
  UNIQUE KEY uk_bkm_nomor (nomor),
  CONSTRAINT ck_bkm_sumber CHECK (sumber IN ('PENGEMBALIAN_UANG_MUKA','PENGEMBALIAN_KAS_KECIL','LAINNYA')),
  CONSTRAINT ck_bkm_status CHECK (status IN ('DICATAT','BATAL')),
  CONSTRAINT ck_bkm_jumlah CHECK (jumlah > 0),
  CONSTRAINT fk_bkm_rekening FOREIGN KEY (rekening_kas_id) REFERENCES rekening_kas (id),
  CONSTRAINT fk_bkm_akun FOREIGN KEY (akun_lawan_id) REFERENCES akun (id),
  CONSTRAINT fk_bkm_jurnal FOREIGN KEY (jurnal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_bkm_jurnal_batal FOREIGN KEY (jurnal_batal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_bkm_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Bukti kas masuk (BKM) dalam siklus pengeluaran';

CREATE TABLE pertanggungjawaban_uang_muka (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor            VARCHAR(30)   NOT NULL,
  tanggal          DATE          NOT NULL,
  uang_muka_id     INT UNSIGNED  NOT NULL,
  departemen_id    INT UNSIGNED  NOT NULL,
  keterangan       VARCHAR(500)  NULL,
  jumlah_uang_muka DECIMAL(18,2) NOT NULL,
  total_realisasi  DECIMAL(18,2) NOT NULL DEFAULT 0,
  selisih          DECIMAL(18,2) NOT NULL DEFAULT 0,
  hasil            VARCHAR(6)    NULL,
  status           VARCHAR(10)   NOT NULL DEFAULT 'DRAFT',
  jurnal_id        INT UNSIGNED  NULL,
  bkk_id           INT UNSIGNED  NULL,
  bkm_id           INT UNSIGNED  NULL,
  jumlah_cetak     INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh      INT UNSIGNED  NOT NULL,
  dibuat_pada      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada      DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  alasan_batal     VARCHAR(255)  NULL,
  UNIQUE KEY uk_pjum_nomor (nomor),
  KEY ix_pjum_um (uang_muka_id),
  CONSTRAINT ck_pjum_hasil CHECK (hasil IS NULL OR hasil IN ('PAS','SISA','KURANG')),
  CONSTRAINT ck_pjum_status CHECK (status IN ('DRAFT','DIAJUKAN','DITOLAK','DISETUJUI','SELESAI','BATAL')),
  CONSTRAINT fk_pjum_um FOREIGN KEY (uang_muka_id) REFERENCES uang_muka (id),
  CONSTRAINT fk_pjum_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_pjum_jurnal FOREIGN KEY (jurnal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_pjum_bkm FOREIGN KEY (bkm_id) REFERENCES penerimaan_kas (id),
  CONSTRAINT fk_pjum_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Pertanggungjawaban uang muka (PJUM); selisih = uang muka - realisasi';

CREATE TABLE pertanggungjawaban_uang_muka_detail (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pjum_id     INT UNSIGNED  NOT NULL,
  baris       SMALLINT      NOT NULL,
  tanggal     DATE          NOT NULL,
  uraian      VARCHAR(255)  NOT NULL,
  akun_id     INT UNSIGNED  NOT NULL,
  nomor_bukti VARCHAR(50)   NULL,
  jumlah      DECIMAL(18,2) NOT NULL,
  KEY ix_pjumd_pjum (pjum_id),
  CONSTRAINT ck_pjumd_jumlah CHECK (jumlah > 0),
  CONSTRAINT fk_pjumd_pjum FOREIGN KEY (pjum_id) REFERENCES pertanggungjawaban_uang_muka (id),
  CONSTRAINT fk_pjumd_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Kas kecil
-- ---------------------------------------------------------------------------

CREATE TABLE pengisian_kas_kecil (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor        VARCHAR(30)   NOT NULL,
  tanggal      DATE          NOT NULL,
  dana_id      INT UNSIGNED  NOT NULL,
  keterangan   VARCHAR(500)  NULL,
  total        DECIMAL(18,2) NOT NULL DEFAULT 0,
  status       VARCHAR(10)   NOT NULL DEFAULT 'DRAFT',
  catatan_tolak VARCHAR(500) NULL,
  bkk_id       INT UNSIGNED  NULL,
  jumlah_cetak INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh  INT UNSIGNED  NOT NULL,
  dibuat_pada  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada  DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  alasan_batal VARCHAR(255)  NULL,
  UNIQUE KEY uk_pdk_nomor (nomor),
  CONSTRAINT ck_pdk_status CHECK (status IN ('DRAFT','DIAJUKAN','DITOLAK','DIPROSES','DIBAYAR','BATAL')),
  CONSTRAINT fk_pdk_dana FOREIGN KEY (dana_id) REFERENCES dana_kas_kecil (id),
  CONSTRAINT fk_pdk_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Permintaan pengisian kembali kas kecil (PDK)';

CREATE TABLE pengeluaran_kas_kecil (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor         VARCHAR(30)   NOT NULL,
  tanggal       DATE          NOT NULL,
  dana_id       INT UNSIGNED  NOT NULL,
  departemen_id INT UNSIGNED  NOT NULL,
  keperluan     VARCHAR(500)  NOT NULL,
  akun_id       INT UNSIGNED  NOT NULL,
  jumlah        DECIMAL(18,2) NOT NULL,
  status        VARCHAR(10)   NOT NULL DEFAULT 'DRAFT',
  nomor_bukti   VARCHAR(50)   NULL,
  tanggal_bayar DATE          NULL,
  dibayar_oleh  INT UNSIGNED  NULL,
  dibayar_pada  DATETIME      NULL,
  pengisian_id  INT UNSIGNED  NULL,
  jumlah_cetak  INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh   INT UNSIGNED  NOT NULL,
  dibuat_pada   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada   DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  alasan_batal  VARCHAR(255)  NULL,
  UNIQUE KEY uk_pkk_nomor (nomor),
  KEY ix_pkk_dana_status (dana_id, status),
  KEY ix_pkk_pengisian (pengisian_id),
  CONSTRAINT ck_pkk_status CHECK (status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK','DIBAYAR','DIGANTI','BATAL')),
  CONSTRAINT ck_pkk_jumlah CHECK (jumlah > 0),
  CONSTRAINT fk_pkk_dana FOREIGN KEY (dana_id) REFERENCES dana_kas_kecil (id),
  CONSTRAINT fk_pkk_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_pkk_akun FOREIGN KEY (akun_id) REFERENCES akun (id),
  CONSTRAINT fk_pkk_bayar FOREIGN KEY (dibayar_oleh) REFERENCES pengguna (id),
  CONSTRAINT fk_pkk_pengisian FOREIGN KEY (pengisian_id) REFERENCES pengisian_kas_kecil (id),
  CONSTRAINT fk_pkk_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Pengeluaran kas kecil (PKK): permintaan dan bukti pengeluaran';

CREATE TABLE opname_kas_kecil (
  id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor               VARCHAR(30)   NOT NULL,
  dana_id             INT UNSIGNED  NOT NULL,
  waktu_opname        DATETIME      NOT NULL,
  jumlah_dana         DECIMAL(18,2) NOT NULL,
  bukti_belum_diganti DECIMAL(18,2) NOT NULL,
  saldo_seharusnya    DECIMAL(18,2) NOT NULL,
  total_fisik         DECIMAL(18,2) NOT NULL,
  selisih             DECIMAL(18,2) NOT NULL,
  rincian             JSON          NOT NULL,
  keterangan          VARCHAR(500)  NULL,
  status              VARCHAR(6)    NOT NULL DEFAULT 'DRAFT',
  jumlah_cetak        INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh         INT UNSIGNED  NOT NULL,
  dibuat_pada         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  difinalkan_pada     DATETIME      NULL,
  UNIQUE KEY uk_opn_nomor (nomor),
  CONSTRAINT ck_opn_status CHECK (status IN ('DRAFT','FINAL')),
  CONSTRAINT fk_opn_dana FOREIGN KEY (dana_id) REFERENCES dana_kas_kecil (id),
  CONSTRAINT fk_opn_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Berita acara opname kas kecil; selisih = fisik - seharusnya';

-- ---------------------------------------------------------------------------
-- Bukti kas keluar dan pembayaran
-- ---------------------------------------------------------------------------

CREATE TABLE bukti_kas_keluar (
  id                      INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor                   VARCHAR(30)   NOT NULL,
  tanggal                 DATE          NOT NULL,
  jenis                   VARCHAR(25)   NOT NULL,
  sumber_id               INT UNSIGNED  NULL,
  sumber_nomor            VARCHAR(30)   NULL,
  pemasok_id              INT UNSIGNED  NULL,
  penerima_nama           VARCHAR(150)  NOT NULL,
  penerima_bank_nama      VARCHAR(60)   NULL,
  penerima_bank_rekening  VARCHAR(40)   NULL,
  penerima_bank_atas_nama VARCHAR(150)  NULL,
  rekening_kas_id         INT UNSIGNED  NOT NULL,
  metode_bayar            VARCHAR(10)   NOT NULL,
  tanggal_rencana_bayar   DATE          NOT NULL,
  keterangan              VARCHAR(500)  NOT NULL,
  jumlah_bruto            DECIMAL(18,2) NOT NULL DEFAULT 0,
  jumlah_potongan         DECIMAL(18,2) NOT NULL DEFAULT 0,
  jumlah_bayar            DECIMAL(18,2) NOT NULL DEFAULT 0,
  status                  VARCHAR(10)   NOT NULL DEFAULT 'DRAFT',
  pembayaran_id           INT UNSIGNED  NULL,
  jumlah_cetak            INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh             INT UNSIGNED  NOT NULL,
  dibuat_pada             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada             DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  dibatalkan_oleh         INT UNSIGNED  NULL,
  dibatalkan_pada         DATETIME      NULL,
  alasan_batal            VARCHAR(255)  NULL,
  UNIQUE KEY uk_bkk_nomor (nomor),
  KEY ix_bkk_status (status),
  KEY ix_bkk_jenis_sumber (jenis, sumber_id),
  KEY ix_bkk_pemasok (pemasok_id),
  CONSTRAINT ck_bkk_jenis CHECK (jenis IN ('PEMBAYARAN_FAKTUR','PERMINTAAN_PEMBAYARAN','UANG_MUKA','KEKURANGAN_UANG_MUKA','PEMBENTUKAN_KAS_KECIL','PENGISIAN_KAS_KECIL')),
  CONSTRAINT ck_bkk_metode CHECK (metode_bayar IN ('CEK','BG','TRANSFER')),
  CONSTRAINT ck_bkk_status CHECK (status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK','DIBAYAR','BATAL')),
  CONSTRAINT ck_bkk_jumlah CHECK (jumlah_bayar = jumlah_bruto - jumlah_potongan AND jumlah_bayar >= 0),
  CONSTRAINT fk_bkk_pemasok FOREIGN KEY (pemasok_id) REFERENCES pemasok (id),
  CONSTRAINT fk_bkk_rekening FOREIGN KEY (rekening_kas_id) REFERENCES rekening_kas (id),
  CONSTRAINT fk_bkk_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Bukti kas keluar (BKK): perintah bayar dari fungsi akuntansi kepada fungsi kas';

CREATE TABLE bukti_kas_keluar_detail (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bkk_id        INT UNSIGNED  NOT NULL,
  baris         SMALLINT      NOT NULL,
  uraian        VARCHAR(255)  NOT NULL,
  akun_id       INT UNSIGNED  NOT NULL,
  departemen_id INT UNSIGNED  NULL,
  pemasok_id    INT UNSIGNED  NULL,
  faktur_id     INT UNSIGNED  NULL,
  ref_nomor     VARCHAR(30)   NULL,
  jumlah        DECIMAL(18,2) NOT NULL,
  KEY ix_bkkd_bkk (bkk_id),
  KEY ix_bkkd_faktur (faktur_id),
  CONSTRAINT ck_bkkd_jumlah CHECK (jumlah > 0),
  CONSTRAINT fk_bkkd_bkk FOREIGN KEY (bkk_id) REFERENCES bukti_kas_keluar (id),
  CONSTRAINT fk_bkkd_akun FOREIGN KEY (akun_id) REFERENCES akun (id),
  CONSTRAINT fk_bkkd_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_bkkd_pemasok FOREIGN KEY (pemasok_id) REFERENCES pemasok (id),
  CONSTRAINT fk_bkkd_faktur FOREIGN KEY (faktur_id) REFERENCES faktur_pemasok (id)
) ENGINE=InnoDB COMMENT='Distribusi akun sisi debit BKK';

CREATE TABLE bukti_kas_keluar_potongan (
  id       INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bkk_id   INT UNSIGNED  NOT NULL,
  pajak_id INT UNSIGNED  NOT NULL,
  akun_id  INT UNSIGNED  NOT NULL,
  dasar    DECIMAL(18,2) NOT NULL,
  tarif    DECIMAL(6,3)  NOT NULL,
  jumlah   DECIMAL(18,2) NOT NULL,
  uraian   VARCHAR(255)  NULL,
  KEY ix_bkkp_bkk (bkk_id),
  CONSTRAINT ck_bkkp_jumlah CHECK (jumlah > 0),
  CONSTRAINT fk_bkkp_bkk FOREIGN KEY (bkk_id) REFERENCES bukti_kas_keluar (id),
  CONSTRAINT fk_bkkp_pajak FOREIGN KEY (pajak_id) REFERENCES pajak (id),
  CONSTRAINT fk_bkkp_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB COMMENT='Potongan pajak pada BKK (sisi kredit)';

CREATE TABLE pembayaran (
  id                      INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor                   VARCHAR(30)   NOT NULL,
  bkk_id                  INT UNSIGNED  NOT NULL,
  tanggal                 DATE          NOT NULL,
  rekening_kas_id         INT UNSIGNED  NOT NULL,
  metode                  VARCHAR(10)   NOT NULL,
  warkat_id               INT UNSIGNED  NULL,
  nomor_warkat            VARCHAR(30)   NULL,
  tanggal_jatuh_tempo_bg  DATE          NULL,
  nomor_referensi         VARCHAR(60)   NULL,
  penerima_nama           VARCHAR(150)  NOT NULL,
  penerima_bank_nama      VARCHAR(60)   NULL,
  penerima_bank_rekening  VARCHAR(40)   NULL,
  penerima_bank_atas_nama VARCHAR(150)  NULL,
  jumlah                  DECIMAL(18,2) NOT NULL,
  status                  VARCHAR(10)   NOT NULL DEFAULT 'DIBAYAR',
  tanggal_kliring         DATE          NULL,
  jurnal_id               INT UNSIGNED  NULL,
  jurnal_batal_id         INT UNSIGNED  NULL,
  jumlah_cetak            INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh             INT UNSIGNED  NOT NULL,
  dibuat_pada             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dibatalkan_oleh         INT UNSIGNED  NULL,
  dibatalkan_pada         DATETIME      NULL,
  alasan_batal            VARCHAR(255)  NULL,
  UNIQUE KEY uk_byr_nomor (nomor),
  UNIQUE KEY uk_byr_warkat (warkat_id),
  KEY ix_byr_bkk (bkk_id),
  KEY ix_byr_rekening_tanggal (rekening_kas_id, tanggal),
  CONSTRAINT ck_byr_metode CHECK (metode IN ('CEK','BG','TRANSFER')),
  CONSTRAINT ck_byr_status CHECK (status IN ('DIBAYAR','BATAL')),
  CONSTRAINT ck_byr_jumlah CHECK (jumlah >= 0),
  CONSTRAINT fk_byr_bkk FOREIGN KEY (bkk_id) REFERENCES bukti_kas_keluar (id),
  CONSTRAINT fk_byr_rekening FOREIGN KEY (rekening_kas_id) REFERENCES rekening_kas (id),
  CONSTRAINT fk_byr_warkat FOREIGN KEY (warkat_id) REFERENCES warkat (id),
  CONSTRAINT fk_byr_jurnal FOREIGN KEY (jurnal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_byr_jurnal_batal FOREIGN KEY (jurnal_batal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_byr_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Pembayaran atas BKK (register cek); satu lembar warkat hanya sekali dipakai';

-- ---------------------------------------------------------------------------
-- Jurnal manual (bukti memorial)
-- ---------------------------------------------------------------------------

CREATE TABLE jurnal_manual (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor        VARCHAR(30)   NOT NULL,
  tanggal      DATE          NOT NULL,
  jenis        VARCHAR(12)   NOT NULL DEFAULT 'UMUM',
  keterangan   VARCHAR(500)  NOT NULL,
  total        DECIMAL(18,2) NOT NULL DEFAULT 0,
  status       VARCHAR(10)   NOT NULL DEFAULT 'DRAFT',
  jurnal_id    INT UNSIGNED  NULL,
  jumlah_cetak INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh  INT UNSIGNED  NOT NULL,
  dibuat_pada  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diubah_pada  DATETIME      NULL ON UPDATE CURRENT_TIMESTAMP,
  alasan_batal VARCHAR(255)  NULL,
  UNIQUE KEY uk_jm_nomor (nomor),
  CONSTRAINT ck_jm_jenis CHECK (jenis IN ('UMUM','SALDO_AWAL','PENYESUAIAN')),
  CONSTRAINT ck_jm_status CHECK (status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK','BATAL')),
  CONSTRAINT fk_jm_jurnal FOREIGN KEY (jurnal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_jm_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Bukti memorial (jurnal manual) dengan persetujuan';

CREATE TABLE jurnal_manual_detail (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jm_id         INT UNSIGNED  NOT NULL,
  baris         SMALLINT      NOT NULL,
  akun_id       INT UNSIGNED  NOT NULL,
  departemen_id INT UNSIGNED  NULL,
  pemasok_id    INT UNSIGNED  NULL,
  keterangan    VARCHAR(255)  NULL,
  debit         DECIMAL(18,2) NOT NULL DEFAULT 0,
  kredit        DECIMAL(18,2) NOT NULL DEFAULT 0,
  KEY ix_jmd_jm (jm_id),
  CONSTRAINT ck_jmd_nilai CHECK (debit >= 0 AND kredit >= 0 AND (debit = 0 OR kredit = 0) AND (debit + kredit) > 0),
  CONSTRAINT fk_jmd_jm FOREIGN KEY (jm_id) REFERENCES jurnal_manual (id),
  CONSTRAINT fk_jmd_akun FOREIGN KEY (akun_id) REFERENCES akun (id),
  CONSTRAINT fk_jmd_departemen FOREIGN KEY (departemen_id) REFERENCES departemen (id),
  CONSTRAINT fk_jmd_pemasok FOREIGN KEY (pemasok_id) REFERENCES pemasok (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Rekonsiliasi bank
-- ---------------------------------------------------------------------------

CREATE TABLE rekonsiliasi_bank (
  id                     INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nomor                  VARCHAR(30)   NOT NULL,
  rekening_kas_id        INT UNSIGNED  NOT NULL,
  tahun                  SMALLINT      NOT NULL,
  bulan                  TINYINT       NOT NULL,
  tanggal_akhir          DATE          NOT NULL,
  saldo_rekening_koran   DECIMAL(18,2) NOT NULL DEFAULT 0,
  saldo_buku             DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_warkat_beredar   DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_penambah_bank    DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_pengurang_bank   DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_penambah_buku    DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_pengurang_buku   DECIMAL(18,2) NOT NULL DEFAULT 0,
  saldo_bank_disesuaikan DECIMAL(18,2) NOT NULL DEFAULT 0,
  saldo_buku_disesuaikan DECIMAL(18,2) NOT NULL DEFAULT 0,
  selisih                DECIMAL(18,2) NOT NULL DEFAULT 0,
  status                 VARCHAR(6)    NOT NULL DEFAULT 'DRAFT',
  jurnal_id              INT UNSIGNED  NULL,
  jumlah_cetak           INT UNSIGNED  NOT NULL DEFAULT 0,
  dibuat_oleh            INT UNSIGNED  NOT NULL,
  dibuat_pada            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  difinalkan_oleh        INT UNSIGNED  NULL,
  difinalkan_pada        DATETIME      NULL,
  UNIQUE KEY uk_rb_nomor (nomor),
  UNIQUE KEY uk_rb_periode (rekening_kas_id, tahun, bulan),
  CONSTRAINT ck_rb_status CHECK (status IN ('DRAFT','FINAL')),
  CONSTRAINT fk_rb_rekening FOREIGN KEY (rekening_kas_id) REFERENCES rekening_kas (id),
  CONSTRAINT fk_rb_jurnal FOREIGN KEY (jurnal_id) REFERENCES jurnal (id),
  CONSTRAINT fk_rb_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES pengguna (id),
  CONSTRAINT fk_rb_final FOREIGN KEY (difinalkan_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Rekonsiliasi bank bulanan per rekening';

CREATE TABLE rekonsiliasi_bank_item (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rekonsiliasi_id INT UNSIGNED  NOT NULL,
  sisi            VARCHAR(4)    NOT NULL,
  jenis           VARCHAR(30)   NOT NULL,
  tanggal         DATE          NULL,
  keterangan      VARCHAR(255)  NOT NULL,
  jumlah          DECIMAL(18,2) NOT NULL,
  akun_id         INT UNSIGNED  NULL,
  KEY ix_rbi_rb (rekonsiliasi_id),
  CONSTRAINT ck_rbi_sisi CHECK (sisi IN ('BANK','BUKU')),
  CONSTRAINT ck_rbi_jenis CHECK (jenis IN ('SETORAN_DALAM_PERJALANAN','KOREKSI_BANK_TAMBAH','KOREKSI_BANK_KURANG','BIAYA_BANK','JASA_GIRO','PAJAK_JASA_GIRO','KOREKSI_BUKU_TAMBAH','KOREKSI_BUKU_KURANG')),
  CONSTRAINT ck_rbi_jumlah CHECK (jumlah > 0),
  CONSTRAINT fk_rbi_rb FOREIGN KEY (rekonsiliasi_id) REFERENCES rekonsiliasi_bank (id),
  CONSTRAINT fk_rbi_akun FOREIGN KEY (akun_id) REFERENCES akun (id)
) ENGINE=InnoDB COMMENT='Pos rekonsiliasi sisi bank dan sisi buku';

CREATE TABLE rekonsiliasi_bank_beredar (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rekonsiliasi_id INT UNSIGNED  NOT NULL,
  pembayaran_id   INT UNSIGNED  NOT NULL,
  tanggal         DATE          NOT NULL,
  nomor_pembayaran VARCHAR(30)  NOT NULL,
  metode          VARCHAR(10)   NOT NULL,
  nomor_warkat    VARCHAR(60)   NULL,
  penerima_nama   VARCHAR(150)  NOT NULL,
  jumlah          DECIMAL(18,2) NOT NULL,
  KEY ix_rbb_rb (rekonsiliasi_id),
  CONSTRAINT fk_rbb_rb FOREIGN KEY (rekonsiliasi_id) REFERENCES rekonsiliasi_bank (id),
  CONSTRAINT fk_rbb_byr FOREIGN KEY (pembayaran_id) REFERENCES pembayaran (id)
) ENGINE=InnoDB COMMENT='Salinan daftar warkat/transfer beredar saat rekonsiliasi difinalkan';

-- ---------------------------------------------------------------------------
-- Persetujuan dan lampiran
-- ---------------------------------------------------------------------------

CREATE TABLE persetujuan (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jenis_dokumen  VARCHAR(10)   NOT NULL,
  dokumen_id     INT UNSIGNED  NOT NULL,
  nomor_dokumen  VARCHAR(30)   NOT NULL,
  nilai          DECIMAL(18,2) NOT NULL DEFAULT 0,
  ringkasan      VARCHAR(255)  NULL,
  pembuat_id     INT UNSIGNED  NOT NULL,
  departemen_id  INT UNSIGNED  NULL,
  putaran        SMALLINT      NOT NULL DEFAULT 1,
  urutan         SMALLINT      NOT NULL,
  nama_langkah   VARCHAR(100)  NOT NULL,
  peran_kode     VARCHAR(30)   NOT NULL,
  lingkup        VARCHAR(12)   NOT NULL,
  status         VARCHAR(12)   NOT NULL DEFAULT 'MENUNGGU',
  diputuskan_oleh INT UNSIGNED NULL,
  diputuskan_pada DATETIME     NULL,
  catatan        VARCHAR(500)  NULL,
  dibuat_pada    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_persetujuan_dok (jenis_dokumen, dokumen_id),
  KEY ix_persetujuan_antrean (status, peran_kode),
  CONSTRAINT ck_persetujuan_status CHECK (status IN ('MENUNGGU','DISETUJUI','DITOLAK','DIBATALKAN')),
  CONSTRAINT fk_persetujuan_peran FOREIGN KEY (peran_kode) REFERENCES peran (kode),
  CONSTRAINT fk_persetujuan_pembuat FOREIGN KEY (pembuat_id) REFERENCES pengguna (id),
  CONSTRAINT fk_persetujuan_oleh FOREIGN KEY (diputuskan_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Langkah persetujuan per dokumen per putaran';

CREATE TABLE lampiran (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jenis_dokumen VARCHAR(10)   NOT NULL,
  dokumen_id    INT UNSIGNED  NOT NULL,
  nama_asli     VARCHAR(255)  NOT NULL,
  nama_simpan   VARCHAR(100)  NOT NULL,
  tipe_mime     VARCHAR(100)  NOT NULL,
  ukuran        INT UNSIGNED  NOT NULL,
  sha256        CHAR(64)      NOT NULL,
  diunggah_oleh INT UNSIGNED  NOT NULL,
  diunggah_pada DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_lampiran_dok (jenis_dokumen, dokumen_id),
  CONSTRAINT fk_lampiran_pengunggah FOREIGN KEY (diunggah_oleh) REFERENCES pengguna (id)
) ENGINE=InnoDB COMMENT='Metadata lampiran; berkas disimpan di folder lampiran server';

-- Rujukan melingkar ditambahkan setelah semua tabel ada
ALTER TABLE permintaan_pembayaran ADD CONSTRAINT fk_pp_bkk FOREIGN KEY (bkk_id) REFERENCES bukti_kas_keluar (id);
ALTER TABLE uang_muka ADD CONSTRAINT fk_um_bkk FOREIGN KEY (bkk_id) REFERENCES bukti_kas_keluar (id);
ALTER TABLE pertanggungjawaban_uang_muka ADD CONSTRAINT fk_pjum_bkk FOREIGN KEY (bkk_id) REFERENCES bukti_kas_keluar (id);
ALTER TABLE pengisian_kas_kecil ADD CONSTRAINT fk_pdk_bkk FOREIGN KEY (bkk_id) REFERENCES bukti_kas_keluar (id);
ALTER TABLE bukti_kas_keluar ADD CONSTRAINT fk_bkk_pembayaran FOREIGN KEY (pembayaran_id) REFERENCES pembayaran (id);
ALTER TABLE warkat ADD CONSTRAINT fk_warkat_pembayaran FOREIGN KEY (pembayaran_id) REFERENCES pembayaran (id);
