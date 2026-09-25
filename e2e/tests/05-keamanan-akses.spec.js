// US-17, KNF keamanan: konflik peran, ganti kata sandi wajib, pembatasan menu dan data, serta kunci akun.
import { test, expect } from '@playwright/test';
import { masuk, notifikasi, pilihOpsi, sebagai } from './bantu.js';

test.describe.serial('Keamanan dan hak akses', () => {
  test('Administrator tidak dapat memberi peran Kasir dan Staf Akuntansi Utang pada satu akun', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'admin');
    await page.goto('/admin/pengguna');
    await page.getByRole('button', { name: 'Tambah pengguna' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nama pengguna').fill('kasir2');
    await dialog.getByLabel('Nama lengkap').fill('Lina Marlina');
    await dialog.getByLabel('Jabatan').fill('Kasir Pengganti');
    await pilihOpsi(dialog.getByLabel('Departemen', { exact: true }), 'Keuangan');
    await dialog.getByLabel('Kata sandi awal').fill('Mulai2026x');
    await dialog.getByLabel(/^Kasir/).check();
    await dialog.getByLabel(/^Staf Akuntansi Utang/).check();
    await expect(dialog.locator('.pesan.galat')).toContainText('tidak boleh dipegang satu akun');
    await expect(dialog.getByRole('button', { name: 'Simpan pengguna' })).toBeDisabled();
    await dialog.getByLabel(/^Staf Akuntansi Utang/).uncheck();
    await dialog.getByRole('button', { name: 'Simpan pengguna' }).click();
    await expect(notifikasi(page)).toContainText('wajib mengganti kata sandi');
    await tutup();
  });

  test('pengguna baru wajib mengganti kata sandi sebelum memakai aplikasi', async ({ page }) => {
    await masuk(page, 'kasir2', 'Mulai2026x');
    await expect(page.getByText('Ganti kata sandi sebelum melanjutkan')).toBeVisible();
    await page.goto('/pembayaran');
    await expect(page.getByText('Ganti kata sandi sebelum melanjutkan')).toBeVisible();
    await page.getByLabel('Kata sandi lama').fill('Mulai2026x');
    await page.getByLabel('Kata sandi baru', { exact: true }).fill('kasir2rahasia9');
    await page.getByLabel('Ulangi kata sandi baru').fill('kasir2rahasia9');
    await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click();
    await expect(page.locator('.kolom .galat')).toContainText('nama pengguna');
    await page.getByLabel('Kata sandi baru', { exact: true }).fill('Rahasia2026z');
    await page.getByLabel('Ulangi kata sandi baru').fill('Rahasia2026z');
    await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click();
    await expect(page.getByRole('heading', { name: 'Beranda', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pembayaran', exact: true })).toBeVisible();
  });

  test('pemohon hanya melihat menu miliknya dan ditolak saat membuka daftar BKK', async ({ browser }) => {
    const { page, tutup } = await sebagai(browser, 'staf2');
    await expect(page.getByRole('link', { name: 'Bukti kas keluar' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Faktur pemasok' })).toHaveCount(0);
    await page.goto('/bkk');
    await expect(page.locator('.pesan.galat')).toContainText('tidak berwenang');
    await tutup();
  });

  test('lima kali salah kata sandi mengunci akun', async ({ page }) => {
    for (let i = 1; i <= 4; i += 1) {
      await masuk(page, 'kapemasaran', `Salah${i}xx`);
      await expect(page.locator('.pesan.galat')).toContainText('Nama pengguna atau kata sandi salah');
    }
    await masuk(page, 'kapemasaran', 'Salah5xx');
    await expect(page.locator('.pesan.galat')).toContainText('Akun dikunci');
    await masuk(page, 'kapemasaran', 'Demo2026');
    await expect(page.locator('.pesan.galat')).toContainText('Akun terkunci sampai');
  });
});
