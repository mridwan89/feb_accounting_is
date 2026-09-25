import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatKonflik, galatTidakAda } from '../lib/galat.js';
import { catatAudit } from '../lib/audit.js';
import { angkaPengaturan } from '../lib/pengaturan.js';
import { pastikanBolehLihat, definisiDokumen } from '../lib/dokumen.js';

export const router = Router();

const unggah = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

/** Kenali jenis berkas dari tanda tangan (magic bytes) isinya, bukan dari ekstensi nama berkas. */
export function kenaliBerkas(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  return null;
}

const STATUS_BOLEH_HAPUS = ['DRAFT', 'DITOLAK'];

export async function simpanLampiran(conn, ctx, { jenis, dokumenId, namaAsli, buffer }) {
  const { doc } = await pastikanBolehLihat(conn, ctx.user, jenis, dokumenId);
  if (doc.status === 'BATAL') throw galatKonflik('Dokumen yang sudah dibatalkan tidak dapat diberi lampiran.');
  const batasMb = await angkaPengaturan('batas_lampiran_mb', 5, conn);
  if (buffer.length > batasMb * 1024 * 1024) throw galatMasukan(`Berkas terlalu besar (maksimal ${batasMb} MB). Kompres atau pindai ulang dengan resolusi lebih rendah.`);
  if (buffer.length === 0) throw galatMasukan('Berkas kosong.');
  const jenisBerkas = kenaliBerkas(buffer);
  if (!jenisBerkas) throw galatMasukan('Jenis berkas tidak didukung. Unggah PDF, JPG, atau PNG.');
  const kini = new Date();
  const subfolder = path.join(String(kini.getFullYear()), String(kini.getMonth() + 1).padStart(2, '0'));
  const namaSimpan = `${randomBytes(16).toString('hex')}.${jenisBerkas.ext}`;
  fs.mkdirSync(path.join(config.lampiranDir, subfolder), { recursive: true });
  fs.writeFileSync(path.join(config.lampiranDir, subfolder, namaSimpan), buffer, { flag: 'wx' });
  const nama = path.basename(String(namaAsli || `lampiran.${jenisBerkas.ext}`)).slice(0, 255);
  const r = await jalankan(
    conn,
    'INSERT INTO lampiran (jenis_dokumen, dokumen_id, nama_asli, nama_simpan, tipe_mime, ukuran, sha256, diunggah_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [jenis, dokumenId, nama, path.join(subfolder, namaSimpan), jenisBerkas.mime, buffer.length, createHash('sha256').update(buffer).digest('hex'), ctx.user.id],
  );
  await catatAudit(conn, ctx, { aksi: 'UNGGAH', entitas: definisiDokumen(jenis).tabel, entitasId: dokumenId, ringkasan: `Lampiran "${nama}" diunggah ke ${doc.nomor || jenis}` });
  return { id: r.insertId, nama_asli: nama, tipe_mime: jenisBerkas.mime, ukuran: buffer.length };
}

router.get('/lampiran/:jenis/:id', async (req, res) => {
  await pastikanBolehLihat(pool, req.user, req.params.jenis, Number(req.params.id));
  res.json(
    await semua(
      pool,
      `SELECT l.id, l.nama_asli, l.tipe_mime, l.ukuran, l.sha256, l.diunggah_oleh, u.nama_lengkap AS diunggah_nama, l.diunggah_pada
         FROM lampiran l JOIN pengguna u ON u.id = l.diunggah_oleh WHERE l.jenis_dokumen = ? AND l.dokumen_id = ? ORDER BY l.id`,
      [req.params.jenis, Number(req.params.id)],
    ),
  );
});

router.post('/lampiran/:jenis/:id', unggah.single('berkas'), async (req, res) => {
  if (!req.file) throw galatMasukan('Pilih berkas yang akan diunggah.');
  const hasil = await tx((conn) =>
    simpanLampiran(conn, req.ctx, { jenis: req.params.jenis, dokumenId: Number(req.params.id), namaAsli: req.file.originalname, buffer: req.file.buffer }),
  );
  res.status(201).json(hasil);
});

router.get('/lampiran-berkas/:id', async (req, res) => {
  const l = await satu(pool, 'SELECT * FROM lampiran WHERE id = ?', [req.params.id]);
  if (!l) throw galatTidakAda('Lampiran tidak ditemukan.');
  await pastikanBolehLihat(pool, req.user, l.jenis_dokumen, l.dokumen_id);
  const lokasi = path.join(config.lampiranDir, l.nama_simpan);
  if (!lokasi.startsWith(config.lampiranDir) || !fs.existsSync(lokasi)) throw galatTidakAda('Berkas lampiran tidak ditemukan di server. Hubungi Administrator.');
  res.setHeader('Content-Type', l.tipe_mime);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(l.nama_asli)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(lokasi).pipe(res);
});

router.delete('/lampiran-berkas/:id', async (req, res) => {
  await tx(async (conn) => {
    const l = await satu(conn, 'SELECT * FROM lampiran WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!l) throw galatTidakAda('Lampiran tidak ditemukan.');
    if (l.diunggah_oleh !== req.user.id) throw galatAkses('Lampiran hanya dapat dihapus oleh pengunggahnya.');
    const { doc, def } = await pastikanBolehLihat(conn, req.user, l.jenis_dokumen, l.dokumen_id);
    if (!STATUS_BOLEH_HAPUS.includes(doc.status)) throw galatKonflik('Lampiran tidak dapat dihapus setelah dokumen diajukan.');
    await jalankan(conn, 'DELETE FROM lampiran WHERE id = ?', [l.id]);
    await catatAudit(conn, req.ctx, { aksi: 'HAPUS_LAMPIRAN', entitas: def.tabel, entitasId: l.dokumen_id, ringkasan: `Lampiran "${l.nama_asli}" dihapus dari ${doc.nomor}`, sebelum: l });
    fs.rm(path.join(config.lampiranDir, l.nama_simpan), { force: true }, () => {});
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- pencatatan cetak (ASLI / SALINAN)

router.post('/cetak/:jenis/:id', async (req, res) => {
  const hasil = await tx(async (conn) => {
    const { def, doc } = await pastikanBolehLihat(conn, req.user, req.params.jenis, Number(req.params.id));
    await jalankan(conn, `UPDATE ${def.tabel} SET jumlah_cetak = jumlah_cetak + 1 WHERE id = ?`, [doc.id]);
    const r = await satu(conn, `SELECT jumlah_cetak, NOW() AS waktu FROM ${def.tabel} WHERE id = ?`, [doc.id]);
    await catatAudit(conn, req.ctx, {
      aksi: 'CETAK',
      entitas: def.tabel,
      entitasId: doc.id,
      ringkasan: `${def.label} ${doc.nomor} dicetak (${r.jumlah_cetak === 1 ? 'asli' : `salinan ke-${r.jumlah_cetak - 1}`})`,
    });
    return { cetak_ke: r.jumlah_cetak, waktu: r.waktu, dicetak_oleh: req.user.nama_lengkap };
  });
  res.json(hasil);
});
