// US-08, US-03, US-06, KF-DOK-01, KF-DOK-04: permintaan pembayaran dari pemohon sampai dibayar Kasir, lalu dicetak.
import { test, expect } from '@playwright/test';
import { judulHalaman, notifikasi, pdfContoh, pilihKombo, pilihOpsi, pola, sebagai, selesaiMemuat, setujui, statusDokumen } from './bantu.js';

test.describe.serial('Permintaan pembayaran sampai dibayar', () => {
  let nomorPP;
  let urlPP;
  let nomorBKK;
  let urlBKK;

  test('pemohon membuat permintaan, sistem menolak pengajuan tanpa lampiran, lalu pengajuan berhasil', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'dosen1');
    await page.getByRole('link', { name: 'Permintaan pembayaran', exact: true }).click();
    await page.getByRole('link', { name: 'Buat permintaan' }).click();
    await page.getByLabel('Nama penerima').fill('CV Katering Sehat');
    await page.getByLabel('Bank penerima').fill('BRI');
    await page.getByLabel('Nomor rekening').fill('0011223344');
    await page.getByLabel('Atas nama').fill('CV Katering Sehat');
    await page.getByLabel('Keterangan').fill('Konsumsi pelatihan penulisan artikel ilmiah dosen');
    const baris = page.locator('table.editor-baris tbody tr').first();
    await baris.getByLabel('Uraian').fill('Makan siang 50 peserta');
    await pilihKombo(baris.getByRole('combobox'), '6-1110');
    await baris.getByLabel('Jumlah').fill('1250000');
    await expect(page.locator('tfoot')).toContainText('Rp1.250.000');
    await page.getByRole('button', { name: 'Simpan sebagai draf' }).click();

    await expect(judulHalaman(page)).toHaveText(/^PP\/\d{4}\/\d{2}\/\d{4}$/);
    nomorPP = await judulHalaman(page).innerText();
    urlPP = page.url();
    await expect(statusDokumen(page)).toHaveText('Draf');
    await expect(page.getByText('Satu juta dua ratus lima puluh ribu rupiah')).toBeVisible();

    await page.getByRole('button', { name: 'Ajukan permintaan' }).click();
    await expect(notifikasi(page)).toContainText('belum punya lampiran');

    await page.locator('input[type=file]').setInputFiles({ name: 'nota-katering.pdf', mimeType: 'application/pdf', buffer: pdfContoh('Nota katering') });
    await expect(page.getByRole('button', { name: 'nota-katering.pdf', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ajukan permintaan' }).click();
    await expect(statusDokumen(page)).toHaveText('Diajukan');
    await tutup();
  });

  test('ketua program studi melihat permintaan di kotak persetujuan dan menyetujuinya', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'kaprodiakt');
    await page.getByRole('link', { name: /Kotak persetujuan/ }).click();
    await page.getByRole('row', { name: pola(nomorPP) }).click();
    await selesaiMemuat(page);
    await expect(page.getByRole('button', { name: 'nota-katering.pdf', exact: true })).toBeVisible();
    await setujui(page, 'Sesuai anggaran pelatihan');
    await expect(statusDokumen(page)).toHaveText('Disetujui');
    await tutup();
  });

  test('pemohon tidak dapat menyetujui atau membayar dokumennya sendiri', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'dosen1');
    await page.goto(urlPP);
    await selesaiMemuat(page);
    await expect(page.getByRole('button', { name: 'Setujui dokumen' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Bukti kas keluar' })).toHaveCount(0);
    await tutup();
  });

  test('staf keuangan membuat BKK dari permintaan yang sudah disetujui dan mengajukannya', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'stafkeu1');
    await page.goto('/bkk/baru?jenis=PERMINTAAN_PEMBAYARAN');
    await page.getByRole('row', { name: pola(nomorPP) }).click();
    await expect(page.getByText(`Rincian ${nomorPP}`)).toBeVisible();
    await pilihOpsi(page.getByLabel('Rekening sumber'), 'Bank BJB');
    await page.getByLabel('Metode bayar').selectOption('TRANSFER');
    await expect(page.locator('.total-ringkas')).toContainText('Rp1.250.000');
    await page.getByRole('button', { name: 'Simpan sebagai draf' }).click();

    await expect(judulHalaman(page)).toHaveText(/^BKK\/\d{4}\/\d{2}\/\d{4}$/);
    nomorBKK = await judulHalaman(page).innerText();
    urlBKK = page.url();
    await page.getByRole('button', { name: 'Ajukan BKK' }).click();
    await expect(statusDokumen(page)).toHaveText('Diajukan');
    await tutup();
  });

  test('BKK diperiksa Kepala Subbagian Keuangan lalu disetujui Wakil Dekan II secara berurutan', async ({ browser }) => {
    const mk = await sebagai(browser, 'wd2');
    await mk.page.goto(urlBKK);
    await selesaiMemuat(mk.page);
    await expect(mk.page.getByRole('button', { name: 'Setujui dokumen' })).toHaveCount(0);

    const spv = await sebagai(browser, 'kasubag');
    await spv.page.goto(urlBKK);
    await setujui(spv.page);
    await spv.tutup();

    await mk.page.reload();
    await setujui(mk.page);
    await expect(statusDokumen(mk.page)).toHaveText('Disetujui');
    await mk.tutup();
  });

  test('Kasir membayar BKK dari antrean dan jurnal pengeluaran kas terbentuk', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'kasir1');
    await page.getByRole('link', { name: 'Pembayaran', exact: true }).click();
    await page.getByRole('row', { name: pola(nomorBKK) }).getByRole('link', { name: 'Bayar' }).click();
    await page.getByLabel('Nomor referensi transfer').fill('IB20260925E2E01');
    await page.getByRole('button', { name: 'Catat pembayaran' }).click();
    await expect(notifikasi(page)).toContainText('diposting ke jurnal JKK/');
    await expect(statusDokumen(page)).toHaveText('Dibayar');
    await tutup();
  });

  test('pemohon melihat permintaannya sudah dibayar', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'dosen1');
    await page.goto('/permintaan');
    await expect(page.getByRole('row', { name: pola(nomorPP) })).toContainText('Dibayar');
    await tutup();
  });

  test('cetakan pertama bertanda ASLI dan berikutnya SALINAN, dengan cap LUNAS', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'stafkeu1');
    await page.goto(urlBKK);
    await page.getByRole('link', { name: 'Cetak' }).click();
    await expect(page.locator('.tanda-cetak')).toContainText('PRATINJAU');
    await expect(page.locator('.cap-lunas-cetak')).toBeVisible();
    await expect(page.locator('.cetak-alat')).toContainText('bertanda ASLI');
    await page.getByRole('button', { name: 'Cetak formulir' }).click();
    await expect.poll(() => page.evaluate(() => window.__cetak)).toBe(1);
    await expect(page.locator('.cetak-alat')).toContainText('Sudah dicetak 1 kali');
    await expect(page.locator('.cetak-alat')).toContainText('SALINAN KE-1');
    await tutup();
  });
});
