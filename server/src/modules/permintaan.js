import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, idOpsional, teks, teksOpsional, tanggal, tanggalOpsional } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu, bolehLihatPermintaan, saringPermintaan } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { jumlahkan } from '../lib/uang.js';
import { hariIni } from '../lib/tanggal.js';
import { daftarkanDokumen, kunciBaris, pastikanStatus, pastikanPembuat, jumlahLampiran } from '../lib/dokumen.js';
import { batalkanPersetujuan, riwayatPersetujuan, bolehMemutuskan } from '../lib/persetujuan.js';
import { ajukanDokumen } from '../lib/alur.js';
import { angkaPengaturan } from '../lib/pengaturan.js';
import { periksaAkunPembebanan } from '../lib/akun.js';

export const router = Router();

daftarkanDokumen('PP', {
  tabel: 'permintaan_pembayaran',
  label: 'Permintaan pembayaran',
  statusMenunggu: 'DIAJUKAN',
  bolehLihat: async (_db, user, doc) => bolehLihatPermintaan(user, doc),
  onDisetujui: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE permintaan_pembayaran SET status = 'DISETUJUI' WHERE id = ?", [doc.id]);
  },
  onDitolak: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE permintaan_pembayaran SET status = 'DITOLAK' WHERE id = ?", [doc.id]);
  },
});

const skemaPP = z
  .object({
    tanggal: tanggal(),
    tanggal_dibutuhkan: tanggalOpsional(),
    pemasok_id: idOpsional(),
    penerima_nama: teksOpsional(150),
    penerima_bank_nama: teksOpsional(60),
    penerima_bank_rekening: z.preprocess((v) => (v ? String(v).trim() || null : null), z.string().regex(/^[0-9-. ]{5,40}$/, 'Nomor rekening hanya angka.').nullable()),
    penerima_bank_atas_nama: teksOpsional(150),
    keterangan: teks(500),
    dokumen_pendukung: teksOpsional(255),
    baris: z.array(z.object({ uraian: teks(255), akun_id: id(), jumlah: z.coerce.number().positive() })).min(1).max(50),
  })
  .superRefine((d, c) => {
    if (!d.pemasok_id && !d.penerima_nama) c.addIssue({ code: 'custom', path: ['penerima_nama'], message: 'Isi nama penerima atau pilih pemasok.' });
    const bank = [d.penerima_bank_nama, d.penerima_bank_rekening, d.penerima_bank_atas_nama];
    if (!d.pemasok_id && bank.some(Boolean) && !bank.every(Boolean)) {
      c.addIssue({ code: 'custom', path: ['penerima_bank_rekening'], message: 'Lengkapi nama bank, nomor rekening, dan atas nama.' });
    }
    if (d.tanggal_dibutuhkan && d.tanggal_dibutuhkan < d.tanggal) {
      c.addIssue({ code: 'custom', path: ['tanggal_dibutuhkan'], message: 'Tidak boleh sebelum tanggal permintaan.' });
    }
  });

async function susunPP(conn, data) {
  await periksaAkunPembebanan(conn, data.baris);
  let penerima = {
    nama: data.penerima_nama,
    bank_nama: data.penerima_bank_nama,
    bank_rekening: data.penerima_bank_rekening,
    bank_atas_nama: data.penerima_bank_atas_nama,
  };
  if (data.pemasok_id) {
    const p = await satu(conn, 'SELECT * FROM pemasok WHERE id = ? AND aktif = 1', [data.pemasok_id]);
    if (!p) throw galatMasukan('Pemasok tidak aktif.', { pemasok_id: 'Pilih pemasok aktif.' });
    penerima = { nama: p.nama, bank_nama: p.bank_nama, bank_rekening: p.bank_nomor_rekening, bank_atas_nama: p.bank_atas_nama };
  }
  return { penerima, total: jumlahkan(data.baris, (b) => b.jumlah) };
}

async function simpanBarisPP(conn, ppId, baris) {
  await jalankan(conn, 'DELETE FROM permintaan_pembayaran_detail WHERE pp_id = ?', [ppId]);
  await jalankan(conn, 'INSERT INTO permintaan_pembayaran_detail (pp_id, baris, uraian, akun_id, jumlah) VALUES ?', [
    baris.map((b, i) => [ppId, i + 1, b.uraian, b.akun_id, b.jumlah]),
  ]);
}

export async function buatPP(conn, ctx, input) {
  const data = validasi(skemaPP, { tanggal: hariIni(), ...input });
  const s = await susunPP(conn, data);
  const nomor = await nomorBaru(conn, 'PP', data.tanggal);
  const r = await jalankan(
    conn,
    `INSERT INTO permintaan_pembayaran (nomor, tanggal, departemen_id, tanggal_dibutuhkan, pemasok_id, penerima_nama, penerima_bank_nama,
       penerima_bank_rekening, penerima_bank_atas_nama, keterangan, dokumen_pendukung, total, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, data.tanggal, ctx.user.departemen_id, data.tanggal_dibutuhkan, data.pemasok_id, s.penerima.nama, s.penerima.bank_nama,
      s.penerima.bank_rekening, s.penerima.bank_atas_nama, data.keterangan, data.dokumen_pendukung, s.total, ctx.user.id],
  );
  await simpanBarisPP(conn, r.insertId, data.baris);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'permintaan_pembayaran', entitasId: r.insertId, ringkasan: `PP ${nomor} kepada ${s.penerima.nama} senilai ${s.total}`, sesudah: data });
  return { id: r.insertId, nomor };
}

export async function ubahPP(conn, ctx, ppId, input) {
  const pp = await kunciBaris(conn, 'permintaan_pembayaran', ppId, 'Permintaan pembayaran');
  pastikanPembuat(ctx, pp);
  pastikanStatus(pp, ['DRAFT', 'DITOLAK'], 'diubah');
  const data = validasi(skemaPP, input);
  const s = await susunPP(conn, data);
  await jalankan(
    conn,
    `UPDATE permintaan_pembayaran SET tanggal = ?, tanggal_dibutuhkan = ?, pemasok_id = ?, penerima_nama = ?, penerima_bank_nama = ?,
       penerima_bank_rekening = ?, penerima_bank_atas_nama = ?, keterangan = ?, dokumen_pendukung = ?, total = ? WHERE id = ?`,
    [data.tanggal, data.tanggal_dibutuhkan, data.pemasok_id, s.penerima.nama, s.penerima.bank_nama, s.penerima.bank_rekening,
      s.penerima.bank_atas_nama, data.keterangan, data.dokumen_pendukung, s.total, ppId],
  );
  await simpanBarisPP(conn, ppId, data.baris);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'permintaan_pembayaran', entitasId: ppId, ringkasan: `PP ${pp.nomor} diubah`, sebelum: pp, sesudah: data });
}

export async function pastikanLampiran(conn, jenis, doc, label) {
  if ((await angkaPengaturan('wajib_lampiran', 1, conn)) && (await jumlahLampiran(conn, jenis, doc.id)) === 0) {
    throw galatMasukan(`${label} ${doc.nomor} belum punya lampiran. Unggah minimal satu dokumen pendukung sebelum mengajukan.`);
  }
}

export async function ajukanPP(conn, ctx, ppId) {
  const pp = await kunciBaris(conn, 'permintaan_pembayaran', ppId, 'Permintaan pembayaran');
  pastikanPembuat(ctx, pp);
  pastikanStatus(pp, ['DRAFT', 'DITOLAK'], 'diajukan');
  await pastikanLampiran(conn, 'PP', pp, 'Permintaan pembayaran');
  const h = await ajukanDokumen(conn, ctx, {
    jenis: 'PP',
    doc: pp,
    nilai: pp.total,
    ringkasan: `${pp.keterangan} (kepada ${pp.penerima_nama})`,
    departemenId: pp.departemen_id,
  });
  await catatAudit(conn, ctx, { aksi: 'AJUKAN', entitas: 'permintaan_pembayaran', entitasId: ppId, ringkasan: `PP ${pp.nomor} diajukan` });
  return h;
}

export async function batalPP(conn, ctx, ppId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const pp = await kunciBaris(conn, 'permintaan_pembayaran', ppId, 'Permintaan pembayaran');
  pastikanPembuat(ctx, pp);
  pastikanStatus(pp, ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'], 'dibatalkan');
  await batalkanPersetujuan(conn, 'PP', ppId);
  await jalankan(conn, "UPDATE permintaan_pembayaran SET status = 'BATAL', alasan_batal = ? WHERE id = ?", [alasan.trim().slice(0, 255), ppId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'permintaan_pembayaran', entitasId: ppId, ringkasan: `PP ${pp.nomor} dibatalkan: ${alasan}` });
}

const PP_SELECT = `SELECT d.*, dp.nama AS departemen_nama, u.nama_lengkap AS dibuat_nama, b.nomor AS bkk_nomor, b.status AS bkk_status,
    py.tanggal AS tanggal_bayar
  FROM permintaan_pembayaran d JOIN departemen dp ON dp.id = d.departemen_id JOIN pengguna u ON u.id = d.dibuat_oleh
  LEFT JOIN bukti_kas_keluar b ON b.id = d.bkk_id LEFT JOIN pembayaran py ON py.id = b.pembayaran_id`;

router.get('/pp', async (req, res) => {
  const q = req.query;
  const saring = saringPermintaan(req.user, 'd');
  const syarat = [saring.sql];
  const params = [...saring.params];
  if (q.saya === '1') { syarat.push('d.dibuat_oleh = ?'); params.push(req.user.id); }
  if (q.status) { syarat.push('d.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.dari) { syarat.push('d.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('d.tanggal <= ?'); params.push(q.sampai); }
  if (q.cari) { syarat.push('(d.nomor LIKE ? OR d.penerima_nama LIKE ? OR d.keterangan LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  res.json(await semua(pool, `${PP_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY d.tanggal DESC, d.id DESC LIMIT 500`, params));
});

export async function detailPP(db, user, ppId) {
  const pp = await satu(db, `${PP_SELECT} WHERE d.id = ?`, [ppId]);
  if (!pp) throw galatTidakAda('Permintaan pembayaran tidak ditemukan.');
  if (!bolehLihatPermintaan(user, pp)) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  const baris = await semua(
    db,
    `SELECT d.*, a.kode AS akun_kode, a.nama AS akun_nama FROM permintaan_pembayaran_detail d JOIN akun a ON a.id = d.akun_id
      WHERE d.pp_id = ? ORDER BY d.baris`,
    [ppId],
  );
  return {
    ...pp,
    baris,
    persetujuan: await riwayatPersetujuan(db, 'PP', ppId),
    boleh_memutuskan: await bolehMemutuskan(db, user, 'PP', ppId),
    jumlah_lampiran: await jumlahLampiran(db, 'PP', ppId),
  };
}

router.get('/pp/:id', async (req, res) => {
  res.json(await detailPP(pool, req.user, Number(req.params.id)));
});
router.post('/pp', perlu('PEMOHON'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatPP(conn, req.ctx, req.body)));
});
router.put('/pp/:id', perlu('PEMOHON'), async (req, res) => {
  await tx((conn) => ubahPP(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/pp/:id/ajukan', perlu('PEMOHON'), async (req, res) => {
  res.json(await tx((conn) => ajukanPP(conn, req.ctx, Number(req.params.id))));
});
router.post('/pp/:id/batal', perlu('PEMOHON'), async (req, res) => {
  await tx((conn) => batalPP(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});
