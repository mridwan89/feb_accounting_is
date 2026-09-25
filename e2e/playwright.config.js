// Konfigurasi uji E2E: server SIAPKas dijalankan di port 3200 dengan basis data khusus uji (sia_pengeluaran_e2e)
// yang dibuat ulang dari data demo setiap kali uji dimulai. Skenario berjalan berurutan karena berbagi data.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT_E2E || 3200);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'laporan-uji' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    // Data demo dibuat ulang lebih dulu, baru server dinyalakan.
    command: 'node db/demo.js --reset && node src/index.js',
    cwd: '../server',
    url: `http://localhost:${PORT}/api/kesehatan`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      DB_NAME: process.env.DB_NAME_E2E || 'sia_pengeluaran_e2e',
      LAMPIRAN_DIR: 'data/lampiran-e2e',
      LOG_REQUEST: '0',
    },
  },
});
