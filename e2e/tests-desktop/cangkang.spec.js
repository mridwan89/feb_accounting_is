// Cangkang desktop Electron: pengaturan alamat server, masuk, simpan PDF, pembatasan navigasi, dan konfigurasi tersimpan.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, _electron as electron } from '@playwright/test';

const DESKTOP = path.resolve(import.meta.dirname, '..', '..', 'desktop');
const BIN = path.join(DESKTOP, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');

test.skip(!fs.existsSync(BIN), 'Electron belum dipasang di folder desktop (npm install di folder desktop).');
test.skip(process.platform === 'linux' && !process.env.DISPLAY, 'Butuh layar; jalankan dengan xvfb-run.');

function jalankan(dataDir) {
  return electron.launch({
    executablePath: BIN,
    args: ['--no-sandbox', DESKTOP],
    env: { ...process.env, XDG_CONFIG_HOME: dataDir, APPDATA: dataDir, SIAPKAS_SERVER: '' },
  });
}

/**
 * Jendela pertama mulai memuat halaman sebelum Playwright tersambung, sehingga sesekali pencari elemen
 * Playwright tidak terpasang pada dokumen pertama (halaman tampil normal, tetapi locator menunggu tanpa akhir).
 * Tunggu sampai alamatnya sesuai, lalu muat ulang sekali agar dokumen dimuat saat Playwright sudah tersambung.
 */
async function jendelaPertama(aplikasi, alamat) {
  const win = await aplikasi.firstWindow();
  await win.waitForURL(alamat);
  await win.reload();
  return win;
}

test('cangkang desktop menghubungkan ke server, menyimpan PDF, dan menolak tautan luar', async ({ baseURL }) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siapkas-desktop-'));
  const pdfPath = path.join(dataDir, 'bkk-uji.pdf');

  const aplikasi = await jalankan(dataDir);
  const win = await jendelaPertama(aplikasi, /pengaturan\.html$/);
  await expect(win.getByRole('heading', { name: 'Hubungkan ke server SIAPKas' })).toBeVisible();
  expect(await win.evaluate(() => navigator.language)).toMatch(/^id/);

  await win.getByLabel('Alamat server').fill('http://localhost:1');
  await win.getByRole('button', { name: 'Uji koneksi' }).click();
  await expect(win.locator('#status')).toContainText('Tidak dapat terhubung');

  await win.getByLabel('Alamat server').fill(baseURL);
  await win.getByRole('button', { name: 'Uji koneksi' }).click();
  await expect(win.locator('#status')).toContainText('Terhubung ke SIAPKas versi');
  await win.getByRole('button', { name: 'Simpan dan buka SIAPKas' }).click();
  await win.waitForURL(/\/masuk/);

  await win.getByLabel('Nama pengguna').fill('akt1');
  await win.getByLabel('Kata sandi').fill('Demo2026');
  await win.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(win.getByRole('heading', { name: 'Beranda', level: 1 })).toBeVisible();

  // Simpan PDF memakai printToPDF Electron; dialog simpan diganti agar uji tidak menunggu pengguna.
  await aplikasi.evaluate(({ dialog }, lokasi) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: lokasi });
  }, pdfPath);
  await win.goto(`${baseURL}/cetak/BKK/1`);
  await win.getByRole('button', { name: 'Simpan sebagai PDF' }).click();
  await expect(win.locator('.toast').last()).toContainText('PDF tersimpan');
  expect(fs.readFileSync(pdfPath).subarray(0, 5).toString()).toBe('%PDF-');

  // Jendela baru dan navigasi ke alamat di luar server ditolak.
  const jumlah = aplikasi.windows().length;
  await win.evaluate(() => window.open('https://contoh.invalid/', '_blank'));
  await win.waitForTimeout(500);
  expect(aplikasi.windows().length).toBe(jumlah);
  await win.evaluate(() => {
    window.location.href = 'https://contoh.invalid/';
  });
  await win.waitForTimeout(500);
  expect(win.url().startsWith(baseURL)).toBe(true);
  await aplikasi.close();

  // Dibuka ulang: alamat server tersimpan sehingga langsung ke SIAPKas.
  const lagi = await jalankan(dataDir);
  const win2 = await jendelaPertama(lagi, (u) => u.href.startsWith(baseURL));
  await expect(win2.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
  await lagi.close();
});
