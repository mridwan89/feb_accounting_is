import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// Berkas .env bersifat opsional; variabel lingkungan yang sudah ada tidak ditimpa.
const envFile = process.env.SIAPKAS_ENV_FILE || path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const nilai = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = nilai;
  }
}

const env = process.env;

export const config = {
  versi: '1.0.0',
  port: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'siapkas',
    password: env.DB_PASSWORD || 'siapkas',
    database: env.DB_NAME || 'sia_pengeluaran',
    socketPath: env.DB_SOCKET || undefined,
  },
  lampiranDir: path.resolve(ROOT, env.LAMPIRAN_DIR || 'data/lampiran'),
  clientDist: path.resolve(ROOT, env.CLIENT_DIST || '../client/dist'),
  updatesDir: path.resolve(ROOT, env.UPDATES_DIR || 'data/pembaruan'),
  tls: {
    cert: env.TLS_CERT ? path.resolve(ROOT, env.TLS_CERT) : null,
    key: env.TLS_KEY ? path.resolve(ROOT, env.TLS_KEY) : null,
  },
  logRequest: env.LOG_REQUEST !== '0',
};
