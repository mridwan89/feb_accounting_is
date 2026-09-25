'use strict';
// Jembatan terbatas antara halaman dan proses utama. Halaman tidak mendapat akses Node.js;
// hanya fungsi di bawah ini yang tersedia sebagai window.siapkasDesktop.
const { contextBridge, ipcRenderer } = require('electron');

const argVersi = process.argv.find((a) => a.startsWith('--siapkas-versi='));

contextBridge.exposeInMainWorld('siapkasDesktop', {
  versi: argVersi ? argVersi.split('=')[1] : null,
  /** Simpan halaman yang sedang tampil sebagai PDF A4 (dipakai halaman cetak formulir). */
  simpanPdf: (namaBerkas) => ipcRenderer.invoke('simpan-pdf', namaBerkas),
  // Fungsi berikut hanya dilayani untuk halaman lokal cangkang (pengaturan dan galat).
  ujiServer: (alamat) => ipcRenderer.invoke('uji-server', alamat),
  simpanServer: (alamat) => ipcRenderer.invoke('simpan-server', alamat),
  infoHalaman: () => ipcRenderer.invoke('info-halaman'),
  muatUlang: () => ipcRenderer.invoke('muat-ulang'),
});
