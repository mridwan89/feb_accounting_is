import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, idOpsional, teks, teksOpsional, tanggal } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu, punya } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { keSen, dariSen } from '../lib/uang.js';
import { hariIni } from '../lib/tanggal.js';
import { daftarkanDokumen, kunciBaris, pastikanStatus, pastikanPembuat, jumlahLampiran } from '../lib/dokumen.js';
import { batalkanPersetujuan, riwayatPersetujuan, bolehMemutuskan } from '../lib/persetujuan.js';
import { ajukanDokumen } from '../lib/alur.js';
import { postingJurnal } from '../lib/jurnal.js';
import { akunSistem } from '../lib/pengaturan.js';

export const router = Router();

const PERAN_LIHAT = ['STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR'];

daftarkanDokumen('JM', {
  tabel: 'jurnal_manual',
  label: 'Bukti memorial',
  statusMenunggu: 'DIAJUKAN',
  bolehLihat: async (_db, user) => punya(user, PERAN_LIHAT),
  onDisetujui: async (conn, ctx, doc) => {
    await postingJurnalManual(conn, ctx, doc.id);
  },
  onDitolak: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE jurnal_manual SET status = 'DITOLAK' WHERE id = ?", [doc.id]);
  },
});

// ---------------------------------------------------------------- jurnal (baca)

function syaratJurnal(q) {
  const syarat = ['1 = 1'];
  const params = [];
  if (q.dari) { syarat.push('j.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('j.tanggal <= ?'); params.push(q.sampai); }
  if (q.jenis) { syarat.push('j.jenis IN (?)'); params.push(String(q.jenis).split(',')); }
  if (q.akun_id) { syarat.push('EXISTS (SELECT 1 FROM jurnal_detail x WHERE x.jurnal_id = j.id AND x.akun_id = ?)'); params.push(Number(q.akun_id)); }
  if (q.cari) { syarat.push('(j.nomor LIKE ? OR j.keterangan LIKE ? OR j.sumber_nomor LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  return { where: syarat.join(' AND '), params };
}

router.get('/jurnal', perlu(...PERAN_LIHAT), async (req, res) => {
  const { where, params } = syaratJurnal(req.query);
  const perHalaman = Math.min(Number(req.query.per_halaman) || 100, 500);
  const halaman = Math.max(Number(req.query.halaman) || 1, 1);
  const total = await satu(pool, `SELECT COUNT(*) AS n, COALESCE(SUM(j.total), 0) AS nilai FROM jurnal j WHERE ${where}`, params);
  const rows = await semua(
    pool,
    `SELECT j.*, u.nama_lengkap AS dibuat_nama, jb.nomor AS dibalik_oleh_nomor, jp.nomor AS pembalik_dari_nomor
       FROM jurnal j JOIN pengguna u ON u.id = j.dibuat_oleh
       LEFT JOIN jurnal jb ON jb.id = j.dibalik_oleh_id LEFT JOIN jurnal jp ON jp.id = j.pembalik_dari_id
      WHERE ${where} ORDER BY j.tanggal DESC, j.id DESC LIMIT ? OFFSET ?`,
    [...params, perHalaman, (halaman - 1) * perHalaman],
  );
  res.json({ total: total.n, nilai: total.nilai, halaman, per_halaman: perHalaman, data: rows });
});

const kolomCsv = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/jurnal/ekspor', perlu(...PERAN_LIHAT), async (req, res) => {
  const { where, params } = syaratJurnal(req.query);
  const rows = await semua(
    pool,
    `SELECT j.tanggal, j.nomor, j.jenis, j.sumber_tipe, j.sumber_nomor, j.keterangan, d.baris, a.kode AS akun_kode, a.nama AS akun_nama,
            dp.kode AS departemen, p.kode AS pemasok, d.keterangan AS keterangan_baris, d.debit, d.kredit
       FROM jurnal j JOIN jurnal_detail d ON d.jurnal_id = j.id JOIN akun a ON a.id = d.akun_id
       LEFT JOIN departemen dp ON dp.id = d.departemen_id LEFT JOIN pemasok p ON p.id = d.pemasok_id
      WHERE ${where} ORDER BY j.tanggal, j.id, d.baris`,
    params,
  );
  const kepala = ['tanggal', 'nomor_jurnal', 'jenis', 'sumber', 'nomor_sumber', 'keterangan', 'baris', 'kode_akun', 'nama_akun', 'departemen', 'pemasok', 'keterangan_baris', 'debit', 'kredit'];
  const isi = rows.map((r) =>
    [r.tanggal, r.nomor, r.jenis, r.sumber_tipe, r.sumber_nomor, r.keterangan, r.baris, r.akun_kode, r.akun_nama, r.departemen, r.pemasok, r.keterangan_baris, Number(r.debit).toFixed(2), Number(r.kredit).toFixed(2)]
      .map(kolomCsv)
      .join(','),
  );
  await catatAudit(pool, req.ctx, { aksi: 'EKSPOR', entitas: 'jurnal', ringkasan: `Ekspor ${rows.length} baris jurnal (${req.query.dari || 'awal'} s.d. ${req.query.sampai || 'akhir'})` });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="jurnal_${req.query.dari || 'semua'}_${req.query.sampai || 'semua'}.csv"`);
  res.send(`\uFEFF${[kepala.join(','), ...isi].join('\r\n')}\r\n`);
});

router.get('/jurnal/:id', perlu(...PERAN_LIHAT), async (req, res) => {
  const j = await satu(
    pool,
    `SELECT j.*, u.nama_lengkap AS dibuat_nama, jb.nomor AS dibalik_oleh_nomor, jp.nomor AS pembalik_dari_nomor
       FROM jurnal j JOIN pengguna u ON u.id = j.dibuat_oleh
       LEFT JOIN jurnal jb ON jb.id = j.dibalik_oleh_id LEFT JOIN jurnal jp ON jp.id = j.pembalik_dari_id WHERE j.id = ?`,
    [req.params.id],
  );
  if (!j) throw galatTidakAda('Jurnal tidak ditemukan.');
  const baris = await semua(
    pool,
    `SELECT d.*, a.kode AS akun_kode, a.nama AS akun_nama, dp.nama AS departemen_nama, p.nama AS pemasok_nama
       FROM jurnal_detail d JOIN akun a ON a.id = d.akun_id LEFT JOIN departemen dp ON dp.id = d.departemen_id
       LEFT JOIN pemasok p ON p.id = d.pemasok_id WHERE d.jurnal_id = ? ORDER BY d.baris`,
    [j.id],
  );
  res.json({ ...j, baris });
});

// ---------------------------------------------------------------- jurnal manual (bukti memorial)

const skemaBarisJM = z.object({
  akun_id: id(),
  departemen_id: idOpsional(),
  pemasok_id: idOpsional(),
  keterangan: teksOpsional(255),
  debit: z.coerce.number().min(0).default(0),
  kredit: z.coerce.number().min(0).default(0),
});
const skemaJM = z.object({
  tanggal: tanggal(),
  jenis: z.enum(['UMUM', 'SALDO_AWAL', 'PENYESUAIAN']),
  keterangan: teks(500),
  baris: z.array(skemaBarisJM).min(2).max(500),
});

async function susunJM(conn, ctx, data) {
  if (data.jenis === 'SALDO_AWAL' && !punya(ctx.user, 'KASUBAG_KEUANGAN')) throw galatAkses('Jurnal saldo awal hanya dibuat Kepala Bagian Akuntansi.');
  const galat = {};
  let debit = 0;
  let kredit = 0;
  const akun = await semua(conn, 'SELECT id, tipe, aktif FROM akun WHERE id IN (?)', [data.baris.map((b) => b.akun_id)]);
  const peta = new Map(akun.map((a) => [a.id, a]));
  const utangUsaha = await akunSistem('akun_utang_usaha', conn);
  data.baris.forEach((b, i) => {
    const d = keSen(b.debit);
    const k = keSen(b.kredit);
    if ((d > 0) === (k > 0)) galat[`baris.${i}.debit`] = 'Isi debit atau kredit (salah satu).';
    const a = peta.get(b.akun_id);
    if (!a || a.tipe !== 'DETAIL' || !a.aktif) galat[`baris.${i}.akun_id`] = 'Pilih akun detail yang aktif.';
    if (b.akun_id === utangUsaha.id && !b.pemasok_id) galat[`baris.${i}.pemasok_id`] = 'Pemasok wajib diisi untuk Utang Usaha.';
    debit += d;
    kredit += k;
  });
  if (Object.keys(galat).length) throw galatMasukan('Periksa kembali baris jurnal yang ditandai.', galat);
  if (debit !== kredit) throw galatMasukan(`Jurnal belum seimbang: debit ${dariSen(debit).toLocaleString('id-ID')} dan kredit ${dariSen(kredit).toLocaleString('id-ID')}.`);
  return dariSen(debit);
}

async function simpanBarisJM(conn, jmId, baris) {
  await jalankan(conn, 'DELETE FROM jurnal_manual_detail WHERE jm_id = ?', [jmId]);
  await jalankan(conn, 'INSERT INTO jurnal_manual_detail (jm_id, baris, akun_id, departemen_id, pemasok_id, keterangan, debit, kredit) VALUES ?', [
    baris.map((b, i) => [jmId, i + 1, b.akun_id, b.departemen_id, b.pemasok_id, b.keterangan, b.debit, b.kredit]),
  ]);
}

export async function buatJM(conn, ctx, input) {
  const data = validasi(skemaJM, { tanggal: hariIni(), jenis: 'UMUM', ...input });
  const total = await susunJM(conn, ctx, data);
  const nomor = await nomorBaru(conn, 'JM', data.tanggal);
  const r = await jalankan(conn, 'INSERT INTO jurnal_manual (nomor, tanggal, jenis, keterangan, total, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?)', [
    nomor, data.tanggal, data.jenis, data.keterangan, total, ctx.user.id,
  ]);
  await simpanBarisJM(conn, r.insertId, data.baris);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'jurnal_manual', entitasId: r.insertId, ringkasan: `Bukti memorial ${nomor} (${data.jenis}) ${total}`, sesudah: data });
  return { id: r.insertId, nomor };
}

export async function ubahJM(conn, ctx, jmId, input) {
  const jm = await kunciBaris(conn, 'jurnal_manual', jmId, 'Bukti memorial');
  pastikanPembuat(ctx, jm);
  pastikanStatus(jm, ['DRAFT', 'DITOLAK'], 'diubah');
  const data = validasi(skemaJM, input);
  const total = await susunJM(conn, ctx, data);
  await jalankan(conn, 'UPDATE jurnal_manual SET tanggal = ?, jenis = ?, keterangan = ?, total = ? WHERE id = ?', [data.tanggal, data.jenis, data.keterangan, total, jmId]);
  await simpanBarisJM(conn, jmId, data.baris);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'jurnal_manual', entitasId: jmId, ringkasan: `Bukti memorial ${jm.nomor} diubah`, sebelum: jm, sesudah: data });
}

export async function ajukanJM(conn, ctx, jmId) {
  const jm = await kunciBaris(conn, 'jurnal_manual', jmId, 'Bukti memorial');
  pastikanPembuat(ctx, jm);
  pastikanStatus(jm, ['DRAFT', 'DITOLAK'], 'diajukan');
  const h = await ajukanDokumen(conn, ctx, { jenis: 'JM', doc: jm, nilai: jm.total, ringkasan: jm.keterangan, departemenId: null });
  await catatAudit(conn, ctx, { aksi: 'AJUKAN', entitas: 'jurnal_manual', entitasId: jmId, ringkasan: `Bukti memorial ${jm.nomor} diajukan` });
  return h;
}

export async function postingJurnalManual(conn, ctx, jmId) {
  const jm = await satu(conn, 'SELECT * FROM jurnal_manual WHERE id = ? FOR UPDATE', [jmId]);
  const baris = await semua(conn, 'SELECT * FROM jurnal_manual_detail WHERE jm_id = ? ORDER BY baris', [jmId]);
  const j = await postingJurnal(conn, ctx, {
    tanggal: jm.tanggal,
    jenis: 'JU',
    sumberTipe: 'JM',
    sumberId: jm.id,
    sumberNomor: jm.nomor,
    keterangan: jm.keterangan,
    baris,
  });
  await jalankan(conn, "UPDATE jurnal_manual SET status = 'DISETUJUI', jurnal_id = ? WHERE id = ?", [j.id, jmId]);
  return j;
}

export async function batalJM(conn, ctx, jmId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const jm = await kunciBaris(conn, 'jurnal_manual', jmId, 'Bukti memorial');
  pastikanPembuat(ctx, jm);
  pastikanStatus(jm, ['DRAFT', 'DITOLAK', 'DIAJUKAN'], 'dibatalkan');
  await batalkanPersetujuan(conn, 'JM', jmId);
  await jalankan(conn, "UPDATE jurnal_manual SET status = 'BATAL', alasan_batal = ? WHERE id = ?", [alasan.trim().slice(0, 255), jmId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'jurnal_manual', entitasId: jmId, ringkasan: `Bukti memorial ${jm.nomor} dibatalkan: ${alasan}` });
}

const JM_SELECT = `SELECT m.*, u.nama_lengkap AS dibuat_nama, j.nomor AS jurnal_nomor FROM jurnal_manual m
  JOIN pengguna u ON u.id = m.dibuat_oleh LEFT JOIN jurnal j ON j.id = m.jurnal_id`;

router.get('/jurnal-manual', perlu(...PERAN_LIHAT), async (req, res) => {
  const q = req.query;
  const syarat = ['1 = 1'];
  const params = [];
  if (q.status) { syarat.push('m.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.dari) { syarat.push('m.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('m.tanggal <= ?'); params.push(q.sampai); }
  res.json(await semua(pool, `${JM_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY m.tanggal DESC, m.id DESC LIMIT 500`, params));
});

router.get('/jurnal-manual/:id', perlu(...PERAN_LIHAT), async (req, res) => {
  const m = await satu(pool, `${JM_SELECT} WHERE m.id = ?`, [req.params.id]);
  if (!m) throw galatTidakAda('Bukti memorial tidak ditemukan.');
  const baris = await semua(
    pool,
    `SELECT d.*, a.kode AS akun_kode, a.nama AS akun_nama, dp.nama AS departemen_nama, p.nama AS pemasok_nama
       FROM jurnal_manual_detail d JOIN akun a ON a.id = d.akun_id LEFT JOIN departemen dp ON dp.id = d.departemen_id
       LEFT JOIN pemasok p ON p.id = d.pemasok_id WHERE d.jm_id = ? ORDER BY d.baris`,
    [m.id],
  );
  res.json({
    ...m,
    baris,
    persetujuan: await riwayatPersetujuan(pool, 'JM', m.id),
    boleh_memutuskan: await bolehMemutuskan(pool, req.user, 'JM', m.id),
    jumlah_lampiran: await jumlahLampiran(pool, 'JM', m.id),
  });
});

router.post('/jurnal-manual', perlu('STAF_KEUANGAN', 'KASUBAG_KEUANGAN'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatJM(conn, req.ctx, req.body)));
});
router.put('/jurnal-manual/:id', perlu('STAF_KEUANGAN', 'KASUBAG_KEUANGAN'), async (req, res) => {
  await tx((conn) => ubahJM(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/jurnal-manual/:id/ajukan', perlu('STAF_KEUANGAN', 'KASUBAG_KEUANGAN'), async (req, res) => {
  res.json(await tx((conn) => ajukanJM(conn, req.ctx, Number(req.params.id))));
});
router.post('/jurnal-manual/:id/batal', perlu('STAF_KEUANGAN', 'KASUBAG_KEUANGAN'), async (req, res) => {
  await tx((conn) => batalJM(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});
