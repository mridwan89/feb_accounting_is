import { Router } from 'express';
import { pool, satu, semua } from '../db.js';
import { punya } from '../lib/akses.js';
import { hariIni, tambahHari, pecah, awalBulan, akhirBulan } from '../lib/tanggal.js';
import { angkaPengaturan } from '../lib/pengaturan.js';
import { tugasPersetujuan } from '../lib/persetujuan.js';
import { posisiDana } from './master.js';
import { umurUtang } from './laporan.js';
import { uangMukaLewatTenggat } from './uangmuka.js';

export const router = Router();

const hitung = async (sql, params = []) => (await satu(pool, sql, params)).n;

router.get('/dasbor', async (req, res) => {
  const u = req.user;
  const kini = hariIni();
  const { tahun, bulan } = pecah(kini);
  const hasil = { per_tanggal: kini, tugas: [], kartu: [], dana: [], peringatan: [] };
  const tugas = (label, jumlah, tautan) => {
    if (jumlah > 0) hasil.tugas.push({ label, jumlah, tautan });
  };

  tugas('Dokumen menunggu persetujuan Anda', (await tugasPersetujuan(pool, u)).length, '/persetujuan');

  if (punya(u, 'PEMOHON')) {
    tugas('Dokumen Anda yang ditolak dan perlu diperbaiki', await hitung(
      `SELECT (SELECT COUNT(*) FROM permintaan_pembayaran WHERE dibuat_oleh = ? AND status = 'DITOLAK')
            + (SELECT COUNT(*) FROM uang_muka WHERE dibuat_oleh = ? AND status = 'DITOLAK')
            + (SELECT COUNT(*) FROM pertanggungjawaban_uang_muka WHERE dibuat_oleh = ? AND status = 'DITOLAK')
            + (SELECT COUNT(*) FROM pengeluaran_kas_kecil WHERE dibuat_oleh = ? AND status = 'DITOLAK') AS n`,
      [u.id, u.id, u.id, u.id],
    ), '/permintaan');
    tugas('Uang muka Anda yang harus dipertanggungjawabkan', await hitung(
      `SELECT COUNT(*) AS n FROM uang_muka x WHERE x.dibuat_oleh = ? AND x.status = 'DIBAYAR'
         AND NOT EXISTS (SELECT 1 FROM pertanggungjawaban_uang_muka p WHERE p.uang_muka_id = x.id AND p.status IN ('DIAJUKAN','DISETUJUI','SELESAI'))`,
      [u.id],
    ), '/uang-muka');
    const lewat = await uangMukaLewatTenggat(pool, u.id);
    if (lewat) hasil.peringatan.push(`Uang muka ${lewat.nomor} sudah melewati tenggat pertanggungjawaban (${lewat.tanggal_batas_pj}). Anda tidak dapat mengajukan uang muka baru sebelum menyelesaikannya.`);
  }
  if (punya(u, 'PEMBELIAN')) {
    tugas('PO disetujui yang belum diterima penuh', await hitung("SELECT COUNT(*) AS n FROM pesanan_pembelian WHERE status IN ('DISETUJUI','DITERIMA_SEBAGIAN')"), '/po');
  }
  if (punya(u, 'GUDANG')) {
    tugas('PO yang menunggu penerimaan barang atau jasa', await hitung("SELECT COUNT(*) AS n FROM pesanan_pembelian WHERE status IN ('DISETUJUI','DITERIMA_SEBAGIAN')"), '/penerimaan/baru');
  }
  if (punya(u, 'STAF_KEUANGAN')) {
    tugas('Faktur draf atau ditolak yang belum diverifikasi', await hitung("SELECT COUNT(*) AS n FROM faktur_pemasok WHERE status IN ('DRAFT','DITOLAK')"), '/faktur');
    tugas('Permintaan pembayaran siap dibuatkan BKK', await hitung("SELECT COUNT(*) AS n FROM permintaan_pembayaran WHERE status = 'DISETUJUI'"), '/bkk/baru?jenis=PERMINTAAN_PEMBAYARAN');
    tugas('Uang muka siap dibuatkan BKK', await hitung("SELECT COUNT(*) AS n FROM uang_muka WHERE status = 'DISETUJUI'"), '/bkk/baru?jenis=UANG_MUKA');
    tugas('Kekurangan uang muka siap dibayar', await hitung("SELECT COUNT(*) AS n FROM pertanggungjawaban_uang_muka WHERE status = 'DISETUJUI' AND hasil = 'KURANG' AND bkk_id IS NULL"), '/bkk/baru?jenis=KEKURANGAN_UANG_MUKA');
    tugas('Pengisian kas kecil siap diproses', await hitung("SELECT COUNT(*) AS n FROM pengisian_kas_kecil WHERE status = 'DIAJUKAN'"), '/bkk/baru?jenis=PENGISIAN_KAS_KECIL');
    tugas('BKK Anda yang ditolak', await hitung("SELECT COUNT(*) AS n FROM bukti_kas_keluar WHERE dibuat_oleh = ? AND status = 'DITOLAK'", [u.id]), '/bkk?status=DITOLAK');
  }
  if (punya(u, 'KASIR')) {
    const antrean = await satu(pool, "SELECT COUNT(*) AS n, COALESCE(SUM(jumlah_bayar), 0) AS nilai FROM bukti_kas_keluar WHERE status = 'DISETUJUI'");
    tugas('BKK disetujui yang menunggu dibayar', antrean.n, '/pembayaran');
    tugas('Sisa uang muka yang menunggu disetor karyawan', await hitung("SELECT COUNT(*) AS n FROM pertanggungjawaban_uang_muka WHERE status = 'DISETUJUI' AND hasil = 'SISA' AND bkm_id IS NULL"), '/bkm/baru');
    const warkat = await semua(
      pool,
      `SELECT r.kode, bc.jenis, SUM(w.status = 'TERSEDIA') AS tersedia FROM buku_cek bc JOIN rekening_kas r ON r.id = bc.rekening_kas_id
         JOIN warkat w ON w.buku_cek_id = bc.id WHERE bc.status = 'AKTIF' GROUP BY r.kode, bc.jenis`,
    );
    for (const w of warkat) {
      if (Number(w.tersedia) < 10) hasil.peringatan.push(`Lembar ${w.jenis === 'CEK' ? 'cek' : 'bilyet giro'} rekening ${w.kode} tinggal ${w.tersedia}. Minta buku baru ke bank.`);
    }
    hasil.kartu.push({ label: 'Antrean pembayaran', nilai: antrean.nilai, keterangan: `${antrean.n} BKK` });
  }
  if (punya(u, 'KASUBAG_KEUANGAN')) {
    tugas('Rekening pemasok menunggu verifikasi', await hitung('SELECT COUNT(*) AS n FROM pemasok WHERE bank_nomor_rekening IS NOT NULL AND rekening_terverifikasi = 0 AND (rekening_diubah_oleh IS NULL OR rekening_diubah_oleh <> ?)', [u.id]), '/pemasok?belum_verifikasi=1');
    const bulanLalu = bulan === 1 ? { tahun: tahun - 1, bulan: 12 } : { tahun, bulan: bulan - 1 };
    tugas(`Rekonsiliasi bank ${bulanLalu.bulan}/${bulanLalu.tahun} yang belum final`, await hitung(
      `SELECT COUNT(*) AS n FROM rekening_kas r WHERE r.aktif = 1 AND NOT EXISTS (SELECT 1 FROM rekonsiliasi_bank b
         WHERE b.rekening_kas_id = r.id AND b.tahun = ? AND b.bulan = ? AND b.status = 'FINAL')`,
      [bulanLalu.tahun, bulanLalu.bulan],
    ), '/rekonsiliasi');
  }
  if (punya(u, 'KAS_KECIL')) {
    const dana = await semua(pool, 'SELECT id, kode, nama FROM dana_kas_kecil WHERE pemegang_id = ? AND aktif = 1', [u.id]);
    const ambang = await angkaPengaturan('ambang_kas_kecil_persen', 25);
    for (const d of dana) {
      const pos = await posisiDana(pool, d.id);
      hasil.dana.push({ ...d, ...pos });
      if (pos.jumlah_dana > 0 && pos.persen_saldo < ambang) hasil.peringatan.push(`Saldo tunai ${d.nama} tinggal ${pos.persen_saldo}% dari dana tetap. Ajukan pengisian kembali.`);
      tugas(`Pengeluaran ${d.nama} yang disetujui dan menunggu dibayar`, await hitung("SELECT COUNT(*) AS n FROM pengeluaran_kas_kecil WHERE dana_id = ? AND status = 'DISETUJUI'", [d.id]), '/pkk?status=DISETUJUI');
    }
  }
  if (punya(u, 'STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR')) {
    const batas7 = tambahHari(kini, 7);
    const utang = await satu(pool, "SELECT COALESCE(SUM(total_utang - terbayar), 0) AS nilai, COUNT(*) AS n FROM faktur_pemasok WHERE status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN')");
    const jt = await satu(pool, "SELECT COALESCE(SUM(total_utang - terbayar), 0) AS nilai, COUNT(*) AS n FROM faktur_pemasok WHERE status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN') AND tanggal_jatuh_tempo BETWEEN ? AND ?", [kini, batas7]);
    const lewat = await satu(pool, "SELECT COALESCE(SUM(total_utang - terbayar), 0) AS nilai, COUNT(*) AS n FROM faktur_pemasok WHERE status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN') AND tanggal_jatuh_tempo < ?", [kini]);
    const bayar = await satu(pool, "SELECT COALESCE(SUM(jumlah), 0) AS nilai, COUNT(*) AS n FROM pembayaran WHERE status = 'DIBAYAR' AND tanggal BETWEEN ? AND ?", [awalBulan(tahun, bulan), akhirBulan(tahun, bulan)]);
    const um = await satu(
      pool,
      `SELECT COALESCE(SUM(x.jumlah), 0) AS nilai, COUNT(*) AS n FROM uang_muka x WHERE x.status = 'DIBAYAR' AND x.tanggal_batas_pj < ?
         AND NOT EXISTS (SELECT 1 FROM pertanggungjawaban_uang_muka p WHERE p.uang_muka_id = x.id AND p.status IN ('DIAJUKAN','DISETUJUI','SELESAI'))`,
      [kini],
    );
    hasil.kartu.push(
      { label: 'Utang usaha beredar', nilai: utang.nilai, keterangan: `${utang.n} faktur` },
      { label: 'Jatuh tempo 7 hari ke depan', nilai: jt.nilai, keterangan: `${jt.n} faktur` },
      { label: 'Sudah lewat jatuh tempo', nilai: lewat.nilai, keterangan: `${lewat.n} faktur`, nada: lewat.n ? 'bahaya' : undefined },
      { label: 'Pembayaran bulan ini', nilai: bayar.nilai, keterangan: `${bayar.n} pembayaran` },
      { label: 'Uang muka lewat tenggat', nilai: um.nilai, keterangan: `${um.n} dokumen`, nada: um.n ? 'peringatan' : undefined },
    );
    hasil.saldo_bank = await semua(
      pool,
      `SELECT r.kode, r.nama, (SELECT COALESCE(SUM(d.debit - d.kredit), 0) FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id
         WHERE d.akun_id = r.akun_id AND j.tanggal <= ?) AS saldo FROM rekening_kas r WHERE r.aktif = 1 ORDER BY r.kode`,
      [kini],
    );
    const u6 = await umurUtang();
    hasil.umur_utang = { kelompok: u6.kelompok, total: u6.total };
    hasil.pembayaran_bulanan = await semua(
      pool,
      `SELECT DATE_FORMAT(tanggal, '%Y-%m') AS bulan, SUM(jumlah) AS nilai, COUNT(*) AS n FROM pembayaran
        WHERE status = 'DIBAYAR' AND tanggal >= ? GROUP BY DATE_FORMAT(tanggal, '%Y-%m') ORDER BY bulan`,
      [awalBulan(bulan > 5 ? tahun : tahun - 1, ((bulan + 6) % 12) + 1)],
    );
  }
  if (punya(u, 'ADMIN')) {
    hasil.kartu.push(
      { label: 'Pengguna aktif', nilai: await hitung('SELECT COUNT(*) AS n FROM pengguna WHERE aktif = 1'), jenis: 'angka' },
      { label: 'Akun terkunci', nilai: await hitung('SELECT COUNT(*) AS n FROM pengguna WHERE terkunci_sampai > NOW()'), jenis: 'angka' },
      { label: 'Sesi aktif', nilai: await hitung('SELECT COUNT(*) AS n FROM sesi WHERE dicabut_pada IS NULL AND kedaluwarsa > NOW() AND aktivitas_terakhir > NOW() - INTERVAL 30 MINUTE'), jenis: 'angka' },
    );
  }
  res.json(hasil);
});
