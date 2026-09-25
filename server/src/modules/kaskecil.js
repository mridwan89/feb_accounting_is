import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatKonflik, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, teks, teksOpsional, tanggal } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu, punya, bolehLihatPermintaan, saringPermintaan, PERAN_KEUANGAN } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { jumlahkan, keSen, dariSen } from '../lib/uang.js';
import { hariIni } from '../lib/tanggal.js';
import { daftarkanDokumen, kunciBaris, pastikanStatus, pastikanPembuat, jumlahLampiran } from '../lib/dokumen.js';
import { batalkanPersetujuan, riwayatPersetujuan, bolehMemutuskan } from '../lib/persetujuan.js';
import { ajukanDokumen } from '../lib/alur.js';
import { periksaAkunPembebanan } from '../lib/akun.js';
import { posisiDana } from './master.js';

export const router = Router();

const PECAHAN_KERTAS = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const PECAHAN_LOGAM = [1000, 500, 200, 100];

async function danaDipegang(db, userId) {
  return (await semua(db, 'SELECT id FROM dana_kas_kecil WHERE pemegang_id = ?', [userId])).map((r) => r.id);
}

async function bolehLihatPKK(db, user, doc) {
  if (bolehLihatPermintaan(user, doc)) return true;
  return (await danaDipegang(db, user.id)).includes(doc.dana_id);
}

daftarkanDokumen('PKK', {
  tabel: 'pengeluaran_kas_kecil',
  label: 'Pengeluaran kas kecil',
  statusMenunggu: 'DIAJUKAN',
  bolehLihat: bolehLihatPKK,
  onDisetujui: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE pengeluaran_kas_kecil SET status = 'DISETUJUI' WHERE id = ?", [doc.id]);
  },
  onDitolak: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE pengeluaran_kas_kecil SET status = 'DITOLAK' WHERE id = ?", [doc.id]);
  },
});

daftarkanDokumen('PDK', {
  tabel: 'pengisian_kas_kecil',
  label: 'Pengisian kembali kas kecil',
  bolehLihat: async (db, user, doc) => punya(user, PERAN_KEUANGAN) || (await danaDipegang(db, user.id)).includes(doc.dana_id),
});

daftarkanDokumen('OPN', {
  tabel: 'opname_kas_kecil',
  label: 'Opname kas kecil',
  bolehLihat: async (db, user, doc) =>
    punya(user, 'AUDITOR', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN') || (await danaDipegang(db, user.id)).includes(doc.dana_id),
});

async function ambilDanaAktif(conn, danaId, kunci = false) {
  const d = await satu(conn, `SELECT * FROM dana_kas_kecil WHERE id = ? ${kunci ? 'FOR UPDATE' : ''}`, [danaId]);
  if (!d || !d.aktif) throw galatMasukan('Dana kas kecil tidak aktif.', { dana_id: 'Pilih dana kas kecil yang aktif.' });
  if (keSen(d.jumlah_dana) <= 0) throw galatMasukan(`Dana ${d.nama} belum dibentuk; belum ada uang tunai yang dapat dipakai.`, { dana_id: 'Dana belum dibentuk.' });
  return d;
}

function periksaBatas(dana, jumlah) {
  if (keSen(jumlah) > keSen(dana.batas_transaksi)) {
    throw galatMasukan(`Jumlah melebihi batas kas kecil per transaksi (Rp${Number(dana.batas_transaksi).toLocaleString('id-ID')}). Ajukan melalui permintaan pembayaran.`, {
      jumlah: 'Melebihi batas per transaksi.',
    });
  }
}

// ---------------------------------------------------------------- pengeluaran kas kecil (PKK)

const skemaPKK = z.object({
  tanggal: tanggal(),
  dana_id: id(),
  keperluan: teks(500),
  akun_id: id(),
  jumlah: z.coerce.number().positive(),
});

export async function buatPKK(conn, ctx, input) {
  const data = validasi(skemaPKK, { tanggal: hariIni(), ...input });
  const dana = await ambilDanaAktif(conn, data.dana_id);
  periksaBatas(dana, data.jumlah);
  await periksaAkunPembebanan(conn, [data], 'akun_id', null);
  const nomor = await nomorBaru(conn, 'PKK', data.tanggal);
  const r = await jalankan(
    conn,
    'INSERT INTO pengeluaran_kas_kecil (nomor, tanggal, dana_id, departemen_id, keperluan, akun_id, jumlah, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [nomor, data.tanggal, dana.id, ctx.user.departemen_id, data.keperluan, data.akun_id, data.jumlah, ctx.user.id],
  );
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'pengeluaran_kas_kecil', entitasId: r.insertId, ringkasan: `PKK ${nomor} ${data.jumlah}: ${data.keperluan}`, sesudah: data });
  return { id: r.insertId, nomor };
}

export async function ubahPKK(conn, ctx, pkkId, input) {
  const k = await kunciBaris(conn, 'pengeluaran_kas_kecil', pkkId, 'Pengeluaran kas kecil');
  pastikanPembuat(ctx, k);
  pastikanStatus(k, ['DRAFT', 'DITOLAK'], 'diubah');
  const data = validasi(skemaPKK, input);
  const dana = await ambilDanaAktif(conn, data.dana_id);
  periksaBatas(dana, data.jumlah);
  await periksaAkunPembebanan(conn, [data], 'akun_id', null);
  await jalankan(conn, 'UPDATE pengeluaran_kas_kecil SET tanggal = ?, dana_id = ?, keperluan = ?, akun_id = ?, jumlah = ? WHERE id = ?', [
    data.tanggal, data.dana_id, data.keperluan, data.akun_id, data.jumlah, pkkId,
  ]);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'pengeluaran_kas_kecil', entitasId: pkkId, ringkasan: `PKK ${k.nomor} diubah`, sebelum: k, sesudah: data });
}

export async function ajukanPKK(conn, ctx, pkkId) {
  const k = await kunciBaris(conn, 'pengeluaran_kas_kecil', pkkId, 'Pengeluaran kas kecil');
  pastikanPembuat(ctx, k);
  pastikanStatus(k, ['DRAFT', 'DITOLAK'], 'diajukan');
  const dana = await ambilDanaAktif(conn, k.dana_id);
  periksaBatas(dana, k.jumlah);
  const h = await ajukanDokumen(conn, ctx, { jenis: 'PKK', doc: k, nilai: k.jumlah, ringkasan: `${k.keperluan} (${dana.nama})`, departemenId: k.departemen_id });
  await catatAudit(conn, ctx, { aksi: 'AJUKAN', entitas: 'pengeluaran_kas_kecil', entitasId: pkkId, ringkasan: `PKK ${k.nomor} diajukan` });
  return h;
}

const skemaBayarPKK = z.object({ tanggal_bayar: tanggal(), nomor_bukti: teks(50) });

export async function bayarPKK(conn, ctx, pkkId, input) {
  const data = validasi(skemaBayarPKK, { tanggal_bayar: hariIni(), ...input });
  const k = await kunciBaris(conn, 'pengeluaran_kas_kecil', pkkId, 'Pengeluaran kas kecil');
  pastikanStatus(k, ['DISETUJUI'], 'dibayar');
  const dana = await ambilDanaAktif(conn, k.dana_id, true);
  if (dana.pemegang_id !== ctx.user.id) throw galatAkses('Hanya pemegang dana ini yang dapat membayar pengeluarannya.');
  if (data.tanggal_bayar < k.tanggal) throw galatMasukan('Tanggal bayar tidak boleh sebelum tanggal permintaan.', { tanggal_bayar: 'Tidak boleh sebelum tanggal permintaan.' });
  periksaBatas(dana, k.jumlah);
  const pos = await posisiDana(conn, dana.id);
  if (keSen(k.jumlah) > keSen(pos.saldo_tunai)) {
    throw galatKonflik(`Saldo tunai dana ${dana.nama} tinggal Rp${Number(pos.saldo_tunai).toLocaleString('id-ID')}, tidak cukup untuk membayar Rp${Number(k.jumlah).toLocaleString('id-ID')}. Ajukan pengisian kembali terlebih dahulu.`);
  }
  await jalankan(
    conn,
    "UPDATE pengeluaran_kas_kecil SET status = 'DIBAYAR', tanggal_bayar = ?, nomor_bukti = ?, dibayar_oleh = ?, dibayar_pada = NOW() WHERE id = ?",
    [data.tanggal_bayar, data.nomor_bukti, ctx.user.id, pkkId],
  );
  await catatAudit(conn, ctx, { aksi: 'BAYAR', entitas: 'pengeluaran_kas_kecil', entitasId: pkkId, ringkasan: `PKK ${k.nomor} dibayar tunai ${k.jumlah}, bukti ${data.nomor_bukti}` });
}

export async function batalPKK(conn, ctx, pkkId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const k = await kunciBaris(conn, 'pengeluaran_kas_kecil', pkkId, 'Pengeluaran kas kecil');
  pastikanPembuat(ctx, k);
  pastikanStatus(k, ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'], 'dibatalkan');
  await batalkanPersetujuan(conn, 'PKK', pkkId);
  await jalankan(conn, "UPDATE pengeluaran_kas_kecil SET status = 'BATAL', alasan_batal = ? WHERE id = ?", [alasan.trim().slice(0, 255), pkkId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'pengeluaran_kas_kecil', entitasId: pkkId, ringkasan: `PKK ${k.nomor} dibatalkan: ${alasan}` });
}

const PKK_SELECT = `SELECT d.*, dn.nama AS dana_nama, dn.kode AS dana_kode, dn.pemegang_id, pg.nama_lengkap AS pemegang_nama,
    dp.nama AS departemen_nama, u.nama_lengkap AS dibuat_nama, a.kode AS akun_kode, a.nama AS akun_nama, pi.nomor AS pengisian_nomor
  FROM pengeluaran_kas_kecil d JOIN dana_kas_kecil dn ON dn.id = d.dana_id JOIN pengguna pg ON pg.id = dn.pemegang_id
  JOIN departemen dp ON dp.id = d.departemen_id JOIN pengguna u ON u.id = d.dibuat_oleh JOIN akun a ON a.id = d.akun_id
  LEFT JOIN pengisian_kas_kecil pi ON pi.id = d.pengisian_id`;

router.get('/pkk', async (req, res) => {
  const q = req.query;
  const saring = saringPermintaan(req.user, 'd');
  const syarat = [`(${saring.sql} OR dn.pemegang_id = ?)`];
  const params = [...saring.params, req.user.id];
  if (q.saya === '1') { syarat.push('d.dibuat_oleh = ?'); params.push(req.user.id); }
  if (q.dana_id) { syarat.push('d.dana_id = ?'); params.push(Number(q.dana_id)); }
  if (q.status) { syarat.push('d.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.belum_diganti === '1') syarat.push("d.status = 'DIBAYAR' AND d.pengisian_id IS NULL");
  if (q.dari) { syarat.push('d.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('d.tanggal <= ?'); params.push(q.sampai); }
  if (q.cari) { syarat.push('(d.nomor LIKE ? OR d.keperluan LIKE ? OR d.nomor_bukti LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  res.json(await semua(pool, `${PKK_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY d.tanggal DESC, d.id DESC LIMIT 500`, params));
});

router.get('/pkk/:id', async (req, res) => {
  const k = await satu(pool, `${PKK_SELECT} WHERE d.id = ?`, [req.params.id]);
  if (!k) throw galatTidakAda('Pengeluaran kas kecil tidak ditemukan.');
  if (!(await bolehLihatPKK(pool, req.user, k))) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  res.json({
    ...k,
    persetujuan: await riwayatPersetujuan(pool, 'PKK', k.id),
    boleh_memutuskan: await bolehMemutuskan(pool, req.user, 'PKK', k.id),
    jumlah_lampiran: await jumlahLampiran(pool, 'PKK', k.id),
  });
});

router.post('/pkk', perlu('PEMOHON'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatPKK(conn, req.ctx, req.body)));
});
router.put('/pkk/:id', perlu('PEMOHON'), async (req, res) => {
  await tx((conn) => ubahPKK(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/pkk/:id/ajukan', perlu('PEMOHON'), async (req, res) => {
  res.json(await tx((conn) => ajukanPKK(conn, req.ctx, Number(req.params.id))));
});
router.post('/pkk/:id/bayar', perlu('KAS_KECIL'), async (req, res) => {
  await tx((conn) => bayarPKK(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/pkk/:id/batal', perlu('PEMOHON'), async (req, res) => {
  await tx((conn) => batalPKK(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- pengisian kembali (PDK)

const skemaPDK = z.object({
  dana_id: id(),
  tanggal: tanggal(),
  keterangan: teksOpsional(500),
  pkk_ids: z.array(id()).min(1, 'Pilih minimal satu bukti pengeluaran.'),
});

async function pasangBuktiPDK(conn, pdkId, dana, pkkIds) {
  await jalankan(conn, "UPDATE pengeluaran_kas_kecil SET pengisian_id = NULL WHERE pengisian_id = ? AND status = 'DIBAYAR'", [pdkId]);
  const bukti = await semua(conn, 'SELECT * FROM pengeluaran_kas_kecil WHERE id IN (?) FOR UPDATE', [pkkIds]);
  if (bukti.length !== new Set(pkkIds).size) throw galatMasukan('Ada bukti pengeluaran yang tidak ditemukan.');
  for (const b of bukti) {
    if (b.dana_id !== dana.id) throw galatMasukan(`Bukti ${b.nomor} bukan milik dana ${dana.nama}.`);
    if (b.status !== 'DIBAYAR') throw galatMasukan(`Bukti ${b.nomor} belum dibayar atau sudah diganti.`);
    if (b.pengisian_id && b.pengisian_id !== pdkId) throw galatKonflik(`Bukti ${b.nomor} sudah masuk pengisian lain.`);
  }
  await jalankan(conn, 'UPDATE pengeluaran_kas_kecil SET pengisian_id = ? WHERE id IN (?)', [pdkId, pkkIds]);
  const total = jumlahkan(bukti, (b) => b.jumlah);
  await jalankan(conn, 'UPDATE pengisian_kas_kecil SET total = ? WHERE id = ?', [total, pdkId]);
  return total;
}

export async function buatPDK(conn, ctx, input) {
  const data = validasi(skemaPDK, { tanggal: hariIni(), ...input });
  const dana = await ambilDanaAktif(conn, data.dana_id, true);
  if (dana.pemegang_id !== ctx.user.id) throw galatAkses('Pengisian kembali hanya diajukan oleh pemegang dana.');
  const nomor = await nomorBaru(conn, 'PDK', data.tanggal);
  const r = await jalankan(conn, 'INSERT INTO pengisian_kas_kecil (nomor, tanggal, dana_id, keterangan, dibuat_oleh) VALUES (?, ?, ?, ?, ?)', [
    nomor, data.tanggal, dana.id, data.keterangan, ctx.user.id,
  ]);
  const total = await pasangBuktiPDK(conn, r.insertId, dana, data.pkk_ids);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'pengisian_kas_kecil', entitasId: r.insertId, ringkasan: `PDK ${nomor} ${dana.nama} sebesar ${total} dari ${data.pkk_ids.length} bukti`, sesudah: data });
  return { id: r.insertId, nomor, total };
}

export async function ubahPDK(conn, ctx, pdkId, input) {
  const p = await kunciBaris(conn, 'pengisian_kas_kecil', pdkId, 'Pengisian kas kecil');
  pastikanPembuat(ctx, p);
  pastikanStatus(p, ['DRAFT', 'DITOLAK'], 'diubah');
  const data = validasi(skemaPDK, { ...input, dana_id: p.dana_id });
  const dana = await ambilDanaAktif(conn, p.dana_id, true);
  await jalankan(conn, "UPDATE pengisian_kas_kecil SET tanggal = ?, keterangan = ?, status = 'DRAFT', catatan_tolak = NULL WHERE id = ?", [data.tanggal, data.keterangan, pdkId]);
  await pasangBuktiPDK(conn, pdkId, dana, data.pkk_ids);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'pengisian_kas_kecil', entitasId: pdkId, ringkasan: `PDK ${p.nomor} diubah`, sesudah: data });
}

export async function ajukanPDK(conn, ctx, pdkId) {
  const p = await kunciBaris(conn, 'pengisian_kas_kecil', pdkId, 'Pengisian kas kecil');
  pastikanPembuat(ctx, p);
  pastikanStatus(p, ['DRAFT', 'DITOLAK'], 'diajukan');
  if (keSen(p.total) <= 0) throw galatMasukan('Pengisian belum memuat bukti pengeluaran.');
  await jalankan(conn, "UPDATE pengisian_kas_kecil SET status = 'DIAJUKAN', catatan_tolak = NULL WHERE id = ?", [pdkId]);
  await catatAudit(conn, ctx, { aksi: 'AJUKAN', entitas: 'pengisian_kas_kecil', entitasId: pdkId, ringkasan: `PDK ${p.nomor} diajukan ke Akuntansi` });
}

export async function tolakPDK(conn, ctx, pdkId, catatan) {
  if (!catatan?.trim()) throw galatMasukan('Alasan penolakan wajib diisi.', { catatan: 'Wajib diisi.' });
  const p = await kunciBaris(conn, 'pengisian_kas_kecil', pdkId, 'Pengisian kas kecil');
  pastikanStatus(p, ['DIAJUKAN'], 'ditolak');
  await jalankan(conn, "UPDATE pengisian_kas_kecil SET status = 'DITOLAK', catatan_tolak = ? WHERE id = ?", [catatan.trim().slice(0, 500), pdkId]);
  await catatAudit(conn, ctx, { aksi: 'TOLAK', entitas: 'pengisian_kas_kecil', entitasId: pdkId, ringkasan: `PDK ${p.nomor} ditolak: ${catatan}` });
}

export async function batalPDK(conn, ctx, pdkId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const p = await kunciBaris(conn, 'pengisian_kas_kecil', pdkId, 'Pengisian kas kecil');
  pastikanPembuat(ctx, p);
  pastikanStatus(p, ['DRAFT', 'DITOLAK', 'DIAJUKAN'], 'dibatalkan');
  await jalankan(conn, "UPDATE pengeluaran_kas_kecil SET pengisian_id = NULL WHERE pengisian_id = ? AND status = 'DIBAYAR'", [pdkId]);
  await jalankan(conn, "UPDATE pengisian_kas_kecil SET status = 'BATAL', alasan_batal = ? WHERE id = ?", [alasan.trim().slice(0, 255), pdkId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'pengisian_kas_kecil', entitasId: pdkId, ringkasan: `PDK ${p.nomor} dibatalkan: ${alasan}` });
}

const PDK_SELECT = `SELECT p.*, dn.nama AS dana_nama, dn.kode AS dana_kode, dn.jumlah_dana, dn.pemegang_id, u.nama_lengkap AS dibuat_nama,
    b.nomor AS bkk_nomor, b.status AS bkk_status
  FROM pengisian_kas_kecil p JOIN dana_kas_kecil dn ON dn.id = p.dana_id JOIN pengguna u ON u.id = p.dibuat_oleh
  LEFT JOIN bukti_kas_keluar b ON b.id = p.bkk_id`;

router.get('/pdk', async (req, res) => {
  const q = req.query;
  const syarat = [];
  const params = [];
  if (!punya(req.user, PERAN_KEUANGAN)) { syarat.push('dn.pemegang_id = ?'); params.push(req.user.id); }
  if (q.status) { syarat.push('p.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.dana_id) { syarat.push('p.dana_id = ?'); params.push(Number(q.dana_id)); }
  res.json(await semua(pool, `${PDK_SELECT} ${syarat.length ? `WHERE ${syarat.join(' AND ')}` : ''} ORDER BY p.tanggal DESC, p.id DESC LIMIT 500`, params));
});

export async function detailPDK(db, user, pdkId) {
  const p = await satu(db, `${PDK_SELECT} WHERE p.id = ?`, [pdkId]);
  if (!p) throw galatTidakAda('Pengisian kas kecil tidak ditemukan.');
  if (!punya(user, PERAN_KEUANGAN) && p.pemegang_id !== user.id) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  const bukti = await semua(db, `${PKK_SELECT} WHERE d.pengisian_id = ? ORDER BY d.tanggal_bayar, d.id`, [pdkId]);
  const rekap = await semua(
    db,
    `SELECT d.akun_id, a.kode AS akun_kode, a.nama AS akun_nama, d.departemen_id, dp.nama AS departemen_nama, SUM(d.jumlah) AS jumlah, COUNT(*) AS jumlah_bukti
       FROM pengeluaran_kas_kecil d JOIN akun a ON a.id = d.akun_id JOIN departemen dp ON dp.id = d.departemen_id
      WHERE d.pengisian_id = ? GROUP BY d.akun_id, d.departemen_id ORDER BY a.kode, dp.nama`,
    [pdkId],
  );
  return { ...p, bukti, rekap, posisi: await posisiDana(db, p.dana_id) };
}

router.get('/pdk/:id', async (req, res) => {
  res.json(await detailPDK(pool, req.user, Number(req.params.id)));
});
router.post('/pdk', perlu('KAS_KECIL'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatPDK(conn, req.ctx, req.body)));
});
router.put('/pdk/:id', perlu('KAS_KECIL'), async (req, res) => {
  await tx((conn) => ubahPDK(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/pdk/:id/ajukan', perlu('KAS_KECIL'), async (req, res) => {
  await tx((conn) => ajukanPDK(conn, req.ctx, Number(req.params.id)));
  res.json({ ok: true });
});
router.post('/pdk/:id/tolak', perlu('STAF_KEUANGAN'), async (req, res) => {
  await tx((conn) => tolakPDK(conn, req.ctx, Number(req.params.id), req.body?.catatan));
  res.json({ ok: true });
});
router.post('/pdk/:id/batal', perlu('KAS_KECIL'), async (req, res) => {
  await tx((conn) => batalPDK(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- opname kas kecil

const angkaLembar = z.coerce.number().int().min(0).max(100000);
const skemaOpname = z.object({
  dana_id: id(),
  waktu_opname: z.preprocess((v) => v || null, z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/, 'Format waktu TTTT-BB-HH JJ:MM.').nullable()),
  rincian: z.object({
    kertas: z.record(z.string(), angkaLembar).default({}),
    logam: z.record(z.string(), angkaLembar).default({}),
  }),
  keterangan: teksOpsional(500),
});

export async function hitungOpname(db, danaId, rincian) {
  const pos = await posisiDana(db, danaId);
  const baris = [];
  let fisikSen = 0;
  for (const [jenis, daftar] of [['kertas', PECAHAN_KERTAS], ['logam', PECAHAN_LOGAM]]) {
    for (const nilai of daftar) {
      const lembar = Number(rincian?.[jenis]?.[String(nilai)] || 0);
      fisikSen += nilai * lembar * 100;
      baris.push({ jenis, nilai, lembar, jumlah: nilai * lembar });
    }
  }
  const fisik = dariSen(fisikSen);
  return {
    jumlah_dana: pos.jumlah_dana,
    bukti_belum_diganti: pos.bukti_belum_diganti,
    saldo_seharusnya: pos.saldo_tunai,
    total_fisik: fisik,
    selisih: dariSen(fisikSen - keSen(pos.saldo_tunai)),
    rincian: { kertas: rincian?.kertas || {}, logam: rincian?.logam || {}, baris },
  };
}

async function periksaPemeriksa(conn, ctx, danaId) {
  const dana = await satu(conn, 'SELECT * FROM dana_kas_kecil WHERE id = ?', [danaId]);
  if (!dana) throw galatTidakAda('Dana kas kecil tidak ditemukan.');
  if (dana.pemegang_id === ctx.user.id) throw galatAkses('Pemegang dana tidak boleh mengopname dananya sendiri.');
  return dana;
}

export async function buatOpname(conn, ctx, input) {
  const data = validasi(skemaOpname, input);
  const dana = await periksaPemeriksa(conn, ctx, data.dana_id);
  const h = await hitungOpname(conn, dana.id, data.rincian);
  const waktu = data.waktu_opname ? data.waktu_opname.replace('T', ' ') : null;
  const nomor = await nomorBaru(conn, 'OPN', waktu ? waktu.slice(0, 10) : hariIni());
  const r = await jalankan(
    conn,
    `INSERT INTO opname_kas_kecil (nomor, dana_id, waktu_opname, jumlah_dana, bukti_belum_diganti, saldo_seharusnya, total_fisik, selisih, rincian, keterangan, dibuat_oleh)
     VALUES (?, ?, COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, dana.id, waktu, h.jumlah_dana, h.bukti_belum_diganti, h.saldo_seharusnya, h.total_fisik, h.selisih, JSON.stringify(h.rincian), data.keterangan, ctx.user.id],
  );
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'opname_kas_kecil', entitasId: r.insertId, ringkasan: `Opname ${nomor} ${dana.nama}: fisik ${h.total_fisik}, selisih ${h.selisih}` });
  return { id: r.insertId, nomor, ...h };
}

export async function ubahOpname(conn, ctx, opnId, input, finalkan = false) {
  const o = await kunciBaris(conn, 'opname_kas_kecil', opnId, 'Opname');
  pastikanPembuat(ctx, o);
  pastikanStatus(o, ['DRAFT'], finalkan ? 'difinalkan' : 'diubah');
  const rincianLama = typeof o.rincian === 'string' ? JSON.parse(o.rincian) : o.rincian;
  const data = input ? validasi(skemaOpname, { ...input, dana_id: o.dana_id }) : { rincian: rincianLama, keterangan: o.keterangan };
  const h = await hitungOpname(conn, o.dana_id, data.rincian);
  await jalankan(
    conn,
    `UPDATE opname_kas_kecil SET jumlah_dana = ?, bukti_belum_diganti = ?, saldo_seharusnya = ?, total_fisik = ?, selisih = ?, rincian = ?, keterangan = ?
       ${finalkan ? ", status = 'FINAL', difinalkan_pada = NOW()" : ''} WHERE id = ?`,
    [h.jumlah_dana, h.bukti_belum_diganti, h.saldo_seharusnya, h.total_fisik, h.selisih, JSON.stringify(h.rincian), data.keterangan ?? o.keterangan, opnId],
  );
  await catatAudit(conn, ctx, {
    aksi: finalkan ? 'FINAL' : 'UBAH',
    entitas: 'opname_kas_kecil',
    entitasId: opnId,
    ringkasan: `Opname ${o.nomor} ${finalkan ? 'difinalkan' : 'diubah'}: fisik ${h.total_fisik}, selisih ${h.selisih}`,
  });
  return h;
}

const OPN_SELECT = `SELECT o.*, dn.nama AS dana_nama, dn.kode AS dana_kode, dn.pemegang_id, pg.nama_lengkap AS pemegang_nama,
    u.nama_lengkap AS dibuat_nama, u.jabatan AS dibuat_jabatan
  FROM opname_kas_kecil o JOIN dana_kas_kecil dn ON dn.id = o.dana_id JOIN pengguna pg ON pg.id = dn.pemegang_id JOIN pengguna u ON u.id = o.dibuat_oleh`;

router.get('/opname', async (req, res) => {
  const syarat = [];
  const params = [];
  if (!punya(req.user, 'AUDITOR', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN')) { syarat.push('dn.pemegang_id = ?'); params.push(req.user.id); }
  if (req.query.dana_id) { syarat.push('o.dana_id = ?'); params.push(Number(req.query.dana_id)); }
  res.json(await semua(pool, `${OPN_SELECT} ${syarat.length ? `WHERE ${syarat.join(' AND ')}` : ''} ORDER BY o.waktu_opname DESC LIMIT 500`, params));
});

router.get('/opname/pratinjau', perlu('AUDITOR', 'KASUBAG_KEUANGAN'), async (req, res) => {
  res.json(await hitungOpname(pool, Number(req.query.dana_id), {}));
});

router.get('/opname/:id', async (req, res) => {
  const o = await satu(pool, `${OPN_SELECT} WHERE o.id = ?`, [req.params.id]);
  if (!o) throw galatTidakAda('Opname tidak ditemukan.');
  if (!punya(req.user, 'AUDITOR', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN') && o.pemegang_id !== req.user.id) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  res.json({ ...o, rincian: typeof o.rincian === 'string' ? JSON.parse(o.rincian) : o.rincian });
});

router.post('/opname', perlu('AUDITOR', 'KASUBAG_KEUANGAN'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatOpname(conn, req.ctx, req.body)));
});
router.put('/opname/:id', perlu('AUDITOR', 'KASUBAG_KEUANGAN'), async (req, res) => {
  res.json(await tx((conn) => ubahOpname(conn, req.ctx, Number(req.params.id), req.body)));
});
router.post('/opname/:id/final', perlu('AUDITOR', 'KASUBAG_KEUANGAN'), async (req, res) => {
  res.json(await tx((conn) => ubahOpname(conn, req.ctx, Number(req.params.id), null, true)));
});

export { PECAHAN_KERTAS, PECAHAN_LOGAM };
