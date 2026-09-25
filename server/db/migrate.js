// Penjalan migrasi skema SIAPKas.
// Pemakaian: node db/migrate.js [--reset]
//   --reset  hapus dan buat ulang basis data (HANYA untuk pengembangan/uji)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../src/config.js';
import { hashSandi } from '../src/lib/sandi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, 'migrations');

export async function migrasi({ reset = false, database = config.db.database, diam = false } = {}) {
  const log = diam ? () => {} : (...a) => console.log(...a);
  const { database: _abaikan, ...koneksi } = config.db;
  const conn = await mysql.createConnection({ ...koneksi, multipleStatements: true, charset: 'utf8mb4_unicode_ci' });
  try {
    await conn.query("SET time_zone = '+07:00'");
    if (reset) {
      log(`Menghapus basis data ${database} ...`);
      await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    }
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${database}\``);
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      versi VARCHAR(100) NOT NULL PRIMARY KEY,
      dijalankan_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    const [sudah] = await conn.query('SELECT versi FROM schema_migrations');
    const sudahSet = new Set(sudah.map((r) => r.versi));
    const berkas = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const f of berkas) {
      if (sudahSet.has(f)) continue;
      log(`Menjalankan migrasi ${f} ...`);
      await conn.query(fs.readFileSync(path.join(DIR, f), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (versi) VALUES (?)', [f]);
    }

    // Akun administrator awal bila belum ada pengguna sama sekali.
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM pengguna');
    if (n === 0) {
      const sandi = process.env.ADMIN_PASSWORD_AWAL || 'Admin12345';
      const [[dept]] = await conn.query("SELECT id FROM departemen WHERE kode = 'TI'");
      const [res] = await conn.query(
        `INSERT INTO pengguna (username, nama_lengkap, jabatan, departemen_id, password_hash, harus_ganti_password)
         VALUES ('admin', 'Administrator Sistem', 'Administrator Sistem', ?, ?, 1)`,
        [dept.id, await hashSandi(sandi)],
      );
      await conn.query("INSERT INTO pengguna_peran (pengguna_id, peran_kode) VALUES (?, 'ADMIN')", [res.insertId]);
      log(`Akun awal dibuat: admin / ${sandi} (wajib diganti saat pertama masuk).`);
    }
    log('Migrasi selesai.');
  } finally {
    await conn.end();
  }
}

const dijalankanLangsung = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (dijalankanLangsung) {
  migrasi({ reset: process.argv.includes('--reset') }).catch((err) => {
    console.error('Migrasi gagal:', err.message);
    process.exit(1);
  });
}
