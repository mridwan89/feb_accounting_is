import { jalankan } from '../db.js';
import { pecah } from './tanggal.js';

/**
 * Nomor dokumen berikutnya berformat KODE/TAHUN/BULAN/URUT, misalnya BKK/2026/10/0007.
 * Baris penghitung terkunci sampai transaksi selesai, sehingga nomor tidak pernah ganda,
 * dan ikut dibatalkan bila transaksi gagal sehingga urutan tidak berlubang.
 */
export async function nomorBaru(conn, kode, tanggal) {
  const { tahun, bulan } = pecah(tanggal);
  const hasil = await jalankan(
    conn,
    `INSERT INTO penomoran (kode, tahun, bulan, nomor_terakhir) VALUES (?, ?, ?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE nomor_terakhir = LAST_INSERT_ID(nomor_terakhir + 1)`,
    [kode, tahun, bulan],
  );
  const urut = Number(hasil.insertId);
  return `${kode}/${tahun}/${String(bulan).padStart(2, '0')}/${String(urut).padStart(4, '0')}`;
}
