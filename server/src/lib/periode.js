import { jalankan, satu } from '../db.js';
import { galatMasukan } from './galat.js';
import { namaPeriode, pecah } from './tanggal.js';

/**
 * Pastikan periode tanggal transaksi berstatus BUKA dan kunci baris periodenya (shared lock)
 * agar periode tidak dapat ditutup selagi transaksi ini berjalan. Periode dibuat otomatis
 * saat transaksi pertama pada bulan itu.
 */
export async function periodeBuka(conn, tanggal) {
  const { tahun, bulan } = pecah(tanggal);
  if (tahun < 2000 || tahun > 2100) throw galatMasukan(`Tanggal ${tanggal} di luar rentang yang diizinkan.`);
  await jalankan(conn, 'INSERT IGNORE INTO periode (tahun, bulan) VALUES (?, ?)', [tahun, bulan]);
  const p = await satu(conn, 'SELECT id, status FROM periode WHERE tahun = ? AND bulan = ? LOCK IN SHARE MODE', [tahun, bulan]);
  if (p.status !== 'BUKA') {
    throw galatMasukan(`Periode ${namaPeriode(tahun, bulan)} sudah ditutup. Gunakan tanggal pada periode yang masih buka.`);
  }
  return p.id;
}
