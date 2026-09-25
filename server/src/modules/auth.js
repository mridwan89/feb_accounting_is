import { Router } from 'express';
import { pool, tx, jalankan, satu } from '../db.js';
import { GalatApp, galatAutentikasi, galatMasukan } from '../lib/galat.js';
import { z, validasi } from '../lib/validasi.js';
import { cocokSandi, hashSandi, buatToken, hashToken, periksaKebijakanSandi } from '../lib/sandi.js';
import { catatAudit } from '../lib/audit.js';
import { ambilPengaturan, angkaPengaturan } from '../lib/pengaturan.js';
import { ipKlien, muatPengguna } from '../middleware/autentikasi.js';

export const ruteTerbuka = Router();
export const router = Router();

// Pembatas percobaan masuk per alamat IP (lapis kedua di samping kunci akun).
// Hanya percobaan yang gagal yang dihitung, sehingga banyak pengguna yang masuk dengan benar tidak terhalang.
const BATAS_GAGAL_IP = 30;
const gagalIp = new Map();
function periksaBatasIp(ip) {
  const catatan = gagalIp.get(ip);
  if (catatan && catatan.reset > Date.now() && catatan.n >= BATAS_GAGAL_IP) {
    throw new GalatApp(429, 'Terlalu banyak percobaan masuk yang gagal dari komputer ini. Tunggu 10 menit, lalu coba lagi.');
  }
}
function catatGagalIp(ip) {
  const kini = Date.now();
  const catatan = gagalIp.get(ip);
  if (!catatan || catatan.reset < kini) gagalIp.set(ip, { n: 1, reset: kini + 10 * 60_000 });
  else catatan.n += 1;
}

const skemaMasuk = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });

export async function masuk({ username, password, ip, userAgent }) {
  periksaBatasIp(ip);
  const maksGagal = await angkaPengaturan('maks_gagal_login', 5);
  const menitKunci = await angkaPengaturan('durasi_kunci_menit', 15);
  const salahUmum = 'Nama pengguna atau kata sandi salah.';

  return tx(async (conn) => {
    const u = await satu(
      conn,
      `SELECT id, username, password_hash, aktif, gagal_login,
              terkunci_sampai, (terkunci_sampai IS NOT NULL AND terkunci_sampai > NOW()) AS terkunci
         FROM pengguna WHERE username = ? FOR UPDATE`,
      [username],
    );
    const ctxTamu = { user: u ? { id: u.id, username: u.username } : { id: null, username }, ip };
    if (!u) {
      await catatAudit(conn, ctxTamu, { aksi: 'GAGAL_MASUK', entitas: 'pengguna', ringkasan: `Nama pengguna tidak dikenal: ${username}` });
      return { galat: galatAutentikasi(salahUmum) };
    }
    if (u.terkunci) {
      return { galat: galatAutentikasi(`Akun terkunci sampai ${u.terkunci_sampai.slice(11, 16)} WIB karena ${maksGagal} kali gagal masuk. Tunggu, atau hubungi Administrator untuk membuka kunci.`) };
    }
    if (!u.aktif) {
      await catatAudit(conn, ctxTamu, { aksi: 'GAGAL_MASUK', entitas: 'pengguna', entitasId: u.id, ringkasan: 'Akun nonaktif' });
      return { galat: galatAutentikasi('Akun Anda nonaktif. Hubungi Administrator.') };
    }
    if (!(await cocokSandi(password, u.password_hash))) {
      const gagal = u.gagal_login + 1;
      if (gagal >= maksGagal) {
        await jalankan(conn, 'UPDATE pengguna SET gagal_login = 0, terkunci_sampai = NOW() + INTERVAL ? MINUTE WHERE id = ?', [menitKunci, u.id]);
        await catatAudit(conn, ctxTamu, { aksi: 'KUNCI_AKUN', entitas: 'pengguna', entitasId: u.id, ringkasan: `Terkunci ${menitKunci} menit setelah ${gagal} kali gagal masuk` });
        return { galat: galatAutentikasi(`Kata sandi salah ${gagal} kali. Akun dikunci ${menitKunci} menit.`) };
      }
      await jalankan(conn, 'UPDATE pengguna SET gagal_login = ? WHERE id = ?', [gagal, u.id]);
      await catatAudit(conn, ctxTamu, { aksi: 'GAGAL_MASUK', entitas: 'pengguna', entitasId: u.id, ringkasan: `Kata sandi salah (${gagal}/${maksGagal})` });
      return { galat: galatAutentikasi(salahUmum) };
    }

    const token = buatToken();
    const jamMaks = await angkaPengaturan('sesi_maks_jam', 12);
    await jalankan(
      conn,
      `INSERT INTO sesi (pengguna_id, token_hash, kedaluwarsa, ip, user_agent)
       VALUES (?, ?, NOW() + INTERVAL ? HOUR, ?, ?)`,
      [u.id, hashToken(token), jamMaks, ip, String(userAgent || '').slice(0, 255)],
    );
    await jalankan(conn, 'UPDATE pengguna SET gagal_login = 0, terkunci_sampai = NULL, terakhir_login = NOW() WHERE id = ?', [u.id]);
    await catatAudit(conn, ctxTamu, { aksi: 'MASUK', entitas: 'pengguna', entitasId: u.id, ringkasan: 'Berhasil masuk' });
    return { token, pengguna: await muatPengguna(conn, u.id) };
  });
}

ruteTerbuka.post('/auth/masuk', async (req, res) => {
  const data = validasi(skemaMasuk, req.body);
  const ip = ipKlien(req);
  const hasil = await masuk({ ...data, ip, userAgent: req.get('user-agent') });
  if (hasil.galat) {
    catatGagalIp(ip);
    throw hasil.galat;
  }
  res.json(hasil);
});

router.post('/auth/keluar', async (req, res) => {
  await tx(async (conn) => {
    await jalankan(conn, "UPDATE sesi SET dicabut_pada = NOW(), alasan_cabut = 'KELUAR' WHERE id = ?", [req.ctx.sesiId]);
    await catatAudit(conn, req.ctx, { aksi: 'KELUAR', entitas: 'pengguna', entitasId: req.user.id, ringkasan: 'Keluar' });
  });
  res.json({ ok: true });
});

router.get('/auth/saya', async (req, res) => {
  const p = await ambilPengaturan(pool);
  const institusi = Object.fromEntries(Object.entries(p).filter(([k]) => k.startsWith('institusi_')));
  res.json({ pengguna: req.user, institusi, sesi_timeout_menit: Number(p.sesi_timeout_menit || 30) });
});

const skemaGanti = z.object({ password_lama: z.string().min(1), password_baru: z.string().min(1) });

router.post('/auth/ganti-sandi', async (req, res) => {
  const data = validasi(skemaGanti, req.body);
  const panjangMin = await angkaPengaturan('min_panjang_password', 8);
  await tx(async (conn) => {
    const u = await satu(conn, 'SELECT id, username, password_hash FROM pengguna WHERE id = ? FOR UPDATE', [req.user.id]);
    if (!(await cocokSandi(data.password_lama, u.password_hash))) {
      throw galatMasukan('Kata sandi lama salah.', { password_lama: 'Kata sandi lama salah.' });
    }
    const pesan = periksaKebijakanSandi(data.password_baru, u.username, panjangMin);
    if (pesan) throw galatMasukan(pesan, { password_baru: pesan });
    if (await cocokSandi(data.password_baru, u.password_hash)) {
      throw galatMasukan('Kata sandi baru harus berbeda dari kata sandi lama.', { password_baru: 'Harus berbeda dari kata sandi lama.' });
    }
    await jalankan(
      conn,
      'UPDATE pengguna SET password_hash = ?, harus_ganti_password = 0, password_diubah_pada = NOW() WHERE id = ?',
      [await hashSandi(data.password_baru), u.id],
    );
    // Sesi lain milik pengguna ini diakhiri; sesi yang sedang dipakai tetap berjalan.
    await jalankan(
      conn,
      "UPDATE sesi SET dicabut_pada = NOW(), alasan_cabut = 'GANTI_SANDI' WHERE pengguna_id = ? AND id <> ? AND dicabut_pada IS NULL",
      [u.id, req.ctx.sesiId],
    );
    await catatAudit(conn, req.ctx, { aksi: 'GANTI_SANDI', entitas: 'pengguna', entitasId: u.id, ringkasan: 'Kata sandi diganti' });
  });
  res.json({ ok: true, pengguna: await muatPengguna(pool, req.user.id) });
});
