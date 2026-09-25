import { Router } from 'express';
import { pool, satu, semua } from '../db.js';
import { galatMasukan, galatAkses } from '../lib/galat.js';
import { perlu, punya } from '../lib/akses.js';
import { keSen, dariSen } from '../lib/uang.js';
import { hariIni, tambahHari, selisihHari, awalBulan, pecah } from '../lib/tanggal.js';
import { akunSistem } from '../lib/pengaturan.js';
import { posisiDana } from './master.js';

export const router = Router();

const PERAN_LAPORAN = ['AKUNTANSI', 'SPV_AKUNTANSI', 'MANAJER_KEUANGAN', 'DIREKTUR', 'AUDITOR'];
const tglValid = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t);

function rentang(q) {
  const kini = hariIni();
  const { tahun, bulan } = pecah(kini);
  const dari = tglValid(q.dari) ? q.dari : awalBulan(tahun, bulan);
  const sampai = tglValid(q.sampai) ? q.sampai : kini;
  if (dari > sampai) throw galatMasukan('Tanggal awal tidak boleh setelah tanggal akhir.');
  return { dari, sampai };
}

const jumlahSen = (rows, kolom) => dariSen(rows.reduce((a, r) => a + keSen(r[kolom]), 0));

// LAP-01 Register BKK
router.get('/laporan/register-bkk', perlu(...PERAN_LAPORAN, 'KASIR'), async (req, res) => {
  const { dari, sampai } = rentang(req.query);
  const syarat = ['b.tanggal BETWEEN ? AND ?'];
  const params = [dari, sampai];
  if (req.query.status) { syarat.push('b.status IN (?)'); params.push(String(req.query.status).split(',')); }
  if (req.query.jenis) { syarat.push('b.jenis = ?'); params.push(String(req.query.jenis)); }
  const rows = await semua(
    pool,
    `SELECT b.id, b.nomor, b.tanggal, b.jenis, b.penerima_nama, b.sumber_nomor, b.metode_bayar, b.jumlah_bruto, b.jumlah_potongan, b.jumlah_bayar, b.status,
            p.nomor AS pembayaran_nomor, p.tanggal AS tanggal_bayar, COALESCE(p.nomor_warkat, p.nomor_referensi) AS bukti_bayar
       FROM bukti_kas_keluar b LEFT JOIN pembayaran p ON p.id = b.pembayaran_id
      WHERE ${syarat.join(' AND ')} ORDER BY b.tanggal, b.nomor`,
    params,
  );
  const berlaku = rows.filter((r) => r.status !== 'BATAL');
  res.json({ dari, sampai, data: rows, total: { jumlah: berlaku.length, bruto: jumlahSen(berlaku, 'jumlah_bruto'), potongan: jumlahSen(berlaku, 'jumlah_potongan'), dibayar: jumlahSen(berlaku, 'jumlah_bayar') } });
});

// LAP-02 Register cek dan pembayaran
router.get('/laporan/register-cek', perlu(...PERAN_LAPORAN, 'KASIR'), async (req, res) => {
  const { dari, sampai } = rentang(req.query);
  const rek = req.query.rekening_kas_id ? Number(req.query.rekening_kas_id) : null;
  const pembayaran = await semua(
    pool,
    `SELECT p.id, p.nomor, p.tanggal, p.metode, p.nomor_warkat, p.nomor_referensi, p.tanggal_jatuh_tempo_bg, p.penerima_nama, p.jumlah, p.status,
            p.tanggal_kliring, p.alasan_batal, b.nomor AS bkk_nomor, r.kode AS rekening_kode
       FROM pembayaran p JOIN bukti_kas_keluar b ON b.id = p.bkk_id JOIN rekening_kas r ON r.id = p.rekening_kas_id
      WHERE p.tanggal BETWEEN ? AND ? ${rek ? 'AND p.rekening_kas_id = ?' : ''} ORDER BY p.tanggal, p.id`,
    rek ? [dari, sampai, rek] : [dari, sampai],
  );
  const buku = await semua(
    pool,
    `SELECT bc.id, bc.jenis, bc.seri, bc.nomor_awal, bc.nomor_akhir, bc.digit, bc.status, r.kode AS rekening_kode,
            SUM(w.status = 'TERSEDIA') AS tersedia, SUM(w.status = 'TERPAKAI') AS terpakai, SUM(w.status = 'BATAL') AS batal, COUNT(w.id) AS total
       FROM buku_cek bc JOIN rekening_kas r ON r.id = bc.rekening_kas_id JOIN warkat w ON w.buku_cek_id = bc.id
      ${rek ? 'WHERE bc.rekening_kas_id = ?' : ''} GROUP BY bc.id ORDER BY r.kode, bc.jenis, bc.nomor_awal`,
    rek ? [rek] : [],
  );
  const warkatBatal = await semua(
    pool,
    `SELECT w.nomor, w.keterangan, w.dibatalkan_pada, u.nama_lengkap AS dibatalkan_nama, bc.jenis, r.kode AS rekening_kode
       FROM warkat w JOIN buku_cek bc ON bc.id = w.buku_cek_id JOIN rekening_kas r ON r.id = bc.rekening_kas_id LEFT JOIN pengguna u ON u.id = w.dibatalkan_oleh
      WHERE w.status = 'BATAL' AND DATE(w.dibatalkan_pada) BETWEEN ? AND ? ${rek ? 'AND bc.rekening_kas_id = ?' : ''} ORDER BY w.dibatalkan_pada`,
    rek ? [dari, sampai, rek] : [dari, sampai],
  );
  const berlaku = pembayaran.filter((p) => p.status === 'DIBAYAR');
  res.json({ dari, sampai, pembayaran, buku, warkat_batal: warkatBatal, total: { jumlah: berlaku.length, nilai: jumlahSen(berlaku, 'jumlah') } });
});

// LAP-03 Jurnal pengeluaran kas (kolom)
router.get('/laporan/jurnal-pengeluaran-kas', perlu(...PERAN_LAPORAN), async (req, res) => {
  const { dari, sampai } = rentang(req.query);
  const utangUsaha = await akunSistem('akun_utang_usaha');
  const akunBank = new Set((await semua(pool, 'SELECT akun_id FROM rekening_kas')).map((r) => r.akun_id));
  const akunPajak = new Set((await semua(pool, "SELECT akun_id FROM pajak WHERE jenis = 'PPH'")).map((r) => r.akun_id));
  const rekAkun = req.query.rekening_kas_id ? (await satu(pool, 'SELECT akun_id FROM rekening_kas WHERE id = ?', [Number(req.query.rekening_kas_id)]))?.akun_id : null;
  const jurnal = await semua(
    pool,
    `SELECT j.id, j.tanggal, j.nomor, j.sumber_nomor, j.keterangan, j.pembalik_dari_id, b.nomor AS bkk_nomor,
            COALESCE(p.nomor_warkat, p.nomor_referensi) AS bukti_bayar
       FROM jurnal j LEFT JOIN pembayaran p ON p.id = j.sumber_id AND j.sumber_tipe = 'BYR' LEFT JOIN bukti_kas_keluar b ON b.id = p.bkk_id
      WHERE j.jenis = 'JKK' AND j.tanggal BETWEEN ? AND ? ORDER BY j.tanggal, j.id`,
    [dari, sampai],
  );
  const detail = jurnal.length
    ? await semua(
        pool,
        'SELECT d.jurnal_id, d.akun_id, a.kode, a.nama, d.debit, d.kredit FROM jurnal_detail d JOIN akun a ON a.id = d.akun_id WHERE d.jurnal_id IN (?) ORDER BY d.baris',
        [jurnal.map((j) => j.id)],
      )
    : [];
  const baris = [];
  for (const j of jurnal) {
    const d = detail.filter((x) => x.jurnal_id === j.id);
    if (rekAkun && !d.some((x) => x.akun_id === rekAkun)) continue;
    // Jurnal pembalik dikelompokkan dalam orientasi jurnal asalnya, lalu seluruh kolom diberi tanda negatif.
    const tanda = j.pembalik_dari_id ? -1 : 1;
    let utang = 0;
    let bank = 0;
    let pajak = 0;
    const lain = [];
    for (const x of d) {
      const net = (keSen(x.debit) - keSen(x.kredit)) * tanda;
      if (x.akun_id === utangUsaha.id) utang += net;
      else if (akunBank.has(x.akun_id)) bank -= net;
      else if (akunPajak.has(x.akun_id) && net < 0) pajak -= net;
      else lain.push({ akun: `${x.kode} ${x.nama}`, jumlah: dariSen(net * tanda) });
    }
    baris.push({
      ...j,
      debit_utang_usaha: dariSen(utang * tanda),
      debit_lain: lain,
      debit_lain_total: dariSen(lain.reduce((a, l) => a + keSen(l.jumlah), 0)),
      kredit_pajak: dariSen(pajak * tanda),
      kredit_bank: dariSen(bank * tanda),
    });
  }
  const total = {
    debit_utang_usaha: jumlahSen(baris, 'debit_utang_usaha'),
    debit_lain_total: jumlahSen(baris, 'debit_lain_total'),
    kredit_pajak: jumlahSen(baris, 'kredit_pajak'),
    kredit_bank: jumlahSen(baris, 'kredit_bank'),
  };
  res.json({ dari, sampai, data: baris, total });
});

// LAP-04 Buku pembantu utang
router.get('/laporan/buku-pembantu-utang', perlu(...PERAN_LAPORAN), async (req, res) => {
  const { dari, sampai } = rentang(req.query);
  const pemasokId = Number(req.query.pemasok_id);
  if (!pemasokId) throw galatMasukan('Pilih pemasok.');
  const utangUsaha = await akunSistem('akun_utang_usaha');
  const pemasok = await satu(pool, 'SELECT id, kode, nama FROM pemasok WHERE id = ?', [pemasokId]);
  const awal = await satu(
    pool,
    'SELECT COALESCE(SUM(d.kredit - d.debit), 0) AS saldo FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id WHERE d.akun_id = ? AND d.pemasok_id = ? AND j.tanggal < ?',
    [utangUsaha.id, pemasokId, dari],
  );
  const mutasi = await semua(
    pool,
    `SELECT j.id AS jurnal_id, j.tanggal, j.nomor, j.jenis, j.sumber_nomor, j.keterangan, d.keterangan AS uraian, d.debit, d.kredit
       FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id
      WHERE d.akun_id = ? AND d.pemasok_id = ? AND j.tanggal BETWEEN ? AND ? ORDER BY j.tanggal, j.id, d.baris`,
    [utangUsaha.id, pemasokId, dari, sampai],
  );
  let saldo = keSen(awal.saldo);
  const data = mutasi.map((m) => {
    saldo += keSen(m.kredit) - keSen(m.debit);
    return { ...m, saldo: dariSen(saldo) };
  });
  res.json({ dari, sampai, pemasok, saldo_awal: awal.saldo, data, saldo_akhir: dariSen(saldo), total_debit: jumlahSen(mutasi, 'debit'), total_kredit: jumlahSen(mutasi, 'kredit') });
});

// LAP-05 Daftar saldo utang dan pencocokan dengan buku besar
router.get('/laporan/saldo-utang', perlu(...PERAN_LAPORAN), async (req, res) => {
  const perTanggal = tglValid(req.query.per_tanggal) ? req.query.per_tanggal : hariIni();
  const utangUsaha = await akunSistem('akun_utang_usaha');
  const rows = await semua(
    pool,
    `SELECT p.id, p.kode, p.nama,
            (SELECT COALESCE(SUM(d.kredit - d.debit), 0) FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id
              WHERE d.akun_id = ? AND d.pemasok_id = p.id AND j.tanggal <= ?) AS saldo_buku_besar,
            (SELECT COALESCE(SUM(f.total_utang - f.terbayar), 0) FROM faktur_pemasok f
              WHERE f.pemasok_id = p.id AND f.status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN')) AS sisa_faktur,
            (SELECT COUNT(*) FROM faktur_pemasok f WHERE f.pemasok_id = p.id AND f.status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN')) AS jumlah_faktur
       FROM pemasok p ORDER BY p.nama`,
    [utangUsaha.id, perTanggal],
  );
  const data = rows
    .filter((r) => keSen(r.saldo_buku_besar) !== 0 || keSen(r.sisa_faktur) !== 0)
    .map((r) => ({ ...r, selisih: dariSen(keSen(r.saldo_buku_besar) - keSen(r.sisa_faktur)) }));
  const kontrol = await satu(
    pool,
    'SELECT COALESCE(SUM(d.kredit - d.debit), 0) AS saldo FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id WHERE d.akun_id = ? AND j.tanggal <= ?',
    [utangUsaha.id, perTanggal],
  );
  res.json({
    per_tanggal: perTanggal,
    data,
    total_buku_pembantu: jumlahSen(data, 'saldo_buku_besar'),
    total_sisa_faktur: jumlahSen(data, 'sisa_faktur'),
    saldo_akun_kontrol: kontrol.saldo,
    akun_kontrol: `${utangUsaha.kode} ${utangUsaha.nama}`,
  });
});

async function fakturTerbuka() {
  return semua(
    pool,
    `SELECT f.id, f.nomor, f.nomor_faktur, f.tanggal_faktur, f.tanggal_jatuh_tempo, f.total_utang, f.terbayar, (f.total_utang - f.terbayar) AS sisa,
            p.id AS pemasok_id, p.kode AS pemasok_kode, p.nama AS pemasok_nama,
            COALESCE((SELECT SUM(d.jumlah) FROM bukti_kas_keluar_detail d JOIN bukti_kas_keluar b ON b.id = d.bkk_id
                       WHERE d.faktur_id = f.id AND b.status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK')), 0) AS dalam_proses
       FROM faktur_pemasok f JOIN pemasok p ON p.id = f.pemasok_id
      WHERE f.status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN') ORDER BY f.tanggal_jatuh_tempo, f.id`,
  );
}

const KELOMPOK_UMUR = [
  { kunci: 'belum_jatuh_tempo', label: 'Belum jatuh tempo', min: -Infinity, maks: 0 },
  { kunci: 'hari_1_30', label: '1 s.d. 30 hari', min: 1, maks: 30 },
  { kunci: 'hari_31_60', label: '31 s.d. 60 hari', min: 31, maks: 60 },
  { kunci: 'hari_61_90', label: '61 s.d. 90 hari', min: 61, maks: 90 },
  { kunci: 'hari_90_lebih', label: 'Di atas 90 hari', min: 91, maks: Infinity },
];

export async function umurUtang() {
  const kini = hariIni();
  const faktur = await fakturTerbuka();
  const peta = new Map();
  const total = Object.fromEntries(KELOMPOK_UMUR.map((k) => [k.kunci, 0]));
  for (const f of faktur) {
    const hari = selisihHari(f.tanggal_jatuh_tempo, kini);
    const k = KELOMPOK_UMUR.find((x) => hari >= x.min && hari <= x.maks);
    if (!peta.has(f.pemasok_id)) peta.set(f.pemasok_id, { pemasok_id: f.pemasok_id, pemasok_kode: f.pemasok_kode, pemasok_nama: f.pemasok_nama, total: 0, ...Object.fromEntries(KELOMPOK_UMUR.map((x) => [x.kunci, 0])) });
    const r = peta.get(f.pemasok_id);
    r[k.kunci] += keSen(f.sisa);
    r.total += keSen(f.sisa);
    total[k.kunci] += keSen(f.sisa);
  }
  const data = [...peta.values()].map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' && !k.endsWith('_id') ? dariSen(v) : v])));
  return {
    per_tanggal: kini,
    kelompok: KELOMPOK_UMUR.map(({ kunci, label }) => ({ kunci, label })),
    data: data.sort((a, b) => b.total - a.total),
    total: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, dariSen(v)])),
    total_semua: dariSen(Object.values(total).reduce((a, v) => a + v, 0)),
  };
}

// LAP-06 Umur utang
router.get('/laporan/umur-utang', perlu(...PERAN_LAPORAN), async (_req, res) => {
  res.json(await umurUtang());
});

// LAP-07 Faktur jatuh tempo (rencana kebutuhan kas)
router.get('/laporan/faktur-jatuh-tempo', perlu(...PERAN_LAPORAN, 'KASIR'), async (req, res) => {
  const hari = Math.min(Math.max(Number(req.query.hari) || 14, 0), 365);
  const kini = hariIni();
  const batas = tambahHari(kini, hari);
  const data = (await fakturTerbuka())
    .filter((f) => f.tanggal_jatuh_tempo <= batas)
    .map((f) => ({ ...f, hari_menuju_jatuh_tempo: selisihHari(kini, f.tanggal_jatuh_tempo), belum_diproses: dariSen(keSen(f.sisa) - keSen(f.dalam_proses)) }));
  res.json({ per_tanggal: kini, sampai: batas, data, total_sisa: jumlahSen(data, 'sisa'), total_lewat: jumlahSen(data.filter((f) => f.hari_menuju_jatuh_tempo < 0), 'sisa') });
});

// LAP-08 Laporan kas kecil
router.get('/laporan/kas-kecil', async (req, res) => {
  const danaId = Number(req.query.dana_id);
  if (!danaId) throw galatMasukan('Pilih dana kas kecil.');
  const dana = await satu(pool, 'SELECT d.*, u.nama_lengkap AS pemegang_nama FROM dana_kas_kecil d JOIN pengguna u ON u.id = d.pemegang_id WHERE d.id = ?', [danaId]);
  if (!dana) throw galatMasukan('Dana kas kecil tidak ditemukan.');
  if (!punya(req.user, PERAN_LAPORAN) && dana.pemegang_id !== req.user.id) throw galatAkses();
  const { dari, sampai } = rentang(req.query);
  const mutasi = await semua(
    pool,
    `SELECT p.tanggal, b.nomor AS dokumen, CASE b.jenis WHEN 'PEMBENTUKAN_KAS_KECIL' THEN 'Pembentukan/penambahan dana' ELSE 'Pengisian kembali' END AS uraian,
            b.jumlah_bruto AS masuk, 0 AS keluar, 1 AS urut
       FROM pembayaran p JOIN bukti_kas_keluar b ON b.id = p.bkk_id
      WHERE p.status = 'DIBAYAR' AND ((b.jenis = 'PEMBENTUKAN_KAS_KECIL' AND b.sumber_id = ?)
         OR (b.jenis = 'PENGISIAN_KAS_KECIL' AND b.sumber_id IN (SELECT id FROM pengisian_kas_kecil WHERE dana_id = ?)))
     UNION ALL
     SELECT k.tanggal_bayar, k.nomor, CONCAT(k.keperluan, ' (', COALESCE(k.nomor_bukti, '-'), ')'), 0, k.jumlah, 2
       FROM pengeluaran_kas_kecil k WHERE k.dana_id = ? AND k.status IN ('DIBAYAR','DIGANTI')
     UNION ALL
     SELECT m.tanggal, m.nomor, 'Pengembalian dana ke bank', 0, m.jumlah, 3
       FROM penerimaan_kas m WHERE m.sumber = 'PENGEMBALIAN_KAS_KECIL' AND m.sumber_id = ? AND m.status = 'DICATAT'
     ORDER BY 1, 5, 2`,
    [danaId, danaId, danaId, danaId],
  );
  let saldoAwal = 0;
  const data = [];
  let saldo = 0;
  for (const m of mutasi) {
    const efek = keSen(m.masuk) - keSen(m.keluar);
    if (m.tanggal < dari) saldoAwal += efek;
    else if (m.tanggal <= sampai) data.push(m);
  }
  saldo = saldoAwal;
  const baris = data.map((m) => {
    saldo += keSen(m.masuk) - keSen(m.keluar);
    return { ...m, saldo: dariSen(saldo) };
  });
  res.json({
    dana,
    dari,
    sampai,
    posisi: await posisiDana(pool, danaId),
    saldo_awal: dariSen(saldoAwal),
    data: baris,
    saldo_akhir: dariSen(saldo),
    total_masuk: jumlahSen(data, 'masuk'),
    total_keluar: jumlahSen(data, 'keluar'),
  });
});

// LAP-09 Uang muka beredar
router.get('/laporan/uang-muka-beredar', perlu(...PERAN_LAPORAN), async (_req, res) => {
  const kini = hariIni();
  const rows = await semua(
    pool,
    `SELECT u.id, u.nomor, u.tanggal, u.keperluan, u.jumlah, u.tanggal_selesai_kegiatan, u.tanggal_batas_pj, u.status,
            pg.nama_lengkap AS pemohon, d.nama AS departemen_nama, p.tanggal AS tanggal_bayar,
            (SELECT x.nomor FROM pertanggungjawaban_uang_muka x WHERE x.uang_muka_id = u.id AND x.status <> 'BATAL' ORDER BY x.id DESC LIMIT 1) AS pjum_nomor,
            (SELECT x.status FROM pertanggungjawaban_uang_muka x WHERE x.uang_muka_id = u.id AND x.status <> 'BATAL' ORDER BY x.id DESC LIMIT 1) AS pjum_status
       FROM uang_muka u JOIN pengguna pg ON pg.id = u.dibuat_oleh JOIN departemen d ON d.id = u.departemen_id
       LEFT JOIN bukti_kas_keluar b ON b.id = u.bkk_id LEFT JOIN pembayaran p ON p.id = b.pembayaran_id
      WHERE u.status = 'DIBAYAR' ORDER BY u.tanggal_batas_pj`,
  );
  const data = rows.map((r) => {
    const lewat = r.tanggal_batas_pj < kini && !['DIAJUKAN', 'DISETUJUI', 'SELESAI'].includes(r.pjum_status);
    return { ...r, umur_hari: r.tanggal_bayar ? selisihHari(r.tanggal_bayar, kini) : 0, lewat_tenggat: lewat, hari_lewat_tenggat: lewat ? selisihHari(r.tanggal_batas_pj, kini) : 0 };
  });
  res.json({
    per_tanggal: kini,
    data,
    total: jumlahSen(data, 'jumlah'),
    total_lewat_tenggat: jumlahSen(data.filter((d) => d.lewat_tenggat), 'jumlah'),
    jumlah_lewat_tenggat: data.filter((d) => d.lewat_tenggat).length,
  });
});

// LAP-10 Buku besar
router.get('/laporan/buku-besar', perlu(...PERAN_LAPORAN), async (req, res) => {
  const { dari, sampai } = rentang(req.query);
  const akunId = Number(req.query.akun_id);
  if (!akunId) throw galatMasukan('Pilih akun.');
  const akun = await satu(pool, 'SELECT id, kode, nama, saldo_normal FROM akun WHERE id = ?', [akunId]);
  const tanda = akun.saldo_normal === 'D' ? 1 : -1;
  const awal = await satu(pool, 'SELECT COALESCE(SUM(d.debit - d.kredit), 0) AS s FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id WHERE d.akun_id = ? AND j.tanggal < ?', [akunId, dari]);
  const mutasi = await semua(
    pool,
    `SELECT j.id AS jurnal_id, j.tanggal, j.nomor, j.jenis, j.sumber_nomor, j.keterangan, d.keterangan AS uraian, d.debit, d.kredit,
            dp.kode AS departemen_kode, p.nama AS pemasok_nama
       FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id LEFT JOIN departemen dp ON dp.id = d.departemen_id LEFT JOIN pemasok p ON p.id = d.pemasok_id
      WHERE d.akun_id = ? AND j.tanggal BETWEEN ? AND ? ORDER BY j.tanggal, j.id, d.baris`,
    [akunId, dari, sampai],
  );
  let saldo = keSen(awal.s) * tanda;
  const data = mutasi.map((m) => {
    saldo += (keSen(m.debit) - keSen(m.kredit)) * tanda;
    return { ...m, saldo: dariSen(saldo) };
  });
  res.json({ akun, dari, sampai, saldo_awal: dariSen(keSen(awal.s) * tanda), data, saldo_akhir: dariSen(saldo), total_debit: jumlahSen(mutasi, 'debit'), total_kredit: jumlahSen(mutasi, 'kredit') });
});

export async function neracaSaldo(db, sampai) {
  const rows = await semua(
    db,
    `SELECT a.id, a.kode, a.nama, a.kategori, a.saldo_normal, SUM(d.debit) AS total_debit, SUM(d.kredit) AS total_kredit, SUM(d.debit - d.kredit) AS saldo
       FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id JOIN akun a ON a.id = d.akun_id
      WHERE j.tanggal <= ? GROUP BY a.id ORDER BY a.kode`,
    [sampai],
  );
  const data = rows.map((r) => ({
    ...r,
    saldo_debit: keSen(r.saldo) > 0 ? r.saldo : 0,
    saldo_kredit: keSen(r.saldo) < 0 ? dariSen(-keSen(r.saldo)) : 0,
  }));
  const totalDebit = jumlahSen(data, 'saldo_debit');
  const totalKredit = jumlahSen(data, 'saldo_kredit');
  return { sampai, data, total_debit: totalDebit, total_kredit: totalKredit, seimbang: keSen(totalDebit) === keSen(totalKredit) };
}

// LAP-11 Neraca saldo
router.get('/laporan/neraca-saldo', perlu(...PERAN_LAPORAN), async (req, res) => {
  res.json(await neracaSaldo(pool, tglValid(req.query.sampai) ? req.query.sampai : hariIni()));
});

// LAP-12 Pengeluaran per departemen dan akun
router.get('/laporan/pengeluaran-departemen', perlu(...PERAN_LAPORAN), async (req, res) => {
  const { dari, sampai } = rentang(req.query);
  const rows = await semua(
    pool,
    `SELECT COALESCE(dp.kode, '-') AS departemen_kode, COALESCE(dp.nama, 'Tanpa departemen') AS departemen_nama, a.kode AS akun_kode, a.nama AS akun_nama,
            SUM(d.debit - d.kredit) AS jumlah
       FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id JOIN akun a ON a.id = d.akun_id LEFT JOIN departemen dp ON dp.id = d.departemen_id
      WHERE a.kategori = 'BEBAN' AND j.tanggal BETWEEN ? AND ?
      GROUP BY dp.id, a.id HAVING jumlah <> 0 ORDER BY departemen_kode, a.kode`,
    [dari, sampai],
  );
  const perDept = new Map();
  for (const r of rows) perDept.set(r.departemen_nama, (perDept.get(r.departemen_nama) || 0) + keSen(r.jumlah));
  res.json({
    dari,
    sampai,
    data: rows,
    per_departemen: [...perDept.entries()].map(([departemen_nama, v]) => ({ departemen_nama, jumlah: dariSen(v) })).sort((a, b) => b.jumlah - a.jumlah),
    total: jumlahSen(rows, 'jumlah'),
  });
});

// LAP-13 Laporan pengecualian untuk Audit Internal
router.get('/laporan/pengecualian', perlu('AUDITOR', 'MANAJER_KEUANGAN', 'DIREKTUR', 'SPV_AKUNTANSI'), async (req, res) => {
  const { dari, sampai } = rentang(req.query);
  const antara = [`${dari} 00:00:00`, `${sampai} 23:59:59`];
  const selisihDisetujui = await semua(
    pool,
    `SELECT f.id, f.nomor, f.nomor_faktur, p.nama AS pemasok_nama, f.total_tagihan, f.catatan_selisih, u.nama_lengkap AS disetujui_oleh, ps.diputuskan_pada, ps.catatan
       FROM persetujuan ps JOIN faktur_pemasok f ON f.id = ps.dokumen_id JOIN pemasok p ON p.id = f.pemasok_id JOIN pengguna u ON u.id = ps.diputuskan_oleh
      WHERE ps.jenis_dokumen = 'FB' AND ps.status = 'DISETUJUI' AND ps.diputuskan_pada BETWEEN ? AND ? ORDER BY ps.diputuskan_pada`,
    antara,
  );
  const pembayaranBatal = await semua(
    pool,
    `SELECT p.nomor, p.tanggal, p.metode, COALESCE(p.nomor_warkat, p.nomor_referensi) AS bukti, p.penerima_nama, p.jumlah, p.alasan_batal, p.dibatalkan_pada,
            u.nama_lengkap AS dibatalkan_oleh, b.nomor AS bkk_nomor
       FROM pembayaran p JOIN pengguna u ON u.id = p.dibatalkan_oleh JOIN bukti_kas_keluar b ON b.id = p.bkk_id
      WHERE p.status = 'BATAL' AND p.dibatalkan_pada BETWEEN ? AND ? ORDER BY p.dibatalkan_pada`,
    antara,
  );
  const warkatBatal = await semua(
    pool,
    `SELECT w.nomor, bc.jenis, r.kode AS rekening_kode, w.keterangan, w.dibatalkan_pada, u.nama_lengkap AS dibatalkan_oleh
       FROM warkat w JOIN buku_cek bc ON bc.id = w.buku_cek_id JOIN rekening_kas r ON r.id = bc.rekening_kas_id LEFT JOIN pengguna u ON u.id = w.dibatalkan_oleh
      WHERE w.status = 'BATAL' AND w.pembayaran_id IS NULL AND w.dibatalkan_pada BETWEEN ? AND ? ORDER BY w.dibatalkan_pada`,
    antara,
  );
  const ditolak = await semua(
    pool,
    `SELECT ps.jenis_dokumen, ps.nomor_dokumen, ps.nilai, ps.nama_langkah, ps.catatan, ps.diputuskan_pada, u.nama_lengkap AS ditolak_oleh, pb.nama_lengkap AS pembuat
       FROM persetujuan ps JOIN pengguna u ON u.id = ps.diputuskan_oleh JOIN pengguna pb ON pb.id = ps.pembuat_id
      WHERE ps.status = 'DITOLAK' AND ps.diputuskan_pada BETWEEN ? AND ? ORDER BY ps.diputuskan_pada`,
    antara,
  );
  const bayarTerlambat = await semua(
    pool,
    `SELECT f.nomor, f.nomor_faktur, pm.nama AS pemasok_nama, f.tanggal_jatuh_tempo, p.tanggal AS tanggal_bayar, DATEDIFF(p.tanggal, f.tanggal_jatuh_tempo) AS hari_terlambat,
            d.jumlah, p.nomor AS pembayaran_nomor
       FROM pembayaran p JOIN bukti_kas_keluar b ON b.id = p.bkk_id JOIN bukti_kas_keluar_detail d ON d.bkk_id = b.id
       JOIN faktur_pemasok f ON f.id = d.faktur_id JOIN pemasok pm ON pm.id = f.pemasok_id
      WHERE p.status = 'DIBAYAR' AND p.tanggal BETWEEN ? AND ? AND p.tanggal > f.tanggal_jatuh_tempo ORDER BY hari_terlambat DESC`,
    [dari, sampai],
  );
  const logPenting = await semua(
    pool,
    `SELECT l.waktu, l.username, l.ip, l.aksi, l.entitas, l.entitas_id, l.ringkasan
       FROM log_audit l WHERE l.aksi IN ('UBAH_REKENING','VERIFIKASI_REKENING','BUKA_PERIODE','KUNCI_AKUN','RESET_SANDI')
        AND l.waktu BETWEEN ? AND ? ORDER BY l.waktu`,
    antara,
  );
  const perubahanAturan = await semua(
    pool,
    `SELECT l.waktu, l.username, l.aksi, l.ringkasan FROM log_audit l
      WHERE l.entitas IN ('aturan_persetujuan','pengaturan') AND l.waktu BETWEEN ? AND ? ORDER BY l.waktu`,
    antara,
  );
  const opnameSelisih = await semua(
    pool,
    `SELECT o.nomor, o.waktu_opname, d.nama AS dana_nama, o.saldo_seharusnya, o.total_fisik, o.selisih, u.nama_lengkap AS pemeriksa
       FROM opname_kas_kecil o JOIN dana_kas_kecil d ON d.id = o.dana_id JOIN pengguna u ON u.id = o.dibuat_oleh
      WHERE o.status = 'FINAL' AND o.selisih <> 0 AND o.waktu_opname BETWEEN ? AND ? ORDER BY o.waktu_opname`,
    antara,
  );
  res.json({
    dari,
    sampai,
    selisih_disetujui: selisihDisetujui,
    pembayaran_batal: pembayaranBatal,
    warkat_batal: warkatBatal,
    dokumen_ditolak: ditolak,
    bayar_terlambat: bayarTerlambat,
    log_penting: logPenting,
    perubahan_aturan: perubahanAturan,
    opname_selisih: opnameSelisih,
  });
});
