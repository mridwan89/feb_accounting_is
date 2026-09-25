'use strict';
// Konfigurasi alamat server SIAPKas.
// Urutan sumber (yang belakangan menimpa yang sebelumnya):
//   1. konfigurasi pengguna  : %APPDATA%\SIAPKas\konfigurasi.json (diisi dari halaman pengaturan)
//   2. konfigurasi mesin     : %ProgramData%\SIAPKas\konfigurasi.json, lalu konfigurasi.json di folder aplikasi
//   3. variabel lingkungan   : SIAPKAS_SERVER (untuk uji)
// Konfigurasi mesin dipasang Bagian TI saat distribusi ke 200 PC. Bila memuat "kunci_alamat": true,
// pengguna tidak dapat mengganti alamat server dari aplikasi.
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const lokasiPengguna = () => path.join(app.getPath('userData'), 'konfigurasi.json');

function lokasiMesin() {
  const daftar = [];
  if (process.env.ProgramData) daftar.push(path.join(process.env.ProgramData, 'SIAPKas', 'konfigurasi.json'));
  daftar.push(path.join(path.dirname(app.getPath('exe')), 'konfigurasi.json'));
  return daftar;
}

function baca(lokasi) {
  try {
    return JSON.parse(fs.readFileSync(lokasi, 'utf8'));
  } catch {
    return {};
  }
}

/** Rapikan alamat: tambahkan skema bila tidak ada dan buang garis miring di akhir. Menghasilkan null bila tidak sah. */
function normalkanAlamat(teks) {
  if (!teks) return null;
  let s = String(teks).trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname) return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

function bacaKonfigurasi() {
  const pengguna = baca(lokasiPengguna());
  const mesin = Object.assign({}, ...lokasiMesin().map(baca));
  const k = { ...pengguna, ...mesin };
  if (process.env.SIAPKAS_SERVER) k.server = process.env.SIAPKAS_SERVER;
  k.server = normalkanAlamat(k.server);
  k.dikunci = Boolean(mesin.server && mesin.kunci_alamat);
  return k;
}

function simpanAlamatPengguna(server) {
  const lokasi = lokasiPengguna();
  fs.mkdirSync(path.dirname(lokasi), { recursive: true });
  fs.writeFileSync(lokasi, JSON.stringify({ ...baca(lokasi), server }, null, 2));
}

module.exports = { bacaKonfigurasi, simpanAlamatPengguna, normalkanAlamat };
