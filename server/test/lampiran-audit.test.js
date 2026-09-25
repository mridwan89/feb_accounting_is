import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { siapkan, tutup, sebagai, idAkun, idPemasok, pool, satu, pdfContoh } from './bantu.js';

after(tutup);

let k;
before(async () => {
  await siapkan();
  const nama = ['staf1', 'staf2', 'kaumum', 'beli1', 'spvakt', 'auditor1', 'akt1'];
  const klien = await Promise.all(nama.map((u) => sebagai(u)));
  k = Object.fromEntries(nama.map((u, i) => [u, klien[i]]));
});

test('KF-DOK-01: lampiran diperiksa dari isinya; berkas yang disamarkan ditolak', async () => {
  const pp = await k.staf1.post('/api/pp', { penerima_nama: 'Toko Lampiran', keterangan: 'Uji lampiran', baris: [{ uraian: 'Biaya', akun_id: await idAkun('6-1199'), jumlah: 100000 }] });
  const ok = await k.staf1.unggah(`/api/lampiran/PP/${pp.body.id}`, 'nota.pdf', pdfContoh('Nota asli'));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.tipe_mime, 'application/pdf');
  const palsu = await k.staf1.unggah(`/api/lampiran/PP/${pp.body.id}`, 'nota.pdf', Buffer.from('MZ\x90\x00 ini sebenarnya program'));
  assert.equal(palsu.status, 400);
  assert.match(palsu.body.pesan, /Unggah PDF, JPG, atau PNG/);
  const png = await k.staf1.unggah(`/api/lampiran/PP/${pp.body.id}`, 'foto.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
  assert.equal(png.status, 201);
  assert.equal((await k.staf1.get(`/api/lampiran/PP/${pp.body.id}`)).body.length, 2);

  // Sebelum diajukan pengunggah boleh menghapus; sesudah diajukan tidak boleh.
  assert.equal((await k.staf1.delete(`/api/lampiran-berkas/${png.body.id}`)).status, 200);
  await k.staf1.post(`/api/pp/${pp.body.id}/ajukan`);
  const hapus = await k.staf1.delete(`/api/lampiran-berkas/${ok.body.id}`);
  assert.equal(hapus.status, 409);

  // Unduh hanya oleh yang berhak melihat dokumen.
  assert.equal((await k.staf2.get(`/api/lampiran-berkas/${ok.body.id}`)).status, 403);
  const unduh = await k.kaumum.get(`/api/lampiran-berkas/${ok.body.id}`);
  assert.equal(unduh.status, 200);
  assert.equal(unduh.headers['content-type'], 'application/pdf');
});

test('KF-DOK-04: cetak pertama tercatat asli, cetak berikutnya salinan', async () => {
  const pp = await satu(pool, "SELECT id FROM permintaan_pembayaran WHERE keterangan = 'Tagihan listrik kantor pusat bulan lalu'");
  const c1 = await k.akt1.post(`/api/cetak/PP/${pp.id}`);
  const c2 = await k.akt1.post(`/api/cetak/PP/${pp.id}`);
  assert.deepEqual([c1.body.cetak_ke, c2.body.cetak_ke], [1, 2]);
  const log = await satu(pool, "SELECT COUNT(*) AS n FROM log_audit WHERE aksi = 'CETAK' AND entitas = 'permintaan_pembayaran' AND entitas_id = ?", [String(pp.id)]);
  assert.equal(log.n, 2);
  assert.equal((await k.staf2.post(`/api/cetak/PP/${pp.id}`)).status, 403);
});

test('US-18 / AB-26: perubahan rekening pemasok tercatat lengkap dan diverifikasi pihak lain', async () => {
  const idTma = await idPemasok('TMA');
  const lama = (await k.beli1.get(`/api/pemasok/${idTma}`)).body;
  const ubah = await k.beli1.put(`/api/pemasok/${idTma}`, { ...lama, bank_nomor_rekening: '0098877000' });
  assert.equal(ubah.status, 200, JSON.stringify(ubah.body));
  const p = await satu(pool, 'SELECT rekening_terverifikasi FROM pemasok WHERE id = ?', [idTma]);
  assert.equal(p.rekening_terverifikasi, 0);
  const log = await satu(pool, "SELECT username, ip, data_sebelum, data_sesudah FROM log_audit WHERE aksi = 'UBAH_REKENING' AND entitas_id = ? ORDER BY id DESC LIMIT 1", [String(idTma)]);
  assert.equal(log.username, 'beli1');
  assert.ok(log.ip);
  const json = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  assert.equal(json(log.data_sebelum).bank_nomor_rekening, '0098877665');
  assert.equal(json(log.data_sesudah).bank_nomor_rekening, '0098877000');

  const cari = await k.auditor1.get(`/api/audit?entitas=pemasok&aksi=UBAH_REKENING&entitas_id=${idTma}`);
  assert.equal(cari.status, 200);
  assert.ok(cari.body.total >= 1);

  assert.equal((await k.spvakt.post(`/api/pemasok/${idTma}/verifikasi-rekening`)).status, 200);
  assert.equal((await k.spvakt.post(`/api/pemasok/${idTma}/verifikasi-rekening`)).status, 409);
  const lap = await k.auditor1.get('/api/laporan/pengecualian?dari=2026-09-01&sampai=2026-12-31');
  assert.ok(lap.body.log_penting.some((l) => l.aksi === 'UBAH_REKENING' && l.entitas_id === String(idTma)));
});

test('KF-MST-09: NPWP dan PKP divalidasi pada data pemasok', async () => {
  const salah = await k.beli1.post('/api/pemasok', { kode: 'UJI-NPWP', nama: 'CV Uji', termin_hari: 30, npwp: '12345', pkp: true });
  assert.equal(salah.status, 400);
  assert.equal(salah.body.galat.npwp, 'NPWP harus 15 atau 16 digit.');
  const pkpTanpaNpwp = await k.beli1.post('/api/pemasok', { kode: 'UJI-PKP', nama: 'CV Uji PKP', termin_hari: 30, pkp: true });
  assert.equal(pkpTanpaNpwp.status, 400);
  const rekeningSetengah = await k.beli1.post('/api/pemasok', { kode: 'UJI-BANK', nama: 'CV Uji Bank', termin_hari: 30, bank_nama: 'BCA' });
  assert.equal(rekeningSetengah.status, 400);
});
