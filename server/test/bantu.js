import './env.js';
import request from 'supertest';
import { buatApp } from '../src/app.js';
import { migrasi } from '../db/migrate.js';
import { isiDemo, SANDI_DEMO, pdfContoh } from '../db/demo.js';
import { pool, satu, semua } from '../src/db.js';
import { aturHariIni } from '../src/lib/tanggal.js';
import { hapusCachePengaturan } from '../src/lib/pengaturan.js';

export const HARI_INI = '2026-09-25';
export const app = buatApp();

let siap = null;
/** Basis data uji baru berisi data demo, dengan "hari ini" dikunci agar hasil uji tidak bergantung tanggal. */
export function siapkan() {
  if (!siap) {
    siap = (async () => {
      await migrasi({ reset: true, diam: true });
      hapusCachePengaturan();
      aturHariIni(HARI_INI);
      await isiDemo({ log: () => {} });
      aturHariIni(HARI_INI);
    })();
  }
  return siap;
}

export async function tutup() {
  await pool.end();
}

export async function masuk(username, sandi = username === 'admin' ? 'Admin12345' : SANDI_DEMO) {
  const r = await request(app).post('/api/auth/masuk').send({ username, password: sandi });
  if (r.status !== 200) throw new Error(`Gagal masuk sebagai ${username}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

/** Klien API yang sudah membawa token pengguna tertentu. */
export async function sebagai(username, sandi) {
  const token = await masuk(username, sandi);
  const pasang = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    token,
    get: (url) => pasang(request(app).get(url)),
    post: (url, body = {}) => pasang(request(app).post(url)).send(body),
    put: (url, body = {}) => pasang(request(app).put(url)).send(body),
    delete: (url) => pasang(request(app).delete(url)),
    unggah: (url, nama, buffer) => pasang(request(app).post(url)).attach('berkas', buffer, nama),
  };
}

export const id = async (tabel, kolom, nilai) => (await satu(pool, `SELECT id FROM ${tabel} WHERE ${kolom} = ?`, [nilai]))?.id;
export const idAkun = (kode) => id('akun', 'kode', kode);
export const idPemasok = (kode) => id('pemasok', 'kode', kode);
export const idPengguna = (username) => id('pengguna', 'username', username);
export const idRekening = (kode) => id('rekening_kas', 'kode', kode);
export const idDept = (kode) => id('departemen', 'kode', kode);

/** Setujui semua langkah persetujuan dokumen memakai klien penyetuju yang diberikan berurutan. */
export async function setujui(jenis, dokumenId, ...klien) {
  for (const k of klien) {
    const r = await k.post(`/api/persetujuan/${jenis}/${dokumenId}/setujui`, { catatan: 'Disetujui dalam uji' });
    if (r.status !== 200) throw new Error(`Gagal menyetujui ${jenis} ${dokumenId}: ${r.status} ${JSON.stringify(r.body)}`);
  }
}

export { pool, satu, semua, pdfContoh, aturHariIni };
