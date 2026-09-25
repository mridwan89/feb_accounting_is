import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { siapkan, tutup, sebagai, setujui, idAkun, idPemasok, idDept, pool, satu, semua } from './bantu.js';

after(tutup);

let beli;
let gudang;
let akt;
let kabeli;
let dirkeu;
let mankeu;
before(async () => {
  await siapkan();
  [beli, gudang, akt, kabeli, dirkeu, mankeu] = await Promise.all(['beli1', 'gudang1', 'akt1', 'kabeli', 'dirkeu', 'mankeu'].map((u) => sebagai(u)));
});

async function poDisetujui({ pemasok = 'BKN', qty = 100, harga = 50000, jenis = 'BARANG', ppn = true, akun = '1-1301' } = {}) {
  const r = await beli.post('/api/po', {
    pemasok_id: await idPemasok(pemasok), departemen_id: await idDept('PRD'), ppn,
    baris: [{ uraian: `Barang uji ${qty}x${harga}`, jenis, qty, satuan: 'unit', harga, akun_id: await idAkun(akun) }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal((await beli.post(`/api/po/${r.body.id}/ajukan`)).status, 200);
  await setujui('PO', r.body.id, kabeli);
  const po = await beli.get(`/api/po/${r.body.id}`);
  return po.body;
}

test('US-19: PO di atas Rp100 juta disetujui Kepala Departemen Pembelian lalu Direktur', async () => {
  const r = await beli.post('/api/po', {
    pemasok_id: await idPemasok('BKN'), departemen_id: await idDept('PRD'), ppn: false,
    baris: [{ uraian: 'Kertas kraft', jenis: 'BARANG', qty: 3000, satuan: 'rol', harga: 50000, akun_id: await idAkun('1-1301') }],
  });
  assert.equal(r.status, 201);
  await beli.post(`/api/po/${r.body.id}/ajukan`);
  const langkah = await semua(pool, "SELECT peran_kode FROM persetujuan WHERE jenis_dokumen = 'PO' AND dokumen_id = ? ORDER BY urutan", [r.body.id]);
  assert.deepEqual(langkah.map((l) => l.peran_kode), ['KEPALA_DEPT', 'DIREKTUR']);
  await setujui('PO', r.body.id, kabeli);
  assert.equal((await beli.get(`/api/po/${r.body.id}`)).body.status, 'DIAJUKAN');
  await setujui('PO', r.body.id, dirkeu);
  assert.equal((await beli.get(`/api/po/${r.body.id}`)).body.status, 'DISETUJUI');
});

test('PPN ditolak pada PO untuk pemasok yang bukan PKP', async () => {
  const r = await beli.post('/api/po', {
    pemasok_id: await idPemasok('SAT'), departemen_id: await idDept('UMS'), ppn: true,
    baris: [{ uraian: 'Map', jenis: 'BARANG', qty: 10, satuan: 'pak', harga: 20000, akun_id: await idAkun('6-1104') }],
  });
  assert.equal(r.status, 400);
  assert.match(r.body.pesan, /bukan PKP/);
});

test('US-20: penerimaan tidak boleh melebihi sisa pesanan', async () => {
  const po = await poDisetujui();
  const d = po.baris[0];
  const lpb1 = await gudang.post('/api/penerimaan', { jenis: 'LPB', po_id: po.id, baris: [{ po_detail_id: d.id, qty: 80 }] });
  assert.equal(lpb1.status, 201);
  assert.equal((await beli.get(`/api/po/${po.id}`)).body.status, 'DITERIMA_SEBAGIAN');
  const lebih = await gudang.post('/api/penerimaan', { jenis: 'LPB', po_id: po.id, baris: [{ po_detail_id: d.id, qty: 30 }] });
  assert.equal(lebih.status, 400);
  assert.match(lebih.body.galat['baris.0.qty'], /sisa pesanan \(20 unit\)/);
  const salahJenis = await gudang.post('/api/penerimaan', { jenis: 'BAST', po_id: po.id, baris: [{ po_detail_id: d.id, qty: 5 }] });
  assert.equal(salahJenis.status, 400);
});

test('US-01: faktur cocok tiga arah langsung terverifikasi dan jurnal pembelian terbentuk', async () => {
  const po = await poDisetujui();
  const d = po.baris[0];
  await gudang.post('/api/penerimaan', { jenis: 'LPB', po_id: po.id, baris: [{ po_detail_id: d.id, qty: 80 }] });
  const f = await akt.post('/api/faktur', { po_id: po.id, nomor_faktur: 'UJI-COCOK-1', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: d.id, qty: 80, harga: 50000 }] });
  assert.equal(f.status, 201, JSON.stringify(f.body));
  const v = await akt.post(`/api/faktur/${f.body.id}/verifikasi`);
  assert.equal(v.status, 200);
  assert.equal(v.body.status, 'TERVERIFIKASI');
  assert.equal(v.body.hasil_cocok, 'COCOK');
  const detail = await akt.get(`/api/faktur/${f.body.id}`);
  assert.equal(detail.body.total_utang, 4440000);
  const jurnal = await semua(pool, 'SELECT a.kode, d.debit, d.kredit FROM jurnal_detail d JOIN akun a ON a.id = d.akun_id WHERE d.jurnal_id = ? ORDER BY d.baris', [detail.body.jurnal_id]);
  assert.deepEqual(jurnal.map((j) => [j.kode, j.debit, j.kredit]), [['1-1301', 4000000, 0], ['1-1501', 440000, 0], ['2-1101', 0, 4440000]]);
  assert.equal(detail.body.tanggal_jatuh_tempo, '2026-10-20');
});

test('US-01: kuantitas melebihi penerimaan menunggu persetujuan; bila ditolak, kuantitas dilepas', async () => {
  const po = await poDisetujui();
  const d = po.baris[0];
  await gudang.post('/api/penerimaan', { jenis: 'LPB', po_id: po.id, baris: [{ po_detail_id: d.id, qty: 80 }] });
  const f = await akt.post('/api/faktur', { po_id: po.id, nomor_faktur: 'UJI-QTY-1', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: d.id, qty: 100, harga: 50000 }] });
  const v = await akt.post(`/api/faktur/${f.body.id}/verifikasi`);
  assert.equal(v.body.status, 'MENUNGGU_PERSETUJUAN');
  assert.equal(v.body.hasil_cocok, 'SELISIH');
  const baris = await satu(pool, 'SELECT status_cocok, qty_tersedia FROM faktur_pemasok_detail WHERE faktur_id = ?', [f.body.id]);
  assert.equal(baris.status_cocok, 'SELISIH_QTY');
  assert.equal(baris.qty_tersedia, 80);
  assert.ok((await mankeu.get('/api/persetujuan/tugas')).body.some((t) => t.jenis_dokumen === 'FB' && t.dokumen_id === f.body.id));

  await mankeu.post(`/api/persetujuan/FB/${f.body.id}/tolak`, { catatan: 'Tagih sesuai barang yang diterima' });
  assert.equal((await satu(pool, 'SELECT qty_ditagih FROM pesanan_pembelian_detail WHERE id = ?', [d.id])).qty_ditagih, 0);
  const ubah = await akt.put(`/api/faktur/${f.body.id}`, { po_id: po.id, nomor_faktur: 'UJI-QTY-1', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: d.id, qty: 80, harga: 50000 }] });
  assert.equal(ubah.status, 200);
  const v2 = await akt.post(`/api/faktur/${f.body.id}/verifikasi`);
  assert.equal(v2.body.status, 'TERVERIFIKASI');
});

test('US-01: harga di atas harga PO dengan toleransi 0% berstatus selisih harga', async () => {
  const po = await poDisetujui();
  const d = po.baris[0];
  await gudang.post('/api/penerimaan', { jenis: 'LPB', po_id: po.id, baris: [{ po_detail_id: d.id, qty: 100 }] });
  const f = await akt.post('/api/faktur', { po_id: po.id, nomor_faktur: 'UJI-HARGA-1', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: d.id, qty: 100, harga: 52000 }] });
  await akt.post(`/api/faktur/${f.body.id}/verifikasi`);
  const baris = await satu(pool, 'SELECT status_cocok FROM faktur_pemasok_detail WHERE faktur_id = ?', [f.body.id]);
  assert.equal(baris.status_cocok, 'SELISIH_HARGA');
  // Setelah Manajer Keuangan menyetujui selisih, faktur diposting dan tercatat di laporan pengecualian.
  await setujui('FB', f.body.id, mankeu);
  assert.equal((await akt.get(`/api/faktur/${f.body.id}`)).body.status, 'TERVERIFIKASI');
  const auditor = await sebagai('auditor1');
  const lap = await auditor.get('/api/laporan/pengecualian?dari=2026-09-01&sampai=2026-09-30');
  assert.ok(lap.body.selisih_disetujui.some((s) => s.id === f.body.id));
});

test('US-02: faktur ganda dari pemasok yang sama ditolak walau penulisan nomornya berbeda', async () => {
  const po = await poDisetujui();
  const d = po.baris[0];
  await gudang.post('/api/penerimaan', { jenis: 'LPB', po_id: po.id, baris: [{ po_detail_id: d.id, qty: 100 }] });
  const pertama = await akt.post('/api/faktur', { po_id: po.id, nomor_faktur: 'INV-778', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: d.id, qty: 50, harga: 50000 }] });
  assert.equal(pertama.status, 201);
  const ganda = await akt.post('/api/faktur', { po_id: po.id, nomor_faktur: 'inv 778', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: d.id, qty: 50, harga: 50000 }] });
  assert.equal(ganda.status, 400);
  assert.match(ganda.body.pesan, new RegExp(`nomor register ${pertama.body.nomor}`));
  // Nomor yang sama dari pemasok lain tetap boleh.
  const poLain = await poDisetujui({ pemasok: 'TPJ', akun: '1-1302' });
  await gudang.post('/api/penerimaan', { jenis: 'LPB', po_id: poLain.id, baris: [{ po_detail_id: poLain.baris[0].id, qty: 10 }] });
  const lain = await akt.post('/api/faktur', { po_id: poLain.id, nomor_faktur: 'INV-778', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: poLain.baris[0].id, qty: 10, harga: 50000 }] });
  assert.equal(lain.status, 201);
});

test('AB-21: PPh Pasal 23 naik 100% untuk pemasok tanpa NPWP', async () => {
  const f = await satu(pool, "SELECT tarif_pph, pph, total_utang FROM faktur_pemasok WHERE nomor_faktur = 'LCP-0906'");
  assert.equal(f.tarif_pph, 4);
  assert.equal(f.pph, 160000);
  assert.equal(f.total_utang, 3840000);
});

test('Faktur tanpa PO yang disetujui ditolak', async () => {
  const r = await beli.post('/api/po', {
    pemasok_id: await idPemasok('BKN'), departemen_id: await idDept('PRD'),
    baris: [{ uraian: 'Draf', jenis: 'BARANG', qty: 1, satuan: 'unit', harga: 1000, akun_id: await idAkun('1-1301') }],
  });
  const f = await akt.post('/api/faktur', { po_id: r.body.id, nomor_faktur: 'UJI-DRAF', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: (await beli.get(`/api/po/${r.body.id}`)).body.baris[0].id, qty: 1, harga: 1000 }] });
  assert.equal(f.status, 400);
  assert.match(f.body.pesan, /belum disetujui/);
});

test('LPB yang kuantitasnya sudah ditagih tidak dapat dibatalkan', async () => {
  const po = await poDisetujui();
  const d = po.baris[0];
  const lpb = await gudang.post('/api/penerimaan', { jenis: 'LPB', po_id: po.id, baris: [{ po_detail_id: d.id, qty: 100 }] });
  const f = await akt.post('/api/faktur', { po_id: po.id, nomor_faktur: 'UJI-LPB-BATAL', tanggal_faktur: '2026-09-20', tanggal_terima: '2026-09-21', baris: [{ po_detail_id: d.id, qty: 100, harga: 50000 }] });
  await akt.post(`/api/faktur/${f.body.id}/verifikasi`);
  const batal = await gudang.post(`/api/penerimaan/${lpb.body.id}/batal`, { alasan: 'Salah catat' });
  assert.equal(batal.status, 409);
});
