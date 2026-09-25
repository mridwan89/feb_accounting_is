// Perangkat bantu uji E2E: masuk sebagai pengguna demo, memilih isian Kombo, notifikasi, dan PDF contoh.
import { expect } from '@playwright/test';

export const sandi = (username) => (username === 'admin' ? 'Admin12345' : 'Demo2026');

/** Escape teks agar aman dipakai di dalam RegExp (nomor dokumen memuat garis miring). */
export const pola = (teks) => new RegExp(String(teks).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));

export async function masuk(page, username, kataSandi = sandi(username)) {
  await page.goto('/masuk');
  await page.getByLabel('Nama pengguna').fill(username);
  await page.getByLabel('Kata sandi').fill(kataSandi);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}

/**
 * Buka sesi (konteks peramban) baru sebagai pengguna tertentu. window.print diganti penghitung
 * agar uji cetak tidak membuka dialog cetak.
 */
export async function sebagai(browser, username, { viewport = { width: 1440, height: 900 } } = {}) {
  const ctx = await browser.newContext({ locale: 'id-ID', timezoneId: 'Asia/Jakarta', viewport });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cetak = 0;
    window.print = () => {
      window.__cetak += 1;
    };
  });
  await masuk(page, username);
  await expect(page.getByRole('heading', { name: 'Beranda', level: 1 })).toBeVisible();
  return { page, tutup: () => ctx.close() };
}

/** Isi Kombo (pilihan dengan pencarian): ketik lalu tekan Enter untuk memilih hasil teratas. */
export async function pilihKombo(lokator, teks) {
  await lokator.click();
  await lokator.fill(teks);
  await lokator.press('Enter');
}

/** Pilih opsi pada <select> berdasarkan sebagian teks opsinya. */
export async function pilihOpsi(select, teks) {
  const nilai = await select.locator('option', { hasText: teks }).first().getAttribute('value');
  await select.selectOption(nilai);
}

export const notifikasi = (page) => page.locator('.toast').last();
export const statusDokumen = (page) => page.locator('.kepala .lencana').first();
export const judulHalaman = (page) => page.getByRole('heading', { level: 1 });

export async function selesaiMemuat(page) {
  await expect(page.locator('.memuat')).toHaveCount(0);
}

/** Setujui dokumen yang sedang terbuka lewat panel persetujuan. */
export async function setujui(page, catatan) {
  if (catatan) await page.getByLabel('Catatan').fill(catatan);
  await page.getByRole('button', { name: 'Setujui dokumen' }).click();
  await expect(notifikasi(page)).toContainText('disetujui');
}

/** Dokumen PDF kecil yang sah untuk diunggah sebagai lampiran. */
export function pdfContoh(judul) {
  const teks = `BT /F1 14 Tf 40 250 Td (${judul.replace(/[()\\]/g, '')}) Tj ET`;
  const obj = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(teks)} >>\nstream\n${teks}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let isi = '%PDF-1.4\n';
  const offset = [];
  obj.forEach((o, i) => {
    offset.push(Buffer.byteLength(isi));
    isi += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(isi);
  isi += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${offset.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  isi += `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(isi, 'latin1');
}
