// Label dan nada warna status, jenis dokumen, peran, serta struktur menu per peran.

export const STATUS = {
  DRAFT: ['Draf', 'abu'],
  DIAJUKAN: ['Diajukan', 'biru'],
  MENUNGGU: ['Menunggu', 'biru'],
  MENUNGGU_PERSETUJUAN: ['Menunggu persetujuan', 'biru'],
  DISETUJUI: ['Disetujui', 'hijau'],
  DITOLAK: ['Ditolak', 'merah'],
  BATAL: ['Batal', 'abu-gelap'],
  DIBATALKAN: ['Dibatalkan', 'abu-gelap'],
  DIPROSES: ['Diproses', 'ungu'],
  DIBAYAR: ['Dibayar', 'hijau-tua'],
  LUNAS: ['Lunas', 'hijau-tua'],
  SELESAI: ['Selesai', 'hijau-tua'],
  DIGANTI: ['Diganti', 'hijau-tua'],
  TERVERIFIKASI: ['Terverifikasi', 'hijau'],
  DIBAYAR_SEBAGIAN: ['Dibayar sebagian', 'teal'],
  DITERIMA_SEBAGIAN: ['Diterima sebagian', 'teal'],
  DITERIMA_PENUH: ['Diterima penuh', 'hijau'],
  DITUTUP: ['Ditutup', 'abu'],
  FINAL: ['Final', 'hijau-tua'],
  DICATAT: ['Dicatat', 'hijau'],
  TERSEDIA: ['Tersedia', 'biru'],
  TERPAKAI: ['Terpakai', 'hijau'],
  AKTIF: ['Aktif', 'hijau'],
  HABIS: ['Habis', 'abu'],
  BUKA: ['Buka', 'hijau'],
  TUTUP: ['Tutup', 'abu-gelap'],
  COCOK: ['Cocok', 'hijau'],
  SELISIH: ['Selisih', 'kuning'],
  SELISIH_QTY: ['Selisih kuantitas', 'kuning'],
  SELISIH_HARGA: ['Selisih harga', 'kuning'],
  SELISIH_QTY_HARGA: ['Selisih kuantitas dan harga', 'kuning'],
  PAS: ['Pas', 'hijau'],
  SISA: ['Ada sisa', 'kuning'],
  KURANG: ['Ada kekurangan', 'kuning'],
};

export const JENIS_BKK = {
  PEMBAYARAN_FAKTUR: 'Pembayaran faktur pemasok',
  PERMINTAAN_PEMBAYARAN: 'Permintaan pembayaran',
  UANG_MUKA: 'Uang muka kerja',
  KEKURANGAN_UANG_MUKA: 'Kekurangan uang muka',
  PEMBENTUKAN_KAS_KECIL: 'Pembentukan dana kas kecil',
  PENGISIAN_KAS_KECIL: 'Pengisian kembali kas kecil',
};

export const METODE = { CEK: 'Cek', BG: 'Bilyet giro', TRANSFER: 'Transfer' };

export const JENIS_DOKUMEN = {
  PO: 'Pesanan pembelian',
  LPB: 'Laporan penerimaan barang',
  BAST: 'Berita acara serah terima',
  FB: 'Faktur pemasok',
  PP: 'Permintaan pembayaran',
  PUM: 'Permintaan uang muka',
  PJUM: 'Pertanggungjawaban uang muka',
  PKK: 'Pengeluaran kas kecil',
  PDK: 'Pengisian kembali kas kecil',
  OPN: 'Opname kas kecil',
  BKK: 'Bukti kas keluar',
  BYR: 'Pembayaran',
  BKM: 'Bukti kas masuk',
  JM: 'Bukti memorial',
  RB: 'Rekonsiliasi bank',
};

/** Rute detail tiap jenis dokumen (dipakai kotak persetujuan dan tautan silang). */
export const RUTE_DOKUMEN = {
  PO: '/po',
  LPB: '/penerimaan',
  BAST: '/penerimaan',
  FB: '/faktur',
  PP: '/pp',
  PUM: '/uang-muka',
  PJUM: '/pjum',
  PKK: '/pkk',
  PDK: '/pdk',
  OPN: '/opname',
  BKK: '/bkk',
  BYR: '/pembayaran',
  BKM: '/bkm',
  JM: '/jurnal-manual',
  RB: '/rekonsiliasi',
};

export const PERAN_KEUANGAN = ['STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'KASIR', 'AUDITOR'];
export const PERAN_LAPORAN = ['STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR'];
export const PERAN_PENYETUJU = ['PIMPINAN_UNIT', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN'];

/** Menu samping: setiap butir hanya tampil untuk peran yang disebut (kosong = semua pengguna). */
export const MENU = [
  { judul: null, butir: [{ label: 'Beranda', ke: '/', ikon: 'beranda' }, { label: 'Kotak persetujuan', ke: '/persetujuan', ikon: 'setuju', peran: PERAN_PENYETUJU, lencana: 'tugas' }] },
  {
    judul: 'Permintaan',
    butir: [
      { label: 'Permintaan saya', ke: '/permintaan', ikon: 'daftar', peran: ['PEMOHON'] },
      { label: 'Permintaan pembayaran', ke: '/pp', ikon: 'dokumen', peran: ['PEMOHON', ...PERAN_KEUANGAN, 'PIMPINAN_UNIT'] },
      { label: 'Uang muka kerja', ke: '/uang-muka', ikon: 'dompet', peran: ['PEMOHON', ...PERAN_KEUANGAN, 'PIMPINAN_UNIT'] },
      { label: 'Pertanggungjawaban', ke: '/pjum', ikon: 'centang', peran: ['PEMOHON', ...PERAN_KEUANGAN, 'PIMPINAN_UNIT'] },
      { label: 'Pengeluaran kas kecil', ke: '/pkk', ikon: 'koin', peran: ['PEMOHON', 'KAS_KECIL', ...PERAN_KEUANGAN, 'PIMPINAN_UNIT'] },
    ],
  },
  {
    judul: 'Pembelian',
    butir: [
      { label: 'Pesanan pembelian', ke: '/po', ikon: 'keranjang', peran: ['PEMBELIAN', 'GUDANG', 'PIMPINAN_UNIT', ...PERAN_KEUANGAN] },
      { label: 'Penerimaan barang', ke: '/penerimaan', ikon: 'kotak', peran: ['PEMBELIAN', 'GUDANG', 'PIMPINAN_UNIT', ...PERAN_KEUANGAN] },
      { label: 'Pemasok', ke: '/pemasok', ikon: 'gedung', peran: ['PEMBELIAN', 'GUDANG', ...PERAN_KEUANGAN] },
    ],
  },
  {
    judul: 'Utang dan kas',
    butir: [
      { label: 'Faktur pemasok', ke: '/faktur', ikon: 'faktur', peran: PERAN_KEUANGAN },
      { label: 'Bukti kas keluar', ke: '/bkk', ikon: 'keluar', peran: PERAN_KEUANGAN },
      { label: 'Pembayaran', ke: '/pembayaran', ikon: 'bayar', peran: PERAN_KEUANGAN },
      { label: 'Bukti kas masuk', ke: '/bkm', ikon: 'masuk', peran: PERAN_KEUANGAN },
      { label: 'Buku cek dan BG', ke: '/buku-cek', ikon: 'cek', peran: ['KASIR', 'STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR'] },
      { label: 'Rekonsiliasi bank', ke: '/rekonsiliasi', ikon: 'timbang', peran: PERAN_LAPORAN },
    ],
  },
  {
    judul: 'Kas kecil',
    butir: [
      { label: 'Dana kas kecil', ke: '/dana-kas-kecil', ikon: 'brankas', peran: ['KAS_KECIL', ...PERAN_KEUANGAN] },
      { label: 'Pengisian kembali', ke: '/pdk', ikon: 'isi', peran: ['KAS_KECIL', ...PERAN_KEUANGAN] },
      { label: 'Opname kas kecil', ke: '/opname', ikon: 'hitung', peran: ['KAS_KECIL', 'AUDITOR', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN'] },
    ],
  },
  {
    judul: 'Akuntansi',
    butir: [
      { label: 'Jurnal', ke: '/jurnal', ikon: 'buku', peran: PERAN_LAPORAN },
      { label: 'Bukti memorial', ke: '/jurnal-manual', ikon: 'pena', peran: PERAN_LAPORAN },
      { label: 'Periode akuntansi', ke: '/periode', ikon: 'kalender', peran: PERAN_LAPORAN },
      { label: 'Laporan', ke: '/laporan', ikon: 'grafik', peran: [...PERAN_LAPORAN, 'KASIR', 'KAS_KECIL'] },
    ],
  },
  {
    judul: 'Data master',
    butir: [
      { label: 'Bagan akun', ke: '/akun', ikon: 'daftar', peran: [...PERAN_LAPORAN, 'ADMIN'] },
      { label: 'Kode pajak', ke: '/pajak', ikon: 'persen', peran: [...PERAN_LAPORAN, 'ADMIN'] },
      { label: 'Rekening bank', ke: '/rekening-kas', ikon: 'bank', peran: [...PERAN_KEUANGAN, 'ADMIN'] },
      { label: 'Unit kerja', ke: '/departemen', ikon: 'orang', peran: ['ADMIN', ...PERAN_LAPORAN] },
    ],
  },
  {
    judul: 'Administrasi',
    butir: [
      { label: 'Pengguna', ke: '/admin/pengguna', ikon: 'orang', peran: ['ADMIN', 'AUDITOR', 'WAKIL_DEKAN_2'] },
      { label: 'Aturan persetujuan', ke: '/admin/aturan-persetujuan', ikon: 'tangga', peran: ['ADMIN', 'AUDITOR', 'WAKIL_DEKAN_2', 'DEKAN'] },
      { label: 'Konflik peran', ke: '/admin/konflik-peran', ikon: 'perisai', peran: ['ADMIN', 'AUDITOR', 'WAKIL_DEKAN_2'] },
      { label: 'Pengaturan', ke: '/admin/pengaturan', ikon: 'gerigi', peran: ['ADMIN'] },
      { label: 'Log audit', ke: '/admin/audit', ikon: 'jejak', peran: ['ADMIN', 'AUDITOR'] },
      { label: 'Sesi aktif', ke: '/admin/sesi', ikon: 'layar', peran: ['ADMIN'] },
    ],
  },
  { judul: null, butir: [{ label: 'Blanko formulir', ke: '/blanko', ikon: 'cetak' }] },
];
