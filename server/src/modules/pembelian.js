import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatKonflik, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, teks, teksOpsional, bool, tanggal, tanggalOpsional } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu, punya } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { kali, jumlahkan, hitungPajak, keSen, tambah } from '../lib/uang.js';
import { hariIni } from '../lib/tanggal.js';
import { daftarkanDokumen, kunciBaris, pastikanStatus, pastikanPembuat } from '../lib/dokumen.js';
import { batalkanPersetujuan, riwayatPersetujuan, bolehMemutuskan } from '../lib/persetujuan.js';
import { ajukanDokumen } from '../lib/alur.js';
import { ambilPengaturan } from '../lib/pengaturan.js';

export const router = Router();

const PERAN_LIHAT_PO = ['PEMBELIAN', 'GUDANG', 'STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR', 'PIMPINAN_UNIT', 'KASIR'];

function bolehLihatPO(user, po) {
  if (punya(user, 'PEMBELIAN', 'GUDANG', 'STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR', 'KASIR')) return true;
  if (punya(user, 'PIMPINAN_UNIT') && (po.departemen_id === user.departemen_id || po.departemen_pembuat_id === user.departemen_id)) return true;
  return po.dibuat_oleh === user.id;
}

daftarkanDokumen('PO', {
  tabel: 'pesanan_pembelian',
  label: 'Pesanan pembelian',
  statusMenunggu: 'DIAJUKAN',
  bolehLihat: async (db, user, po) => {
    const u = await satu(db, 'SELECT departemen_id FROM pengguna WHERE id = ?', [po.dibuat_oleh]);
    return bolehLihatPO(user, { ...po, departemen_pembuat_id: u?.departemen_id });
  },
  onDisetujui: async (conn, _ctx, po) => {
    await jalankan(conn, "UPDATE pesanan_pembelian SET status = 'DISETUJUI' WHERE id = ?", [po.id]);
  },
  onDitolak: async (conn, _ctx, po) => {
    await jalankan(conn, "UPDATE pesanan_pembelian SET status = 'DITOLAK' WHERE id = ?", [po.id]);
  },
});

daftarkanDokumen('LPB', {
  tabel: 'penerimaan_barang',
  label: 'Penerimaan barang',
  bolehLihat: async (_db, user) => punya(user, PERAN_LIHAT_PO),
});
daftarkanDokumen('BAST', {
  tabel: 'penerimaan_barang',
  label: 'Berita acara serah terima',
  bolehLihat: async (_db, user) => punya(user, PERAN_LIHAT_PO),
});

// ---------------------------------------------------------------- pesanan pembelian

const skemaBarisPO = z.object({
  uraian: teks(255),
  jenis: z.enum(['BARANG', 'JASA']),
  qty: z.coerce.number().positive(),
  satuan: teks(20),
  harga: z.coerce.number().positive(),
  akun_id: id(),
});

const skemaPO = z.object({
  tanggal: tanggal(),
  pemasok_id: id(),
  departemen_id: id(),
  tanggal_kirim: tanggalOpsional(),
  termin_hari: z.coerce.number().int().min(0).max(365).optional(),
  ppn: bool().optional(),
  keterangan: teksOpsional(500),
  baris: z.array(skemaBarisPO).min(1).max(100),
});

async function susunPO(conn, data) {
  const pemasok = await satu(conn, 'SELECT * FROM pemasok WHERE id = ?', [data.pemasok_id]);
  if (!pemasok || !pemasok.aktif) throw galatMasukan('Pemasok tidak aktif.', { pemasok_id: 'Pilih pemasok aktif.' });
  if (data.ppn && !pemasok.pkp) throw galatMasukan('Pemasok ini bukan PKP sehingga tidak boleh menagih PPN.', { ppn: 'Pemasok bukan PKP.' });
  const dept = await satu(conn, 'SELECT id FROM departemen WHERE id = ? AND aktif = 1', [data.departemen_id]);
  if (!dept) throw galatMasukan('Departemen tidak aktif.', { departemen_id: 'Pilih departemen aktif.' });
  if (data.tanggal_kirim && data.tanggal_kirim < data.tanggal) throw galatMasukan('Tanggal kirim tidak boleh sebelum tanggal PO.', { tanggal_kirim: 'Tidak boleh sebelum tanggal PO.' });
  const akun = await semua(conn, "SELECT id FROM akun WHERE id IN (?) AND tipe = 'DETAIL' AND aktif = 1 AND kategori IN ('ASET','BEBAN')", [data.baris.map((b) => b.akun_id)]);
  const akunValid = new Set(akun.map((a) => a.id));
  const galat = {};
  data.baris.forEach((b, i) => {
    if (!akunValid.has(b.akun_id)) galat[`baris.${i}.akun_id`] = 'Pilih akun detail aset atau beban.';
  });
  if (Object.keys(galat).length) throw galatMasukan('Periksa kembali isian yang ditandai.', galat);

  const baris = data.baris.map((b, i) => ({ ...b, baris: i + 1, jumlah: kali(b.qty, b.harga) }));
  const subtotal = jumlahkan(baris, (b) => b.jumlah);
  let pajakPpn = null;
  let ppn = 0;
  if (data.ppn) {
    const p = await ambilPengaturan(conn);
    pajakPpn = await satu(conn, "SELECT * FROM pajak WHERE kode = ? AND jenis = 'PPN'", [p.pajak_ppn_bawaan]);
    if (!pajakPpn) throw galatMasukan('Kode pajak PPN bawaan belum diatur. Hubungi Administrator.');
    ppn = hitungPajak(subtotal, pajakPpn.tarif);
  }
  return {
    pemasok,
    baris,
    subtotal,
    ppn,
    total: tambah(subtotal, ppn),
    pajakPpnId: pajakPpn?.id || null,
    termin: data.termin_hari ?? pemasok.termin_hari,
  };
}

async function simpanBarisPO(conn, poId, baris) {
  await jalankan(conn, 'DELETE FROM pesanan_pembelian_detail WHERE po_id = ?', [poId]);
  await jalankan(
    conn,
    'INSERT INTO pesanan_pembelian_detail (po_id, baris, uraian, jenis, qty, satuan, harga, jumlah, akun_id) VALUES ?',
    [baris.map((b) => [poId, b.baris, b.uraian, b.jenis, b.qty, b.satuan, b.harga, b.jumlah, b.akun_id])],
  );
}

export async function buatPO(conn, ctx, input) {
  const data = validasi(skemaPO, { tanggal: hariIni(), ...input });
  const s = await susunPO(conn, data);
  const nomor = await nomorBaru(conn, 'PO', data.tanggal);
  const r = await jalankan(
    conn,
    `INSERT INTO pesanan_pembelian (nomor, tanggal, pemasok_id, departemen_id, tanggal_kirim, termin_hari, pajak_ppn_id,
       keterangan, subtotal, ppn, total, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, data.tanggal, data.pemasok_id, data.departemen_id, data.tanggal_kirim, s.termin, s.pajakPpnId, data.keterangan, s.subtotal, s.ppn, s.total, ctx.user.id],
  );
  await simpanBarisPO(conn, r.insertId, s.baris);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'pesanan_pembelian', entitasId: r.insertId, ringkasan: `PO ${nomor} ke ${s.pemasok.nama} senilai ${s.total}`, sesudah: data });
  return { id: r.insertId, nomor };
}

export async function ubahPO(conn, ctx, poId, input) {
  const po = await kunciBaris(conn, 'pesanan_pembelian', poId, 'Pesanan pembelian');
  pastikanPembuat(ctx, po);
  pastikanStatus(po, ['DRAFT', 'DITOLAK'], 'diubah');
  const data = validasi(skemaPO, input);
  const s = await susunPO(conn, data);
  await jalankan(
    conn,
    `UPDATE pesanan_pembelian SET tanggal = ?, pemasok_id = ?, departemen_id = ?, tanggal_kirim = ?, termin_hari = ?, pajak_ppn_id = ?,
       keterangan = ?, subtotal = ?, ppn = ?, total = ? WHERE id = ?`,
    [data.tanggal, data.pemasok_id, data.departemen_id, data.tanggal_kirim, s.termin, s.pajakPpnId, data.keterangan, s.subtotal, s.ppn, s.total, poId],
  );
  await simpanBarisPO(conn, poId, s.baris);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'pesanan_pembelian', entitasId: poId, ringkasan: `PO ${po.nomor} diubah`, sebelum: po, sesudah: data });
}

export async function ajukanPO(conn, ctx, poId) {
  const po = await kunciBaris(conn, 'pesanan_pembelian', poId, 'Pesanan pembelian');
  pastikanPembuat(ctx, po);
  pastikanStatus(po, ['DRAFT', 'DITOLAK'], 'diajukan');
  const pemasok = await satu(conn, 'SELECT nama FROM pemasok WHERE id = ?', [po.pemasok_id]);
  const h = await ajukanDokumen(conn, ctx, {
    jenis: 'PO',
    doc: po,
    nilai: po.total,
    ringkasan: `PO ke ${pemasok.nama}`,
    departemenId: ctx.user.departemen_id,
  });
  await catatAudit(conn, ctx, { aksi: 'AJUKAN', entitas: 'pesanan_pembelian', entitasId: poId, ringkasan: `PO ${po.nomor} diajukan` });
  return h;
}

export async function batalPO(conn, ctx, poId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const po = await kunciBaris(conn, 'pesanan_pembelian', poId, 'Pesanan pembelian');
  if (['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(po.status)) {
    pastikanPembuat(ctx, po);
  } else if (po.status === 'DISETUJUI') {
    if (!punya(ctx.user, 'PEMBELIAN')) throw galatAkses();
    const terima = await satu(conn, 'SELECT SUM(qty_diterima) AS d FROM pesanan_pembelian_detail WHERE po_id = ?', [poId]);
    if (keSen(terima.d) > 0) throw galatKonflik('PO sudah ada penerimaan barang; gunakan Tutup PO.');
  } else {
    pastikanStatus(po, ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'], 'dibatalkan');
  }
  await batalkanPersetujuan(conn, 'PO', poId);
  await jalankan(conn, "UPDATE pesanan_pembelian SET status = 'BATAL', alasan_batal = ? WHERE id = ?", [alasan.trim().slice(0, 255), poId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'pesanan_pembelian', entitasId: poId, ringkasan: `PO ${po.nomor} dibatalkan: ${alasan}` });
}

export async function tutupPO(conn, ctx, poId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan penutupan wajib diisi.', { alasan: 'Wajib diisi.' });
  const po = await kunciBaris(conn, 'pesanan_pembelian', poId, 'Pesanan pembelian');
  pastikanStatus(po, ['DITERIMA_SEBAGIAN'], 'ditutup');
  await jalankan(conn, "UPDATE pesanan_pembelian SET status = 'DITUTUP', alasan_batal = ? WHERE id = ?", [alasan.trim().slice(0, 255), poId]);
  await catatAudit(conn, ctx, { aksi: 'TUTUP', entitas: 'pesanan_pembelian', entitasId: poId, ringkasan: `PO ${po.nomor} ditutup: ${alasan}` });
}

const PO_SELECT = `SELECT po.*, p.nama AS pemasok_nama, p.kode AS pemasok_kode, d.nama AS departemen_nama,
    u.nama_lengkap AS dibuat_nama, u.departemen_id AS departemen_pembuat_id
  FROM pesanan_pembelian po JOIN pemasok p ON p.id = po.pemasok_id JOIN departemen d ON d.id = po.departemen_id
  JOIN pengguna u ON u.id = po.dibuat_oleh`;

router.get('/po', perlu(...PERAN_LIHAT_PO), async (req, res) => {
  const q = req.query;
  const syarat = ['1 = 1'];
  const params = [];
  if (!punya(req.user, 'PEMBELIAN', 'GUDANG', 'STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR', 'KASIR')) {
    syarat.push('(po.departemen_id = ? OR u.departemen_id = ?)');
    params.push(req.user.departemen_id, req.user.departemen_id);
  }
  if (q.status) { syarat.push('po.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.pemasok_id) { syarat.push('po.pemasok_id = ?'); params.push(Number(q.pemasok_id)); }
  if (q.dari) { syarat.push('po.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('po.tanggal <= ?'); params.push(q.sampai); }
  if (q.cari) { syarat.push('(po.nomor LIKE ? OR p.nama LIKE ? OR po.keterangan LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  if (q.bisa_diterima === '1') syarat.push("po.status IN ('DISETUJUI','DITERIMA_SEBAGIAN')");
  if (q.bisa_ditagih === '1') {
    syarat.push("po.status IN ('DISETUJUI','DITERIMA_SEBAGIAN','DITERIMA_PENUH','DITUTUP')");
    syarat.push('EXISTS (SELECT 1 FROM pesanan_pembelian_detail x WHERE x.po_id = po.id AND x.qty_diterima > x.qty_ditagih)');
  }
  res.json(await semua(pool, `${PO_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY po.tanggal DESC, po.id DESC LIMIT 500`, params));
});

export async function detailPO(db, user, poId) {
  const po = await satu(db, `${PO_SELECT} WHERE po.id = ?`, [poId]);
  if (!po) throw galatTidakAda('Pesanan pembelian tidak ditemukan.');
  if (!bolehLihatPO(user, po)) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  const baris = await semua(
    db,
    `SELECT d.*, a.kode AS akun_kode, a.nama AS akun_nama FROM pesanan_pembelian_detail d JOIN akun a ON a.id = d.akun_id
      WHERE d.po_id = ? ORDER BY d.baris`,
    [poId],
  );
  const pemasok = await satu(db, 'SELECT id, kode, nama, alamat, kota, npwp, pkp, telepon, kontak FROM pemasok WHERE id = ?', [po.pemasok_id]);
  const penerimaan = await semua(db, 'SELECT id, nomor, jenis, tanggal, status FROM penerimaan_barang WHERE po_id = ? ORDER BY id', [poId]);
  const faktur = await semua(db, 'SELECT id, nomor, nomor_faktur, tanggal_faktur, total_tagihan, status FROM faktur_pemasok WHERE po_id = ? ORDER BY id', [poId]);
  return {
    ...po,
    pemasok,
    baris,
    penerimaan,
    faktur,
    persetujuan: await riwayatPersetujuan(db, 'PO', poId),
    boleh_memutuskan: await bolehMemutuskan(db, user, 'PO', poId),
  };
}

router.get('/po/:id', perlu(...PERAN_LIHAT_PO), async (req, res) => {
  res.json(await detailPO(pool, req.user, Number(req.params.id)));
});
router.post('/po', perlu('PEMBELIAN'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatPO(conn, req.ctx, req.body)));
});
router.put('/po/:id', perlu('PEMBELIAN'), async (req, res) => {
  await tx((conn) => ubahPO(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/po/:id/ajukan', perlu('PEMBELIAN'), async (req, res) => {
  res.json(await tx((conn) => ajukanPO(conn, req.ctx, Number(req.params.id))));
});
router.post('/po/:id/batal', perlu('PEMBELIAN'), async (req, res) => {
  await tx((conn) => batalPO(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});
router.post('/po/:id/tutup', perlu('PEMBELIAN'), async (req, res) => {
  await tx((conn) => tutupPO(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- penerimaan barang (LPB/BAST)

const skemaLPB = z.object({
  jenis: z.enum(['LPB', 'BAST']),
  tanggal: tanggal(),
  po_id: id(),
  nomor_surat_jalan: teksOpsional(50),
  keterangan: teksOpsional(500),
  baris: z
    .array(z.object({ po_detail_id: id(), qty: z.coerce.number().positive(), catatan: teksOpsional(255) }))
    .min(1),
});

export async function perbaruiStatusPO(conn, poId) {
  const po = await satu(conn, 'SELECT id, status FROM pesanan_pembelian WHERE id = ? FOR UPDATE', [poId]);
  if (!['DISETUJUI', 'DITERIMA_SEBAGIAN', 'DITERIMA_PENUH'].includes(po.status)) return;
  const r = await satu(
    conn,
    'SELECT COUNT(*) AS n, SUM(qty_diterima > 0) AS ada, SUM(qty_diterima >= qty) AS penuh FROM pesanan_pembelian_detail WHERE po_id = ?',
    [poId],
  );
  const baru = !Number(r.ada) ? 'DISETUJUI' : Number(r.penuh) === Number(r.n) ? 'DITERIMA_PENUH' : 'DITERIMA_SEBAGIAN';
  if (baru !== po.status) await jalankan(conn, 'UPDATE pesanan_pembelian SET status = ? WHERE id = ?', [baru, poId]);
}

export async function buatPenerimaan(conn, ctx, input) {
  const data = validasi(skemaLPB, { tanggal: hariIni(), ...input });
  const po = await kunciBaris(conn, 'pesanan_pembelian', data.po_id, 'Pesanan pembelian');
  if (!['DISETUJUI', 'DITERIMA_SEBAGIAN'].includes(po.status)) {
    throw galatKonflik(`PO ${po.nomor} belum disetujui atau sudah selesai diterima, sehingga tidak dapat dicatat penerimaannya.`);
  }
  if (data.tanggal < po.tanggal) throw galatMasukan('Tanggal penerimaan tidak boleh sebelum tanggal PO.', { tanggal: 'Tidak boleh sebelum tanggal PO.' });
  const detail = await semua(conn, 'SELECT * FROM pesanan_pembelian_detail WHERE po_id = ? FOR UPDATE', [po.id]);
  const peta = new Map(detail.map((d) => [d.id, d]));
  const jenisBaris = data.jenis === 'LPB' ? 'BARANG' : 'JASA';
  const galat = {};
  const dipakai = new Set();
  data.baris.forEach((b, i) => {
    const d = peta.get(b.po_detail_id);
    if (!d) galat[`baris.${i}.po_detail_id`] = 'Baris bukan bagian dari PO ini.';
    else if (dipakai.has(d.id)) galat[`baris.${i}.po_detail_id`] = 'Baris PO dipilih lebih dari sekali.';
    else if (d.jenis !== jenisBaris) galat[`baris.${i}.po_detail_id`] = data.jenis === 'LPB' ? 'LPB hanya untuk baris barang.' : 'BAST hanya untuk baris jasa.';
    else {
      const sisa = Number(d.qty) - Number(d.qty_diterima);
      if (keSen(b.qty) > keSen(sisa)) galat[`baris.${i}.qty`] = `Melebihi sisa pesanan (${sisa} ${d.satuan}).`;
    }
    if (d) dipakai.add(d.id);
  });
  if (Object.keys(galat).length) throw galatMasukan('Kuantitas penerimaan tidak sesuai pesanan.', galat);

  const nomor = await nomorBaru(conn, data.jenis, data.tanggal);
  const r = await jalankan(
    conn,
    'INSERT INTO penerimaan_barang (nomor, jenis, tanggal, po_id, nomor_surat_jalan, keterangan, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [nomor, data.jenis, data.tanggal, po.id, data.nomor_surat_jalan, data.keterangan, ctx.user.id],
  );
  await jalankan(conn, 'INSERT INTO penerimaan_barang_detail (penerimaan_id, po_detail_id, qty, catatan) VALUES ?', [
    data.baris.map((b) => [r.insertId, b.po_detail_id, b.qty, b.catatan]),
  ]);
  for (const b of data.baris) {
    await jalankan(conn, 'UPDATE pesanan_pembelian_detail SET qty_diterima = qty_diterima + ? WHERE id = ?', [b.qty, b.po_detail_id]);
  }
  await perbaruiStatusPO(conn, po.id);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'penerimaan_barang', entitasId: r.insertId, ringkasan: `${data.jenis} ${nomor} atas PO ${po.nomor}`, sesudah: data });
  return { id: r.insertId, nomor };
}

export async function batalPenerimaan(conn, ctx, lpbId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const lpb = await kunciBaris(conn, 'penerimaan_barang', lpbId, 'Penerimaan barang');
  pastikanStatus(lpb, ['DICATAT'], 'dibatalkan');
  await kunciBaris(conn, 'pesanan_pembelian', lpb.po_id, 'Pesanan pembelian');
  const baris = await semua(
    conn,
    `SELECT b.qty, d.id AS po_detail_id, d.uraian, d.qty_diterima, d.qty_ditagih
       FROM penerimaan_barang_detail b JOIN pesanan_pembelian_detail d ON d.id = b.po_detail_id
      WHERE b.penerimaan_id = ? FOR UPDATE`,
    [lpbId],
  );
  for (const b of baris) {
    if (keSen(Number(b.qty_diterima) - Number(b.qty)) < keSen(b.qty_ditagih)) {
      throw galatKonflik(`Barang "${b.uraian}" sudah ditagih pemasok melebihi sisa penerimaan; batalkan fakturnya terlebih dahulu.`);
    }
  }
  for (const b of baris) {
    await jalankan(conn, 'UPDATE pesanan_pembelian_detail SET qty_diterima = qty_diterima - ? WHERE id = ?', [b.qty, b.po_detail_id]);
  }
  await jalankan(conn, "UPDATE penerimaan_barang SET status = 'BATAL', dibatalkan_oleh = ?, dibatalkan_pada = NOW(), alasan_batal = ? WHERE id = ?", [ctx.user.id, alasan.trim().slice(0, 255), lpbId]);
  await perbaruiStatusPO(conn, lpb.po_id);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'penerimaan_barang', entitasId: lpbId, ringkasan: `${lpb.jenis} ${lpb.nomor} dibatalkan: ${alasan}` });
}

const LPB_SELECT = `SELECT l.*, po.nomor AS po_nomor, p.nama AS pemasok_nama, p.id AS pemasok_id, u.nama_lengkap AS dibuat_nama
  FROM penerimaan_barang l JOIN pesanan_pembelian po ON po.id = l.po_id JOIN pemasok p ON p.id = po.pemasok_id
  JOIN pengguna u ON u.id = l.dibuat_oleh`;

router.get('/penerimaan', perlu(...PERAN_LIHAT_PO), async (req, res) => {
  const q = req.query;
  const syarat = ['1 = 1'];
  const params = [];
  if (q.po_id) { syarat.push('l.po_id = ?'); params.push(Number(q.po_id)); }
  if (q.status) { syarat.push('l.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.dari) { syarat.push('l.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('l.tanggal <= ?'); params.push(q.sampai); }
  if (q.cari) { syarat.push('(l.nomor LIKE ? OR po.nomor LIKE ? OR p.nama LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  res.json(await semua(pool, `${LPB_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY l.tanggal DESC, l.id DESC LIMIT 500`, params));
});

router.get('/penerimaan/:id', perlu(...PERAN_LIHAT_PO), async (req, res) => {
  const l = await satu(pool, `${LPB_SELECT} WHERE l.id = ?`, [req.params.id]);
  if (!l) throw galatTidakAda('Penerimaan tidak ditemukan.');
  const baris = await semua(
    pool,
    `SELECT b.*, d.baris, d.uraian, d.qty AS qty_po, d.satuan, d.qty_diterima AS qty_diterima_total,
            (SELECT COALESCE(SUM(x.qty), 0) FROM penerimaan_barang_detail x JOIN penerimaan_barang y ON y.id = x.penerimaan_id
              WHERE x.po_detail_id = b.po_detail_id AND y.status = 'DICATAT' AND y.id < b.penerimaan_id) AS qty_sebelumnya
       FROM penerimaan_barang_detail b JOIN pesanan_pembelian_detail d ON d.id = b.po_detail_id
      WHERE b.penerimaan_id = ? ORDER BY d.baris`,
    [req.params.id],
  );
  res.json({ ...l, baris });
});

router.post('/penerimaan', perlu('GUDANG'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatPenerimaan(conn, req.ctx, req.body)));
});
router.post('/penerimaan/:id/batal', perlu('GUDANG'), async (req, res) => {
  await tx((conn) => batalPenerimaan(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});

