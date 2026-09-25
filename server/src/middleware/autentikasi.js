import { pool, jalankan, satu, semua } from '../db.js';
import { GalatApp, galatAutentikasi } from '../lib/galat.js';
import { hashToken } from '../lib/sandi.js';
import { angkaPengaturan } from '../lib/pengaturan.js';

export const ipKlien = (req) => String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');

// Rute yang tetap boleh diakses saat pengguna wajib mengganti kata sandi.
const RUTE_GANTI_SANDI = new Set(['/auth/saya', '/auth/ganti-sandi', '/auth/keluar']);

export async function muatPengguna(db, id) {
  const u = await satu(
    db,
    `SELECT u.id, u.username, u.nama_lengkap, u.jabatan, u.nomor_pegawai, u.email, u.departemen_id, u.aktif, u.harus_ganti_password,
            d.kode AS departemen_kode, d.nama AS departemen_nama
       FROM pengguna u JOIN departemen d ON d.id = u.departemen_id WHERE u.id = ?`,
    [id],
  );
  if (!u) return null;
  const peran = await semua(db, 'SELECT peran_kode FROM pengguna_peran WHERE pengguna_id = ? ORDER BY peran_kode', [id]);
  return { ...u, harus_ganti_password: !!u.harus_ganti_password, aktif: !!u.aktif, peran: peran.map((p) => p.peran_kode) };
}

export async function autentikasi(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw galatAutentikasi('Silakan masuk terlebih dahulu.');

  const sesi = await satu(
    pool,
    `SELECT id, pengguna_id, dicabut_pada, (kedaluwarsa <= NOW()) AS lewat,
            TIMESTAMPDIFF(SECOND, aktivitas_terakhir, NOW()) AS detik_diam
       FROM sesi WHERE token_hash = ?`,
    [hashToken(token)],
  );
  if (!sesi || sesi.dicabut_pada) throw galatAutentikasi();

  const menit = await angkaPengaturan('sesi_timeout_menit', 30);
  if (sesi.lewat || sesi.detik_diam > menit * 60) {
    await jalankan(pool, "UPDATE sesi SET dicabut_pada = NOW(), alasan_cabut = 'KEDALUWARSA' WHERE id = ?", [sesi.id]);
    throw galatAutentikasi(`Sesi Anda berakhir karena tidak ada aktivitas selama ${menit} menit. Silakan masuk kembali.`);
  }

  const user = await muatPengguna(pool, sesi.pengguna_id);
  if (!user || !user.aktif) {
    await jalankan(pool, "UPDATE sesi SET dicabut_pada = NOW(), alasan_cabut = 'AKUN_NONAKTIF' WHERE id = ?", [sesi.id]);
    throw galatAutentikasi('Akun Anda sudah dinonaktifkan. Hubungi Administrator.');
  }
  if (sesi.detik_diam > 30) {
    await jalankan(pool, 'UPDATE sesi SET aktivitas_terakhir = NOW() WHERE id = ?', [sesi.id]);
  }

  req.user = user;
  req.ctx = { user, ip: ipKlien(req), sesiId: sesi.id };
  if (user.harus_ganti_password && !RUTE_GANTI_SANDI.has(req.path)) {
    throw new GalatApp(403, 'Anda wajib mengganti kata sandi sebelum memakai aplikasi.', { kode: 'GANTI_SANDI' });
  }
  next();
}
