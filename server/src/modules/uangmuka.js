import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatKonflik, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, teks, teksOpsional, tanggal } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu, bolehLihatPermintaan, saringPermintaan } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { jumlahkan, keSen, kurang, dariSen } from '../lib/uang.js';
import { hariIni, tambahHari, selisihHari } from '../lib/tanggal.js';
import { daftarkanDokumen, kunciBaris, pastikanStatus, pastikanPembuat, jumlahLampiran } from '../lib/dokumen.js';
import { batalkanPersetujuan, riwayatPersetujuan, bolehMemutuskan } from '../lib/persetujuan.js';
import { ajukanDokumen } from '../lib/alur.js';
import { akunSistem, angkaPengaturan } from '../lib/pengaturan.js';
import { postingJurnal } from '../lib/jurnal.js';
import { periksaAkunPembebanan } from '../lib/akun.js';
import { pastikanLampiran } from './permintaan.js';

export const router = Router();

daftarkanDokumen('PUM', {
  tabel: 'uang_muka',
  label: 'Permintaan uang muka',
  statusMenunggu: 'DIAJUKAN',
  bolehLihat: async (_db, user, doc) => bolehLihatPermintaan(user, doc),
  onDisetujui: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE uang_muka SET status = 'DISETUJUI' WHERE id = ?", [doc.id]);
  },
  onDitolak: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE uang_muka SET status = 'DITOLAK' WHERE id = ?", [doc.id]);
  },
});

daftarkanDokumen('PJUM', {
  tabel: 'pertanggungjawaban_uang_muka',
  label: 'Pertanggungjawaban uang muka',
  statusMenunggu: 'DIAJUKAN',
  bolehLihat: async (_db, user, doc) => bolehLihatPermintaan(user, doc),
  onDisetujui: async (conn, ctx, doc) => {
    await selesaikanPJUM(conn, ctx, doc.id);
  },
  onDitolak: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE pertanggungjawaban_uang_muka SET status = 'DITOLAK' WHERE id = ?", [doc.id]);
  },
});

// ---------------------------------------------------------------- permintaan uang muka (PUM)

const skemaPUM = z
  .object({
    tanggal: tanggal(),
    keperluan: teks(500),
    jumlah: z.coerce.number().positive(),
    tanggal_selesai_kegiatan: tanggal(),
  })
  .refine((d) => d.tanggal_selesai_kegiatan >= d.tanggal, { path: ['tanggal_selesai_kegiatan'], message: 'Tidak boleh sebelum tanggal permintaan.' });

async function batasPJ(conn, selesai) {
  return tambahHari(selesai, await angkaPengaturan('hari_batas_pj_uang_muka', 7, conn));
}

export async function buatPUM(conn, ctx, input) {
  const data = validasi(skemaPUM, { tanggal: hariIni(), ...input });
  const nomor = await nomorBaru(conn, 'PUM', data.tanggal);
  const batas = await batasPJ(conn, data.tanggal_selesai_kegiatan);
  const r = await jalankan(
    conn,
    `INSERT INTO uang_muka (nomor, tanggal, departemen_id, keperluan, jumlah, tanggal_selesai_kegiatan, tanggal_batas_pj, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, data.tanggal, ctx.user.departemen_id, data.keperluan, data.jumlah, data.tanggal_selesai_kegiatan, batas, ctx.user.id],
  );
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'uang_muka', entitasId: r.insertId, ringkasan: `PUM ${nomor} ${data.jumlah}: ${data.keperluan}`, sesudah: data });
  return { id: r.insertId, nomor };
}

export async function ubahPUM(conn, ctx, umId, input) {
  const um = await kunciBaris(conn, 'uang_muka', umId, 'Permintaan uang muka');
  pastikanPembuat(ctx, um);
  pastikanStatus(um, ['DRAFT', 'DITOLAK'], 'diubah');
  const data = validasi(skemaPUM, input);
  await jalankan(
    conn,
    'UPDATE uang_muka SET tanggal = ?, keperluan = ?, jumlah = ?, tanggal_selesai_kegiatan = ?, tanggal_batas_pj = ? WHERE id = ?',
    [data.tanggal, data.keperluan, data.jumlah, data.tanggal_selesai_kegiatan, await batasPJ(conn, data.tanggal_selesai_kegiatan), umId],
  );
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'uang_muka', entitasId: umId, ringkasan: `PUM ${um.nomor} diubah`, sebelum: um, sesudah: data });
}

/** Uang muka milik pengguna yang sudah dibayar, lewat tenggat, dan belum dipertanggungjawabkan. */
export async function uangMukaLewatTenggat(db, penggunaId) {
  return satu(
    db,
    `SELECT u.nomor, u.tanggal_batas_pj FROM uang_muka u
      WHERE u.dibuat_oleh = ? AND u.status = 'DIBAYAR' AND u.tanggal_batas_pj < ?
        AND NOT EXISTS (SELECT 1 FROM pertanggungjawaban_uang_muka p
                         WHERE p.uang_muka_id = u.id AND p.status IN ('DIAJUKAN','DISETUJUI','SELESAI'))
      ORDER BY u.tanggal_batas_pj LIMIT 1`,
    [penggunaId, hariIni()],
  );
}

export async function ajukanPUM(conn, ctx, umId) {
  const um = await kunciBaris(conn, 'uang_muka', umId, 'Permintaan uang muka');
  pastikanPembuat(ctx, um);
  pastikanStatus(um, ['DRAFT', 'DITOLAK'], 'diajukan');
  const lewat = await uangMukaLewatTenggat(conn, um.dibuat_oleh);
  if (lewat) {
    throw galatKonflik(
      `Anda masih punya uang muka ${lewat.nomor} yang lewat tenggat pertanggungjawaban (${lewat.tanggal_batas_pj}). Selesaikan pertanggungjawabannya sebelum mengajukan uang muka baru.`,
    );
  }
  const h = await ajukanDokumen(conn, ctx, { jenis: 'PUM', doc: um, nilai: um.jumlah, ringkasan: um.keperluan, departemenId: um.departemen_id });
  await catatAudit(conn, ctx, { aksi: 'AJUKAN', entitas: 'uang_muka', entitasId: umId, ringkasan: `PUM ${um.nomor} diajukan` });
  return h;
}

export async function batalPUM(conn, ctx, umId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const um = await kunciBaris(conn, 'uang_muka', umId, 'Permintaan uang muka');
  pastikanPembuat(ctx, um);
  pastikanStatus(um, ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'], 'dibatalkan');
  await batalkanPersetujuan(conn, 'PUM', umId);
  await jalankan(conn, "UPDATE uang_muka SET status = 'BATAL', alasan_batal = ? WHERE id = ?", [alasan.trim().slice(0, 255), umId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'uang_muka', entitasId: umId, ringkasan: `PUM ${um.nomor} dibatalkan: ${alasan}` });
}

const PUM_SELECT = `SELECT d.*, dp.nama AS departemen_nama, u.nama_lengkap AS dibuat_nama, b.nomor AS bkk_nomor, b.status AS bkk_status,
    py.tanggal AS tanggal_bayar,
    (SELECT p.id FROM pertanggungjawaban_uang_muka p WHERE p.uang_muka_id = d.id AND p.status <> 'BATAL' ORDER BY p.id DESC LIMIT 1) AS pjum_id,
    (SELECT p.status FROM pertanggungjawaban_uang_muka p WHERE p.uang_muka_id = d.id AND p.status <> 'BATAL' ORDER BY p.id DESC LIMIT 1) AS pjum_status
  FROM uang_muka d JOIN departemen dp ON dp.id = d.departemen_id JOIN pengguna u ON u.id = d.dibuat_oleh
  LEFT JOIN bukti_kas_keluar b ON b.id = d.bkk_id LEFT JOIN pembayaran py ON py.id = b.pembayaran_id`;

function tandaiTenggat(r) {
  const kini = hariIni();
  const lewat = r.status === 'DIBAYAR' && r.tanggal_batas_pj < kini && !['DIAJUKAN', 'DISETUJUI', 'SELESAI'].includes(r.pjum_status);
  return { ...r, lewat_tenggat: lewat, hari_lewat_tenggat: lewat ? selisihHari(r.tanggal_batas_pj, kini) : 0 };
}

router.get('/uang-muka', async (req, res) => {
  const q = req.query;
  const saring = saringPermintaan(req.user, 'd');
  const syarat = [saring.sql];
  const params = [...saring.params];
  if (q.saya === '1') { syarat.push('d.dibuat_oleh = ?'); params.push(req.user.id); }
  if (q.status) { syarat.push('d.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.dari) { syarat.push('d.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('d.tanggal <= ?'); params.push(q.sampai); }
  if (q.cari) { syarat.push('(d.nomor LIKE ? OR d.keperluan LIKE ? OR u.nama_lengkap LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  const rows = await semua(pool, `${PUM_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY d.tanggal DESC, d.id DESC LIMIT 500`, params);
  res.json(rows.map(tandaiTenggat));
});

router.get('/uang-muka/:id', async (req, res) => {
  const um = await satu(pool, `${PUM_SELECT} WHERE d.id = ?`, [req.params.id]);
  if (!um) throw galatTidakAda('Permintaan uang muka tidak ditemukan.');
  if (!bolehLihatPermintaan(req.user, um)) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  res.json({
    ...tandaiTenggat(um),
    persetujuan: await riwayatPersetujuan(pool, 'PUM', um.id),
    boleh_memutuskan: await bolehMemutuskan(pool, req.user, 'PUM', um.id),
    jumlah_lampiran: await jumlahLampiran(pool, 'PUM', um.id),
  });
});

router.post('/uang-muka', perlu('PEMOHON'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatPUM(conn, req.ctx, req.body)));
});
router.put('/uang-muka/:id', perlu('PEMOHON'), async (req, res) => {
  await tx((conn) => ubahPUM(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/uang-muka/:id/ajukan', perlu('PEMOHON'), async (req, res) => {
  res.json(await tx((conn) => ajukanPUM(conn, req.ctx, Number(req.params.id))));
});
router.post('/uang-muka/:id/batal', perlu('PEMOHON'), async (req, res) => {
  await tx((conn) => batalPUM(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- pertanggungjawaban (PJUM)

const skemaPJUM = z.object({
  uang_muka_id: id(),
  tanggal: tanggal(),
  keterangan: teksOpsional(500),
  baris: z
    .array(z.object({ tanggal: tanggal(), uraian: teks(255), akun_id: id(), nomor_bukti: teksOpsional(50), jumlah: z.coerce.number().positive() }))
    .min(1)
    .max(100),
});

async function simpanBarisPJUM(conn, pjumId, baris) {
  await jalankan(conn, 'DELETE FROM pertanggungjawaban_uang_muka_detail WHERE pjum_id = ?', [pjumId]);
  await jalankan(conn, 'INSERT INTO pertanggungjawaban_uang_muka_detail (pjum_id, baris, tanggal, uraian, akun_id, nomor_bukti, jumlah) VALUES ?', [
    baris.map((b, i) => [pjumId, i + 1, b.tanggal, b.uraian, b.akun_id, b.nomor_bukti, b.jumlah]),
  ]);
}

export async function buatPJUM(conn, ctx, input) {
  const data = validasi(skemaPJUM, { tanggal: hariIni(), ...input });
  const um = await kunciBaris(conn, 'uang_muka', data.uang_muka_id, 'Uang muka');
  if (um.dibuat_oleh !== ctx.user.id) throw galatAkses('Pertanggungjawaban hanya dibuat oleh penerima uang muka.');
  pastikanStatus(um, ['DIBAYAR'], 'dipertanggungjawabkan');
  const ada = await satu(conn, "SELECT nomor FROM pertanggungjawaban_uang_muka WHERE uang_muka_id = ? AND status <> 'BATAL'", [um.id]);
  if (ada) throw galatKonflik(`Uang muka ini sudah punya pertanggungjawaban ${ada.nomor}.`);
  await periksaAkunPembebanan(conn, data.baris);
  const realisasi = jumlahkan(data.baris, (b) => b.jumlah);
  const nomor = await nomorBaru(conn, 'PJUM', data.tanggal);
  const r = await jalankan(
    conn,
    `INSERT INTO pertanggungjawaban_uang_muka (nomor, tanggal, uang_muka_id, departemen_id, keterangan, jumlah_uang_muka, total_realisasi, selisih, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, data.tanggal, um.id, um.departemen_id, data.keterangan, um.jumlah, realisasi, kurang(um.jumlah, realisasi), ctx.user.id],
  );
  await simpanBarisPJUM(conn, r.insertId, data.baris);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'pertanggungjawaban_uang_muka', entitasId: r.insertId, ringkasan: `PJUM ${nomor} atas ${um.nomor}, realisasi ${realisasi}`, sesudah: data });
  return { id: r.insertId, nomor };
}

export async function ubahPJUM(conn, ctx, pjumId, input) {
  const pj = await kunciBaris(conn, 'pertanggungjawaban_uang_muka', pjumId, 'Pertanggungjawaban');
  pastikanPembuat(ctx, pj);
  pastikanStatus(pj, ['DRAFT', 'DITOLAK'], 'diubah');
  const data = validasi(skemaPJUM, { ...input, uang_muka_id: pj.uang_muka_id });
  await periksaAkunPembebanan(conn, data.baris);
  const realisasi = jumlahkan(data.baris, (b) => b.jumlah);
  await jalankan(
    conn,
    'UPDATE pertanggungjawaban_uang_muka SET tanggal = ?, keterangan = ?, total_realisasi = ?, selisih = ? WHERE id = ?',
    [data.tanggal, data.keterangan, realisasi, kurang(pj.jumlah_uang_muka, realisasi), pjumId],
  );
  await simpanBarisPJUM(conn, pjumId, data.baris);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'pertanggungjawaban_uang_muka', entitasId: pjumId, ringkasan: `PJUM ${pj.nomor} diubah`, sebelum: pj, sesudah: data });
}

export async function ajukanPJUM(conn, ctx, pjumId) {
  const pj = await kunciBaris(conn, 'pertanggungjawaban_uang_muka', pjumId, 'Pertanggungjawaban');
  pastikanPembuat(ctx, pj);
  pastikanStatus(pj, ['DRAFT', 'DITOLAK'], 'diajukan');
  await pastikanLampiran(conn, 'PJUM', pj, 'Pertanggungjawaban uang muka');
  const um = await satu(conn, 'SELECT nomor, keperluan FROM uang_muka WHERE id = ?', [pj.uang_muka_id]);
  const h = await ajukanDokumen(conn, ctx, {
    jenis: 'PJUM',
    doc: pj,
    nilai: pj.total_realisasi,
    ringkasan: `Pertanggungjawaban ${um.nomor}: ${um.keperluan}`,
    departemenId: pj.departemen_id,
  });
  await catatAudit(conn, ctx, { aksi: 'AJUKAN', entitas: 'pertanggungjawaban_uang_muka', entitasId: pjumId, ringkasan: `PJUM ${pj.nomor} diajukan` });
  return h;
}

/** Setelah PJUM disetujui: jurnal penyelesaian uang muka, lalu tentukan hasil pas/sisa/kurang. */
export async function selesaikanPJUM(conn, ctx, pjumId) {
  const pj = await satu(conn, 'SELECT * FROM pertanggungjawaban_uang_muka WHERE id = ? FOR UPDATE', [pjumId]);
  const um = await satu(conn, 'SELECT * FROM uang_muka WHERE id = ? FOR UPDATE', [pj.uang_muka_id]);
  const penerima = await satu(conn, 'SELECT nama_lengkap FROM pengguna WHERE id = ?', [um.dibuat_oleh]);
  const detail = await semua(conn, 'SELECT * FROM pertanggungjawaban_uang_muka_detail WHERE pjum_id = ? ORDER BY baris', [pjumId]);
  const akunUM = await akunSistem('akun_uang_muka_karyawan', conn);
  const selisihSen = keSen(pj.jumlah_uang_muka) - keSen(pj.total_realisasi);
  const baris = detail.map((d) => ({ akun_id: d.akun_id, departemen_id: pj.departemen_id, debit: d.jumlah, kredit: 0, keterangan: d.uraian }));
  if (selisihSen > 0) {
    const piutang = await akunSistem('akun_piutang_karyawan', conn);
    baris.push({ akun_id: piutang.id, debit: dariSen(selisihSen), kredit: 0, keterangan: `Sisa uang muka ${um.nomor} a.n. ${penerima.nama_lengkap}` });
  }
  baris.push({ akun_id: akunUM.id, debit: 0, kredit: pj.jumlah_uang_muka, keterangan: `Penyelesaian uang muka ${um.nomor}` });
  if (selisihSen < 0) {
    const utangKry = await akunSistem('akun_utang_karyawan', conn);
    baris.push({ akun_id: utangKry.id, debit: 0, kredit: dariSen(-selisihSen), keterangan: `Kekurangan uang muka ${um.nomor} a.n. ${penerima.nama_lengkap}` });
  }
  const j = await postingJurnal(conn, ctx, {
    tanggal: pj.tanggal,
    jenis: 'JU',
    sumberTipe: 'PJUM',
    sumberId: pj.id,
    sumberNomor: pj.nomor,
    keterangan: `Pertanggungjawaban uang muka ${um.nomor} a.n. ${penerima.nama_lengkap}`,
    baris,
  });
  const hasil = selisihSen === 0 ? 'PAS' : selisihSen > 0 ? 'SISA' : 'KURANG';
  await jalankan(conn, 'UPDATE pertanggungjawaban_uang_muka SET status = ?, hasil = ?, jurnal_id = ? WHERE id = ?', [hasil === 'PAS' ? 'SELESAI' : 'DISETUJUI', hasil, j.id, pjumId]);
  if (hasil === 'PAS') await jalankan(conn, "UPDATE uang_muka SET status = 'SELESAI' WHERE id = ?", [um.id]);
  return { hasil, jurnal: j };
}

export async function batalPJUM(conn, ctx, pjumId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const pj = await kunciBaris(conn, 'pertanggungjawaban_uang_muka', pjumId, 'Pertanggungjawaban');
  pastikanPembuat(ctx, pj);
  pastikanStatus(pj, ['DRAFT', 'DITOLAK', 'DIAJUKAN'], 'dibatalkan');
  await batalkanPersetujuan(conn, 'PJUM', pjumId);
  await jalankan(conn, "UPDATE pertanggungjawaban_uang_muka SET status = 'BATAL', alasan_batal = ? WHERE id = ?", [alasan.trim().slice(0, 255), pjumId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'pertanggungjawaban_uang_muka', entitasId: pjumId, ringkasan: `PJUM ${pj.nomor} dibatalkan: ${alasan}` });
}

const PJUM_SELECT = `SELECT d.*, um.nomor AS uang_muka_nomor, um.keperluan, um.tanggal_batas_pj, dp.nama AS departemen_nama,
    u.nama_lengkap AS dibuat_nama, b.nomor AS bkk_nomor, b.status AS bkk_status, k.nomor AS bkm_nomor
  FROM pertanggungjawaban_uang_muka d JOIN uang_muka um ON um.id = d.uang_muka_id JOIN departemen dp ON dp.id = d.departemen_id
  JOIN pengguna u ON u.id = d.dibuat_oleh LEFT JOIN bukti_kas_keluar b ON b.id = d.bkk_id LEFT JOIN penerimaan_kas k ON k.id = d.bkm_id`;

router.get('/pjum', async (req, res) => {
  const q = req.query;
  const saring = saringPermintaan(req.user, 'd');
  const syarat = [saring.sql];
  const params = [...saring.params];
  if (q.saya === '1') { syarat.push('d.dibuat_oleh = ?'); params.push(req.user.id); }
  if (q.status) { syarat.push('d.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.hasil) { syarat.push('d.hasil = ?'); params.push(String(q.hasil)); }
  if (q.cari) { syarat.push('(d.nomor LIKE ? OR um.nomor LIKE ? OR u.nama_lengkap LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  res.json(await semua(pool, `${PJUM_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY d.tanggal DESC, d.id DESC LIMIT 500`, params));
});

router.get('/pjum/:id', async (req, res) => {
  const pj = await satu(pool, `${PJUM_SELECT} WHERE d.id = ?`, [req.params.id]);
  if (!pj) throw galatTidakAda('Pertanggungjawaban tidak ditemukan.');
  if (!bolehLihatPermintaan(req.user, pj)) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  const baris = await semua(
    pool,
    `SELECT d.*, a.kode AS akun_kode, a.nama AS akun_nama FROM pertanggungjawaban_uang_muka_detail d JOIN akun a ON a.id = d.akun_id
      WHERE d.pjum_id = ? ORDER BY d.baris`,
    [pj.id],
  );
  res.json({
    ...pj,
    baris,
    persetujuan: await riwayatPersetujuan(pool, 'PJUM', pj.id),
    boleh_memutuskan: await bolehMemutuskan(pool, req.user, 'PJUM', pj.id),
    jumlah_lampiran: await jumlahLampiran(pool, 'PJUM', pj.id),
  });
});

router.post('/pjum', perlu('PEMOHON'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatPJUM(conn, req.ctx, req.body)));
});
router.put('/pjum/:id', perlu('PEMOHON'), async (req, res) => {
  await tx((conn) => ubahPJUM(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/pjum/:id/ajukan', perlu('PEMOHON'), async (req, res) => {
  res.json(await tx((conn) => ajukanPJUM(conn, req.ctx, Number(req.params.id))));
});
router.post('/pjum/:id/batal', perlu('PEMOHON'), async (req, res) => {
  await tx((conn) => batalPJUM(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});
