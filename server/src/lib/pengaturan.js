import { pool, semua, satu } from '../db.js';
import { galatMasukan } from './galat.js';

let cache = null;
let cacheWaktu = 0;
const UMUR_CACHE_MS = 30_000;

export function hapusCachePengaturan() {
  cache = null;
  akunCache.clear();
}

/** Ambil seluruh pengaturan sebagai objek { kunci: nilai }. */
export async function ambilPengaturan(db = pool) {
  if (cache && Date.now() - cacheWaktu < UMUR_CACHE_MS) return cache;
  const rows = await semua(db, 'SELECT kunci, nilai FROM pengaturan');
  cache = Object.fromEntries(rows.map((r) => [r.kunci, r.nilai]));
  cacheWaktu = Date.now();
  return cache;
}

export async function angkaPengaturan(kunci, bawaan, db = pool) {
  const p = await ambilPengaturan(db);
  const n = Number(p[kunci]);
  return Number.isFinite(n) ? n : bawaan;
}

const akunCache = new Map();

/** Akun sistem dari pemetaan pengaturan, misalnya 'akun_utang_usaha'. */
export async function akunSistem(kunciPengaturan, db = pool) {
  const p = await ambilPengaturan(db);
  const kode = p[kunciPengaturan];
  if (!kode) throw galatMasukan(`Pengaturan ${kunciPengaturan} belum diisi. Hubungi Administrator.`);
  if (akunCache.has(kode)) return akunCache.get(kode);
  const akun = await satu(db, 'SELECT id, kode, nama FROM akun WHERE kode = ?', [kode]);
  if (!akun) throw galatMasukan(`Akun ${kode} pada pengaturan ${kunciPengaturan} tidak ditemukan di bagan akun.`);
  akunCache.set(kode, akun);
  return akun;
}
