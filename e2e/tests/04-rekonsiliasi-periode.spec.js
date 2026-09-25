// US-15, US-16: rekonsiliasi bank oleh Kepala Bagian Akuntansi (bukan Kasir) serta tutup dan buka periode.
import { test, expect } from '@playwright/test';
import { notifikasi, pilihOpsi, sebagai, selesaiMemuat, statusDokumen } from './bantu.js';

test.describe.serial('Rekonsiliasi bank dan periode akuntansi', () => {
  test('Kasir tidak melihat menu rekonsiliasi dan ditolak bila membuka alamatnya langsung', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'kasir1');
    await expect(page.getByRole('link', { name: 'Rekonsiliasi bank' })).toHaveCount(0);
    await page.goto('/rekonsiliasi');
    await expect(page.locator('.pesan.galat')).toContainText('tidak berwenang');
    await tutup();
  });

  test('Kepala Bagian Akuntansi menyusun rekonsiliasi; selisih mencegah finalisasi', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'spvakt');
    await page.goto('/rekonsiliasi');
    await page.getByRole('button', { name: 'Buat rekonsiliasi' }).click();
    const dialog = page.getByRole('dialog');
    await pilihOpsi(dialog.getByLabel('Rekening', { exact: true }), 'Bank Mandiri');
    await dialog.getByLabel('Bulan').selectOption('9');
    await dialog.getByLabel('Saldo akhir menurut rekening koran').fill('500000000');
    await dialog.getByRole('button', { name: 'Buat rekonsiliasi' }).click();
    await expect(statusDokumen(page)).toHaveText('Draf');
    await selesaiMemuat(page);
    await expect(page.locator('.pesan.peringatan')).toContainText('Masih ada selisih');
    await expect(page.getByRole('button', { name: 'Finalkan rekonsiliasi' })).toBeDisabled();

    await page.getByLabel('Jenis pos').selectOption('BIAYA_BANK');
    await page.getByLabel('Keterangan', { exact: true }).fill('Biaya administrasi September');
    await page.getByLabel('Jumlah').fill('25000');
    await page.getByRole('button', { name: 'Tambah pos' }).click();
    await expect(notifikasi(page)).toContainText('Pos rekonsiliasi ditambahkan');
    await expect(page.locator('section', { hasText: 'Pos rekonsiliasi' }).getByRole('row', { name: /Biaya administrasi September/ })).toBeVisible();
    await tutup();
  });

  test('Manajer Keuangan menutup periode lalu membukanya kembali dengan alasan', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'mankeu');
    await page.goto('/periode');
    await page.getByLabel('Pilih periode').selectOption('2026-8');
    await selesaiMemuat(page);
    await expect(page.getByText('Rekonsiliasi bank Bank BCA Giro Operasional')).toBeVisible();
    await page.getByRole('button', { name: 'Tutup periode Agustus 2026' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Tutup periode' }).click();
    await expect(notifikasi(page)).toContainText('ditutup');
    await expect(page.getByRole('button', { name: 'Buka kembali periode' })).toBeVisible();

    await page.getByRole('button', { name: 'Buka kembali periode' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Buka periode' }).click();
    await expect(dialog.getByText('Wajib diisi.')).toBeVisible();
    await dialog.getByLabel('Alasan membuka kembali').fill('Koreksi akrual beban listrik Agustus');
    await dialog.getByRole('button', { name: 'Buka periode' }).click();
    await expect(notifikasi(page)).toContainText('dibuka kembali');
    await tutup();
  });
});
