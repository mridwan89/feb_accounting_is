import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { siapkan, tutup, sebagai, setujui, idAkun, idRekening, idDept, id, pool, satu, semua, pdfContoh } from './bantu.js';

after(tutup);

let k;
before(async () => {
  await siapkan();
  const nama = ['dosen1', 'dosen2', 'kaprodiakt', 'kaprodimnj', 'kaskecil1', 'kaskecil2', 'stafkeu1', 'kasubag', 'wd2', 'kasir1', 'auditor1', 'katu'];
  const klien = await Promise.all(nama.map((u) => sebagai(u)));
  k = Object.fromEntries(nama.map((u, i) => [u, klien[i]]));
});

async function bkkDibayar(input, metode = 'CEK') {
  const bkk = await k.stafkeu1.post('/api/bkk', { rekening_kas_id: await idRekening('BJB-OPS'), metode_bayar: metode, ...input });
  assert.equal(bkk.status, 201, JSON.stringify(bkk.body));
  assert.equal((await k.stafkeu1.post(`/api/bkk/${bkk.body.id}/ajukan`)).status, 200);
  await setujui('BKK', bkk.body.id, k.kasubag, k.wd2);
  const bayar = { bkk_id: bkk.body.id };
  if (metode === 'TRANSFER') bayar.nomor_referensi = `IB-${bkk.body.id}`;
  else bayar.warkat_id = (await k.kasir1.get(`/api/warkat/tersedia?rekening_kas_id=${await idRekening('BJB-OPS')}&jenis=CEK`)).body[0].id;
  const r = await k.kasir1.post('/api/pembayaran', bayar);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return bkk.body;
}

test('US-12: pengeluaran kas kecil di atas batas per transaksi ditolak', async () => {
  const r = await k.dosen1.post('/api/pkk', { dana_id: await id('dana_kas_kecil', 'kode', 'KK-DKN'), keperluan: 'Printer kecil', akun_id: await idAkun('6-1104'), jumlah: 1200000 });
  assert.equal(r.status, 400);
  assert.match(r.body.pesan, /batas kas kecil per transaksi \(Rp1\.000\.000\)/);
});

test('US-12 dan US-13: saldo tunai tidak boleh minus; pengisian kembali memulihkan saldo', async () => {
  const dana = await k.wd2.post('/api/dana-kas-kecil', {
    kode: 'KK-UJI', nama: 'Kas Kecil Uji', pemegang_id: await id('pengguna', 'username', 'kaskecil2'), departemen_id: await idDept('TU'),
    akun_id: await idAkun('1-1104'), dana_diusulkan: 1000000, batas_transaksi: 1000000,
  });
  assert.equal(dana.status, 201, JSON.stringify(dana.body));
  const belumDibentuk = await k.dosen1.post('/api/pkk', { dana_id: dana.body.id, keperluan: 'Uji', akun_id: await idAkun('6-1104'), jumlah: 10000 });
  assert.equal(belumDibentuk.status, 400);
  assert.match(belumDibentuk.body.pesan, /belum dibentuk/);
  await bkkDibayar({ jenis: 'PEMBENTUKAN_KAS_KECIL', sumber_id: dana.body.id });
  assert.equal((await satu(pool, 'SELECT jumlah_dana FROM dana_kas_kecil WHERE id = ?', [dana.body.id])).jumlah_dana, 1000000);

  const buatDanDisetujui = async (jumlah) => {
    const pkk = await k.katu.post('/api/pkk', { dana_id: dana.body.id, keperluan: `Perlengkapan ruang kuliah ${jumlah}`, akun_id: await idAkun('5-1103'), jumlah });
    assert.equal(pkk.status, 201, JSON.stringify(pkk.body));
    await k.katu.post(`/api/pkk/${pkk.body.id}/ajukan`);
    await setujui('PKK', pkk.body.id, k.wd2); // pembuat adalah pimpinan unit: dialihkan ke Wakil Dekan II
    return pkk.body.id;
  };
  const p1 = await buatDanDisetujui(800000);
  const p2 = await buatDanDisetujui(300000);
  assert.equal((await k.kaskecil1.post(`/api/pkk/${p1}/bayar`, { nomor_bukti: 'NT-1' })).status, 403, 'bukan pemegang dana');
  assert.equal((await k.kaskecil2.post(`/api/pkk/${p1}/bayar`, { nomor_bukti: 'NT-1' })).status, 200);
  const kurang = await k.kaskecil2.post(`/api/pkk/${p2}/bayar`, { nomor_bukti: 'NT-2' });
  assert.equal(kurang.status, 409);
  assert.match(kurang.body.pesan, /tinggal Rp200\.000/);

  const pdk = await k.kaskecil2.post('/api/pdk', { dana_id: dana.body.id, pkk_ids: [p1] });
  assert.equal(pdk.status, 201, JSON.stringify(pdk.body));
  assert.equal(pdk.body.total, 800000);
  await k.kaskecil2.post(`/api/pdk/${pdk.body.id}/ajukan`);
  const bkk = await bkkDibayar({ jenis: 'PENGISIAN_KAS_KECIL', sumber_id: pdk.body.id });
  const detailBkk = await k.stafkeu1.get(`/api/bkk/${bkk.id}`);
  assert.equal(detailBkk.body.baris[0].akun_kode, '5-1103');
  const posisi = (await k.kaskecil2.get(`/api/dana-kas-kecil/${dana.body.id}`)).body.posisi;
  assert.equal(posisi.saldo_tunai, 1000000);
  assert.equal((await satu(pool, 'SELECT status FROM pengeluaran_kas_kecil WHERE id = ?', [p1])).status, 'DIGANTI');
  assert.equal((await k.kaskecil2.post(`/api/pkk/${p2}/bayar`, { nomor_bukti: 'NT-2' })).status, 200);
});

test('US-14: opname menghitung selisih dan terkunci setelah final; pemegang dana tidak dapat mengopname', async () => {
  const dana = await id('dana_kas_kecil', 'kode', 'KK-TU');
  assert.equal((await k.kaskecil2.post('/api/opname', { dana_id: dana, rincian: { kertas: {}, logam: {} } })).status, 403);
  const pos = (await k.auditor1.get(`/api/opname/pratinjau?dana_id=${dana}`)).body;
  assert.equal(pos.saldo_seharusnya, 6750000);
  const opn = await k.auditor1.post('/api/opname', { dana_id: dana, rincian: { kertas: { 100000: 67, 50000: 1 }, logam: {} } });
  assert.equal(opn.status, 201, JSON.stringify(opn.body));
  assert.equal(opn.body.total_fisik, 6750000);
  assert.equal(opn.body.selisih, 0);
  assert.equal((await k.auditor1.post(`/api/opname/${opn.body.id}/final`)).status, 200);
  assert.equal((await k.auditor1.put(`/api/opname/${opn.body.id}`, { rincian: { kertas: {}, logam: {} } })).status, 409);
  const opnDemo = await satu(pool, "SELECT selisih FROM opname_kas_kecil WHERE nomor = 'OPN/2026/09/0001'");
  assert.equal(opnDemo.selisih, -5000);
});

test('US-10: uang muka yang lewat tenggat memblokir pengajuan uang muka baru', async () => {
  const lewat = await satu(pool, "SELECT nomor, tanggal_batas_pj FROM uang_muka WHERE keperluan = 'Kunjungan promosi ke SMA mitra di Cirebon'");
  assert.ok(lewat.tanggal_batas_pj < '2026-09-25');
  const baru = await k.dosen2.post('/api/uang-muka', { keperluan: 'Pameran pendidikan Surabaya', jumlah: 2500000, tanggal_selesai_kegiatan: '2026-10-05' });
  assert.equal(baru.status, 201);
  const aju = await k.dosen2.post(`/api/uang-muka/${baru.body.id}/ajukan`);
  assert.equal(aju.status, 409);
  assert.match(aju.body.pesan, new RegExp(lewat.nomor));
  const lap = await k.wd2.get('/api/laporan/uang-muka-beredar');
  assert.ok(lap.body.data.some((u) => u.nomor === lewat.nomor && u.lewat_tenggat));
});

test('US-11: pertanggungjawaban dengan sisa diselesaikan lewat BKM sebesar sisa tepat', async () => {
  const um = await satu(pool, "SELECT id, nomor FROM uang_muka WHERE keperluan = 'Kunjungan promosi ke SMA mitra di Cirebon'");
  const pj = await k.dosen2.post('/api/pjum', {
    uang_muka_id: um.id,
    baris: [
      { tanggal: '2026-08-27', uraian: 'Tiket kereta', akun_id: await idAkun('6-1111'), nomor_bukti: 'KAI-1', jumlah: 700000 },
      { tanggal: '2026-08-27', uraian: 'Hotel', akun_id: await idAkun('6-1111'), nomor_bukti: 'HTL-1', jumlah: 500000 },
    ],
  });
  assert.equal(pj.status, 201, JSON.stringify(pj.body));
  const tanpaLampiran = await k.dosen2.post(`/api/pjum/${pj.body.id}/ajukan`);
  assert.equal(tanpaLampiran.status, 400);
  assert.match(tanpaLampiran.body.pesan, /belum punya lampiran/);
  await k.dosen2.unggah(`/api/lampiran/PJUM/${pj.body.id}`, 'bukti.pdf', pdfContoh('Bukti perjalanan'));
  assert.equal((await k.dosen2.post(`/api/pjum/${pj.body.id}/ajukan`)).status, 200);
  await setujui('PJUM', pj.body.id, k.kaprodimnj, k.kasubag);
  const detail = await k.dosen2.get(`/api/pjum/${pj.body.id}`);
  assert.deepEqual([detail.body.status, detail.body.hasil, detail.body.selisih], ['DISETUJUI', 'SISA', 300000]);
  const jurnal = await semua(pool, 'SELECT a.kode, d.debit, d.kredit FROM jurnal_detail d JOIN akun a ON a.id = d.akun_id WHERE d.jurnal_id = ? ORDER BY d.baris', [detail.body.jurnal_id]);
  assert.deepEqual(jurnal.map((j) => [j.kode, j.debit, j.kredit]), [['6-1111', 700000, 0], ['6-1111', 500000, 0], ['1-1202', 300000, 0], ['1-1401', 0, 1500000]]);

  const salah = await k.kasir1.post('/api/bkm', { rekening_kas_id: await idRekening('BJB-OPS'), sumber: 'PENGEMBALIAN_UANG_MUKA', sumber_id: pj.body.id, jumlah: 250000 });
  assert.equal(salah.status, 400);
  const bkm = await k.kasir1.post('/api/bkm', { rekening_kas_id: await idRekening('BJB-OPS'), sumber: 'PENGEMBALIAN_UANG_MUKA', sumber_id: pj.body.id, jumlah: 300000 });
  assert.equal(bkm.status, 201, JSON.stringify(bkm.body));
  assert.equal((await satu(pool, 'SELECT status FROM uang_muka WHERE id = ?', [um.id])).status, 'SELESAI');
  // Setelah dipertanggungjawabkan, uang muka baru dapat diajukan.
  const baru = await satu(pool, "SELECT id FROM uang_muka WHERE keperluan = 'Pameran pendidikan Surabaya'");
  assert.equal((await k.dosen2.post(`/api/uang-muka/${baru.id}/ajukan`)).status, 200);
});

test('US-11: kekurangan uang muka dicatat sebagai utang kepada pegawai lalu dibayar melalui BKK', async () => {
  const pj = await satu(pool, "SELECT * FROM pertanggungjawaban_uang_muka WHERE hasil = 'KURANG'");
  assert.equal(pj.status, 'SELESAI');
  assert.equal(pj.selisih, -400000);
  const baris = await semua(pool, 'SELECT a.kode, d.kredit FROM jurnal_detail d JOIN akun a ON a.id = d.akun_id WHERE d.jurnal_id = ? AND d.kredit > 0', [pj.jurnal_id]);
  assert.deepEqual(baris.map((b) => [b.kode, b.kredit]), [['1-1401', 2000000], ['2-1301', 400000]]);
  const bkk = await satu(pool, 'SELECT status, jumlah_bayar FROM bukti_kas_keluar WHERE id = ?', [pj.bkk_id]);
  assert.deepEqual([bkk.status, bkk.jumlah_bayar], ['DIBAYAR', 400000]);
});
