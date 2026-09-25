// US-12, US-13, US-14: batas kas kecil, pembayaran tunai oleh pemegang dana, pengisian kembali, dan opname.
import { test, expect } from '@playwright/test';
import { judulHalaman, notifikasi, pilihKombo, pilihOpsi, pola, sebagai, selesaiMemuat, setujui, statusDokumen } from './bantu.js';

test.describe.serial('Kas kecil sistem imprest', () => {
  let urlPKK;
  let urlPDK;

  test('pengeluaran di atas batas per transaksi ditolak, pengeluaran wajar tersimpan dan diajukan', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'staf1');
    await page.goto('/pkk/baru');
    await pilihOpsi(page.getByLabel('Dana kas kecil'), 'Kantor Pusat');
    await page.getByLabel('Jumlah').fill('1500000');
    await page.getByLabel('Keperluan').fill('Pembelian kursi lipat');
    await pilihKombo(page.getByLabel('Akun pembebanan'), '6-1106');
    await expect(page.locator('.pesan.peringatan')).toContainText('melebihi batas');
    await page.getByRole('button', { name: 'Simpan sebagai draf' }).click();
    await expect(notifikasi(page)).toContainText('melebihi batas kas kecil');

    await page.getByLabel('Jumlah').fill('150000');
    await page.getByLabel('Keperluan').fill('Pembelian lampu ruang rapat');
    await page.getByRole('button', { name: 'Simpan sebagai draf' }).click();
    await expect(judulHalaman(page)).toHaveText(/^PKK\//);
    urlPKK = page.url();
    await page.getByRole('button', { name: 'Ajukan pengeluaran' }).click();
    await expect(statusDokumen(page)).toHaveText('Diajukan');
    await tutup();
  });

  test('atasan menyetujui dan pemegang kas kecil membayar tunai dengan nomor nota', async ({ browser }) => {
    const atasan = await sebagai(browser, 'kaumum');
    await atasan.page.goto(urlPKK);
    await setujui(atasan.page);
    await atasan.tutup();

    const { page, tutup } = await sebagai(browser, 'kaskecil1');
    await page.goto(urlPKK);
    await page.getByRole('button', { name: 'Bayar tunai' }).click();
    await page.getByLabel('Nomor nota atau kuitansi').fill('NT-E2E-77');
    await page.getByRole('button', { name: 'Catat pembayaran tunai' }).click();
    await expect(statusDokumen(page)).toHaveText('Dibayar');
    await expect(page.getByRole('link', { name: 'Cetak bukti pengeluaran' })).toBeVisible();
    await tutup();
  });

  test('pemegang dana menyusun pengisian kembali dari bukti yang sudah dibayar', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'kaskecil1');
    await page.goto('/pdk/baru');
    await pilihOpsi(page.getByLabel('Dana kas kecil'), 'Kantor Pusat');
    await expect(page.getByRole('row', { name: /Pembelian lampu ruang rapat/ })).toBeVisible();
    await page.getByRole('button', { name: 'Pilih semua' }).click();
    await page.getByRole('button', { name: 'Simpan sebagai draf' }).click();
    await expect(judulHalaman(page)).toHaveText(/^PDK\//);
    urlPDK = page.url();
    await page.getByRole('button', { name: 'Ajukan ke Akuntansi' }).click();
    await expect(statusDokumen(page)).toHaveText('Diajukan');
    await tutup();
  });

  test('akuntansi membuat BKK pengisian kembali dengan rekap per akun', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'akt1');
    await page.goto(urlPDK);
    await selesaiMemuat(page);
    const total = await page.locator('.total-ringkas .baris.besar .angka').first().innerText();
    await page.getByRole('link', { name: 'Buat BKK pengisian' }).click();
    await expect(page.locator('tr.dipilih')).toHaveCount(1);
    await pilihOpsi(page.getByLabel('Rekening sumber'), 'Bank BCA');
    await page.getByLabel('Metode bayar').selectOption('CEK');
    await page.getByRole('button', { name: 'Simpan sebagai draf' }).click();
    await expect(judulHalaman(page)).toHaveText(/^BKK\//);
    await expect(page.locator('.total-ringkas')).toContainText(total);
    await tutup();
  });

  test('pemegang dana tidak dapat mengopname dananya sendiri; auditor mencatat dan memfinalkan opname', async ({ browser }) => {
    const pemegang = await sebagai(browser, 'kaskecil1');
    await pemegang.page.goto('/opname');
    await expect(pemegang.page.getByRole('link', { name: 'Opname baru' })).toHaveCount(0);
    await pemegang.tutup();

    const { page, tutup } = await sebagai(browser, 'auditor1');
    await page.goto('/opname/baru');
    await pilihOpsi(page.getByLabel('Dana kas kecil'), 'Kas Kecil Pabrik');
    await expect(page.getByText('Saldo tunai seharusnya')).toBeVisible();
    await page.getByLabel('Jumlah kertas 100000').fill('70');
    await page.getByLabel('Jumlah kertas 50000').fill('10');
    await page.getByRole('button', { name: 'Simpan hasil opname' }).click();
    await expect(judulHalaman(page)).toHaveText(/^OPN\//);
    await page.getByRole('button', { name: 'Finalkan opname' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Finalkan opname' }).click();
    await expect(statusDokumen(page)).toHaveText('Final');
    await tutup();
  });
});
