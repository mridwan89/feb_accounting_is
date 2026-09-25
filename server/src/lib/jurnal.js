import { jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatKonflik } from './galat.js';
import { nomorBaru } from './penomoran.js';
import { periodeBuka } from './periode.js';
import { akunSistem } from './pengaturan.js';
import { keSen, dariSen } from './uang.js';

/**
 * Mesin jurnal: satu-satunya jalan menulis ke tabel jurnal.
 * baris: [{ akun_id, debit, kredit, departemen_id?, pemasok_id?, keterangan? }]
 * Aturan: seimbang sampai sen, akun detail aktif, periode buka, baris Utang Usaha wajib berpemasok.
 */
export async function postingJurnal(conn, ctx, { tanggal, jenis, sumberTipe, sumberId = null, sumberNomor = null, keterangan, baris, pembalikDariId = null }) {
  const bersih = baris
    .map((b) => ({ ...b, debitSen: keSen(b.debit), kreditSen: keSen(b.kredit) }))
    .filter((b) => b.debitSen !== 0 || b.kreditSen !== 0);

  if (bersih.length < 2) throw galatMasukan('Jurnal minimal terdiri dari dua baris.');
  for (const b of bersih) {
    if (b.debitSen < 0 || b.kreditSen < 0) throw galatMasukan('Nilai jurnal tidak boleh negatif.');
    if (b.debitSen > 0 && b.kreditSen > 0) throw galatMasukan('Satu baris jurnal hanya boleh berisi debit atau kredit.');
  }
  const totalDebit = bersih.reduce((a, b) => a + b.debitSen, 0);
  const totalKredit = bersih.reduce((a, b) => a + b.kreditSen, 0);
  if (totalDebit !== totalKredit) {
    throw galatMasukan(`Jurnal tidak seimbang: debit ${dariSen(totalDebit)} dan kredit ${dariSen(totalKredit)}.`);
  }

  const idAkun = [...new Set(bersih.map((b) => b.akun_id))];
  const akun = await semua(conn, 'SELECT id, kode, nama, tipe, aktif FROM akun WHERE id IN (?)', [idAkun]);
  const petaAkun = new Map(akun.map((a) => [a.id, a]));
  const utangUsaha = await akunSistem('akun_utang_usaha', conn);
  for (const b of bersih) {
    const a = petaAkun.get(b.akun_id);
    if (!a) throw galatMasukan(`Akun dengan id ${b.akun_id} tidak ditemukan.`);
    if (a.tipe !== 'DETAIL') throw galatMasukan(`Akun ${a.kode} ${a.nama} adalah akun induk dan tidak dapat dipakai transaksi.`);
    if (!a.aktif) throw galatMasukan(`Akun ${a.kode} ${a.nama} sudah nonaktif.`);
    if (a.id === utangUsaha.id && !b.pemasok_id) throw galatMasukan('Baris akun Utang Usaha wajib mencantumkan pemasok.');
  }

  const periodeId = await periodeBuka(conn, tanggal);
  const nomor = await nomorBaru(conn, jenis, tanggal);
  const res = await jalankan(
    conn,
    `INSERT INTO jurnal (nomor, tanggal, jenis, periode_id, sumber_tipe, sumber_id, sumber_nomor, keterangan, total, pembalik_dari_id, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, tanggal, jenis, periodeId, sumberTipe, sumberId, sumberNomor, String(keterangan).slice(0, 500), dariSen(totalDebit), pembalikDariId, ctx.user.id],
  );
  const jurnalId = res.insertId;
  const nilai = bersih.map((b, i) => [
    jurnalId,
    i + 1,
    b.akun_id,
    b.departemen_id || null,
    b.pemasok_id || null,
    b.keterangan ? String(b.keterangan).slice(0, 255) : null,
    dariSen(b.debitSen),
    dariSen(b.kreditSen),
  ]);
  await jalankan(
    conn,
    'INSERT INTO jurnal_detail (jurnal_id, baris, akun_id, departemen_id, pemasok_id, keterangan, debit, kredit) VALUES ?',
    [nilai],
  );
  return { id: jurnalId, nomor, total: dariSen(totalDebit) };
}

/** Buat jurnal pembalik: debit dan kredit ditukar, jenis sama, jurnal asal ditandai dibalik. */
export async function balikJurnal(conn, ctx, jurnalId, { tanggal, keterangan }) {
  const asal = await satu(conn, 'SELECT * FROM jurnal WHERE id = ? FOR UPDATE', [jurnalId]);
  if (!asal) throw galatMasukan('Jurnal asal tidak ditemukan.');
  if (asal.dibalik_oleh_id) throw galatKonflik(`Jurnal ${asal.nomor} sudah pernah dibalik.`);
  const detail = await semua(conn, 'SELECT * FROM jurnal_detail WHERE jurnal_id = ? ORDER BY baris', [jurnalId]);
  const pembalik = await postingJurnal(conn, ctx, {
    tanggal,
    jenis: asal.jenis,
    sumberTipe: asal.sumber_tipe,
    sumberId: asal.sumber_id,
    sumberNomor: asal.sumber_nomor,
    keterangan: `${keterangan} (pembalik ${asal.nomor})`,
    pembalikDariId: asal.id,
    baris: detail.map((d) => ({
      akun_id: d.akun_id,
      departemen_id: d.departemen_id,
      pemasok_id: d.pemasok_id,
      keterangan: d.keterangan,
      debit: d.kredit,
      kredit: d.debit,
    })),
  });
  await jalankan(conn, 'UPDATE jurnal SET dibalik_oleh_id = ? WHERE id = ?', [pembalik.id, asal.id]);
  return pembalik;
}
