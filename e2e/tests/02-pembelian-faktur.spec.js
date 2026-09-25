// US-19, US-20, US-01, US-02: PO berjenjang, penerimaan tidak melebihi pesanan, pencocokan tiga arah, dan faktur ganda.
import { test, expect } from '@playwright/test';
import { judulHalaman, notifikasi, pilihKombo, pola, sebagai, selesaiMemuat, setujui, statusDokumen } from './bantu.js';

test.describe.serial('Pembelian dan pencocokan faktur tiga arah', () => {
  let urlPO;
  let idPO;
  let nomorPO;
  let urlFakturSelisih;

  test('staf pembelian membuat PO dua baris untuk pemasok non-PKP dan mengajukannya', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'beli1');
    await page.goto('/po/baru');
    await pilihKombo(page.getByLabel('Pemasok', { exact: true }), 'Sumber Alat');
    await expect(page.getByText('CV Sumber Alat Tulis: bukan PKP')).toBeVisible();
    const baris = page.locator('table.editor-baris tbody tr');
    await baris.nth(0).getByLabel('Uraian').fill('Map plastik kancing');
    await baris.nth(0).getByLabel('Kuantitas').fill('100');
    await baris.nth(0).getByLabel('Satuan', { exact: true }).fill('buah');
    await baris.nth(0).getByLabel('Harga satuan').fill('2500');
    await pilihKombo(baris.nth(0).locator('.kombo input'), '6-1104');
    await page.getByRole('button', { name: 'Tambah baris' }).click();
    await baris.nth(1).getByLabel('Uraian').fill('Amplop cokelat folio');
    await baris.nth(1).getByLabel('Kuantitas').fill('50');
    await baris.nth(1).getByLabel('Satuan', { exact: true }).fill('pak');
    await baris.nth(1).getByLabel('Harga satuan').fill('18000');
    await pilihKombo(baris.nth(1).locator('.kombo input'), '6-1104');
    await expect(page.locator('.total-ringkas')).toContainText('Rp1.150.000');
    await page.getByRole('button', { name: 'Simpan sebagai draf' }).click();

    await expect(judulHalaman(page)).toHaveText(/^PO\//);
    nomorPO = await judulHalaman(page).innerText();
    urlPO = page.url();
    idPO = urlPO.split('/').pop();
    await page.getByRole('button', { name: 'Ajukan PO' }).click();
    await expect(statusDokumen(page)).toHaveText('Diajukan');
    await tutup();
  });

  test('kepala departemen pembelian menyetujui PO', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'kabeli');
    await page.goto('/persetujuan');
    await page.getByRole('row', { name: pola(nomorPO) }).click();
    await setujui(page);
    await expect(statusDokumen(page)).toHaveText('Disetujui');
    await tutup();
  });

  test('gudang tidak dapat menerima melebihi pesanan, lalu mencatat penerimaan penuh', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'gudang1');
    await page.goto(`/penerimaan/baru?po_id=${idPO}`);
    await page.getByLabel('Nomor surat jalan').fill('SJ-E2E-001');
    await page.getByLabel('Diterima sekarang Map plastik kancing').fill('120');
    await page.getByRole('button', { name: 'Simpan penerimaan' }).click();
    await expect(notifikasi(page)).toContainText('tidak sesuai pesanan');
    await expect(page.locator('.pesan.galat')).toContainText('Melebihi sisa pesanan');

    await page.getByLabel('Diterima sekarang Map plastik kancing').fill('100');
    await page.getByRole('button', { name: 'Simpan penerimaan' }).click();
    await expect(judulHalaman(page)).toHaveText(/^LPB\//);
    await page.goto(urlPO);
    await expect(statusDokumen(page)).toHaveText('Diterima penuh');
    await tutup();
  });

  test('faktur yang cocok dengan PO dan LPB langsung diposting menjadi utang', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'akt1');
    await page.goto(`/faktur/baru?po_id=${idPO}`);
    await page.getByLabel('Nomor faktur pemasok').fill('SAT-E2E-01');
    await page.getByLabel('Tagih Amplop cokelat folio', { exact: true }).uncheck();
    await expect(page.locator('.total-ringkas')).toContainText('Rp250.000');
    await page.getByRole('button', { name: 'Simpan faktur' }).click();
    await expect(judulHalaman(page)).toContainText('SAT-E2E-01');
    await page.getByRole('button', { name: 'Verifikasi dan cocokkan' }).click();
    await expect(notifikasi(page)).toContainText('cocok dengan PO dan penerimaan');
    await expect(statusDokumen(page)).toHaveText('Terverifikasi');
    await expect(page.getByRole('link', { name: /^JP\// })).toBeVisible();
    await tutup();
  });

  test('nomor faktur yang sama dari pemasok yang sama ditolak', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'akt1');
    await page.goto(`/faktur/baru?po_id=${idPO}`);
    await page.getByLabel('Nomor faktur pemasok').fill('sat e2e 01');
    await page.getByRole('button', { name: 'Simpan faktur' }).click();
    await expect(notifikasi(page)).toContainText('sudah tercatat');
    await tutup();
  });

  test('faktur yang menagih melebihi penerimaan menunggu keputusan Manajer Keuangan', async ({ browser }) => {
    const akt = await sebagai(browser, 'akt1');
    const { page } = akt;
    await page.goto(`/faktur/baru?po_id=${idPO}`);
    await page.getByLabel('Nomor faktur pemasok').fill('SAT-E2E-02');
    await page.getByLabel('Kuantitas ditagih Amplop cokelat folio').fill('60');
    await expect(page.locator('tr.selisih')).toHaveCount(1);
    await page.getByRole('button', { name: 'Simpan faktur' }).click();
    await page.getByRole('button', { name: 'Verifikasi dan cocokkan' }).click();
    await expect(notifikasi(page)).toContainText('selisih pencocokan');
    await expect(statusDokumen(page)).toHaveText('Menunggu persetujuan');
    urlFakturSelisih = page.url();
    await akt.tutup();

    const mk = await sebagai(browser, 'mankeu');
    await mk.page.goto(urlFakturSelisih);
    await expect(mk.page.locator('.pesan.peringatan')).toContainText('ditagih 60');
    await setujui(mk.page, 'Pemasok mengirim tambahan 10 pak sesuai konfirmasi Gudang');
    await expect(statusDokumen(mk.page)).toHaveText('Terverifikasi');
    await mk.tutup();
  });

  test('pengecualian yang disetujui muncul di laporan untuk Auditor Internal', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'auditor1');
    await page.goto('/laporan/pengecualian');
    await selesaiMemuat(page);
    await expect(page.locator('section', { hasText: 'Selisih pencocokan faktur yang disetujui' })).toContainText('SAT-E2E-02');
    await tutup();
  });
});
