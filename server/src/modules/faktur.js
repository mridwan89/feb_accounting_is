import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatKonflik, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, idOpsional, teks, teksOpsional, tanggal, tanggalOpsional } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu, punya } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { kali, jumlahkan, hitungPajak, keSen, tambah, kurang } from '../lib/uang.js';
import { hariIni, tambahHari, selisihHari } from '../lib/tanggal.js';
import { daftarkanDokumen, kunciBaris, pastikanStatus } from '../lib/dokumen.js';
import { batalkanPersetujuan, riwayatPersetujuan, bolehMemutuskan } from '../lib/persetujuan.js';
import { ajukanDokumen } from '../lib/alur.js';
import { postingJurnal, balikJurnal } from '../lib/jurnal.js';
import { akunSistem, angkaPengaturan } from '../lib/pengaturan.js';

export const router = Router();

const PERAN_LIHAT = ['AKUNTANSI', 'SPV_AKUNTANSI', 'MANAJER_KEUANGAN', 'DIREKTUR', 'AUDITOR', 'KASIR'];

/** Normalisasi nomor faktur untuk deteksi duplikat: huruf kapital, tanpa spasi dan tanda baca. */
export const normalNomorFaktur = (nomor) => String(nomor).toUpperCase().replace(/[^A-Z0-9]/g, '');

daftarkanDokumen('FB', {
  tabel: 'faktur_pemasok',
  label: 'Faktur pemasok',
  statusMenunggu: 'MENUNGGU_PERSETUJUAN',
  bolehLihat: async (_db, user) => punya(user, PERAN_LIHAT),
  onDisetujui: async (conn, ctx, faktur) => {
    await postingFaktur(conn, ctx, faktur.id);
  },
  onDitolak: async (conn, _ctx, faktur) => {
    await lepasTagihanPO(conn, faktur.id);
    await jalankan(conn, "UPDATE faktur_pemasok SET status = 'DITOLAK' WHERE id = ?", [faktur.id]);
  },
});

const skemaBaris = z.object({ po_detail_id: id(), qty: z.coerce.number().positive(), harga: z.coerce.number().positive() });
const skemaFaktur = z.object({
  po_id: id(),
  nomor_faktur: teks(50),
  nomor_faktur_pajak: teksOpsional(50),
  tanggal_faktur: tanggal(),
  tanggal_terima: tanggal(),
  tanggal_jatuh_tempo: tanggalOpsional(),
  ppn: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.coerce.number().min(0).nullable()),
  pajak_pph_id: idOpsional(),
  keterangan: teksOpsional(500),
  baris: z.array(skemaBaris).min(1).max(100),
});

async function periksaDuplikat(conn, pemasokId, nomorFaktur, kecualiId = 0) {
  const norm = normalNomorFaktur(nomorFaktur);
  if (!norm) throw galatMasukan('Nomor faktur harus memuat huruf atau angka.', { nomor_faktur: 'Nomor faktur tidak valid.' });
  const ada = await satu(
    conn,
    "SELECT nomor, nomor_faktur, status FROM faktur_pemasok WHERE pemasok_id = ? AND nomor_faktur_norm = ? AND status <> 'BATAL' AND id <> ?",
    [pemasokId, norm, kecualiId],
  );
  if (ada) {
    const pesan = `Faktur ${ada.nomor_faktur} dari pemasok ini sudah tercatat dengan nomor register ${ada.nomor}. Faktur yang sama tidak boleh dicatat dua kali.`;
    throw galatMasukan(pesan, { nomor_faktur: pesan });
  }
  return norm;
}

/** Hitung pajak PPh atas baris jasa; tarif dinaikkan 100% untuk pemasok tanpa NPWP bila kode pajak menentukan. */
export async function hitungPph(conn, pajakPphId, dasar, tanpaNpwp) {
  if (!pajakPphId) return { pajak: null, tarif: 0, pph: 0 };
  const pajak = await satu(conn, "SELECT * FROM pajak WHERE id = ? AND jenis = 'PPH' AND aktif = 1", [pajakPphId]);
  if (!pajak) throw galatMasukan('Kode PPh tidak aktif.', { pajak_pph_id: 'Pilih kode PPh aktif.' });
  const tarif = Number(pajak.tarif) * (pajak.naik_tanpa_npwp && tanpaNpwp ? 2 : 1);
  return { pajak, tarif, pph: hitungPajak(dasar, tarif) };
}

async function susunFaktur(conn, data, kecualiId = 0) {
  const po = await satu(conn, 'SELECT * FROM pesanan_pembelian WHERE id = ?', [data.po_id]);
  if (!po) throw galatMasukan('PO tidak ditemukan.', { po_id: 'PO tidak ditemukan.' });
  if (!['DISETUJUI', 'DITERIMA_SEBAGIAN', 'DITERIMA_PENUH', 'DITUTUP'].includes(po.status)) {
    throw galatMasukan(`PO ${po.nomor} belum disetujui sehingga fakturnya belum dapat dicatat.`, { po_id: 'PO belum disetujui.' });
  }
  if (data.tanggal_terima < data.tanggal_faktur) throw galatMasukan('Tanggal diterima tidak boleh sebelum tanggal faktur.', { tanggal_terima: 'Tidak boleh sebelum tanggal faktur.' });
  const pemasok = await satu(conn, 'SELECT * FROM pemasok WHERE id = ?', [po.pemasok_id]);
  const norm = await periksaDuplikat(conn, pemasok.id, data.nomor_faktur, kecualiId);

  const detailPO = await semua(conn, 'SELECT * FROM pesanan_pembelian_detail WHERE po_id = ?', [po.id]);
  const peta = new Map(detailPO.map((d) => [d.id, d]));
  const galat = {};
  const dipakai = new Set();
  const baris = data.baris.map((b, i) => {
    const d = peta.get(b.po_detail_id);
    if (!d) galat[`baris.${i}.po_detail_id`] = 'Baris bukan bagian dari PO ini.';
    else if (dipakai.has(d.id)) galat[`baris.${i}.po_detail_id`] = 'Baris PO dipilih lebih dari sekali.';
    if (d) dipakai.add(d.id);
    return d ? { baris: i + 1, po_detail_id: d.id, uraian: d.uraian, jenis: d.jenis, akun_id: d.akun_id, qty: b.qty, harga: b.harga, jumlah: kali(b.qty, b.harga) } : null;
  });
  if (Object.keys(galat).length) throw galatMasukan('Periksa kembali isian yang ditandai.', galat);

  const dpp = jumlahkan(baris, (b) => b.jumlah);
  let ppn = 0;
  if (po.pajak_ppn_id && pemasok.pkp) {
    const pajakPpn = await satu(conn, 'SELECT tarif FROM pajak WHERE id = ?', [po.pajak_ppn_id]);
    ppn = data.ppn === null ? hitungPajak(dpp, pajakPpn.tarif) : data.ppn;
  } else if (data.ppn) {
    throw galatMasukan('PO ini tidak dikenai PPN atau pemasok bukan PKP, sehingga PPN harus nol.', { ppn: 'Harus nol.' });
  }
  const dasarPph = jumlahkan(baris.filter((b) => b.jenis === 'JASA'), (b) => b.jumlah);
  if (data.pajak_pph_id && keSen(dasarPph) === 0) {
    throw galatMasukan('PPh hanya dapat dipotong atas baris jasa.', { pajak_pph_id: 'Tidak ada baris jasa.' });
  }
  const { tarif, pph } = await hitungPph(conn, data.pajak_pph_id, dasarPph, !pemasok.npwp);
  const totalTagihan = tambah(dpp, ppn);
  return {
    po,
    pemasok,
    norm,
    baris,
    dpp,
    ppn,
    tarifPph: tarif,
    pph,
    totalTagihan,
    totalUtang: kurang(totalTagihan, pph),
    jatuhTempo: data.tanggal_jatuh_tempo || tambahHari(data.tanggal_faktur, po.termin_hari),
  };
}

async function simpanBarisFaktur(conn, fakturId, baris) {
  await jalankan(conn, 'DELETE FROM faktur_pemasok_detail WHERE faktur_id = ?', [fakturId]);
  await jalankan(
    conn,
    'INSERT INTO faktur_pemasok_detail (faktur_id, baris, po_detail_id, uraian, jenis, qty, harga, jumlah, akun_id) VALUES ?',
    [baris.map((b) => [fakturId, b.baris, b.po_detail_id, b.uraian, b.jenis, b.qty, b.harga, b.jumlah, b.akun_id])],
  );
}

export async function buatFaktur(conn, ctx, input) {
  const data = validasi(skemaFaktur, { tanggal_terima: hariIni(), ...input });
  const s = await susunFaktur(conn, data);
  const nomor = await nomorBaru(conn, 'FB', data.tanggal_terima);
  const r = await jalankan(
    conn,
    `INSERT INTO faktur_pemasok (nomor, jenis, pemasok_id, po_id, nomor_faktur, nomor_faktur_norm, nomor_faktur_pajak, tanggal_faktur,
       tanggal_terima, tanggal_jatuh_tempo, keterangan, dpp, ppn, pajak_pph_id, tarif_pph, pph, total_tagihan, total_utang, dibuat_oleh)
     VALUES (?, 'PO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, s.pemasok.id, s.po.id, data.nomor_faktur, s.norm, data.nomor_faktur_pajak, data.tanggal_faktur, data.tanggal_terima, s.jatuhTempo,
      data.keterangan, s.dpp, s.ppn, data.pajak_pph_id, s.tarifPph, s.pph, s.totalTagihan, s.totalUtang, ctx.user.id],
  );
  await simpanBarisFaktur(conn, r.insertId, s.baris);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'faktur_pemasok', entitasId: r.insertId, ringkasan: `Faktur ${data.nomor_faktur} dari ${s.pemasok.nama} dicatat sebagai ${nomor}`, sesudah: data });
  return { id: r.insertId, nomor };
}

export async function ubahFaktur(conn, ctx, fakturId, input) {
  const f = await kunciBaris(conn, 'faktur_pemasok', fakturId, 'Faktur');
  pastikanStatus(f, ['DRAFT', 'DITOLAK'], 'diubah');
  if (f.jenis !== 'PO') throw galatKonflik('Faktur saldo awal tidak dapat diubah.');
  const data = validasi(skemaFaktur, input);
  const s = await susunFaktur(conn, data, fakturId);
  await jalankan(
    conn,
    `UPDATE faktur_pemasok SET pemasok_id = ?, po_id = ?, nomor_faktur = ?, nomor_faktur_norm = ?, nomor_faktur_pajak = ?, tanggal_faktur = ?,
       tanggal_terima = ?, tanggal_jatuh_tempo = ?, keterangan = ?, dpp = ?, ppn = ?, pajak_pph_id = ?, tarif_pph = ?, pph = ?,
       total_tagihan = ?, total_utang = ?, hasil_cocok = NULL, catatan_selisih = NULL, status = 'DRAFT' WHERE id = ?`,
    [s.pemasok.id, s.po.id, data.nomor_faktur, s.norm, data.nomor_faktur_pajak, data.tanggal_faktur, data.tanggal_terima, s.jatuhTempo,
      data.keterangan, s.dpp, s.ppn, data.pajak_pph_id, s.tarifPph, s.pph, s.totalTagihan, s.totalUtang, fakturId],
  );
  await simpanBarisFaktur(conn, fakturId, s.baris);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'faktur_pemasok', entitasId: fakturId, ringkasan: `Faktur ${f.nomor} diubah`, sebelum: f, sesudah: data });
}

/** Kurangi kuantitas yang sudah dicadangkan faktur ini di baris PO (faktur ditolak atau dibatalkan). */
async function lepasTagihanPO(conn, fakturId) {
  const baris = await semua(conn, 'SELECT po_detail_id, qty FROM faktur_pemasok_detail WHERE faktur_id = ? AND po_detail_id IS NOT NULL', [fakturId]);
  for (const b of baris) {
    await jalankan(conn, 'UPDATE pesanan_pembelian_detail SET qty_ditagih = GREATEST(qty_ditagih - ?, 0) WHERE id = ?', [b.qty, b.po_detail_id]);
  }
}

/** Posting jurnal pembelian (JP) dan tandai faktur terverifikasi. */
export async function postingFaktur(conn, ctx, fakturId) {
  const f = await satu(conn, 'SELECT * FROM faktur_pemasok WHERE id = ? FOR UPDATE', [fakturId]);
  const po = await satu(conn, 'SELECT departemen_id, pajak_ppn_id FROM pesanan_pembelian WHERE id = ?', [f.po_id]);
  const pemasok = await satu(conn, 'SELECT nama FROM pemasok WHERE id = ?', [f.pemasok_id]);
  const detail = await semua(conn, 'SELECT * FROM faktur_pemasok_detail WHERE faktur_id = ? ORDER BY baris', [fakturId]);
  const utangUsaha = await akunSistem('akun_utang_usaha', conn);
  const baris = detail.map((d) => ({ akun_id: d.akun_id, departemen_id: po.departemen_id, debit: d.jumlah, kredit: 0, keterangan: d.uraian }));
  if (keSen(f.ppn) > 0) {
    const pajakPpn = await satu(conn, 'SELECT akun_id FROM pajak WHERE id = ?', [po.pajak_ppn_id]);
    baris.push({ akun_id: pajakPpn.akun_id, debit: f.ppn, kredit: 0, keterangan: `PPN faktur ${f.nomor_faktur}` });
  }
  baris.push({ akun_id: utangUsaha.id, pemasok_id: f.pemasok_id, debit: 0, kredit: f.total_utang, keterangan: `Faktur ${f.nomor_faktur}` });
  if (keSen(f.pph) > 0) {
    const pajakPph = await satu(conn, 'SELECT akun_id, nama FROM pajak WHERE id = ?', [f.pajak_pph_id]);
    baris.push({ akun_id: pajakPph.akun_id, debit: 0, kredit: f.pph, keterangan: `${pajakPph.nama} faktur ${f.nomor_faktur}` });
  }
  const j = await postingJurnal(conn, ctx, {
    tanggal: f.tanggal_terima,
    jenis: 'JP',
    sumberTipe: 'FB',
    sumberId: f.id,
    sumberNomor: f.nomor,
    keterangan: `Faktur ${f.nomor_faktur} dari ${pemasok.nama}`,
    baris,
  });
  await jalankan(conn, "UPDATE faktur_pemasok SET status = 'TERVERIFIKASI', jurnal_id = ?, diverifikasi_pada = NOW() WHERE id = ?", [j.id, fakturId]);
  return j;
}

/** Pencocokan tiga arah: PO (harga), LPB/BAST (kuantitas diterima), faktur (kuantitas dan harga ditagih). */
export async function verifikasiFaktur(conn, ctx, fakturId) {
  const f = await kunciBaris(conn, 'faktur_pemasok', fakturId, 'Faktur');
  pastikanStatus(f, ['DRAFT', 'DITOLAK'], 'diverifikasi');
  const detail = await semua(conn, 'SELECT * FROM faktur_pemasok_detail WHERE faktur_id = ? ORDER BY baris', [fakturId]);
  const barisPO = await semua(conn, 'SELECT * FROM pesanan_pembelian_detail WHERE po_id = ? FOR UPDATE', [f.po_id]);
  const peta = new Map(barisPO.map((d) => [d.id, d]));
  const tolHarga = await angkaPengaturan('toleransi_harga_persen', 0, conn);
  const tolQty = await angkaPengaturan('toleransi_qty_persen', 0, conn);

  const selisih = [];
  for (const b of detail) {
    const d = peta.get(b.po_detail_id);
    const tersedia = Number(d.qty_diterima) - Number(d.qty_ditagih);
    const batasQty = tersedia + (Number(d.qty) * tolQty) / 100;
    const batasHarga = Number(d.harga) * (1 + tolHarga / 100);
    const qtyOk = keSen(b.qty) <= keSen(batasQty);
    const hargaOk = keSen(b.harga) <= keSen(batasHarga);
    const status = qtyOk && hargaOk ? 'COCOK' : !qtyOk && !hargaOk ? 'SELISIH_QTY_HARGA' : !qtyOk ? 'SELISIH_QTY' : 'SELISIH_HARGA';
    const catatan = [];
    if (!qtyOk) catatan.push(`ditagih ${Number(b.qty)} ${d.satuan}, yang diterima dan belum ditagih ${tersedia} ${d.satuan}`);
    if (!hargaOk) catatan.push(`harga faktur ${Number(b.harga)} di atas harga PO ${Number(d.harga)}`);
    if (catatan.length) selisih.push(`Baris ${b.baris} (${b.uraian}): ${catatan.join('; ')}`);
    await jalankan(
      conn,
      'UPDATE faktur_pemasok_detail SET qty_po = ?, harga_po = ?, qty_tersedia = ?, status_cocok = ?, catatan_cocok = ? WHERE id = ?',
      [d.qty, d.harga, tersedia, status, catatan.join('; ') || null, b.id],
    );
    // Cadangkan kuantitas sejak verifikasi agar faktur lain tidak menagih kuantitas yang sama.
    await jalankan(conn, 'UPDATE pesanan_pembelian_detail SET qty_ditagih = qty_ditagih + ? WHERE id = ?', [b.qty, d.id]);
  }

  if (!selisih.length) {
    await jalankan(conn, "UPDATE faktur_pemasok SET hasil_cocok = 'COCOK', catatan_selisih = NULL WHERE id = ?", [fakturId]);
    const j = await postingFaktur(conn, ctx, fakturId);
    await catatAudit(conn, ctx, { aksi: 'VERIFIKASI', entitas: 'faktur_pemasok', entitasId: fakturId, ringkasan: `Faktur ${f.nomor} cocok tiga arah dan diposting (${j.nomor})` });
    return { status: 'TERVERIFIKASI', hasil_cocok: 'COCOK', jurnal: j.nomor };
  }
  const ringkasan = selisih.join('. ').slice(0, 500);
  await jalankan(conn, "UPDATE faktur_pemasok SET hasil_cocok = 'SELISIH', catatan_selisih = ? WHERE id = ?", [ringkasan, fakturId]);
  const pemasok = await satu(conn, 'SELECT nama FROM pemasok WHERE id = ?', [f.pemasok_id]);
  const h = await ajukanDokumen(conn, ctx, {
    jenis: 'FB',
    doc: f,
    nilai: f.total_tagihan,
    ringkasan: `Selisih pencocokan faktur ${f.nomor_faktur} dari ${pemasok.nama}`,
    departemenId: null,
  });
  await catatAudit(conn, ctx, { aksi: 'VERIFIKASI', entitas: 'faktur_pemasok', entitasId: fakturId, ringkasan: `Faktur ${f.nomor} berselisih: ${ringkasan}` });
  return { status: h.status, hasil_cocok: 'SELISIH', catatan_selisih: ringkasan };
}

/** Jumlah yang masih dapat dimasukkan ke BKK baru untuk faktur ini. */
export async function sisaTersediaFaktur(db, fakturId, kecualiBkkId = 0) {
  const r = await satu(
    db,
    `SELECT f.total_utang - f.terbayar - COALESCE((
        SELECT SUM(d.jumlah) FROM bukti_kas_keluar_detail d JOIN bukti_kas_keluar b ON b.id = d.bkk_id
         WHERE d.faktur_id = f.id AND b.status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK') AND b.id <> ?), 0) AS sisa
       FROM faktur_pemasok f WHERE f.id = ?`,
    [kecualiBkkId, fakturId],
  );
  return r ? r.sisa : 0;
}

export async function batalFaktur(conn, ctx, fakturId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const f = await kunciBaris(conn, 'faktur_pemasok', fakturId, 'Faktur');
  if (['DRAFT', 'DITOLAK', 'MENUNGGU_PERSETUJUAN'].includes(f.status)) {
    if (!punya(ctx.user, 'AKUNTANSI', 'SPV_AKUNTANSI')) throw galatAkses();
    if (f.status === 'MENUNGGU_PERSETUJUAN') {
      await batalkanPersetujuan(conn, 'FB', fakturId);
      await lepasTagihanPO(conn, fakturId);
    }
  } else if (f.status === 'TERVERIFIKASI') {
    if (!punya(ctx.user, 'SPV_AKUNTANSI')) throw galatAkses('Faktur terverifikasi hanya dapat dibatalkan Kepala Bagian Akuntansi.');
    if (keSen(f.terbayar) > 0) throw galatKonflik('Faktur sudah ada pembayaran sehingga tidak dapat dibatalkan.');
    const aktif = await satu(
      conn,
      `SELECT b.nomor FROM bukti_kas_keluar_detail d JOIN bukti_kas_keluar b ON b.id = d.bkk_id
        WHERE d.faktur_id = ? AND b.status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK') LIMIT 1`,
      [fakturId],
    );
    if (aktif) throw galatKonflik(`Faktur sedang diproses di ${aktif.nomor}; batalkan BKK itu terlebih dahulu.`);
    if (f.jurnal_id) await balikJurnal(conn, ctx, f.jurnal_id, { tanggal: hariIni(), keterangan: `Pembatalan faktur ${f.nomor_faktur}` });
    if (f.jenis === 'PO') await lepasTagihanPO(conn, fakturId);
  } else {
    pastikanStatus(f, ['DRAFT', 'DITOLAK', 'MENUNGGU_PERSETUJUAN', 'TERVERIFIKASI'], 'dibatalkan');
  }
  await jalankan(conn, "UPDATE faktur_pemasok SET status = 'BATAL', dibatalkan_oleh = ?, dibatalkan_pada = NOW(), alasan_batal = ? WHERE id = ?", [ctx.user.id, alasan.trim().slice(0, 255), fakturId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'faktur_pemasok', entitasId: fakturId, ringkasan: `Faktur ${f.nomor} dibatalkan: ${alasan}` });
}

const skemaSaldoAwal = z.object({
  pemasok_id: id(),
  nomor_faktur: teks(50),
  tanggal_faktur: tanggal(),
  tanggal_jatuh_tempo: tanggal(),
  total_utang: z.coerce.number().positive(),
  keterangan: teksOpsional(500),
});

/** Faktur saldo awal: utang yang belum lunas saat go-live; tanpa PO dan tanpa jurnal. */
export async function buatFakturSaldoAwal(conn, ctx, input) {
  const data = validasi(skemaSaldoAwal, input);
  const pemasok = await satu(conn, 'SELECT id, nama FROM pemasok WHERE id = ?', [data.pemasok_id]);
  if (!pemasok) throw galatMasukan('Pemasok tidak ditemukan.', { pemasok_id: 'Pilih pemasok.' });
  const norm = await periksaDuplikat(conn, pemasok.id, data.nomor_faktur);
  const nomor = await nomorBaru(conn, 'FB', data.tanggal_faktur);
  const r = await jalankan(
    conn,
    `INSERT INTO faktur_pemasok (nomor, jenis, pemasok_id, nomor_faktur, nomor_faktur_norm, tanggal_faktur, tanggal_terima, tanggal_jatuh_tempo,
       keterangan, dpp, total_tagihan, total_utang, status, diverifikasi_pada, dibuat_oleh)
     VALUES (?, 'SALDO_AWAL', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TERVERIFIKASI', NOW(), ?)`,
    [nomor, pemasok.id, data.nomor_faktur, norm, data.tanggal_faktur, data.tanggal_faktur, data.tanggal_jatuh_tempo,
      data.keterangan || 'Saldo awal utang', data.total_utang, data.total_utang, data.total_utang, ctx.user.id],
  );
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'faktur_pemasok', entitasId: r.insertId, ringkasan: `Faktur saldo awal ${data.nomor_faktur} ${pemasok.nama} ${data.total_utang}`, sesudah: data });
  return { id: r.insertId, nomor };
}

const FAKTUR_SELECT = `SELECT f.*, p.nama AS pemasok_nama, p.kode AS pemasok_kode, po.nomor AS po_nomor, u.nama_lengkap AS dibuat_nama,
    (f.total_utang - f.terbayar) AS sisa,
    COALESCE((SELECT SUM(d.jumlah) FROM bukti_kas_keluar_detail d JOIN bukti_kas_keluar b ON b.id = d.bkk_id
               WHERE d.faktur_id = f.id AND b.status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK')), 0) AS dalam_proses
  FROM faktur_pemasok f JOIN pemasok p ON p.id = f.pemasok_id LEFT JOIN pesanan_pembelian po ON po.id = f.po_id
  JOIN pengguna u ON u.id = f.dibuat_oleh`;

router.get('/faktur', perlu(...PERAN_LIHAT), async (req, res) => {
  const q = req.query;
  const syarat = ['1 = 1'];
  const params = [];
  if (q.status) { syarat.push('f.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.pemasok_id) { syarat.push('f.pemasok_id = ?'); params.push(Number(q.pemasok_id)); }
  if (q.dari) { syarat.push('f.tanggal_terima >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('f.tanggal_terima <= ?'); params.push(q.sampai); }
  if (q.belum_lunas === '1') syarat.push("f.status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN')");
  if (q.jatuh_tempo_sampai) { syarat.push('f.tanggal_jatuh_tempo <= ?'); params.push(q.jatuh_tempo_sampai); }
  if (q.cari) { syarat.push('(f.nomor LIKE ? OR f.nomor_faktur LIKE ? OR p.nama LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  const rows = await semua(pool, `${FAKTUR_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY f.tanggal_terima DESC, f.id DESC LIMIT 500`, params);
  const kini = hariIni();
  res.json(rows.map((r) => ({ ...r, hari_lewat_jatuh_tempo: selisihHari(r.tanggal_jatuh_tempo, kini) })));
});

export async function detailFaktur(db, user, fakturId) {
  const f = await satu(db, `${FAKTUR_SELECT} WHERE f.id = ?`, [fakturId]);
  if (!f) throw galatTidakAda('Faktur tidak ditemukan.');
  if (!punya(user, PERAN_LIHAT)) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  const baris = await semua(
    db,
    `SELECT d.*, a.kode AS akun_kode, a.nama AS akun_nama, pd.satuan FROM faktur_pemasok_detail d
       JOIN akun a ON a.id = d.akun_id LEFT JOIN pesanan_pembelian_detail pd ON pd.id = d.po_detail_id
      WHERE d.faktur_id = ? ORDER BY d.baris`,
    [fakturId],
  );
  const pembayaran = await semua(
    db,
    `SELECT b.id AS bkk_id, b.nomor AS bkk_nomor, b.status AS bkk_status, d.jumlah, p.nomor AS pembayaran_nomor, p.tanggal AS tanggal_bayar, p.nomor_warkat, p.nomor_referensi
       FROM bukti_kas_keluar_detail d JOIN bukti_kas_keluar b ON b.id = d.bkk_id
       LEFT JOIN pembayaran p ON p.id = b.pembayaran_id
      WHERE d.faktur_id = ? ORDER BY b.id`,
    [fakturId],
  );
  const pph = f.pajak_pph_id ? await satu(db, 'SELECT kode, nama FROM pajak WHERE id = ?', [f.pajak_pph_id]) : null;
  const jurnal = f.jurnal_id ? await satu(db, 'SELECT id, nomor, dibalik_oleh_id FROM jurnal WHERE id = ?', [f.jurnal_id]) : null;
  return {
    ...f,
    pajak_pph: pph,
    jurnal,
    baris,
    pembayaran,
    persetujuan: await riwayatPersetujuan(db, 'FB', fakturId),
    boleh_memutuskan: await bolehMemutuskan(db, user, 'FB', fakturId),
    hari_lewat_jatuh_tempo: selisihHari(f.tanggal_jatuh_tempo, hariIni()),
  };
}

router.get('/faktur/:id', perlu(...PERAN_LIHAT), async (req, res) => {
  res.json(await detailFaktur(pool, req.user, Number(req.params.id)));
});
router.post('/faktur', perlu('AKUNTANSI'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatFaktur(conn, req.ctx, req.body)));
});
router.post('/faktur/saldo-awal', perlu('SPV_AKUNTANSI'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatFakturSaldoAwal(conn, req.ctx, req.body)));
});
router.put('/faktur/:id', perlu('AKUNTANSI'), async (req, res) => {
  await tx((conn) => ubahFaktur(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/faktur/:id/verifikasi', perlu('AKUNTANSI'), async (req, res) => {
  res.json(await tx((conn) => verifikasiFaktur(conn, req.ctx, Number(req.params.id))));
});
router.post('/faktur/:id/batal', perlu('AKUNTANSI', 'SPV_AKUNTANSI'), async (req, res) => {
  await tx((conn) => batalFaktur(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});

