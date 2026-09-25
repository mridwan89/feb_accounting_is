import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatKonflik, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, idOpsional, teks, tanggalOpsional } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu, punya } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { keSen, dariSen } from '../lib/uang.js';
import { akhirBulan, awalBulan, namaPeriode } from '../lib/tanggal.js';
import { daftarkanDokumen, kunciBaris, pastikanStatus } from '../lib/dokumen.js';
import { postingJurnal } from '../lib/jurnal.js';
import { akunSistem } from '../lib/pengaturan.js';

export const router = Router();

const PERAN_LIHAT = ['KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR', 'STAF_KEUANGAN'];

daftarkanDokumen('RB', { tabel: 'rekonsiliasi_bank', label: 'Rekonsiliasi bank', bolehLihat: async (_db, user) => punya(user, PERAN_LIHAT) });

export const JENIS_POS = {
  SETORAN_DALAM_PERJALANAN: { sisi: 'BANK', arah: 1, label: 'Setoran dalam perjalanan' },
  KOREKSI_BANK_TAMBAH: { sisi: 'BANK', arah: 1, label: 'Koreksi bank (menambah)' },
  KOREKSI_BANK_KURANG: { sisi: 'BANK', arah: -1, label: 'Koreksi bank (mengurangi)' },
  BIAYA_BANK: { sisi: 'BUKU', arah: -1, label: 'Biaya administrasi bank', akun: 'akun_beban_adm_bank' },
  JASA_GIRO: { sisi: 'BUKU', arah: 1, label: 'Jasa giro', akun: 'akun_pendapatan_jasa_giro' },
  PAJAK_JASA_GIRO: { sisi: 'BUKU', arah: -1, label: 'Pajak atas jasa giro', akun: 'akun_beban_pajak' },
  KOREKSI_BUKU_TAMBAH: { sisi: 'BUKU', arah: 1, label: 'Koreksi buku (menambah)' },
  KOREKSI_BUKU_KURANG: { sisi: 'BUKU', arah: -1, label: 'Koreksi buku (mengurangi)' },
};

function pastikanBukanKasir(user) {
  if (punya(user, 'KASIR')) throw galatAkses('Rekonsiliasi bank tidak boleh dikerjakan oleh pengguna berperan Kasir.');
}

/** Warkat dan transfer yang sudah dicatat di buku tetapi belum kliring di bank per tanggal akhir. */
export async function warkatBeredar(db, rekeningId, akhir) {
  return semua(
    db,
    `SELECT p.id AS pembayaran_id, p.nomor AS nomor_pembayaran, p.tanggal, p.metode,
            COALESCE(p.nomor_warkat, p.nomor_referensi) AS nomor_warkat, p.penerima_nama, p.jumlah
       FROM pembayaran p LEFT JOIN jurnal jb ON jb.id = p.jurnal_batal_id
      WHERE p.rekening_kas_id = ? AND p.tanggal <= ?
        AND (p.status = 'DIBAYAR' OR (p.status = 'BATAL' AND jb.tanggal > ?))
        AND (p.tanggal_kliring IS NULL OR p.tanggal_kliring > ?)
      ORDER BY p.tanggal, p.id`,
    [rekeningId, akhir, akhir, akhir],
  );
}

/** Hitung seluruh angka rekonsiliasi dari data terkini (untuk rekonsiliasi berstatus draf). */
export async function hitungRekonsiliasi(db, rb) {
  const rek = await satu(db, 'SELECT * FROM rekening_kas WHERE id = ?', [rb.rekening_kas_id]);
  const buku = await satu(
    db,
    'SELECT COALESCE(SUM(d.debit - d.kredit), 0) AS saldo FROM jurnal_detail d JOIN jurnal j ON j.id = d.jurnal_id WHERE d.akun_id = ? AND j.tanggal <= ?',
    [rek.akun_id, rb.tanggal_akhir],
  );
  const beredar = await warkatBeredar(db, rb.rekening_kas_id, rb.tanggal_akhir);
  const item = await semua(
    db,
    'SELECT i.*, a.kode AS akun_kode, a.nama AS akun_nama FROM rekonsiliasi_bank_item i LEFT JOIN akun a ON a.id = i.akun_id WHERE i.rekonsiliasi_id = ? ORDER BY i.sisi, i.id',
    [rb.id],
  );
  const jumlahPos = (sisi, arah) => item.filter((i) => i.sisi === sisi && JENIS_POS[i.jenis].arah === arah).reduce((a, i) => a + keSen(i.jumlah), 0);
  const totalBeredar = beredar.reduce((a, b) => a + keSen(b.jumlah), 0);
  const bankDisesuaikan = keSen(rb.saldo_rekening_koran) + jumlahPos('BANK', 1) - jumlahPos('BANK', -1) - totalBeredar;
  const bukuDisesuaikan = keSen(buku.saldo) + jumlahPos('BUKU', 1) - jumlahPos('BUKU', -1);
  return {
    rekening: rek,
    saldo_buku: dariSen(keSen(buku.saldo)),
    beredar,
    item: item.map((i) => ({ ...i, jenis_label: JENIS_POS[i.jenis].label, arah: JENIS_POS[i.jenis].arah })),
    total_warkat_beredar: dariSen(totalBeredar),
    total_penambah_bank: dariSen(jumlahPos('BANK', 1)),
    total_pengurang_bank: dariSen(jumlahPos('BANK', -1)),
    total_penambah_buku: dariSen(jumlahPos('BUKU', 1)),
    total_pengurang_buku: dariSen(jumlahPos('BUKU', -1)),
    saldo_bank_disesuaikan: dariSen(bankDisesuaikan),
    saldo_buku_disesuaikan: dariSen(bukuDisesuaikan),
    selisih: dariSen(bankDisesuaikan - bukuDisesuaikan),
  };
}

const skemaRB = z.object({
  rekening_kas_id: id(),
  tahun: z.coerce.number().int().min(2000).max(2100),
  bulan: z.coerce.number().int().min(1).max(12),
  saldo_rekening_koran: z.coerce.number(),
});

export async function buatRekonsiliasi(conn, ctx, input) {
  pastikanBukanKasir(ctx.user);
  const data = validasi(skemaRB, input);
  const rek = await satu(conn, 'SELECT * FROM rekening_kas WHERE id = ?', [data.rekening_kas_id]);
  if (!rek) throw galatMasukan('Rekening tidak ditemukan.', { rekening_kas_id: 'Pilih rekening.' });
  const ada = await satu(conn, 'SELECT nomor FROM rekonsiliasi_bank WHERE rekening_kas_id = ? AND tahun = ? AND bulan = ?', [rek.id, data.tahun, data.bulan]);
  if (ada) throw galatKonflik(`Rekonsiliasi ${rek.nama} ${namaPeriode(data.tahun, data.bulan)} sudah ada (${ada.nomor}).`);
  const akhir = akhirBulan(data.tahun, data.bulan);
  const nomor = await nomorBaru(conn, 'RB', akhir);
  const r = await jalankan(
    conn,
    'INSERT INTO rekonsiliasi_bank (nomor, rekening_kas_id, tahun, bulan, tanggal_akhir, saldo_rekening_koran, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [nomor, rek.id, data.tahun, data.bulan, akhir, data.saldo_rekening_koran, ctx.user.id],
  );
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'rekonsiliasi_bank', entitasId: r.insertId, ringkasan: `Rekonsiliasi ${nomor} ${rek.nama} ${namaPeriode(data.tahun, data.bulan)}` });
  return { id: r.insertId, nomor };
}

async function kunciDraf(conn, ctx, rbId) {
  pastikanBukanKasir(ctx.user);
  const rb = await kunciBaris(conn, 'rekonsiliasi_bank', rbId, 'Rekonsiliasi');
  pastikanStatus(rb, ['DRAFT'], 'diubah');
  return rb;
}

export async function ubahSaldoKoran(conn, ctx, rbId, saldo) {
  const rb = await kunciDraf(conn, ctx, rbId);
  if (!Number.isFinite(Number(saldo))) throw galatMasukan('Saldo rekening koran harus berupa angka.', { saldo_rekening_koran: 'Harus berupa angka.' });
  await jalankan(conn, 'UPDATE rekonsiliasi_bank SET saldo_rekening_koran = ? WHERE id = ?', [Number(saldo), rbId]);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'rekonsiliasi_bank', entitasId: rbId, ringkasan: `Saldo rekening koran ${rb.nomor} diubah menjadi ${saldo}` });
}

const skemaPos = z.object({
  jenis: z.enum(Object.keys(JENIS_POS)),
  tanggal: tanggalOpsional(),
  keterangan: teks(255),
  jumlah: z.coerce.number().positive(),
  akun_id: idOpsional(),
});

export async function tambahPos(conn, ctx, rbId, input) {
  const rb = await kunciDraf(conn, ctx, rbId);
  const data = validasi(skemaPos, input);
  const jenis = JENIS_POS[data.jenis];
  let akunId = data.akun_id;
  if (jenis.sisi === 'BUKU') {
    if (jenis.akun) akunId = akunId || (await akunSistem(jenis.akun, conn)).id;
    if (!akunId) throw galatMasukan('Pilih akun lawan untuk koreksi buku.', { akun_id: 'Wajib diisi.' });
    const a = await satu(conn, "SELECT id FROM akun WHERE id = ? AND tipe = 'DETAIL' AND aktif = 1", [akunId]);
    if (!a) throw galatMasukan('Pilih akun detail yang aktif.', { akun_id: 'Pilih akun detail.' });
  } else {
    akunId = null;
  }
  const r = await jalankan(conn, 'INSERT INTO rekonsiliasi_bank_item (rekonsiliasi_id, sisi, jenis, tanggal, keterangan, jumlah, akun_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    rbId, jenis.sisi, data.jenis, data.tanggal, data.keterangan, data.jumlah, akunId,
  ]);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'rekonsiliasi_bank', entitasId: rbId, ringkasan: `Pos ${jenis.label} ${data.jumlah} ditambahkan ke ${rb.nomor}` });
  return { id: r.insertId };
}

export async function hapusPos(conn, ctx, rbId, itemId) {
  const rb = await kunciDraf(conn, ctx, rbId);
  const item = await satu(conn, 'SELECT * FROM rekonsiliasi_bank_item WHERE id = ? AND rekonsiliasi_id = ?', [itemId, rbId]);
  if (!item) throw galatTidakAda('Pos rekonsiliasi tidak ditemukan.');
  await jalankan(conn, 'DELETE FROM rekonsiliasi_bank_item WHERE id = ?', [itemId]);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'rekonsiliasi_bank', entitasId: rbId, ringkasan: `Pos ${JENIS_POS[item.jenis].label} ${item.jumlah} dihapus dari ${rb.nomor}`, sebelum: item });
}

export async function finalkanRekonsiliasi(conn, ctx, rbId) {
  const rb = await kunciDraf(conn, ctx, rbId);
  const h = await hitungRekonsiliasi(conn, rb);
  if (keSen(h.selisih) !== 0) {
    throw galatKonflik(`Rekonsiliasi belum seimbang: selisih Rp${Number(h.selisih).toLocaleString('id-ID')}. Telusuri pos yang belum dicatat sebelum difinalkan.`);
  }
  let jurnalId = null;
  const posBuku = h.item.filter((i) => i.sisi === 'BUKU');
  if (posBuku.length) {
    const baris = [];
    for (const i of posBuku) {
      if (i.arah === 1) {
        baris.push({ akun_id: h.rekening.akun_id, debit: i.jumlah, kredit: 0, keterangan: i.keterangan });
        baris.push({ akun_id: i.akun_id, debit: 0, kredit: i.jumlah, keterangan: i.keterangan });
      } else {
        baris.push({ akun_id: i.akun_id, debit: i.jumlah, kredit: 0, keterangan: i.keterangan });
        baris.push({ akun_id: h.rekening.akun_id, debit: 0, kredit: i.jumlah, keterangan: i.keterangan });
      }
    }
    const j = await postingJurnal(conn, ctx, {
      tanggal: rb.tanggal_akhir,
      jenis: 'JU',
      sumberTipe: 'RB',
      sumberId: rb.id,
      sumberNomor: rb.nomor,
      keterangan: `Penyesuaian rekonsiliasi ${h.rekening.nama} ${namaPeriode(rb.tahun, rb.bulan)}`,
      baris,
    });
    jurnalId = j.id;
  }
  if (h.beredar.length) {
    await jalankan(
      conn,
      'INSERT INTO rekonsiliasi_bank_beredar (rekonsiliasi_id, pembayaran_id, tanggal, nomor_pembayaran, metode, nomor_warkat, penerima_nama, jumlah) VALUES ?',
      [h.beredar.map((b) => [rb.id, b.pembayaran_id, b.tanggal, b.nomor_pembayaran, b.metode, b.nomor_warkat, b.penerima_nama, b.jumlah])],
    );
  }
  await jalankan(
    conn,
    `UPDATE rekonsiliasi_bank SET saldo_buku = ?, total_warkat_beredar = ?, total_penambah_bank = ?, total_pengurang_bank = ?, total_penambah_buku = ?,
       total_pengurang_buku = ?, saldo_bank_disesuaikan = ?, saldo_buku_disesuaikan = ?, selisih = 0, status = 'FINAL', jurnal_id = ?,
       difinalkan_oleh = ?, difinalkan_pada = NOW() WHERE id = ?`,
    [h.saldo_buku, h.total_warkat_beredar, h.total_penambah_bank, h.total_pengurang_bank, h.total_penambah_buku, h.total_pengurang_buku,
      h.saldo_bank_disesuaikan, h.saldo_buku_disesuaikan, jurnalId, ctx.user.id, rbId],
  );
  await catatAudit(conn, ctx, { aksi: 'FINAL', entitas: 'rekonsiliasi_bank', entitasId: rbId, ringkasan: `Rekonsiliasi ${rb.nomor} difinalkan; saldo disesuaikan ${h.saldo_bank_disesuaikan}` });
  return h;
}

const RB_SELECT = `SELECT rb.*, r.kode AS rekening_kode, r.nama AS rekening_nama, r.bank_nama, r.nomor_rekening, u.nama_lengkap AS dibuat_nama,
    uf.nama_lengkap AS difinalkan_nama, j.nomor AS jurnal_nomor
  FROM rekonsiliasi_bank rb JOIN rekening_kas r ON r.id = rb.rekening_kas_id JOIN pengguna u ON u.id = rb.dibuat_oleh
  LEFT JOIN pengguna uf ON uf.id = rb.difinalkan_oleh LEFT JOIN jurnal j ON j.id = rb.jurnal_id`;

router.get('/rekonsiliasi', perlu(...PERAN_LIHAT), async (req, res) => {
  const syarat = ['1 = 1'];
  const params = [];
  if (req.query.rekening_kas_id) { syarat.push('rb.rekening_kas_id = ?'); params.push(Number(req.query.rekening_kas_id)); }
  res.json(await semua(pool, `${RB_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY rb.tahun DESC, rb.bulan DESC, r.kode`, params));
});

export async function detailRekonsiliasi(db, rbId) {
  const rb = await satu(db, `${RB_SELECT} WHERE rb.id = ?`, [rbId]);
  if (!rb) throw galatTidakAda('Rekonsiliasi tidak ditemukan.');
  const h = await hitungRekonsiliasi(db, rb);
  if (rb.status === 'FINAL') {
    const beredar = await semua(db, 'SELECT * FROM rekonsiliasi_bank_beredar WHERE rekonsiliasi_id = ? ORDER BY tanggal, id', [rb.id]);
    return { ...rb, item: h.item, beredar, rekening: h.rekening };
  }
  const awal = awalBulan(rb.tahun, rb.bulan);
  const pembayaran = await semua(
    db,
    `SELECT p.id, p.nomor, p.tanggal, p.metode, COALESCE(p.nomor_warkat, p.nomor_referensi) AS nomor_warkat, p.penerima_nama, p.jumlah, p.tanggal_kliring
       FROM pembayaran p WHERE p.rekening_kas_id = ? AND p.status = 'DIBAYAR' AND p.tanggal <= ?
        AND (p.tanggal_kliring IS NULL OR p.tanggal_kliring >= ?) ORDER BY p.tanggal, p.id`,
    [rb.rekening_kas_id, rb.tanggal_akhir, awal],
  );
  return { ...rb, ...h, pembayaran };
}

router.get('/rekonsiliasi/:id', perlu(...PERAN_LIHAT), async (req, res) => {
  res.json(await detailRekonsiliasi(pool, Number(req.params.id)));
});
router.post('/rekonsiliasi', perlu('KASUBAG_KEUANGAN'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatRekonsiliasi(conn, req.ctx, req.body)));
});
router.put('/rekonsiliasi/:id', perlu('KASUBAG_KEUANGAN'), async (req, res) => {
  await tx((conn) => ubahSaldoKoran(conn, req.ctx, Number(req.params.id), req.body?.saldo_rekening_koran));
  res.json({ ok: true });
});
router.post('/rekonsiliasi/:id/item', perlu('KASUBAG_KEUANGAN'), async (req, res) => {
  res.status(201).json(await tx((conn) => tambahPos(conn, req.ctx, Number(req.params.id), req.body)));
});
router.delete('/rekonsiliasi/:id/item/:itemId', perlu('KASUBAG_KEUANGAN'), async (req, res) => {
  await tx((conn) => hapusPos(conn, req.ctx, Number(req.params.id), Number(req.params.itemId)));
  res.json({ ok: true });
});
router.post('/rekonsiliasi/:id/final', perlu('KASUBAG_KEUANGAN'), async (req, res) => {
  await tx((conn) => finalkanRekonsiliasi(conn, req.ctx, Number(req.params.id)));
  res.json({ ok: true });
});
