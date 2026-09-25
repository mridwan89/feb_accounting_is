'use strict';
// Proses utama aplikasi desktop SIAPKas.
// Cangkang ini tidak memuat logika bisnis: antarmuka dimuat dari server SIAPKas di LAN (ADR-01), sehingga
// seluruh PC selalu memakai versi antarmuka yang sama. Cangkang hanya menangani jendela, keamanan navigasi,
// cetak/simpan PDF, dan pembaruan dirinya sendiri dari folder /pembaruan di server.
const fs = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, Menu, dialog, ipcMain, net, session } = require('electron');
const { bacaKonfigurasi, simpanAlamatPengguna, normalkanAlamat } = require('./konfigurasi');

// Mode pengembang (alat pengembang aktif): npm run dev, atau variabel lingkungan SIAPKAS_DEV=1.
const MODE_PENGEMBANG = process.argv.includes('--siapkas-dev') || process.env.SIAPKAS_DEV === '1';
const HALAMAN = (nama) => path.join(__dirname, 'halaman', `${nama}.html`);

let jendela = null;
let konfig = {};
let pembaruanDiperiksa = false;

app.setName('SIAPKas');
app.commandLine.appendSwitch('lang', 'id');

const asal = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};
const dariServer = (url) => Boolean(konfig.server) && asal(url) === asal(konfig.server);
const dariHalamanLokal = (url) => String(url || '').startsWith('file://');

function opsiWeb() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: false,
    devTools: MODE_PENGEMBANG,
    additionalArguments: [`--siapkas-versi=${app.getVersion()}`],
  };
}

function buatJendela() {
  jendela = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    title: 'SIAPKas',
    show: false,
    backgroundColor: '#f3f5f8',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: opsiWeb(),
  });
  jendela.once('ready-to-show', () => jendela.show());
  jendela.on('closed', () => {
    jendela = null;
  });
  pasangPengaman(jendela.webContents);
  muat();
}

/** Batasi navigasi: hanya server SIAPKas dan halaman lokal cangkang; tautan lain ditolak. */
function pasangPengaman(wc) {
  wc.setWindowOpenHandler(({ url }) => {
    if (dariServer(url) || url.startsWith('blob:')) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 1100, height: 820, autoHideMenuBar: true, webPreferences: opsiWeb() } };
    }
    return { action: 'deny' };
  });
  wc.on('did-create-window', (anak) => pasangPengaman(anak.webContents));
  wc.on('will-navigate', (event, url) => {
    if (!dariServer(url) && !dariHalamanLokal(url)) event.preventDefault();
  });
  wc.on('did-fail-load', (_e, kode, deskripsi, url, bingkaiUtama) => {
    // -3 = navigasi dibatalkan (misalnya pindah halaman cepat); bukan galat koneksi.
    if (bingkaiUtama && kode !== -3 && wc === jendela?.webContents) tampilkanGalat(`${deskripsi} (${kode})`, url);
  });
  wc.on('render-process-gone', async (_e, detail) => {
    if (wc !== jendela?.webContents) return;
    const r = await dialog.showMessageBox(jendela, {
      type: 'error',
      title: 'SIAPKas berhenti',
      message: 'Tampilan SIAPKas berhenti tidak terduga.',
      detail: `Sebab: ${detail.reason}. Data yang sudah disimpan tidak hilang. Muat ulang untuk melanjutkan.`,
      buttons: ['Muat ulang', 'Tutup aplikasi'],
    });
    if (r.response === 0) muat();
    else app.quit();
  });
}

function muat() {
  konfig = bacaKonfigurasi();
  buatMenu();
  if (!konfig.server) {
    jendela.loadFile(HALAMAN('pengaturan'));
    return;
  }
  jendela.loadURL(konfig.server);
  if (!pembaruanDiperiksa) periksaPembaruan(false);
}

function tampilkanGalat(pesan, alamat) {
  jendela.loadFile(HALAMAN('galat'), { query: { pesan, alamat: alamat || konfig.server || '', dikunci: konfig.dikunci ? '1' : '0' } });
}

function buatMenu() {
  const templat = [
    {
      label: 'Berkas',
      submenu: [
        { label: 'Beranda SIAPKas', accelerator: 'Alt+Home', enabled: Boolean(konfig.server), click: () => jendela?.loadURL(konfig.server) },
        { label: 'Muat ulang', accelerator: 'F5', click: () => jendela?.webContents.reload() },
        { type: 'separator' },
        { label: 'Ubah alamat server...', enabled: !konfig.dikunci, click: () => jendela?.loadFile(HALAMAN('pengaturan')) },
        { type: 'separator' },
        { label: 'Keluar dari aplikasi', accelerator: 'Alt+F4', role: 'quit' },
      ],
    },
    {
      label: 'Sunting',
      submenu: [
        { label: 'Batalkan', role: 'undo' },
        { label: 'Ulangi', role: 'redo' },
        { type: 'separator' },
        { label: 'Potong', role: 'cut' },
        { label: 'Salin', role: 'copy' },
        { label: 'Tempel', role: 'paste' },
        { label: 'Pilih semua', role: 'selectAll' },
      ],
    },
    {
      label: 'Tampilan',
      submenu: [
        { label: 'Perbesar', role: 'zoomIn' },
        { label: 'Perkecil', role: 'zoomOut' },
        { label: 'Ukuran normal', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Layar penuh', role: 'togglefullscreen' },
        ...(MODE_PENGEMBANG ? [{ type: 'separator' }, { label: 'Alat pengembang', role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Bantuan',
      submenu: [
        { label: 'Periksa pembaruan', click: () => periksaPembaruan(true) },
        { label: 'Tentang SIAPKas', click: tentang },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(templat));
}

function tentang() {
  dialog.showMessageBox(jendela, {
    type: 'info',
    title: 'Tentang SIAPKas',
    message: `SIAPKas desktop versi ${app.getVersion()}`,
    detail: [
      'Sistem Informasi Akuntansi Pengeluaran Kas.',
      `Server: ${konfig.server || 'belum diatur'}${konfig.dikunci ? ' (diatur Bagian TI)' : ''}`,
      `Electron ${process.versions.electron}, Chromium ${process.versions.chrome}`,
    ].join('\n'),
  });
}

/** Pembaruan cangkang dari server lokal (electron-updater, penyedia generic). Hanya untuk aplikasi terpasang. */
function periksaPembaruan(manual) {
  if (!app.isPackaged || !konfig.server) {
    if (manual) {
      dialog.showMessageBox(jendela, { type: 'info', title: 'Pembaruan', message: 'Pemeriksaan pembaruan hanya berjalan pada aplikasi yang sudah dipasang dan terhubung ke server.' });
    }
    return;
  }
  pembaruanDiperiksa = true;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.setFeedURL({ provider: 'generic', url: `${konfig.server}/pembaruan` });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.removeAllListeners();
  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox(jendela, {
      type: 'info',
      title: 'Pembaruan SIAPKas',
      message: `Versi ${info.version} sudah diunduh.`,
      detail: 'Pilih Nanti bila masih ada pekerjaan yang belum disimpan; pembaruan dipasang otomatis saat aplikasi ditutup.',
      buttons: ['Pasang dan mulai ulang', 'Nanti'],
      defaultId: 0,
      cancelId: 1,
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  if (manual) {
    autoUpdater.once('update-not-available', () => dialog.showMessageBox(jendela, { type: 'info', title: 'Pembaruan', message: `Aplikasi sudah versi terbaru (${app.getVersion()}).` }));
  }
  autoUpdater.checkForUpdates().catch((e) => {
    if (manual) dialog.showErrorBox('Pembaruan gagal diperiksa', `${e.message}\n\nPastikan folder pembaruan di server sudah diisi Bagian TI.`);
  });
}

// ---------------------------------------------------------------- IPC untuk halaman

async function ujiServer(alamat) {
  const server = normalkanAlamat(alamat);
  if (!server) return { ok: false, pesan: 'Alamat server tidak sah. Contoh: https://siapkas.kantor.local:3000' };
  try {
    const pengendali = new AbortController();
    const batas = setTimeout(() => pengendali.abort(), 8000);
    const res = await net.fetch(`${server}/api/kesehatan`, { signal: pengendali.signal });
    clearTimeout(batas);
    if (!res.ok) return { ok: false, pesan: `Server menjawab dengan kode ${res.status}. Pastikan alamat mengarah ke server SIAPKas.` };
    const data = await res.json();
    if (data.status !== 'ok') return { ok: false, pesan: 'Server menjawab, tetapi bukan server SIAPKas.' };
    return { ok: true, server, versi: data.versi, waktu: data.waktu_server };
  } catch (e) {
    return { ok: false, pesan: e.name === 'AbortError' ? 'Server tidak menjawab dalam 8 detik.' : `Tidak dapat terhubung: ${e.message}` };
  }
}

function pasangIpc() {
  ipcMain.handle('uji-server', (event, alamat) => {
    if (!dariHalamanLokal(event.senderFrame?.url)) return { ok: false, pesan: 'Tidak diizinkan.' };
    return ujiServer(alamat);
  });
  ipcMain.handle('simpan-server', async (event, alamat) => {
    if (!dariHalamanLokal(event.senderFrame?.url)) return { ok: false, pesan: 'Tidak diizinkan.' };
    if (konfig.dikunci) return { ok: false, pesan: 'Alamat server diatur Bagian TI dan tidak dapat diubah dari aplikasi.' };
    const hasil = await ujiServer(alamat);
    if (!hasil.ok) return hasil;
    simpanAlamatPengguna(hasil.server);
    muat();
    return { ok: true };
  });
  ipcMain.handle('info-halaman', (event) => {
    if (!dariHalamanLokal(event.senderFrame?.url)) return {};
    return { server: konfig.server, dikunci: konfig.dikunci, versi: app.getVersion() };
  });
  ipcMain.handle('muat-ulang', (event) => {
    if (!dariHalamanLokal(event.senderFrame?.url) && !dariServer(event.senderFrame?.url)) return;
    muat();
  });
  ipcMain.handle('simpan-pdf', async (event, namaBerkas) => {
    if (!dariServer(event.senderFrame?.url)) return { ok: false, pesan: 'Tidak diizinkan.' };
    const induk = BrowserWindow.fromWebContents(event.sender) || jendela;
    const nama = String(namaBerkas || 'dokumen-siapkas').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120);
    const pilih = await dialog.showSaveDialog(induk, {
      title: 'Simpan sebagai PDF',
      defaultPath: path.join(app.getPath('documents'), `${nama}.pdf`),
      filters: [{ name: 'Dokumen PDF', extensions: ['pdf'] }],
    });
    if (pilih.canceled || !pilih.filePath) return { ok: false, batal: true };
    const pdf = await event.sender.printToPDF({ printBackground: true, preferCSSPageSize: true });
    await fs.writeFile(pilih.filePath, pdf);
    return { ok: true, lokasi: pilih.filePath };
  });
}

// ---------------------------------------------------------------- siklus hidup

if (!app.requestSingleInstanceLock()) {
  // SIAPKas sudah terbuka di PC ini: instans pertama menampilkan jendelanya, instans ini langsung berhenti.
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!jendela) return;
    if (jendela.isMinimized()) jendela.restore();
    jendela.focus();
  });

  // Sertifikat server internal: bila CA perusahaan belum terpasang di Windows, Bagian TI dapat menyematkan
  // sidik jari sertifikat server (format "sha256/...") di konfigurasi mesin.
  app.on('certificate-error', (event, _wc, url, _galat, sertifikat, callback) => {
    const sidik = konfig.sertifikat_sidik_jari;
    if (sidik && dariServer(url) && sertifikat.fingerprint === sidik) {
      event.preventDefault();
      callback(true);
      return;
    }
    callback(false);
  });

  app.whenReady().then(() => {
    // Aplikasi tidak memerlukan kamera, mikrofon, lokasi, atau notifikasi.
    session.defaultSession.setPermissionRequestHandler((_wc, _izin, callback) => callback(false));
    pasangIpc();
    buatJendela();
  });

  app.on('window-all-closed', () => app.quit());
}
