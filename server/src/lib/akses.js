import { semua } from '../db.js';
import { galatAkses } from './galat.js';

export const PERAN_KEUANGAN = ['AKUNTANSI', 'SPV_AKUNTANSI', 'MANAJER_KEUANGAN', 'DIREKTUR', 'KASIR', 'AUDITOR'];

/** Apakah pengguna memegang salah satu peran? */
export const punya = (user, ...peran) => peran.flat().some((p) => user?.peran?.includes(p));

export function wajibPeran(user, ...peran) {
  if (!punya(user, ...peran)) throw galatAkses();
}

/** Middleware Express: hanya peran tertentu yang boleh mengakses rute. */
export const perlu =
  (...peran) =>
  (req, _res, next) => {
    if (!punya(req.user, ...peran)) return next(galatAkses());
    next();
  };

let petaNamaPeran = null;
export async function namaPeran(db, kode) {
  if (!petaNamaPeran) {
    const rows = await semua(db, 'SELECT kode, nama FROM peran');
    petaNamaPeran = new Map(rows.map((r) => [r.kode, r.nama]));
  }
  return petaNamaPeran.get(kode) || kode;
}

/** Aturan lihat untuk dokumen permintaan (PP, PUM, PJUM, PKK). */
export function bolehLihatPermintaan(user, doc) {
  if (punya(user, PERAN_KEUANGAN)) return true;
  if (doc.dibuat_oleh === user.id) return true;
  if (punya(user, 'KEPALA_DEPT') && doc.departemen_id === user.departemen_id) return true;
  if (punya(user, 'DIREKTUR')) return true;
  return false;
}

/** Potongan SQL untuk menyaring daftar dokumen permintaan sesuai hak lihat. */
export function saringPermintaan(user, alias = 'd') {
  if (punya(user, PERAN_KEUANGAN)) return { sql: '1 = 1', params: [] };
  if (punya(user, 'KEPALA_DEPT')) {
    return { sql: `(${alias}.dibuat_oleh = ? OR ${alias}.departemen_id = ?)`, params: [user.id, user.departemen_id] };
  }
  return { sql: `${alias}.dibuat_oleh = ?`, params: [user.id] };
}
