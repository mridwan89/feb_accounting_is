import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { siapkan, tutup, sebagai, idPengguna, idDept, idAkun, pool, satu, semua, pdfContoh, id } from './bantu.js';

before(siapkan);
after(tutup);

test('KNF-04: peran menentukan rute yang boleh diakses', async () => {
  const staf1 = await sebagai('staf1');
  assert.equal((await staf1.get('/api/bkk')).status, 403);
  assert.equal((await staf1.post('/api/faktur', {})).status, 403);
  const kasir = await sebagai('kasir1');
  assert.equal((await kasir.post('/api/bkk', {})).status, 403);
  assert.equal((await kasir.post('/api/rekonsiliasi', {})).status, 403);
  const auditor = await sebagai('auditor1');
  assert.equal((await auditor.get('/api/bkk')).status, 200);
  assert.equal((await auditor.post('/api/pp', {})).status, 403);
  assert.equal((await auditor.get('/api/audit')).status, 200);
  assert.equal((await staf1.get('/api/audit')).status, 403);
});

test('US-17 / AB-05: kombinasi peran yang bertentangan ditolak', async () => {
  const admin = await sebagai('admin');
  const akt1 = await idPengguna('akt1');
  const r = await admin.put(`/api/pengguna/${akt1}`, {
    nama_lengkap: 'Rina Marlina', jabatan: 'Staf Akuntansi Utang', departemen_id: await idDept('KEU'), peran: ['AKUNTANSI', 'KASIR', 'PEMOHON'],
  });
  assert.equal(r.status, 400);
  assert.match(r.body.pesan, /Kasir dan Staf Akuntansi Utang|Staf Akuntansi Utang dan Kasir/);
  const peran = await semua(pool, 'SELECT peran_kode FROM pengguna_peran WHERE pengguna_id = ? ORDER BY peran_kode', [akt1]);
  assert.deepEqual(peran.map((p) => p.peran_kode), ['AKUNTANSI', 'PEMOHON']);
});

async function ppBaru(klien, jumlah = 1500000) {
  const buat = await klien.post('/api/pp', {
    penerima_nama: 'Toko Uji', keterangan: 'Permintaan uji hak akses', baris: [{ uraian: 'Biaya uji', akun_id: await idAkun('6-1199'), jumlah }],
  });
  assert.equal(buat.status, 201, JSON.stringify(buat.body));
  const unggah = await klien.unggah(`/api/lampiran/PP/${buat.body.id}`, 'nota.pdf', pdfContoh('Nota uji'));
  assert.equal(unggah.status, 201, JSON.stringify(unggah.body));
  return buat.body;
}

test('US-09 / AB-02: dokumen Kepala Departemen dialihkan ke Direktur dan pembuat tidak dapat menyetujui', async () => {
  const mankeu = await sebagai('mankeu');
  const pp = await ppBaru(mankeu);
  const aju = await mankeu.post(`/api/pp/${pp.id}/ajukan`);
  assert.equal(aju.status, 200, JSON.stringify(aju.body));
  const langkah = await satu(pool, "SELECT * FROM persetujuan WHERE jenis_dokumen = 'PP' AND dokumen_id = ?", [pp.id]);
  assert.equal(langkah.peran_kode, 'DIREKTUR');
  assert.match(langkah.nama_langkah, /dialihkan/);
  const sendiri = await mankeu.post(`/api/persetujuan/PP/${pp.id}/setujui`);
  assert.equal(sendiri.status, 403);
  const dirkeu = await sebagai('dirkeu');
  assert.equal((await dirkeu.post(`/api/persetujuan/PP/${pp.id}/setujui`)).status, 200);
  const hasil = await satu(pool, 'SELECT status FROM permintaan_pembayaran WHERE id = ?', [pp.id]);
  assert.equal(hasil.status, 'DISETUJUI');
});

test('US-09: Kepala Departemen hanya melihat dan menyetujui dokumen departemennya', async () => {
  const pp4 = await id('permintaan_pembayaran', 'keterangan', 'Iklan media sosial peluncuran kemasan baru');
  const kaumum = await sebagai('kaumum');
  const tugasUmum = await kaumum.get('/api/persetujuan/tugas');
  assert.ok(!tugasUmum.body.some((t) => t.jenis_dokumen === 'PP' && t.dokumen_id === pp4));
  const tolak = await kaumum.post(`/api/persetujuan/PP/${pp4}/setujui`);
  assert.equal(tolak.status, 403);
  assert.match(tolak.body.pesan, /departemen lain/);
  assert.equal((await kaumum.get(`/api/pp/${pp4}`)).status, 403);
  const kapemasaran = await sebagai('kapemasaran');
  const tugas = await kapemasaran.get('/api/persetujuan/tugas');
  assert.ok(tugas.body.some((t) => t.jenis_dokumen === 'PP' && t.dokumen_id === pp4));
});

test('AB-03: satu pengguna hanya menyetujui satu langkah pada satu dokumen', async () => {
  const admin = await sebagai('admin');
  const buat = await admin.post('/api/pengguna', {
    username: 'rangkap', nama_lengkap: 'Pejabat Rangkap', departemen_id: await idDept('KEU'), peran: ['SPV_AKUNTANSI', 'MANAJER_KEUANGAN'], password_awal: 'Pejabat2026',
  });
  assert.equal(buat.status, 201, JSON.stringify(buat.body));
  await pool.query("UPDATE pengguna SET harus_ganti_password = 0 WHERE username = 'rangkap'");
  const bkk = await id('bukti_kas_keluar', 'nomor', 'BKK/2026/09/0002');
  const klien = await sebagai('rangkap', 'Pejabat2026');
  assert.equal((await klien.post(`/api/persetujuan/BKK/${bkk}/setujui`)).status, 200);
  const kedua = await klien.post(`/api/persetujuan/BKK/${bkk}/setujui`);
  assert.equal(kedua.status, 403);
  assert.match(kedua.body.pesan, /sudah menyetujui langkah lain/);
  const mankeu = await sebagai('mankeu');
  assert.equal((await mankeu.post(`/api/persetujuan/BKK/${bkk}/setujui`)).status, 200);
  assert.equal((await satu(pool, 'SELECT status FROM bukti_kas_keluar WHERE id = ?', [bkk])).status, 'DISETUJUI');
});

test('KF-PST-02: penolakan wajib disertai alasan dan mengembalikan dokumen ke pembuat', async () => {
  const staf1 = await sebagai('staf1');
  const pp = await ppBaru(staf1, 250000);
  await staf1.post(`/api/pp/${pp.id}/ajukan`);
  const kaumum = await sebagai('kaumum');
  const tanpaAlasan = await kaumum.post(`/api/persetujuan/PP/${pp.id}/tolak`, {});
  assert.equal(tanpaAlasan.status, 400);
  const tolak = await kaumum.post(`/api/persetujuan/PP/${pp.id}/tolak`, { catatan: 'Nota tidak terbaca' });
  assert.equal(tolak.status, 200);
  const detail = await staf1.get(`/api/pp/${pp.id}`);
  assert.equal(detail.body.status, 'DITOLAK');
  assert.equal(detail.body.persetujuan.at(-1).catatan, 'Nota tidak terbaca');
  // Diperbaiki lalu diajukan ulang: putaran persetujuan baru, riwayat lama tetap ada.
  assert.equal((await staf1.post(`/api/pp/${pp.id}/ajukan`)).status, 200);
  const putaran = await semua(pool, "SELECT DISTINCT putaran FROM persetujuan WHERE jenis_dokumen = 'PP' AND dokumen_id = ?", [pp.id]);
  assert.equal(putaran.length, 2);
});

test('Pengajuan ditolak bila tidak ada penyetuju yang memenuhi syarat', async () => {
  const gudang = await sebagai('gudang1');
  await pool.query("UPDATE pengguna SET aktif = 0 WHERE username = 'kagudang'");
  const pp = await ppBaru(gudang, 100000);
  const aju = await gudang.post(`/api/pp/${pp.id}/ajukan`);
  assert.equal(aju.status, 400);
  assert.match(aju.body.pesan, /Belum ada pengguna aktif berperan Kepala Departemen di departemen Gudang/);
  await pool.query("UPDATE pengguna SET aktif = 1 WHERE username = 'kagudang'");
});
