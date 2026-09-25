import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { siapkan, tutup, sebagai, setujui, idAkun, idRekening, idPemasok, id, pool, satu, semua } from './bantu.js';

after(tutup);

let k;
before(async () => {
  await siapkan();
  const nama = ['stafkeu1', 'kasubag', 'wd2', 'kasir1', 'auditor1', 'dosen1'];
  const klien = await Promise.all(nama.map((u) => sebagai(u)));
  k = Object.fromEntries(nama.map((u, i) => [u, klien[i]]));
});

test('AB-16: setiap jurnal seimbang dan neraca saldo seimbang', async () => {
  const takSeimbang = await semua(pool, 'SELECT jurnal_id FROM jurnal_detail GROUP BY jurnal_id HAVING SUM(debit) <> SUM(kredit)');
  assert.equal(takSeimbang.length, 0);
  const total = await satu(pool, 'SELECT SUM(j.total) AS total, (SELECT SUM(debit) FROM jurnal_detail) AS debit FROM jurnal j');
  assert.equal(total.total, total.debit);
  const ns = await k.wd2.get('/api/laporan/neraca-saldo?sampai=2026-09-30');
  assert.equal(ns.status, 200);
  assert.equal(ns.body.seimbang, true);
  assert.equal(ns.body.total_debit, ns.body.total_kredit);
});

test('LAP-05: buku pembantu utang sama dengan akun kontrol Utang Usaha dan sisa faktur', async () => {
  const r = await k.kasubag.get('/api/laporan/saldo-utang');
  assert.equal(r.body.total_buku_pembantu, r.body.saldo_akun_kontrol);
  assert.equal(r.body.total_sisa_faktur, r.body.saldo_akun_kontrol);
  assert.ok(r.body.data.every((d) => d.selisih === 0));
});

test('LAP-03: jurnal pengeluaran kas bersaldo seimbang per kolom', async () => {
  const r = await k.wd2.get('/api/laporan/jurnal-pengeluaran-kas?dari=2026-08-01&sampai=2026-09-30');
  const t = r.body.total;
  assert.equal(Math.round((t.debit_utang_usaha + t.debit_lain_total) * 100), Math.round((t.kredit_pajak + t.kredit_bank) * 100));
  // PPh 23 Rp300.000 + PPh 4(2) Rp2.000.000; pembayaran sewa yang dibatalkan saling hapus dengan pembaliknya.
  assert.equal(t.kredit_pajak, 2300000);
});

test('US-16 / AB-15: periode yang ditutup menolak posting sampai dibuka kembali dengan alasan', async () => {
  assert.equal((await k.stafkeu1.post('/api/periode/tutup', { tahun: 2026, bulan: 8 })).status, 403);
  assert.equal((await k.wd2.post('/api/periode/tutup', { tahun: 2026, bulan: 8 })).status, 200);
  const jm = await k.stafkeu1.post('/api/jurnal-manual', {
    tanggal: '2026-08-31', jenis: 'PENYESUAIAN', keterangan: 'Uji periode tutup',
    baris: [
      { akun_id: await idAkun('6-1199'), debit: 10000, kredit: 0 },
      { akun_id: await idAkun('2-1401'), debit: 0, kredit: 10000 },
    ],
  });
  assert.equal(jm.status, 201, JSON.stringify(jm.body));
  await k.stafkeu1.post(`/api/jurnal-manual/${jm.body.id}/ajukan`);
  const setuju = await k.wd2.post(`/api/persetujuan/JM/${jm.body.id}/setujui`);
  assert.equal(setuju.status, 400);
  assert.match(setuju.body.pesan, /Periode Agustus 2026 sudah ditutup/);
  assert.equal((await k.wd2.post('/api/periode/buka', { tahun: 2026, bulan: 8 })).status, 400, 'alasan wajib');
  assert.equal((await k.wd2.post('/api/periode/buka', { tahun: 2026, bulan: 8, alasan: 'Koreksi akrual yang disetujui Dekan' })).status, 200);
  assert.equal((await k.wd2.post(`/api/persetujuan/JM/${jm.body.id}/setujui`)).status, 200);
  const log = await satu(pool, "SELECT COUNT(*) AS n FROM log_audit WHERE aksi IN ('TUTUP_PERIODE','BUKA_PERIODE')");
  assert.ok(log.n >= 3);
});

test('Daftar periksa tutup buku menyebut rekonsiliasi yang belum final', async () => {
  const r = await k.wd2.get('/api/periode/cek?tahun=2026&bulan=8');
  const bjb = r.body.find((b) => b.butir.includes('Bank BJB'));
  const bsi = r.body.find((b) => b.butir.includes('Bank BSI'));
  assert.equal(bjb.status, 'OK');
  assert.equal(bsi.status, 'PERHATIAN');
});

test('KF-AKT-02: jurnal manual yang tidak seimbang ditolak; saldo awal hanya untuk Kepala Subbagian Keuangan', async () => {
  const tak = await k.stafkeu1.post('/api/jurnal-manual', {
    keterangan: 'Tidak seimbang',
    baris: [
      { akun_id: await idAkun('6-1199'), debit: 100, kredit: 0 },
      { akun_id: await idAkun('2-1401'), debit: 0, kredit: 90 },
    ],
  });
  assert.equal(tak.status, 400);
  assert.match(tak.body.pesan, /belum seimbang/);
  const induk = await k.stafkeu1.post('/api/jurnal-manual', {
    keterangan: 'Akun induk',
    baris: [
      { akun_id: await idAkun('6-1000'), debit: 100, kredit: 0 },
      { akun_id: await idAkun('2-1401'), debit: 0, kredit: 100 },
    ],
  });
  assert.equal(induk.status, 400);
  const utangTanpaPemasok = await k.stafkeu1.post('/api/jurnal-manual', {
    keterangan: 'Utang tanpa pemasok',
    baris: [
      { akun_id: await idAkun('6-1199'), debit: 100, kredit: 0 },
      { akun_id: await idAkun('2-1101'), debit: 0, kredit: 100 },
    ],
  });
  assert.equal(utangTanpaPemasok.status, 400);
  const saldoAwal = await k.stafkeu1.post('/api/jurnal-manual', {
    jenis: 'SALDO_AWAL', keterangan: 'Coba saldo awal',
    baris: [
      { akun_id: await idAkun('1-1111'), debit: 100, kredit: 0 },
      { akun_id: await idAkun('3-2101'), debit: 0, kredit: 100 },
    ],
  });
  assert.equal(saldoAwal.status, 403);
});

test('KF-AKT-02: tidak ada jalan mengubah atau menghapus jurnal terposting', async () => {
  const j = await satu(pool, 'SELECT id FROM jurnal ORDER BY id LIMIT 1');
  assert.equal((await k.kasubag.put(`/api/jurnal/${j.id}`, {})).status, 404);
  assert.equal((await k.kasubag.delete(`/api/jurnal/${j.id}`)).status, 404);
});

test('US-15 / AB-27: rekonsiliasi tidak dapat difinalkan bila selisih, dan tidak boleh dikerjakan Kasir', async () => {
  assert.equal((await k.kasir1.post('/api/rekonsiliasi', { rekening_kas_id: await idRekening('BJB-OPS'), tahun: 2026, bulan: 9, saldo_rekening_koran: 0 })).status, 403);
  const rb = await k.kasubag.post('/api/rekonsiliasi', { rekening_kas_id: await idRekening('BJB-OPS'), tahun: 2026, bulan: 9, saldo_rekening_koran: 123 });
  assert.equal(rb.status, 201, JSON.stringify(rb.body));
  const detail = await k.kasubag.get(`/api/rekonsiliasi/${rb.body.id}`);
  assert.ok(detail.body.beredar.length > 0, 'warkat beredar terisi otomatis');
  const final = await k.kasubag.post(`/api/rekonsiliasi/${rb.body.id}/final`);
  assert.equal(final.status, 409);
  assert.match(final.body.pesan, /belum seimbang/);
  // Rekonsiliasi bulan lalu yang sudah final memuat biaya bank sebagai jurnal penyesuaian.
  const lalu = await satu(pool, "SELECT jurnal_id, status FROM rekonsiliasi_bank WHERE tahun = 2026 AND bulan = 8");
  assert.equal(lalu.status, 'FINAL');
  const baris = await semua(pool, 'SELECT a.kode, d.debit, d.kredit FROM jurnal_detail d JOIN akun a ON a.id = d.akun_id WHERE d.jurnal_id = ? ORDER BY d.baris', [lalu.jurnal_id]);
  assert.ok(baris.some((b) => b.kode === '6-1116' && b.debit === 25000));
  assert.ok(baris.some((b) => b.kode === '4-2101' && b.kredit === 150000));
});

test('Tanggal kliring pada periode rekonsiliasi yang sudah final tidak dapat diubah', async () => {
  const p = await satu(pool, "SELECT id FROM pembayaran WHERE status = 'DIBAYAR' AND tanggal_kliring BETWEEN '2026-08-01' AND '2026-08-31' LIMIT 1");
  const r = await k.kasubag.post(`/api/pembayaran/${p.id}/kliring`, { tanggal_kliring: null });
  assert.equal(r.status, 409);
});

test('KF-AKT-06: ekspor jurnal menghasilkan CSV UTF-8 dengan kepala kolom', async () => {
  const r = await k.stafkeu1.get('/api/jurnal/ekspor?dari=2026-08-01&sampai=2026-08-31');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/csv/);
  const teks = r.text.replace(/^\uFEFF/, '');
  const baris = teks.trim().split('\r\n');
  assert.equal(baris[0], 'tanggal,nomor_jurnal,jenis,sumber,nomor_sumber,keterangan,baris,kode_akun,nama_akun,departemen,pemasok,keterangan_baris,debit,kredit');
  assert.ok(baris.length > 20);
});

test('AB-01: nomor dokumen berurutan per bulan tanpa celah', async () => {
  const nomor = (await semua(pool, "SELECT nomor FROM bukti_kas_keluar WHERE nomor LIKE 'BKK/2026/08/%' ORDER BY nomor")).map((r) => Number(r.nomor.slice(-4)));
  assert.deepEqual(nomor, nomor.map((_, i) => i + 1));
  const jurnal = (await semua(pool, "SELECT nomor FROM jurnal WHERE nomor LIKE 'JKK/2026/08/%' ORDER BY nomor")).map((r) => Number(r.nomor.slice(-4)));
  assert.deepEqual(jurnal, jurnal.map((_, i) => i + 1));
});

test('LAP-06 dan LAP-07: umur utang dan faktur jatuh tempo', async () => {
  const umur = await k.wd2.get('/api/laporan/umur-utang');
  assert.equal(umur.status, 200);
  assert.ok(umur.body.total_semua > 0);
  const tpj = umur.body.data.find((d) => d.pemasok_nama === 'PT Teknologi Presentasi Jaya');
  // Faktur saldo awal jatuh tempo 25 Agustus: per 25 September lewat 31 hari.
  assert.equal(tpj.hari_31_60, 12500000);
  assert.equal(tpj.belum_jatuh_tempo, 17760000);
  const jt = await k.wd2.get('/api/laporan/faktur-jatuh-tempo?hari=7');
  const nomor = jt.body.data.map((f) => f.nomor_faktur).sort();
  assert.deepEqual(nomor, ['LCP-0906', 'TPJ/07/0098', 'TPJ/09/0144']);
  assert.equal(jt.body.total_lewat, 16340000);
});
