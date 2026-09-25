import { semua, satu } from '../db.js';
import { galatMasukan } from './galat.js';
import { akunSistem } from './pengaturan.js';

/**
 * Validasi akun pembebanan untuk dokumen permintaan (PP, PJUM, PKK):
 * akun detail aktif berkategori aset, beban, atau liabilitas; bukan Utang Usaha (harus lewat faktur)
 * dan bukan akun kas/bank/kas kecil (kas tidak boleh didebit dari permintaan).
 */
export async function periksaAkunPembebanan(conn, baris, kolom = 'akun_id', awalanGalat = 'baris') {
  const ids = [...new Set(baris.map((b) => b[kolom]))];
  const akun = await semua(conn, 'SELECT id, kategori, tipe, aktif FROM akun WHERE id IN (?)', [ids]);
  const peta = new Map(akun.map((a) => [a.id, a]));
  const utangUsaha = await akunSistem('akun_utang_usaha', conn);
  const akunKas = new Set(
    (await semua(conn, 'SELECT akun_id FROM rekening_kas UNION SELECT akun_id FROM dana_kas_kecil')).map((r) => r.akun_id),
  );
  const galat = {};
  baris.forEach((b, i) => {
    const a = peta.get(b[kolom]);
    const kunci = awalanGalat ? `${awalanGalat}.${i}.${kolom}` : kolom;
    if (!a || a.tipe !== 'DETAIL' || !a.aktif) galat[kunci] = 'Pilih akun detail yang aktif.';
    else if (!['ASET', 'BEBAN', 'LIABILITAS'].includes(a.kategori)) galat[kunci] = 'Akun harus berkategori beban, aset, atau liabilitas.';
    else if (a.id === utangUsaha.id) galat[kunci] = 'Utang Usaha dibayar melalui faktur pemasok, bukan permintaan.';
    else if (akunKas.has(a.id)) galat[kunci] = 'Akun kas atau bank tidak dapat dipakai di sini.';
  });
  if (Object.keys(galat).length) throw galatMasukan('Periksa kembali akun yang ditandai.', galat);
}

export async function namaAkun(db, id) {
  const a = await satu(db, 'SELECT kode, nama FROM akun WHERE id = ?', [id]);
  return a ? `${a.kode} ${a.nama}` : '';
}
