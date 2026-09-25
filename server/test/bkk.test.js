import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { siapkan, tutup, sebagai, setujui, idAkun, idPemasok, idRekening, idDept, id, pool, satu, semua, pdfContoh } from './bantu.js';
import { bayarBKK } from '../src/modules/pembayaran.js';
import { tx } from '../src/db.js';
import { muatPengguna } from '../src/middleware/autentikasi.js';

after(tutup);

let akt;
let spv;
let wd2;
let dekan;
let kasir;
let beli;
before(async () => {
  await siapkan();
  [akt, spv, wd2, dekan, kasir, beli] = await Promise.all(['stafkeu1', 'kasubag', 'wd2', 'dekan', 'kasir1', 'pengadaan1'].map((u) => sebagai(u)));
});

const langkahBKK = async (bkkId) =>
  (await semua(pool, "SELECT peran_kode FROM persetujuan WHERE jenis_dokumen = 'BKK' AND dokumen_id = ? AND status <> 'DIBATALKAN' ORDER BY putaran DESC, urutan", [bkkId])).map((l) => l.peran_kode);

test('US-04: BKK tepat Rp10.000.000 tidak butuh Dekan; Rp10.000.000,01 butuh Dekan', async () => {
  const mk = wd2;
  const dana = await mk.post('/api/dana-kas-kecil', {
    kode: 'KK-UJI50', nama: 'Kas Kecil Uji Batas', pemegang_id: await id('pengguna', 'username', 'kaskecil2'), departemen_id: await idDept('TU'),
    akun_id: await idAkun('1-1104'), dana_diusulkan: 12000000, batas_transaksi: 1000000,
  });
  assert.equal(dana.status, 201, JSON.stringify(dana.body));
  const bkk1 = await akt.post('/api/bkk', { jenis: 'PEMBENTUKAN_KAS_KECIL', sumber_id: dana.body.id, jumlah: 10000000, rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: 'CEK' });
  assert.equal(bkk1.status, 201, JSON.stringify(bkk1.body));
  await akt.post(`/api/bkk/${bkk1.body.id}/ajukan`);
  assert.deepEqual(await langkahBKK(bkk1.body.id), ['KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2']);
  assert.equal((await akt.post(`/api/bkk/${bkk1.body.id}/batal`, { alasan: 'Uji batas' })).status, 200);

  const bkk2 = await akt.post('/api/bkk', { jenis: 'PEMBENTUKAN_KAS_KECIL', sumber_id: dana.body.id, jumlah: 10000000.01, rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: 'CEK' });
  assert.equal(bkk2.status, 201, JSON.stringify(bkk2.body));
  await akt.post(`/api/bkk/${bkk2.body.id}/ajukan`);
  assert.deepEqual(await langkahBKK(bkk2.body.id), ['KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN']);
  await setujui('BKK', bkk2.body.id, spv, wd2);
  assert.ok((await dekan.get('/api/persetujuan/tugas')).body.some((t) => t.dokumen_id === bkk2.body.id && t.jenis_dokumen === 'BKK'));
});

test('US-06: Kasir tidak dapat membayar BKK yang belum disetujui lengkap', async () => {
  const bkk = await id('bukti_kas_keluar', 'nomor', 'BKK/2026/09/0002');
  const antrean = await kasir.get('/api/pembayaran/antrean');
  assert.ok(!antrean.body.some((b) => b.id === bkk));
  const r = await kasir.post('/api/pembayaran', { bkk_id: bkk, nomor_referensi: 'IB-UJI-1' });
  assert.equal(r.status, 409);
  assert.match(r.body.pesan, /berstatus diajukan/);
});

test('US-05 dan US-07: pembayaran cek, lembar terpakai, lalu dibatalkan Wakil Dekan II dengan jurnal pembalik', async () => {
  const faktur = await id('faktur_pemasok', 'nomor_faktur', 'TPJ/07/0098');
  const buat = await akt.post('/api/bkk', {
    jenis: 'PEMBAYARAN_FAKTUR', pemasok_id: await idPemasok('TPJ'), rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: 'CEK',
    faktur: [{ faktur_id: faktur, jumlah: 12500000 }],
  });
  assert.equal(buat.status, 201, JSON.stringify(buat.body));
  await akt.post(`/api/bkk/${buat.body.id}/ajukan`);
  await setujui('BKK', buat.body.id, spv, wd2, dekan);
  assert.ok((await kasir.get('/api/pembayaran/antrean')).body.some((b) => b.id === buat.body.id));

  const lembar = (await kasir.get(`/api/warkat/tersedia?rekening_kas_id=${await idRekening('BJB-OPS')}&jenis=CEK`)).body;
  const bayar = await kasir.post('/api/pembayaran', { bkk_id: buat.body.id, warkat_id: lembar[0].id });
  assert.equal(bayar.status, 201, JSON.stringify(bayar.body));
  assert.equal((await satu(pool, 'SELECT status FROM warkat WHERE id = ?', [lembar[0].id])).status, 'TERPAKAI');
  assert.equal((await satu(pool, 'SELECT status, terbayar FROM faktur_pemasok WHERE id = ?', [faktur])).status, 'LUNAS');
  const bkk = await akt.get(`/api/bkk/${buat.body.id}`);
  assert.equal(bkk.body.status, 'DIBAYAR');
  assert.equal(bkk.body.nomor_warkat, lembar[0].nomor);

  // Lembar yang sama tidak dapat dipakai untuk pembayaran lain.
  const bkkLain = await akt.post('/api/bkk', { jenis: 'PEMBAYARAN_FAKTUR', pemasok_id: await idPemasok('TPJ'), rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: 'CEK', faktur: [{ faktur_id: faktur, jumlah: 1 }] });
  assert.equal(bkkLain.status, 400, 'faktur yang sudah lunas tidak boleh diproses lagi');

  assert.equal((await kasir.post(`/api/pembayaran/${bayar.body.id}/batal`, { alasan: 'coba' })).status, 403);
  const batal = await wd2.post(`/api/pembayaran/${bayar.body.id}/batal`, { alasan: 'Cek rusak saat ditulis' });
  assert.equal(batal.status, 200, JSON.stringify(batal.body));
  const p = await satu(pool, 'SELECT status, jurnal_id, jurnal_batal_id FROM pembayaran WHERE id = ?', [bayar.body.id]);
  assert.equal(p.status, 'BATAL');
  const pembalik = await satu(pool, 'SELECT pembalik_dari_id, jenis FROM jurnal WHERE id = ?', [p.jurnal_batal_id]);
  assert.equal(pembalik.pembalik_dari_id, p.jurnal_id);
  assert.equal(pembalik.jenis, 'JKK');
  assert.equal((await satu(pool, 'SELECT dibalik_oleh_id FROM jurnal WHERE id = ?', [p.jurnal_id])).dibalik_oleh_id, p.jurnal_batal_id);
  assert.equal((await satu(pool, 'SELECT status FROM warkat WHERE id = ?', [lembar[0].id])).status, 'BATAL');
  const f = await satu(pool, 'SELECT status, terbayar FROM faktur_pemasok WHERE id = ?', [faktur]);
  assert.deepEqual([f.status, f.terbayar], ['TERVERIFIKASI', 0]);
  assert.equal((await akt.get(`/api/bkk/${buat.body.id}`)).body.status, 'DISETUJUI');
  assert.ok((await kasir.get('/api/pembayaran/antrean')).body.some((b) => b.id === buat.body.id));

  // Lembar batal tidak dapat dipakai lagi; pembayaran ulang memakai lembar berikutnya.
  const pakaiLagi = await kasir.post('/api/pembayaran', { bkk_id: buat.body.id, warkat_id: lembar[0].id });
  assert.equal(pakaiLagi.status, 409);
  const ulang = await kasir.post('/api/pembayaran', { bkk_id: buat.body.id, warkat_id: lembar[1].id });
  assert.equal(ulang.status, 201);
});

test('KF-BKK-06: transfer ke rekening pemasok yang belum diverifikasi tidak dapat diajukan', async () => {
  const bkk = await id('bukti_kas_keluar', 'nomor', 'BKK/2026/09/0001');
  const aju = await akt.post(`/api/bkk/${bkk}/ajukan`);
  assert.equal(aju.status, 409);
  assert.match(aju.body.pesan, /belum diverifikasi/);
  assert.equal((await beli.post(`/api/pemasok/${await idPemasok('LCP')}/verifikasi-rekening`)).status, 403);
  assert.equal((await spv.post(`/api/pemasok/${await idPemasok('LCP')}/verifikasi-rekening`)).status, 200);
  assert.equal((await akt.post(`/api/bkk/${bkk}/ajukan`)).status, 200);
});

test('AB-11: rekening pemasok yang diubah setelah BKK disetujui memblokir pembayaran transfer', async () => {
  const bkk = await id('bukti_kas_keluar', 'nomor', 'BKK/2026/09/0002');
  await setujui('BKK', bkk, spv, wd2, dekan);
  const tpj = await beli.get(`/api/pemasok/${await idPemasok('TPJ')}`);
  const ubah = await beli.put(`/api/pemasok/${tpj.body.id}`, { ...tpj.body, bank_nomor_rekening: '9990001112223' });
  assert.equal(ubah.status, 200, JSON.stringify(ubah.body));
  const bayar = await kasir.post('/api/pembayaran', { bkk_id: bkk, nomor_referensi: 'IB-UJI-2' });
  assert.equal(bayar.status, 409);
  assert.match(bayar.body.pesan, /belum diverifikasi/);
});

test('AB-09: jumlah bayar faktur tidak boleh melebihi sisa utang', async () => {
  const faktur = await id('faktur_pemasok', 'nomor_faktur', 'LCP-0906');
  const r = await akt.post('/api/bkk', { jenis: 'PEMBAYARAN_FAKTUR', pemasok_id: await idPemasok('LCP'), rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: 'CEK', faktur: [{ faktur_id: faktur, jumlah: 5000000 }] });
  assert.equal(r.status, 400);
  assert.match(r.body.galat['faktur.0.jumlah'], /Melebihi sisa utang/);
});

test('KF-BKK-04: satu permintaan pembayaran tidak dapat diproses di dua BKK', async () => {
  const dosen1 = await sebagai('dosen1');
  const kaprodiakt = await sebagai('kaprodiakt');
  const pp = await dosen1.post('/api/pp', { penerima_nama: 'Toko Uji', keterangan: 'Uji BKK ganda', baris: [{ uraian: 'Biaya', akun_id: await idAkun('6-1199'), jumlah: 500000 }] });
  await dosen1.unggah(`/api/lampiran/PP/${pp.body.id}`, 'nota.pdf', pdfContoh('Nota'));
  await dosen1.post(`/api/pp/${pp.body.id}/ajukan`);
  await setujui('PP', pp.body.id, kaprodiakt);
  const bkk1 = await akt.post('/api/bkk', { jenis: 'PERMINTAAN_PEMBAYARAN', sumber_id: pp.body.id, rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: 'CEK' });
  assert.equal(bkk1.status, 201);
  const bkk2 = await akt.post('/api/bkk', { jenis: 'PERMINTAAN_PEMBAYARAN', sumber_id: pp.body.id, rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: 'CEK' });
  assert.equal(bkk2.status, 409);
  // BKK dibatalkan: PP kembali siap diproses.
  await akt.post(`/api/bkk/${bkk1.body.id}/batal`, { alasan: 'Salah rekening sumber' });
  assert.equal((await dosen1.get(`/api/pp/${pp.body.id}`)).body.status, 'DISETUJUI');
});

test('KF-BKK-03: potongan PPh atas PP mengurangi jumlah dibayar tanpa mengubah total yang disetujui', async () => {
  const bkk = await satu(pool, "SELECT jumlah_bruto, jumlah_potongan, jumlah_bayar FROM bukti_kas_keluar WHERE sumber_nomor = (SELECT nomor FROM permintaan_pembayaran WHERE keterangan = 'Jasa pendampingan akreditasi internasional program studi')");
  assert.deepEqual([bkk.jumlah_bruto, bkk.jumlah_potongan, bkk.jumlah_bayar], [15000000, 300000, 14700000]);
});

test('AB-10: pembuat BKK tidak dapat mencatat pembayarannya meski lolos pemeriksaan peran', async () => {
  const bkk = await satu(pool, "SELECT id FROM bukti_kas_keluar WHERE status = 'DISETUJUI' ORDER BY id LIMIT 1");
  const ctx = { user: await muatPengguna(pool, await id('pengguna', 'username', 'stafkeu1')), ip: '127.0.0.1' };
  await assert.rejects(() => tx((conn) => bayarBKK(conn, ctx, { bkk_id: bkk.id, nomor_referensi: 'X', warkat_id: 1 })), /pembuat BKK/);
});

test('KNF-06: dua pembayaran serentak atas BKK yang sama hanya berhasil satu', async () => {
  const dosen1 = await sebagai('dosen1');
  const kaprodiakt = await sebagai('kaprodiakt');
  const pp = await dosen1.post('/api/pp', { penerima_nama: 'Toko Serentak', penerima_bank_nama: 'BCA', penerima_bank_rekening: '1112223334', penerima_bank_atas_nama: 'Toko Serentak', keterangan: 'Uji serentak', baris: [{ uraian: 'Biaya', akun_id: await idAkun('6-1199'), jumlah: 750000 }] });
  await dosen1.unggah(`/api/lampiran/PP/${pp.body.id}`, 'nota.pdf', pdfContoh('Nota'));
  await dosen1.post(`/api/pp/${pp.body.id}/ajukan`);
  await setujui('PP', pp.body.id, kaprodiakt);
  const bkk = await akt.post('/api/bkk', { jenis: 'PERMINTAAN_PEMBAYARAN', sumber_id: pp.body.id, rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: 'TRANSFER' });
  await akt.post(`/api/bkk/${bkk.body.id}/ajukan`);
  await setujui('BKK', bkk.body.id, spv, wd2);
  const [a, b] = await Promise.all([
    kasir.post('/api/pembayaran', { bkk_id: bkk.body.id, nomor_referensi: 'IB-SERENTAK-A' }),
    kasir.post('/api/pembayaran', { bkk_id: bkk.body.id, nomor_referensi: 'IB-SERENTAK-B' }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  const n = await satu(pool, "SELECT COUNT(*) AS n FROM pembayaran WHERE bkk_id = ? AND status = 'DIBAYAR'", [bkk.body.id]);
  assert.equal(n.n, 1);
});
