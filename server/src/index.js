import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { config } from './config.js';
import { buatApp } from './app.js';
import { pool } from './db.js';

const app = buatApp();
const server = config.tls.cert && config.tls.key
  ? https.createServer({ cert: fs.readFileSync(config.tls.cert), key: fs.readFileSync(config.tls.key) }, app)
  : http.createServer(app);

server.listen(config.port, config.host, () => {
  const skema = config.tls.cert ? 'https' : 'http';
  console.log(`SIAPKas ${config.versi} berjalan di ${skema}://${config.host}:${config.port} (basis data ${config.db.database})`);
});

function berhenti() {
  console.log('Menghentikan server ...');
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', berhenti);
process.on('SIGTERM', berhenti);
