import { jalankan } from '../db.js';

const kolomRahasia = new Set(['password_hash', 'token_hash']);

function bersihkan(data) {
  if (data === undefined || data === null) return null;
  if (typeof data !== 'object') return JSON.stringify(data);
  const salin = Array.isArray(data) ? data : { ...data };
  if (!Array.isArray(salin)) for (const k of kolomRahasia) delete salin[k];
  return JSON.stringify(salin);
}

/**
 * Catat satu entri log audit. Dipanggil di dalam transaksi yang sama dengan perubahan datanya
 * sehingga log dan data selalu konsisten.
 */
export async function catatAudit(db, ctx, { aksi, entitas, entitasId = null, ringkasan = null, sebelum = null, sesudah = null }) {
  await jalankan(
    db,
    `INSERT INTO log_audit (pengguna_id, username, ip, aksi, entitas, entitas_id, ringkasan, data_sebelum, data_sesudah)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx?.user?.id ?? null,
      ctx?.user?.username ?? null,
      ctx?.ip ?? null,
      aksi,
      entitas,
      entitasId === null ? null : String(entitasId),
      ringkasan ? String(ringkasan).slice(0, 500) : null,
      bersihkan(sebelum),
      bersihkan(sesudah),
    ],
  );
}
