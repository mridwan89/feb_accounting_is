import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { pool, satu } from './db.js';
import { GalatApp } from './lib/galat.js';
import { autentikasi } from './middleware/autentikasi.js';
import { ruteTerbuka, router as ruteAuth } from './modules/auth.js';
import { router as ruteAdmin } from './modules/admin.js';
import { router as ruteMaster } from './modules/master.js';
import { router as rutePembelian } from './modules/pembelian.js';
import { router as ruteFaktur } from './modules/faktur.js';
import { router as rutePermintaan } from './modules/permintaan.js';
import { router as ruteUangMuka } from './modules/uangmuka.js';
import { router as ruteKasKecil } from './modules/kaskecil.js';
import { router as ruteBkk } from './modules/bkk.js';
import { router as rutePembayaran } from './modules/pembayaran.js';
import { router as ruteAkuntansi } from './modules/akuntansi.js';
import { router as ruteRekonsiliasi } from './modules/rekonsiliasi.js';
import { router as rutePersetujuan } from './modules/persetujuan.js';
import { router as ruteLampiran } from './modules/lampiran.js';
import { router as ruteLaporan } from './modules/laporan.js';
import { router as ruteDasbor } from './modules/dasbor.js';

function pencatatPermintaan(req, res, next) {
  const mulai = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - mulai) / 1e6;
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}

function penanganGalat(err, req, res, _next) {
  if (err instanceof GalatApp) {
    return res.status(err.status).json({ pesan: err.message, galat: err.detail?.kode ? undefined : err.detail, kode: err.detail?.kode });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ pesan: 'Format data yang dikirim tidak valid.' });
  }
  if (err?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ pesan: 'Data yang sama sudah tercatat. Periksa nomor atau kode yang dimasukkan.' });
  }
  if (err?.errno === 4025 || err?.code === 'ER_CONSTRAINT_FAILED') {
    return res.status(400).json({ pesan: 'Data melanggar aturan validasi basis data. Periksa kembali nilai yang dimasukkan.' });
  }
  if (err?.code === 'ER_ROW_IS_REFERENCED_2' || err?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(409).json({ pesan: 'Data masih terkait dengan data lain sehingga tidak dapat diproses.' });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ pesan: 'Ukuran berkas melebihi batas.' });
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ pesan: 'Terjadi kesalahan di server. Coba lagi; bila berulang, hubungi Administrator.' });
}

export function buatApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: !!config.tls.cert,
    }),
  );
  if (config.logRequest) app.use(pencatatPermintaan);
  app.use(express.json({ limit: '2mb' }));

  const api = express.Router();
  api.get('/kesehatan', async (_req, res) => {
    const r = await satu(pool, 'SELECT NOW() AS waktu, VERSION() AS versi_db');
    res.json({ status: 'ok', versi: config.versi, waktu_server: r.waktu, basis_data: r.versi_db });
  });
  api.use(ruteTerbuka);
  api.use(autentikasi);
  for (const r of [
    ruteAuth, ruteAdmin, ruteMaster, rutePembelian, ruteFaktur, rutePermintaan, ruteUangMuka, ruteKasKecil, ruteBkk,
    rutePembayaran, ruteAkuntansi, ruteRekonsiliasi, rutePersetujuan, ruteLampiran, ruteLaporan, ruteDasbor,
  ]) {
    api.use(r);
  }
  api.use((_req, res) => res.status(404).json({ pesan: 'Alamat API tidak dikenal.' }));
  app.use('/api', api);

  // Berkas pembaruan cangkang desktop (electron-updater, penyedia generic).
  app.use('/pembaruan', express.static(config.updatesDir, { fallthrough: false }));

  // Antarmuka React hasil build disajikan dari server yang sama (thin client).
  if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(penanganGalat);
  return app;
}
