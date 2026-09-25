import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatTidakAda, galatKonflik } from '../lib/galat.js';
import { z, validasi, id, teks, teksOpsional, bool } from '../lib/validasi.js';
import { hashSandi, periksaKebijakanSandi } from '../lib/sandi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu } from '../lib/akses.js';
import { ambilPengaturan, angkaPengaturan, hapusCachePengaturan } from '../lib/pengaturan.js';
import { akhirBulan, awalBulan, namaPeriode } from '../lib/tanggal.js';
import { muatPengguna } from '../middleware/autentikasi.js';

export const router = Router();

// ---------------------------------------------------------------- peran dan konflik

router.get('/peran', async (_req, res) => {
  res.json(await semua(pool, 'SELECT * FROM peran ORDER BY urutan'));
});

router.get('/konflik-peran', async (_req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT k.peran_a, pa.nama AS nama_a, k.peran_b, pb.nama AS nama_b, k.alasan
         FROM konflik_peran k JOIN peran pa ON pa.kode = k.peran_a JOIN peran pb ON pb.kode = k.peran_b
        ORDER BY pa.urutan, pb.urutan`,
    ),
  );
});

export async function periksaKonflikPeran(db, daftarPeran) {
  if (daftarPeran.length < 2) return;
  const konflik = await satu(
    db,
    `SELECT pa.nama AS nama_a, pb.nama AS nama_b, k.alasan
       FROM konflik_peran k JOIN peran pa ON pa.kode = k.peran_a JOIN peran pb ON pb.kode = k.peran_b
      WHERE k.peran_a IN (?) AND k.peran_b IN (?) LIMIT 1`,
    [daftarPeran, daftarPeran],
  );
  if (konflik) {
    const pesan = `Peran ${konflik.nama_a} dan ${konflik.nama_b} tidak boleh dipegang satu akun: ${konflik.alasan}.`;
    throw galatMasukan(pesan, { peran: pesan });
  }
}

// ---------------------------------------------------------------- pengguna

const skemaPengguna = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,50}$/, 'Nama pengguna 3 sampai 50 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.'),
  nama_lengkap: teks(100),
  jabatan: teksOpsional(100),
  email: z.preprocess((v) => v || null, z.string().email('Format email belum benar.').max(100).nullable()),
  departemen_id: id(),
  peran: z.array(z.string()).min(1, 'Pilih minimal satu peran.'),
  aktif: bool().optional(),
  password_awal: z.string().optional(),
});

async function simpanPeran(conn, penggunaId, daftarPeran) {
  const valid = await semua(conn, 'SELECT kode FROM peran WHERE kode IN (?)', [daftarPeran]);
  if (valid.length !== new Set(daftarPeran).size) throw galatMasukan('Ada peran yang tidak dikenal.', { peran: 'Ada peran yang tidak dikenal.' });
  await periksaKonflikPeran(conn, daftarPeran);
  await jalankan(conn, 'DELETE FROM pengguna_peran WHERE pengguna_id = ?', [penggunaId]);
  await jalankan(conn, 'INSERT INTO pengguna_peran (pengguna_id, peran_kode) VALUES ?', [[...new Set(daftarPeran)].map((p) => [penggunaId, p])]);
}

router.get('/pengguna', perlu('ADMIN', 'AUDITOR', 'MANAJER_KEUANGAN'), async (req, res) => {
  const rows = await semua(
    pool,
    `SELECT u.id, u.username, u.nama_lengkap, u.jabatan, u.email, u.departemen_id, d.nama AS departemen_nama,
            u.aktif, u.harus_ganti_password, u.terakhir_login, (u.terkunci_sampai > NOW()) AS terkunci,
            GROUP_CONCAT(pp.peran_kode ORDER BY pp.peran_kode) AS peran
       FROM pengguna u JOIN departemen d ON d.id = u.departemen_id
       LEFT JOIN pengguna_peran pp ON pp.pengguna_id = u.id
      GROUP BY u.id ORDER BY u.nama_lengkap`,
  );
  res.json(rows.map((r) => ({ ...r, aktif: !!r.aktif, terkunci: !!r.terkunci, harus_ganti_password: !!r.harus_ganti_password, peran: r.peran ? r.peran.split(',') : [] })));
});

/** Daftar ringkas pengguna aktif untuk pilihan (misalnya pemegang kas kecil). */
router.get('/pengguna/pilihan', async (req, res) => {
  const peran = req.query.peran ? String(req.query.peran) : null;
  const rows = await semua(
    pool,
    `SELECT DISTINCT u.id, u.nama_lengkap, u.jabatan, u.departemen_id FROM pengguna u
       LEFT JOIN pengguna_peran pp ON pp.pengguna_id = u.id
      WHERE u.aktif = 1 ${peran ? 'AND pp.peran_kode = ?' : ''} ORDER BY u.nama_lengkap`,
    peran ? [peran] : [],
  );
  res.json(rows);
});

export async function buatPengguna(conn, ctx, input) {
  const data = validasi(skemaPengguna, input);
  const panjangMin = await angkaPengaturan('min_panjang_password', 8, conn);
  const pesan = periksaKebijakanSandi(data.password_awal || '', data.username, panjangMin);
  if (pesan) throw galatMasukan(pesan, { password_awal: pesan });
  if (await satu(conn, 'SELECT id FROM pengguna WHERE username = ?', [data.username])) {
    throw galatMasukan('Nama pengguna sudah dipakai.', { username: 'Nama pengguna sudah dipakai.' });
  }
  const res = await jalankan(
    conn,
    `INSERT INTO pengguna (username, nama_lengkap, jabatan, email, departemen_id, password_hash, harus_ganti_password)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [data.username, data.nama_lengkap, data.jabatan, data.email, data.departemen_id, await hashSandi(data.password_awal)],
  );
  await simpanPeran(conn, res.insertId, data.peran);
  const baru = await muatPengguna(conn, res.insertId);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'pengguna', entitasId: res.insertId, ringkasan: `Akun ${data.username} dibuat`, sesudah: baru });
  return baru;
}

router.post('/pengguna', perlu('ADMIN'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatPengguna(conn, req.ctx, req.body)));
});

router.put('/pengguna/:id', perlu('ADMIN'), async (req, res) => {
  const penggunaId = Number(req.params.id);
  const hasil = await tx(async (conn) => {
    const lama = await muatPengguna(conn, penggunaId);
    if (!lama) throw galatTidakAda('Pengguna tidak ditemukan.');
    const data = validasi(skemaPengguna.omit({ username: true, password_awal: true }), req.body);
    if (penggunaId === req.user.id && (!data.peran.includes('ADMIN') || data.aktif === false)) {
      throw galatMasukan('Anda tidak dapat mencabut peran Administrator atau menonaktifkan akun Anda sendiri.');
    }
    await jalankan(
      conn,
      'UPDATE pengguna SET nama_lengkap = ?, jabatan = ?, email = ?, departemen_id = ?, aktif = ? WHERE id = ?',
      [data.nama_lengkap, data.jabatan, data.email, data.departemen_id, data.aktif === false ? 0 : 1, penggunaId],
    );
    await simpanPeran(conn, penggunaId, data.peran);
    if (data.aktif === false) {
      await jalankan(conn, "UPDATE sesi SET dicabut_pada = NOW(), alasan_cabut = 'AKUN_NONAKTIF' WHERE pengguna_id = ? AND dicabut_pada IS NULL", [penggunaId]);
    }
    const baru = await muatPengguna(conn, penggunaId);
    await catatAudit(conn, req.ctx, { aksi: 'UBAH', entitas: 'pengguna', entitasId: penggunaId, ringkasan: `Akun ${lama.username} diubah`, sebelum: lama, sesudah: baru });
    return baru;
  });
  res.json(hasil);
});

router.post('/pengguna/:id/reset-sandi', perlu('ADMIN'), async (req, res) => {
  const { password_baru } = validasi(z.object({ password_baru: z.string().min(1) }), req.body);
  await tx(async (conn) => {
    const u = await satu(conn, 'SELECT id, username FROM pengguna WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!u) throw galatTidakAda('Pengguna tidak ditemukan.');
    const pesan = periksaKebijakanSandi(password_baru, u.username, await angkaPengaturan('min_panjang_password', 8, conn));
    if (pesan) throw galatMasukan(pesan, { password_baru: pesan });
    await jalankan(
      conn,
      'UPDATE pengguna SET password_hash = ?, harus_ganti_password = 1, gagal_login = 0, terkunci_sampai = NULL WHERE id = ?',
      [await hashSandi(password_baru), u.id],
    );
    await jalankan(conn, "UPDATE sesi SET dicabut_pada = NOW(), alasan_cabut = 'RESET_SANDI' WHERE pengguna_id = ? AND dicabut_pada IS NULL", [u.id]);
    await catatAudit(conn, req.ctx, { aksi: 'RESET_SANDI', entitas: 'pengguna', entitasId: u.id, ringkasan: `Kata sandi ${u.username} direset` });
  });
  res.json({ ok: true });
});

router.post('/pengguna/:id/buka-kunci', perlu('ADMIN'), async (req, res) => {
  await tx(async (conn) => {
    const u = await satu(conn, 'SELECT id, username FROM pengguna WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!u) throw galatTidakAda('Pengguna tidak ditemukan.');
    await jalankan(conn, 'UPDATE pengguna SET gagal_login = 0, terkunci_sampai = NULL WHERE id = ?', [u.id]);
    await catatAudit(conn, req.ctx, { aksi: 'BUKA_KUNCI', entitas: 'pengguna', entitasId: u.id, ringkasan: `Kunci akun ${u.username} dibuka` });
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- sesi aktif

router.get('/sesi', perlu('ADMIN'), async (_req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT s.id, s.pengguna_id, u.username, u.nama_lengkap, s.dibuat_pada, s.aktivitas_terakhir, s.ip, s.user_agent
         FROM sesi s JOIN pengguna u ON u.id = s.pengguna_id
        WHERE s.dicabut_pada IS NULL AND s.kedaluwarsa > NOW()
          AND s.aktivitas_terakhir > NOW() - INTERVAL ? MINUTE
        ORDER BY s.aktivitas_terakhir DESC`,
      [await angkaPengaturan('sesi_timeout_menit', 30)],
    ),
  );
});

router.post('/sesi/:id/cabut', perlu('ADMIN'), async (req, res) => {
  await tx(async (conn) => {
    const s = await satu(conn, 'SELECT s.id, u.username FROM sesi s JOIN pengguna u ON u.id = s.pengguna_id WHERE s.id = ?', [req.params.id]);
    if (!s) throw galatTidakAda('Sesi tidak ditemukan.');
    await jalankan(conn, "UPDATE sesi SET dicabut_pada = NOW(), alasan_cabut = 'DICABUT_ADMIN' WHERE id = ?", [s.id]);
    await catatAudit(conn, req.ctx, { aksi: 'CABUT_SESI', entitas: 'sesi', entitasId: s.id, ringkasan: `Sesi ${s.username} diakhiri Administrator` });
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- aturan persetujuan

const skemaAturan = z.object({
  jenis_dokumen: z.enum(['PO', 'FB', 'PP', 'PUM', 'PJUM', 'PKK', 'BKK', 'JM']),
  urutan: z.coerce.number().int().min(1).max(20),
  nama_langkah: teks(100),
  peran_kode: z.string().min(1),
  lingkup: z.enum(['DEPARTEMEN', 'GLOBAL']),
  batas_bawah: z.coerce.number().min(0),
  peran_pengganti_kode: z.preprocess((v) => v || null, z.string().nullable()),
  aktif: bool().optional(),
});

router.get('/aturan-persetujuan', async (_req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT a.*, p.nama AS peran_nama, pg.nama AS peran_pengganti_nama
         FROM aturan_persetujuan a JOIN peran p ON p.kode = a.peran_kode
         LEFT JOIN peran pg ON pg.kode = a.peran_pengganti_kode
        ORDER BY FIELD(a.jenis_dokumen, 'PO','FB','PP','PUM','PJUM','PKK','BKK','JM'), a.urutan`,
    ),
  );
});

async function simpanAturan(conn, ctx, idAturan, input) {
  const data = validasi(skemaAturan, input);
  if (data.lingkup === 'DEPARTEMEN' && !data.peran_pengganti_kode) {
    throw galatMasukan('Langkah berlingkup departemen wajib punya peran pengganti.', { peran_pengganti_kode: 'Wajib diisi untuk lingkup departemen.' });
  }
  const bentrok = await satu(
    conn,
    'SELECT id FROM aturan_persetujuan WHERE jenis_dokumen = ? AND urutan = ? AND id <> ?',
    [data.jenis_dokumen, data.urutan, idAturan || 0],
  );
  if (bentrok) throw galatMasukan('Urutan ini sudah dipakai langkah lain pada jenis dokumen yang sama.', { urutan: 'Sudah dipakai.' });
  const nilai = [data.jenis_dokumen, data.urutan, data.nama_langkah, data.peran_kode, data.lingkup, data.batas_bawah, data.peran_pengganti_kode, data.aktif === false ? 0 : 1];
  if (idAturan) {
    const lama = await satu(conn, 'SELECT * FROM aturan_persetujuan WHERE id = ? FOR UPDATE', [idAturan]);
    if (!lama) throw galatTidakAda('Aturan tidak ditemukan.');
    await jalankan(
      conn,
      `UPDATE aturan_persetujuan SET jenis_dokumen = ?, urutan = ?, nama_langkah = ?, peran_kode = ?, lingkup = ?,
         batas_bawah = ?, peran_pengganti_kode = ?, aktif = ? WHERE id = ?`,
      [...nilai, idAturan],
    );
    await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'aturan_persetujuan', entitasId: idAturan, ringkasan: `Aturan ${data.jenis_dokumen} langkah ${data.urutan} diubah`, sebelum: lama, sesudah: data });
    return idAturan;
  }
  const r = await jalankan(
    conn,
    `INSERT INTO aturan_persetujuan (jenis_dokumen, urutan, nama_langkah, peran_kode, lingkup, batas_bawah, peran_pengganti_kode, aktif)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    nilai,
  );
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'aturan_persetujuan', entitasId: r.insertId, ringkasan: `Aturan ${data.jenis_dokumen} langkah ${data.urutan} dibuat`, sesudah: data });
  return r.insertId;
}

router.post('/aturan-persetujuan', perlu('ADMIN'), async (req, res) => {
  const idBaru = await tx((conn) => simpanAturan(conn, req.ctx, null, req.body));
  res.status(201).json({ id: idBaru });
});

router.put('/aturan-persetujuan/:id', perlu('ADMIN'), async (req, res) => {
  await tx((conn) => simpanAturan(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- pengaturan

const KUNCI_ANGKA = new Set([
  'toleransi_harga_persen', 'toleransi_qty_persen', 'hari_batas_pj_uang_muka', 'wajib_lampiran', 'batas_lampiran_mb',
  'sesi_timeout_menit', 'sesi_maks_jam', 'maks_gagal_login', 'durasi_kunci_menit', 'min_panjang_password', 'ambang_kas_kecil_persen',
]);

router.get('/pengaturan', async (_req, res) => {
  res.json(await semua(pool, 'SELECT kunci, nilai, keterangan, diubah_pada FROM pengaturan ORDER BY kunci'));
});

router.put('/pengaturan', perlu('ADMIN'), async (req, res) => {
  const masukan = req.body && typeof req.body === 'object' ? req.body : {};
  await tx(async (conn) => {
    const lama = Object.fromEntries((await semua(conn, 'SELECT kunci, nilai FROM pengaturan FOR UPDATE')).map((r) => [r.kunci, r.nilai]));
    const galat = {};
    const ubah = {};
    for (const [kunci, nilaiMentah] of Object.entries(masukan)) {
      if (!(kunci in lama)) {
        galat[kunci] = 'Kunci pengaturan tidak dikenal.';
        continue;
      }
      const nilai = String(nilaiMentah ?? '').trim();
      if (nilai === lama[kunci]) continue;
      if (!nilai) galat[kunci] = 'Wajib diisi.';
      else if (KUNCI_ANGKA.has(kunci) && !(Number.isFinite(Number(nilai)) && Number(nilai) >= 0)) galat[kunci] = 'Harus berupa angka tidak negatif.';
      else if (kunci.startsWith('akun_')) {
        const a = await satu(conn, "SELECT id FROM akun WHERE kode = ? AND tipe = 'DETAIL' AND aktif = 1", [nilai]);
        if (!a) galat[kunci] = 'Kode akun detail aktif tidak ditemukan.';
      } else if (kunci === 'pajak_ppn_bawaan') {
        const p = await satu(conn, "SELECT id FROM pajak WHERE kode = ? AND jenis = 'PPN' AND aktif = 1", [nilai]);
        if (!p) galat[kunci] = 'Kode pajak PPN aktif tidak ditemukan.';
      }
      ubah[kunci] = nilai;
    }
    if (Object.keys(galat).length) throw galatMasukan('Periksa kembali isian yang ditandai.', galat);
    for (const [kunci, nilai] of Object.entries(ubah)) {
      await jalankan(conn, 'UPDATE pengaturan SET nilai = ?, diubah_oleh = ?, diubah_pada = NOW() WHERE kunci = ?', [nilai, req.user.id, kunci]);
    }
    if (Object.keys(ubah).length) {
      const sebelum = Object.fromEntries(Object.keys(ubah).map((k) => [k, lama[k]]));
      await catatAudit(conn, req.ctx, { aksi: 'UBAH', entitas: 'pengaturan', ringkasan: `Pengaturan diubah: ${Object.keys(ubah).join(', ')}`, sebelum, sesudah: ubah });
    }
  });
  hapusCachePengaturan();
  res.json(await ambilPengaturan(pool));
});

// ---------------------------------------------------------------- log audit

router.get('/audit', perlu('ADMIN', 'AUDITOR'), async (req, res) => {
  const q = req.query;
  const syarat = ['1 = 1'];
  const params = [];
  if (q.dari) { syarat.push('l.waktu >= ?'); params.push(`${q.dari} 00:00:00`); }
  if (q.sampai) { syarat.push('l.waktu <= ?'); params.push(`${q.sampai} 23:59:59`); }
  if (q.pengguna_id) { syarat.push('l.pengguna_id = ?'); params.push(Number(q.pengguna_id)); }
  if (q.entitas) { syarat.push('l.entitas = ?'); params.push(String(q.entitas)); }
  if (q.entitas_id) { syarat.push('l.entitas_id = ?'); params.push(String(q.entitas_id)); }
  if (q.aksi) { syarat.push('l.aksi = ?'); params.push(String(q.aksi)); }
  if (q.cari) { syarat.push('(l.ringkasan LIKE ? OR l.username LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`); }
  const perHalaman = Math.min(Number(q.per_halaman) || 100, 500);
  const halaman = Math.max(Number(q.halaman) || 1, 1);
  const where = syarat.join(' AND ');
  const total = await satu(pool, `SELECT COUNT(*) AS n FROM log_audit l WHERE ${where}`, params);
  const rows = await semua(
    pool,
    `SELECT l.id, l.waktu, l.pengguna_id, l.username, l.ip, l.aksi, l.entitas, l.entitas_id, l.ringkasan, l.data_sebelum, l.data_sesudah
       FROM log_audit l WHERE ${where} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, perHalaman, (halaman - 1) * perHalaman],
  );
  res.json({ total: total.n, halaman, per_halaman: perHalaman, data: rows });
});

// ---------------------------------------------------------------- periode

router.get('/periode', async (_req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT p.*, u.nama_lengkap AS ditutup_nama FROM periode p LEFT JOIN pengguna u ON u.id = p.ditutup_oleh
        ORDER BY p.tahun DESC, p.bulan DESC`,
    ),
  );
});

/** Daftar periksa sebelum tutup buku (D03 bagian 10). */
export async function cekTutupBuku(db, tahun, bulan) {
  const awal = awalBulan(tahun, bulan);
  const akhir = akhirBulan(tahun, bulan);
  const hitung = async (sql, params) => (await satu(db, sql, params)).n;
  const butir = [];
  const tambah = (label, jumlah, catatan) => butir.push({ butir: label, jumlah, status: jumlah === 0 ? 'OK' : 'PERHATIAN', catatan });

  tambah('BKK bertanggal periode ini yang sudah disetujui tetapi belum dibayar',
    await hitung("SELECT COUNT(*) n FROM bukti_kas_keluar WHERE status = 'DISETUJUI' AND tanggal BETWEEN ? AND ?", [awal, akhir]),
    'Bayar atau batalkan sebelum tutup buku.');
  tambah('BKK bertanggal periode ini yang masih draf atau menunggu persetujuan',
    await hitung("SELECT COUNT(*) n FROM bukti_kas_keluar WHERE status IN ('DRAFT','DIAJUKAN','DITOLAK') AND tanggal BETWEEN ? AND ?", [awal, akhir]),
    'Selesaikan persetujuan atau batalkan.');
  tambah('Faktur diterima pada periode ini yang belum terverifikasi',
    await hitung("SELECT COUNT(*) n FROM faktur_pemasok WHERE status IN ('DRAFT','MENUNGGU_PERSETUJUAN','DITOLAK') AND tanggal_terima BETWEEN ? AND ?", [awal, akhir]),
    'Verifikasi agar utang periode ini lengkap.');
  tambah('Jurnal manual periode ini yang belum diputuskan',
    await hitung("SELECT COUNT(*) n FROM jurnal_manual WHERE status IN ('DRAFT','DIAJUKAN','DITOLAK') AND tanggal BETWEEN ? AND ?", [awal, akhir]),
    'Setujui, tolak, atau batalkan.');
  tambah('Pertanggungjawaban uang muka periode ini yang belum diputuskan',
    await hitung("SELECT COUNT(*) n FROM pertanggungjawaban_uang_muka WHERE status IN ('DIAJUKAN') AND tanggal BETWEEN ? AND ?", [awal, akhir]),
    'Beban uang muka belum masuk periode ini.');
  const rekening = await semua(db, 'SELECT id, kode, nama FROM rekening_kas WHERE aktif = 1 ORDER BY kode');
  for (const r of rekening) {
    const rb = await satu(db, 'SELECT status FROM rekonsiliasi_bank WHERE rekening_kas_id = ? AND tahun = ? AND bulan = ?', [r.id, tahun, bulan]);
    butir.push({
      butir: `Rekonsiliasi bank ${r.nama}`,
      jumlah: rb?.status === 'FINAL' ? 0 : 1,
      status: rb?.status === 'FINAL' ? 'OK' : 'PERHATIAN',
      catatan: rb ? (rb.status === 'FINAL' ? 'Sudah final.' : 'Masih draf.') : 'Belum dibuat.',
    });
  }
  tambah('Bukti kas kecil yang sudah dibayar tetapi belum diganti (semua dana)',
    await hitung("SELECT COUNT(*) n FROM pengeluaran_kas_kecil WHERE status = 'DIBAYAR' AND tanggal_bayar <= ?", [akhir]),
    'Ajukan pengisian kembali agar beban masuk periode ini.');
  return butir;
}

router.get('/periode/cek', async (req, res) => {
  const tahun = Number(req.query.tahun);
  const bulan = Number(req.query.bulan);
  if (!tahun || !bulan) throw galatMasukan('Tahun dan bulan wajib diisi.');
  res.json(await cekTutupBuku(pool, tahun, bulan));
});

const skemaPeriode = z.object({ tahun: z.coerce.number().int().min(2000).max(2100), bulan: z.coerce.number().int().min(1).max(12), alasan: teksOpsional(255) });

export async function ubahStatusPeriode(conn, ctx, input, statusBaru) {
  const { tahun, bulan, alasan } = validasi(skemaPeriode, input);
  if (statusBaru === 'BUKA' && !alasan) throw galatMasukan('Alasan membuka kembali periode wajib diisi.', { alasan: 'Wajib diisi.' });
  await jalankan(conn, 'INSERT IGNORE INTO periode (tahun, bulan) VALUES (?, ?)', [tahun, bulan]);
  const p = await satu(conn, 'SELECT * FROM periode WHERE tahun = ? AND bulan = ? FOR UPDATE', [tahun, bulan]);
  if (p.status === statusBaru) throw galatKonflik(`Periode ${namaPeriode(tahun, bulan)} sudah berstatus ${statusBaru === 'TUTUP' ? 'tutup' : 'buka'}.`);
  if (statusBaru === 'TUTUP') {
    await jalankan(conn, "UPDATE periode SET status = 'TUTUP', ditutup_oleh = ?, ditutup_pada = NOW() WHERE id = ?", [ctx.user.id, p.id]);
  } else {
    await jalankan(conn, "UPDATE periode SET status = 'BUKA', ditutup_oleh = NULL, ditutup_pada = NULL WHERE id = ?", [p.id]);
  }
  await catatAudit(conn, ctx, {
    aksi: statusBaru === 'TUTUP' ? 'TUTUP_PERIODE' : 'BUKA_PERIODE',
    entitas: 'periode',
    entitasId: p.id,
    ringkasan: `Periode ${namaPeriode(tahun, bulan)} ${statusBaru === 'TUTUP' ? 'ditutup' : `dibuka kembali: ${alasan}`}`,
  });
}

router.post('/periode/tutup', perlu('MANAJER_KEUANGAN'), async (req, res) => {
  await tx((conn) => ubahStatusPeriode(conn, req.ctx, req.body, 'TUTUP'));
  res.json({ ok: true });
});

router.post('/periode/buka', perlu('MANAJER_KEUANGAN'), async (req, res) => {
  await tx((conn) => ubahStatusPeriode(conn, req.ctx, req.body, 'BUKA'));
  res.json({ ok: true });
});
