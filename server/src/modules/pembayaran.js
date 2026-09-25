import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatKonflik, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, idOpsional, teks, teksOpsional, tanggal, tanggalOpsional, bool } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { keSen, tambah, kurang, sama } from '../lib/uang.js';
import { hariIni, pecah, namaPeriode } from '../lib/tanggal.js';
import { kunciBaris, pastikanStatus, daftarkanDokumen } from '../lib/dokumen.js';
import { penyetujuDokumen } from '../lib/persetujuan.js';
import { postingJurnal, balikJurnal } from '../lib/jurnal.js';
import { akunSistem } from '../lib/pengaturan.js';
import { periksaRekeningPemasok, batalBKK } from './bkk.js';
import { perbaruiStatusBukuCek, posisiDana } from './master.js';

export const router = Router();

const PERAN_LIHAT = ['KASIR', 'STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR'];

daftarkanDokumen('BYR', { tabel: 'pembayaran', label: 'Pembayaran', bolehLihat: async (_db, user) => user.peran.some((p) => PERAN_LIHAT.includes(p)) });
daftarkanDokumen('BKM', { tabel: 'penerimaan_kas', label: 'Bukti kas masuk', bolehLihat: async (_db, user) => user.peran.some((p) => PERAN_LIHAT.includes(p)) });

// ---------------------------------------------------------------- efek pembayaran pada dokumen sumber

async function perbaruiFaktur(conn, fakturId, delta) {
  const f = await satu(conn, 'SELECT * FROM faktur_pemasok WHERE id = ? FOR UPDATE', [fakturId]);
  const terbayar = tambah(f.terbayar, delta);
  if (keSen(terbayar) < 0 || keSen(terbayar) > keSen(f.total_utang)) throw galatKonflik(`Pembayaran faktur ${f.nomor_faktur} melebihi sisa utangnya.`);
  const status = sama(terbayar, f.total_utang) ? 'LUNAS' : keSen(terbayar) > 0 ? 'DIBAYAR_SEBAGIAN' : 'TERVERIFIKASI';
  await jalankan(conn, 'UPDATE faktur_pemasok SET terbayar = ?, status = ? WHERE id = ?', [terbayar, status, fakturId]);
}

/** Terapkan (arah = 1) atau batalkan (arah = -1) pengaruh pembayaran BKK terhadap dokumen sumbernya. */
async function terapkanSumber(conn, bkk, arah) {
  const bayar = arah === 1;
  switch (bkk.jenis) {
    case 'PEMBAYARAN_FAKTUR': {
      const baris = await semua(conn, 'SELECT faktur_id, jumlah FROM bukti_kas_keluar_detail WHERE bkk_id = ? AND faktur_id IS NOT NULL', [bkk.id]);
      for (const b of baris) await perbaruiFaktur(conn, b.faktur_id, bayar ? b.jumlah : -b.jumlah);
      break;
    }
    case 'PERMINTAAN_PEMBAYARAN':
      await jalankan(conn, 'UPDATE permintaan_pembayaran SET status = ? WHERE id = ?', [bayar ? 'DIBAYAR' : 'DIPROSES', bkk.sumber_id]);
      break;
    case 'UANG_MUKA':
      await jalankan(conn, 'UPDATE uang_muka SET status = ? WHERE id = ?', [bayar ? 'DIBAYAR' : 'DIPROSES', bkk.sumber_id]);
      break;
    case 'KEKURANGAN_UANG_MUKA': {
      const pj = await satu(conn, 'SELECT uang_muka_id FROM pertanggungjawaban_uang_muka WHERE id = ?', [bkk.sumber_id]);
      await jalankan(conn, 'UPDATE pertanggungjawaban_uang_muka SET status = ? WHERE id = ?', [bayar ? 'SELESAI' : 'DISETUJUI', bkk.sumber_id]);
      await jalankan(conn, 'UPDATE uang_muka SET status = ? WHERE id = ?', [bayar ? 'SELESAI' : 'DIBAYAR', pj.uang_muka_id]);
      break;
    }
    case 'PEMBENTUKAN_KAS_KECIL': {
      const dana = await satu(conn, 'SELECT * FROM dana_kas_kecil WHERE id = ? FOR UPDATE', [bkk.sumber_id]);
      if (!bayar) {
        const pos = await posisiDana(conn, dana.id);
        if (keSen(pos.saldo_tunai) < keSen(bkk.jumlah_bruto)) {
          throw galatKonflik(`Uang tunai ${dana.nama} tinggal Rp${Number(pos.saldo_tunai).toLocaleString('id-ID')}; pembentukan dana tidak dapat dibatalkan sebelum bukti yang sudah dibayar diganti.`);
        }
      }
      await jalankan(conn, 'UPDATE dana_kas_kecil SET jumlah_dana = ? WHERE id = ?', [bayar ? tambah(dana.jumlah_dana, bkk.jumlah_bruto) : kurang(dana.jumlah_dana, bkk.jumlah_bruto), dana.id]);
      break;
    }
    case 'PENGISIAN_KAS_KECIL':
      await jalankan(conn, 'UPDATE pengisian_kas_kecil SET status = ? WHERE id = ?', [bayar ? 'DIBAYAR' : 'DIPROSES', bkk.sumber_id]);
      await jalankan(conn, 'UPDATE pengeluaran_kas_kecil SET status = ? WHERE pengisian_id = ? AND status = ?', [
        bayar ? 'DIGANTI' : 'DIBAYAR', bkk.sumber_id, bayar ? 'DIBAYAR' : 'DIGANTI',
      ]);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- pembayaran BKK

const skemaBayar = z.object({
  bkk_id: id(),
  tanggal: tanggal(),
  warkat_id: idOpsional(),
  tanggal_jatuh_tempo_bg: tanggalOpsional(),
  nomor_referensi: teksOpsional(60),
});

export async function bayarBKK(conn, ctx, input) {
  const data = validasi(skemaBayar, { tanggal: hariIni(), ...input });
  const bkk = await kunciBaris(conn, 'bukti_kas_keluar', data.bkk_id, 'BKK');
  pastikanStatus(bkk, ['DISETUJUI'], 'dibayar');
  if (bkk.dibuat_oleh === ctx.user.id) throw galatAkses('Anda pembuat BKK ini sehingga tidak dapat mencatat pembayarannya.');
  if ((await penyetujuDokumen(conn, 'BKK', bkk.id)).includes(ctx.user.id)) throw galatAkses('Anda ikut menyetujui BKK ini sehingga tidak dapat mencatat pembayarannya.');
  if (data.tanggal < bkk.tanggal) throw galatMasukan('Tanggal bayar tidak boleh sebelum tanggal BKK.', { tanggal: 'Tidak boleh sebelum tanggal BKK.' });

  let warkat = null;
  if (bkk.metode_bayar === 'CEK' || bkk.metode_bayar === 'BG') {
    if (!data.warkat_id) throw galatMasukan(`Pilih nomor ${bkk.metode_bayar === 'CEK' ? 'cek' : 'bilyet giro'}.`, { warkat_id: 'Wajib diisi.' });
    warkat = await satu(
      conn,
      'SELECT w.*, b.rekening_kas_id, b.jenis, b.status AS buku_status FROM warkat w JOIN buku_cek b ON b.id = w.buku_cek_id WHERE w.id = ? FOR UPDATE',
      [data.warkat_id],
    );
    if (!warkat) throw galatMasukan('Lembar warkat tidak ditemukan.', { warkat_id: 'Tidak ditemukan.' });
    if (warkat.rekening_kas_id !== bkk.rekening_kas_id || warkat.jenis !== bkk.metode_bayar) {
      throw galatMasukan('Lembar warkat bukan dari buku rekening dan jenis yang sesuai BKK.', { warkat_id: 'Tidak sesuai.' });
    }
    if (warkat.status !== 'TERSEDIA') throw galatKonflik(`Lembar ${warkat.nomor} sudah ${warkat.status === 'TERPAKAI' ? 'terpakai' : 'dibatalkan'} dan tidak dapat dipakai.`);
    if (bkk.metode_bayar === 'BG') {
      if (!data.tanggal_jatuh_tempo_bg) throw galatMasukan('Tanggal efektif bilyet giro wajib diisi.', { tanggal_jatuh_tempo_bg: 'Wajib diisi.' });
      if (data.tanggal_jatuh_tempo_bg < data.tanggal) throw galatMasukan('Tanggal efektif bilyet giro tidak boleh sebelum tanggal bayar.', { tanggal_jatuh_tempo_bg: 'Tidak boleh sebelum tanggal bayar.' });
    }
  } else {
    if (!data.nomor_referensi) throw galatMasukan('Nomor referensi transfer dari internet banking wajib diisi.', { nomor_referensi: 'Wajib diisi.' });
    await periksaRekeningPemasok(conn, bkk);
  }

  const nomor = await nomorBaru(conn, 'BYR', data.tanggal);
  const r = await jalankan(
    conn,
    `INSERT INTO pembayaran (nomor, bkk_id, tanggal, rekening_kas_id, metode, warkat_id, nomor_warkat, tanggal_jatuh_tempo_bg, nomor_referensi,
       penerima_nama, penerima_bank_nama, penerima_bank_rekening, penerima_bank_atas_nama, jumlah, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, bkk.id, data.tanggal, bkk.rekening_kas_id, bkk.metode_bayar, warkat?.id || null, warkat?.nomor || null,
      bkk.metode_bayar === 'BG' ? data.tanggal_jatuh_tempo_bg : null, bkk.metode_bayar === 'TRANSFER' ? data.nomor_referensi : null,
      bkk.penerima_nama, bkk.penerima_bank_nama, bkk.penerima_bank_rekening, bkk.penerima_bank_atas_nama, bkk.jumlah_bayar, ctx.user.id],
  );
  const pembayaranId = r.insertId;
  if (warkat) {
    await jalankan(conn, "UPDATE warkat SET status = 'TERPAKAI', pembayaran_id = ? WHERE id = ?", [pembayaranId, warkat.id]);
    await perbaruiStatusBukuCek(conn, warkat.buku_cek_id);
  }

  // Jurnal pengeluaran kas: debit distribusi BKK, kredit potongan pajak dan bank.
  const detail = await semua(conn, 'SELECT * FROM bukti_kas_keluar_detail WHERE bkk_id = ? ORDER BY baris', [bkk.id]);
  const potongan = await semua(conn, 'SELECT * FROM bukti_kas_keluar_potongan WHERE bkk_id = ? ORDER BY id', [bkk.id]);
  const rek = await satu(conn, 'SELECT akun_id, nama FROM rekening_kas WHERE id = ?', [bkk.rekening_kas_id]);
  const bukti = warkat ? `${bkk.metode_bayar === 'CEK' ? 'cek' : 'BG'} ${warkat.nomor}` : `transfer ${data.nomor_referensi}`;
  const baris = [
    ...detail.map((d) => ({ akun_id: d.akun_id, departemen_id: d.departemen_id, pemasok_id: d.pemasok_id, debit: d.jumlah, kredit: 0, keterangan: d.uraian })),
    ...potongan.map((p) => ({ akun_id: p.akun_id, debit: 0, kredit: p.jumlah, keterangan: p.uraian })),
    { akun_id: rek.akun_id, debit: 0, kredit: bkk.jumlah_bayar, keterangan: `${bkk.nomor} (${bukti})` },
  ];
  const j = await postingJurnal(conn, ctx, {
    tanggal: data.tanggal,
    jenis: 'JKK',
    sumberTipe: 'BYR',
    sumberId: pembayaranId,
    sumberNomor: nomor,
    keterangan: `Pembayaran ${bkk.nomor} kepada ${bkk.penerima_nama} (${bukti})`,
    baris,
  });
  await jalankan(conn, 'UPDATE pembayaran SET jurnal_id = ? WHERE id = ?', [j.id, pembayaranId]);
  await jalankan(conn, "UPDATE bukti_kas_keluar SET status = 'DIBAYAR', pembayaran_id = ? WHERE id = ?", [pembayaranId, bkk.id]);
  await terapkanSumber(conn, bkk, 1);
  await catatAudit(conn, ctx, {
    aksi: 'BAYAR',
    entitas: 'pembayaran',
    entitasId: pembayaranId,
    ringkasan: `Pembayaran ${nomor} atas ${bkk.nomor} kepada ${bkk.penerima_nama} sebesar ${bkk.jumlah_bayar} (${bukti}), jurnal ${j.nomor}`,
  });
  return { id: pembayaranId, nomor, jurnal: j.nomor };
}

const skemaBatalBayar = z.object({ alasan: teks(255), batalkan_bkk: bool().optional() });

export async function batalPembayaran(conn, ctx, pembayaranId, input) {
  const data = validasi(skemaBatalBayar, input);
  const p = await kunciBaris(conn, 'pembayaran', pembayaranId, 'Pembayaran');
  pastikanStatus(p, ['DIBAYAR'], 'dibatalkan');
  if (p.tanggal_kliring) throw galatKonflik(`Pembayaran ${p.nomor} sudah kliring di bank pada ${p.tanggal_kliring} sehingga tidak dapat dibatalkan.`);
  const bkk = await kunciBaris(conn, 'bukti_kas_keluar', p.bkk_id, 'BKK');
  await terapkanSumber(conn, bkk, -1);
  const pembalik = await balikJurnal(conn, ctx, p.jurnal_id, { tanggal: hariIni(), keterangan: `Pembatalan pembayaran ${p.nomor}: ${data.alasan}` });
  if (p.warkat_id) {
    const w = await satu(conn, 'SELECT buku_cek_id FROM warkat WHERE id = ? FOR UPDATE', [p.warkat_id]);
    await jalankan(conn, "UPDATE warkat SET status = 'BATAL', keterangan = ?, dibatalkan_oleh = ?, dibatalkan_pada = NOW() WHERE id = ?", [
      `Pembayaran ${p.nomor} dibatalkan: ${data.alasan}`.slice(0, 255), ctx.user.id, p.warkat_id,
    ]);
    await perbaruiStatusBukuCek(conn, w.buku_cek_id);
  }
  await jalankan(conn, "UPDATE pembayaran SET status = 'BATAL', jurnal_batal_id = ?, dibatalkan_oleh = ?, dibatalkan_pada = NOW(), alasan_batal = ? WHERE id = ?", [
    pembalik.id, ctx.user.id, data.alasan, p.id,
  ]);
  await jalankan(conn, "UPDATE bukti_kas_keluar SET status = 'DISETUJUI', pembayaran_id = NULL WHERE id = ?", [bkk.id]);
  await catatAudit(conn, ctx, {
    aksi: 'BATAL',
    entitas: 'pembayaran',
    entitasId: p.id,
    ringkasan: `Pembayaran ${p.nomor} (${p.nomor_warkat || p.nomor_referensi}) dibatalkan: ${data.alasan}. Jurnal pembalik ${pembalik.nomor}`,
  });
  if (data.batalkan_bkk) await batalBKK(conn, ctx, bkk.id, `Pembayaran ${p.nomor} dibatalkan: ${data.alasan}`);
  return { jurnal_pembalik: pembalik.nomor };
}

export async function tandaiKliring(conn, ctx, pembayaranId, tanggalKliring) {
  const p = await kunciBaris(conn, 'pembayaran', pembayaranId, 'Pembayaran');
  if (p.status !== 'DIBAYAR') throw galatKonflik('Hanya pembayaran yang berlaku yang dapat ditandai kliring.');
  if (tanggalKliring && tanggalKliring < p.tanggal) throw galatMasukan('Tanggal kliring tidak boleh sebelum tanggal pembayaran.');
  for (const tgl of [p.tanggal_kliring, tanggalKliring].filter(Boolean)) {
    const { tahun, bulan } = pecah(tgl);
    const final = await satu(conn, "SELECT nomor FROM rekonsiliasi_bank WHERE rekening_kas_id = ? AND tahun = ? AND bulan = ? AND status = 'FINAL'", [p.rekening_kas_id, tahun, bulan]);
    if (final) throw galatKonflik(`Rekonsiliasi ${namaPeriode(tahun, bulan)} (${final.nomor}) sudah final; tanggal kliring pada periode itu tidak dapat diubah.`);
  }
  await jalankan(conn, 'UPDATE pembayaran SET tanggal_kliring = ? WHERE id = ?', [tanggalKliring || null, p.id]);
  await catatAudit(conn, ctx, { aksi: 'KLIRING', entitas: 'pembayaran', entitasId: p.id, ringkasan: `Pembayaran ${p.nomor} ${tanggalKliring ? `kliring ${tanggalKliring}` : 'tanda kliring dihapus'}` });
}

const BYR_SELECT = `SELECT p.*, b.nomor AS bkk_nomor, b.jenis AS bkk_jenis, b.keterangan AS bkk_keterangan, r.nama AS rekening_nama, r.kode AS rekening_kode,
    r.bank_nama AS rekening_bank, r.nomor_rekening AS rekening_nomor, u.nama_lengkap AS dibayar_nama, ub.nama_lengkap AS dibatalkan_nama,
    j.nomor AS jurnal_nomor, jb.nomor AS jurnal_batal_nomor
  FROM pembayaran p JOIN bukti_kas_keluar b ON b.id = p.bkk_id JOIN rekening_kas r ON r.id = p.rekening_kas_id
  JOIN pengguna u ON u.id = p.dibuat_oleh LEFT JOIN pengguna ub ON ub.id = p.dibatalkan_oleh
  LEFT JOIN jurnal j ON j.id = p.jurnal_id LEFT JOIN jurnal jb ON jb.id = p.jurnal_batal_id`;

router.get('/pembayaran/antrean', perlu(...PERAN_LIHAT), async (_req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT b.*, r.nama AS rekening_nama, r.kode AS rekening_kode, pm.rekening_terverifikasi
         FROM bukti_kas_keluar b JOIN rekening_kas r ON r.id = b.rekening_kas_id LEFT JOIN pemasok pm ON pm.id = b.pemasok_id
        WHERE b.status = 'DISETUJUI' ORDER BY b.tanggal_rencana_bayar, b.id`,
    ),
  );
});

router.get('/pembayaran', perlu(...PERAN_LIHAT), async (req, res) => {
  const q = req.query;
  const syarat = ['1 = 1'];
  const params = [];
  if (q.status) { syarat.push('p.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.rekening_kas_id) { syarat.push('p.rekening_kas_id = ?'); params.push(Number(q.rekening_kas_id)); }
  if (q.metode) { syarat.push('p.metode = ?'); params.push(String(q.metode)); }
  if (q.dari) { syarat.push('p.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('p.tanggal <= ?'); params.push(q.sampai); }
  if (q.belum_kliring === '1') syarat.push("p.status = 'DIBAYAR' AND p.tanggal_kliring IS NULL");
  if (q.cari) { syarat.push('(p.nomor LIKE ? OR p.nomor_warkat LIKE ? OR p.penerima_nama LIKE ? OR b.nomor LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  res.json(await semua(pool, `${BYR_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY p.tanggal DESC, p.id DESC LIMIT 500`, params));
});

router.get('/pembayaran/:id', perlu(...PERAN_LIHAT), async (req, res) => {
  const p = await satu(pool, `${BYR_SELECT} WHERE p.id = ?`, [req.params.id]);
  if (!p) throw galatTidakAda('Pembayaran tidak ditemukan.');
  res.json(p);
});

router.post('/pembayaran', perlu('KASIR'), async (req, res) => {
  res.status(201).json(await tx((conn) => bayarBKK(conn, req.ctx, req.body)));
});
router.post('/pembayaran/:id/batal', perlu('WAKIL_DEKAN_2'), async (req, res) => {
  res.json(await tx((conn) => batalPembayaran(conn, req.ctx, Number(req.params.id), req.body)));
});
router.post('/pembayaran/:id/kliring', perlu('KASUBAG_KEUANGAN'), async (req, res) => {
  const tgl = req.body?.tanggal_kliring || null;
  if (tgl && !/^\d{4}-\d{2}-\d{2}$/.test(tgl)) throw galatMasukan('Format tanggal harus TTTT-BB-HH.');
  await tx((conn) => tandaiKliring(conn, req.ctx, Number(req.params.id), tgl));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- bukti kas masuk (BKM)

const skemaBKM = z.object({
  tanggal: tanggal(),
  rekening_kas_id: id(),
  sumber: z.enum(['PENGEMBALIAN_UANG_MUKA', 'PENGEMBALIAN_KAS_KECIL', 'LAINNYA']),
  sumber_id: idOpsional(),
  diterima_dari: teksOpsional(150),
  keterangan: teksOpsional(500),
  jumlah: z.coerce.number().positive(),
  akun_lawan_id: idOpsional(),
  pemasok_id: idOpsional(),
});

export async function buatBKM(conn, ctx, input) {
  const data = validasi(skemaBKM, { tanggal: hariIni(), ...input });
  const rek = await satu(conn, 'SELECT * FROM rekening_kas WHERE id = ? AND aktif = 1', [data.rekening_kas_id]);
  if (!rek) throw galatMasukan('Rekening penerima tidak aktif.', { rekening_kas_id: 'Pilih rekening aktif.' });
  let akunLawan;
  let diterimaDari = data.diterima_dari;
  let keterangan = data.keterangan;
  let pemasokId = null;
  let pjum = null;
  let dana = null;

  if (data.sumber === 'PENGEMBALIAN_UANG_MUKA') {
    pjum = await satu(conn, 'SELECT * FROM pertanggungjawaban_uang_muka WHERE id = ? FOR UPDATE', [data.sumber_id || 0]);
    if (!pjum || pjum.status !== 'DISETUJUI' || pjum.hasil !== 'SISA' || pjum.bkm_id) {
      throw galatKonflik('Pilih pertanggungjawaban uang muka yang disetujui dan masih menunggu pengembalian sisa.');
    }
    if (!sama(data.jumlah, pjum.selisih)) {
      throw galatMasukan(`Jumlah harus sama dengan sisa uang muka Rp${Number(pjum.selisih).toLocaleString('id-ID')}.`, { jumlah: 'Harus sama dengan sisa uang muka.' });
    }
    akunLawan = (await akunSistem('akun_piutang_karyawan', conn)).id;
    const u = await satu(conn, 'SELECT nama_lengkap FROM pengguna WHERE id = ?', [pjum.dibuat_oleh]);
    diterimaDari = diterimaDari || u.nama_lengkap;
    keterangan = keterangan || `Pengembalian sisa uang muka menurut ${pjum.nomor}`;
  } else if (data.sumber === 'PENGEMBALIAN_KAS_KECIL') {
    dana = await satu(conn, 'SELECT * FROM dana_kas_kecil WHERE id = ? FOR UPDATE', [data.sumber_id || 0]);
    if (!dana) throw galatMasukan('Pilih dana kas kecil.', { sumber_id: 'Wajib diisi.' });
    const pos = await posisiDana(conn, dana.id);
    if (keSen(data.jumlah) > keSen(pos.saldo_tunai)) {
      throw galatMasukan(`Pengembalian melebihi uang tunai dana (Rp${Number(pos.saldo_tunai).toLocaleString('id-ID')}).`, { jumlah: 'Melebihi uang tunai dana.' });
    }
    akunLawan = dana.akun_id;
    const u = await satu(conn, 'SELECT nama_lengkap FROM pengguna WHERE id = ?', [dana.pemegang_id]);
    diterimaDari = diterimaDari || u.nama_lengkap;
    keterangan = keterangan || `Pengembalian sebagian dana ${dana.nama}`;
  } else {
    if (!data.akun_lawan_id) throw galatMasukan('Pilih akun lawan.', { akun_lawan_id: 'Wajib diisi.' });
    if (!diterimaDari) throw galatMasukan('Isi nama penyetor.', { diterima_dari: 'Wajib diisi.' });
    if (!keterangan) throw galatMasukan('Isi keterangan penerimaan.', { keterangan: 'Wajib diisi.' });
    const akunKas = (await semua(conn, 'SELECT akun_id FROM rekening_kas UNION SELECT akun_id FROM dana_kas_kecil')).map((r) => r.akun_id);
    if (akunKas.includes(data.akun_lawan_id)) throw galatMasukan('Akun lawan tidak boleh akun kas atau bank.', { akun_lawan_id: 'Pilih akun lain.' });
    const utangUsaha = await akunSistem('akun_utang_usaha', conn);
    if (data.akun_lawan_id === utangUsaha.id) {
      if (!data.pemasok_id) throw galatMasukan('Pilih pemasok untuk akun Utang Usaha.', { pemasok_id: 'Wajib diisi.' });
      pemasokId = data.pemasok_id;
    }
    akunLawan = data.akun_lawan_id;
  }

  const nomor = await nomorBaru(conn, 'BKM', data.tanggal);
  const r = await jalankan(
    conn,
    `INSERT INTO penerimaan_kas (nomor, tanggal, rekening_kas_id, sumber, sumber_id, diterima_dari, keterangan, jumlah, akun_lawan_id, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, data.tanggal, rek.id, data.sumber, data.sumber === 'LAINNYA' ? null : data.sumber_id, diterimaDari, keterangan, data.jumlah, akunLawan, ctx.user.id],
  );
  const j = await postingJurnal(conn, ctx, {
    tanggal: data.tanggal,
    jenis: 'JKM',
    sumberTipe: 'BKM',
    sumberId: r.insertId,
    sumberNomor: nomor,
    keterangan: `${keterangan} (diterima dari ${diterimaDari})`,
    baris: [
      { akun_id: rek.akun_id, debit: data.jumlah, kredit: 0, keterangan: nomor },
      { akun_id: akunLawan, pemasok_id: pemasokId, debit: 0, kredit: data.jumlah, keterangan },
    ],
  });
  await jalankan(conn, 'UPDATE penerimaan_kas SET jurnal_id = ? WHERE id = ?', [j.id, r.insertId]);
  if (pjum) {
    await jalankan(conn, "UPDATE pertanggungjawaban_uang_muka SET status = 'SELESAI', bkm_id = ? WHERE id = ?", [r.insertId, pjum.id]);
    await jalankan(conn, "UPDATE uang_muka SET status = 'SELESAI' WHERE id = ?", [pjum.uang_muka_id]);
  }
  if (dana) await jalankan(conn, 'UPDATE dana_kas_kecil SET jumlah_dana = ? WHERE id = ?', [kurang(dana.jumlah_dana, data.jumlah), dana.id]);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'penerimaan_kas', entitasId: r.insertId, ringkasan: `BKM ${nomor} ${data.jumlah} dari ${diterimaDari}, jurnal ${j.nomor}`, sesudah: data });
  return { id: r.insertId, nomor, jurnal: j.nomor };
}

export async function batalBKM(conn, ctx, bkmId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const k = await kunciBaris(conn, 'penerimaan_kas', bkmId, 'Bukti kas masuk');
  pastikanStatus(k, ['DICATAT'], 'dibatalkan');
  const pembalik = await balikJurnal(conn, ctx, k.jurnal_id, { tanggal: hariIni(), keterangan: `Pembatalan ${k.nomor}: ${alasan}` });
  if (k.sumber === 'PENGEMBALIAN_UANG_MUKA') {
    const pj = await satu(conn, 'SELECT uang_muka_id FROM pertanggungjawaban_uang_muka WHERE id = ? FOR UPDATE', [k.sumber_id]);
    await jalankan(conn, "UPDATE pertanggungjawaban_uang_muka SET status = 'DISETUJUI', bkm_id = NULL WHERE id = ?", [k.sumber_id]);
    await jalankan(conn, "UPDATE uang_muka SET status = 'DIBAYAR' WHERE id = ?", [pj.uang_muka_id]);
  }
  if (k.sumber === 'PENGEMBALIAN_KAS_KECIL') {
    await jalankan(conn, 'UPDATE dana_kas_kecil SET jumlah_dana = jumlah_dana + ? WHERE id = ?', [k.jumlah, k.sumber_id]);
  }
  await jalankan(conn, "UPDATE penerimaan_kas SET status = 'BATAL', jurnal_batal_id = ?, dibatalkan_oleh = ?, dibatalkan_pada = NOW(), alasan_batal = ? WHERE id = ?", [
    pembalik.id, ctx.user.id, alasan.trim().slice(0, 255), k.id,
  ]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'penerimaan_kas', entitasId: k.id, ringkasan: `BKM ${k.nomor} dibatalkan: ${alasan}. Jurnal pembalik ${pembalik.nomor}` });
}

const BKM_SELECT = `SELECT k.*, r.nama AS rekening_nama, r.kode AS rekening_kode, a.kode AS akun_lawan_kode, a.nama AS akun_lawan_nama,
    u.nama_lengkap AS dibuat_nama, j.nomor AS jurnal_nomor
  FROM penerimaan_kas k JOIN rekening_kas r ON r.id = k.rekening_kas_id JOIN akun a ON a.id = k.akun_lawan_id
  JOIN pengguna u ON u.id = k.dibuat_oleh LEFT JOIN jurnal j ON j.id = k.jurnal_id`;

router.get('/bkm', perlu(...PERAN_LIHAT), async (req, res) => {
  const q = req.query;
  const syarat = ['1 = 1'];
  const params = [];
  if (q.dari) { syarat.push('k.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('k.tanggal <= ?'); params.push(q.sampai); }
  if (q.sumber) { syarat.push('k.sumber = ?'); params.push(String(q.sumber)); }
  res.json(await semua(pool, `${BKM_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY k.tanggal DESC, k.id DESC LIMIT 500`, params));
});

router.get('/bkm/sumber', perlu('KASIR'), async (req, res) => {
  if (req.query.sumber === 'PENGEMBALIAN_UANG_MUKA') {
    return res.json(
      await semua(
        pool,
        `SELECT p.id, p.nomor, p.tanggal, p.selisih AS jumlah, u.nama_lengkap AS penerima, um.nomor AS uang_muka_nomor
           FROM pertanggungjawaban_uang_muka p JOIN pengguna u ON u.id = p.dibuat_oleh JOIN uang_muka um ON um.id = p.uang_muka_id
          WHERE p.status = 'DISETUJUI' AND p.hasil = 'SISA' AND p.bkm_id IS NULL ORDER BY p.tanggal`,
      ),
    );
  }
  res.json([]);
});

router.get('/bkm/:id', perlu(...PERAN_LIHAT), async (req, res) => {
  const k = await satu(pool, `${BKM_SELECT} WHERE k.id = ?`, [req.params.id]);
  if (!k) throw galatTidakAda('Bukti kas masuk tidak ditemukan.');
  res.json(k);
});
router.post('/bkm', perlu('KASIR'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatBKM(conn, req.ctx, req.body)));
});
router.post('/bkm/:id/batal', perlu('WAKIL_DEKAN_2'), async (req, res) => {
  await tx((conn) => batalBKM(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});

