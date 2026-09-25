import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 20),
  dateStrings: true,
  decimalNumbers: true,
  timezone: '+07:00',
  charset: 'utf8mb4_unicode_ci',
});

// Setiap koneksi memakai zona waktu WIB agar NOW() dan CURRENT_TIMESTAMP konsisten.
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+07:00'");
});

/** Jalankan fungsi di dalam satu transaksi; rollback bila terjadi galat. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const hasil = await fn(conn);
    await conn.commit();
    return hasil;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // koneksi mungkin sudah terputus; galat asli yang dilaporkan
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function semua(db, sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

export async function satu(db, sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

export async function jalankan(db, sql, params = []) {
  const [res] = await db.query(sql, params);
  return res;
}
