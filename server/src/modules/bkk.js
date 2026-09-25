import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatAkses, galatKonflik, galatTidakAda } from '../lib/galat.js';
import { z, validasi, id, idOpsional, teksOpsional, tanggal, bool } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu, punya } from '../lib/akses.js';
import { nomorBaru } from '../lib/penomoran.js';
import { jumlahkan, keSen, dariSen, kurang } from '../lib/uang.js';
import { hariIni } from '../lib/tanggal.js';
import { daftarkanDokumen, kunciBaris, pastikanStatus, jumlahLampiran } from '../lib/dokumen.js';
import { batalkanPersetujuan, riwayatPersetujuan, bolehMemutuskan } from '../lib/persetujuan.js';
import { ajukanDokumen } from '../lib/alur.js';
import { akunSistem } from '../lib/pengaturan.js';
import { periksaAkunPembebanan } from '../lib/akun.js';
import { sisaTersediaFaktur, hitungPph } from './faktur.js';

export const router = Router();

export const JENIS_BKK = {
  PEMBAYARAN_FAKTUR: 'Pembayaran faktur pemasok',
  PERMINTAAN_PEMBAYARAN: 'Permintaan pembayaran',
  UANG_MUKA: 'Uang muka kerja',
  KEKURANGAN_UANG_MUKA: 'Kekurangan uang muka',
  PEMBENTUKAN_KAS_KECIL: 'Pembentukan dana kas kecil',
  PENGISIAN_KAS_KECIL: 'Pengisian kembali kas kecil',
};

const PERAN_LIHAT = ['AKUNTANSI', 'SPV_AKUNTANSI', 'MANAJER_KEUANGAN', 'DIREKTUR', 'KASIR', 'AUDITOR'];

daftarkanDokumen('BKK', {
  tabel: 'bukti_kas_keluar',
  label: 'Bukti kas keluar',
  statusMenunggu: 'DIAJUKAN',
  bolehLihat: async (_db, user) => punya(user, PERAN_LIHAT),
  onDisetujui: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE bukti_kas_keluar SET status = 'DISETUJUI' WHERE id = ?", [doc.id]);
  },
  onDitolak: async (conn, _ctx, doc) => {
    await jalankan(conn, "UPDATE bukti_kas_keluar SET status = 'DITOLAK' WHERE id = ?", [doc.id]);
  },
});

const kosong = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

const skemaBKK = z.object({
  jenis: z.enum(Object.keys(JENIS_BKK)),
  sumber_id: idOpsional(),
  pemasok_id: idOpsional(),
  tanggal: tanggal(),
  rekening_kas_id: id(),
  metode_bayar: z.enum(['CEK', 'BG', 'TRANSFER']),
  tanggal_rencana_bayar: tanggal(),
  keterangan: teksOpsional(500),
  penerima_bank_nama: z.preprocess(kosong, z.string().max(60).nullable()),
  penerima_bank_rekening: z.preprocess(kosong, z.string().regex(/^[0-9-. ]{5,40}$/, 'Nomor rekening hanya angka.').nullable()),
  penerima_bank_atas_nama: z.preprocess(kosong, z.string().max(150).nullable()),
  penerima_tanpa_npwp: bool().optional(),
  faktur: z.array(z.object({ faktur_id: id(), jumlah: z.coerce.number().positive() })).optional(),
  baris: z.array(z.object({ baris: z.coerce.number().int().positive(), akun_id: id(), departemen_id: idOpsional() })).optional(),
  potongan: z.array(z.object({ pajak_id: id(), dasar: z.coerce.number().positive() })).optional(),
  jumlah: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().positive().optional()),
});

const STATUS_BKK_AKTIF = ['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK'];

/** Pastikan dokumen sumber masih dapat diproses: status bebas, atau sudah terkait BKK yang sedang diubah. */
function periksaSumber(doc, statusBebas, statusTerkait, bkkIdLama, label) {
  const bebas = statusBebas.includes(doc.status) && !doc.bkk_id;
  const terkait = bkkIdLama && statusTerkait.includes(doc.status) && doc.bkk_id === bkkIdLama;
  if (!bebas && !terkait) throw galatKonflik(`${label} ${doc.nomor} tidak siap diproses menjadi BKK (status ${doc.status.toLowerCase()}).`);
}

async function penerimaKaryawan(conn, penggunaId, data) {
  const u = await satu(conn, 'SELECT nama_lengkap FROM pengguna WHERE id = ?', [penggunaId]);
  return { nama: u.nama_lengkap, bank_nama: data.penerima_bank_nama, bank_rekening: data.penerima_bank_rekening, bank_atas_nama: data.penerima_bank_atas_nama };
}

/** Susun isi BKK sesuai jenis sumbernya. Mengunci dokumen sumber. */
async function susunBKK(conn, data, bkkIdLama = 0) {
  const rek = await satu(conn, 'SELECT * FROM rekening_kas WHERE id = ? AND aktif = 1', [data.rekening_kas_id]);
  if (!rek) throw galatMasukan('Rekening sumber tidak aktif.', { rekening_kas_id: 'Pilih rekening aktif.' });
  if (data.tanggal_rencana_bayar < data.tanggal) throw galatMasukan('Tanggal rencana bayar tidak boleh sebelum tanggal BKK.', { tanggal_rencana_bayar: 'Tidak boleh sebelum tanggal BKK.' });

  let baris = [];
  let potongan = [];
  let penerima;
  let pemasokId = null;
  let sumberNomor = null;
  let keterangan = data.keterangan;

  switch (data.jenis) {
    case 'PEMBAYARAN_FAKTUR': {
      if (!data.pemasok_id) throw galatMasukan('Pilih pemasok.', { pemasok_id: 'Wajib diisi.' });
      if (!data.faktur?.length) throw galatMasukan('Pilih minimal satu faktur untuk dibayar.', { faktur: 'Pilih faktur.' });
      const p = await satu(conn, 'SELECT * FROM pemasok WHERE id = ?', [data.pemasok_id]);
      if (!p) throw galatMasukan('Pemasok tidak ditemukan.', { pemasok_id: 'Pemasok tidak ditemukan.' });
      const utangUsaha = await akunSistem('akun_utang_usaha', conn);
      const dipakai = new Set();
      const galat = {};
      for (const [i, item] of data.faktur.entries()) {
        if (dipakai.has(item.faktur_id)) { galat[`faktur.${i}.faktur_id`] = 'Faktur dipilih lebih dari sekali.'; continue; }
        dipakai.add(item.faktur_id);
        const f = await satu(conn, 'SELECT * FROM faktur_pemasok WHERE id = ? FOR UPDATE', [item.faktur_id]);
        if (!f || f.pemasok_id !== p.id) { galat[`faktur.${i}.faktur_id`] = 'Faktur bukan milik pemasok ini.'; continue; }
        if (!['TERVERIFIKASI', 'DIBAYAR_SEBAGIAN'].includes(f.status)) { galat[`faktur.${i}.faktur_id`] = `Faktur ${f.nomor_faktur} tidak dalam status siap bayar.`; continue; }
        const sisa = await sisaTersediaFaktur(conn, f.id, bkkIdLama);
        if (keSen(item.jumlah) > keSen(sisa)) { galat[`faktur.${i}.jumlah`] = `Melebihi sisa utang yang belum diproses (${Number(sisa).toLocaleString('id-ID')}).`; continue; }
        baris.push({ uraian: `Faktur ${f.nomor_faktur} (${f.nomor})`, akun_id: utangUsaha.id, departemen_id: null, pemasok_id: p.id, faktur_id: f.id, ref_nomor: f.nomor, jumlah: item.jumlah });
      }
      if (Object.keys(galat).length) throw galatMasukan('Periksa kembali faktur yang ditandai.', galat);
      pemasokId = p.id;
      penerima = { nama: p.nama, bank_nama: p.bank_nama, bank_rekening: p.bank_nomor_rekening, bank_atas_nama: p.bank_atas_nama };
      keterangan = keterangan || `Pembayaran ${baris.length} faktur ${p.nama}`;
      break;
    }
    case 'PERMINTAAN_PEMBAYARAN': {
      const pp = await satu(conn, 'SELECT * FROM permintaan_pembayaran WHERE id = ? FOR UPDATE', [data.sumber_id || 0]);
      if (!pp) throw galatMasukan('Pilih permintaan pembayaran.', { sumber_id: 'Wajib diisi.' });
      periksaSumber(pp, ['DISETUJUI'], ['DIPROSES'], bkkIdLama, 'Permintaan pembayaran');
      const detail = await semua(conn, 'SELECT * FROM permintaan_pembayaran_detail WHERE pp_id = ? ORDER BY baris', [pp.id]);
      const ubah = new Map((data.baris || []).map((b) => [b.baris, b]));
      baris = detail.map((d) => {
        const u = ubah.get(d.baris);
        return { uraian: d.uraian, akun_id: u?.akun_id || d.akun_id, departemen_id: u?.departemen_id || pp.departemen_id, pemasok_id: null, faktur_id: null, ref_nomor: pp.nomor, jumlah: d.jumlah };
      });
      await periksaAkunPembebanan(conn, baris);
      let tanpaNpwp = !!data.penerima_tanpa_npwp;
      if (pp.pemasok_id) {
        const p = await satu(conn, 'SELECT * FROM pemasok WHERE id = ?', [pp.pemasok_id]);
        pemasokId = p.id;
        tanpaNpwp = !p.npwp;
        penerima = { nama: p.nama, bank_nama: p.bank_nama, bank_rekening: p.bank_nomor_rekening, bank_atas_nama: p.bank_atas_nama };
      } else {
        penerima = { nama: pp.penerima_nama, bank_nama: pp.penerima_bank_nama, bank_rekening: pp.penerima_bank_rekening, bank_atas_nama: pp.penerima_bank_atas_nama };
      }
      const bruto = jumlahkan(baris, (b) => b.jumlah);
      for (const [i, pt] of (data.potongan || []).entries()) {
        if (keSen(pt.dasar) > keSen(bruto)) throw galatMasukan('Dasar potongan tidak boleh melebihi jumlah bruto.', { [`potongan.${i}.dasar`]: 'Melebihi jumlah bruto.' });
        const h = await hitungPph(conn, pt.pajak_id, pt.dasar, tanpaNpwp);
        if (h.pph > 0) potongan.push({ pajak_id: h.pajak.id, akun_id: h.pajak.akun_id, dasar: pt.dasar, tarif: h.tarif, jumlah: h.pph, uraian: `${h.pajak.nama}${h.tarif !== Number(h.pajak.tarif) ? ' (tanpa NPWP)' : ''}` });
      }
      sumberNomor = pp.nomor;
      keterangan = keterangan || pp.keterangan;
      break;
    }
    case 'UANG_MUKA': {
      const um = await satu(conn, 'SELECT * FROM uang_muka WHERE id = ? FOR UPDATE', [data.sumber_id || 0]);
      if (!um) throw galatMasukan('Pilih permintaan uang muka.', { sumber_id: 'Wajib diisi.' });
      periksaSumber(um, ['DISETUJUI'], ['DIPROSES'], bkkIdLama, 'Permintaan uang muka');
      const akunUM = await akunSistem('akun_uang_muka_karyawan', conn);
      baris = [{ uraian: `Uang muka ${um.nomor}: ${um.keperluan}`.slice(0, 255), akun_id: akunUM.id, departemen_id: um.departemen_id, pemasok_id: null, faktur_id: null, ref_nomor: um.nomor, jumlah: um.jumlah }];
      penerima = await penerimaKaryawan(conn, um.dibuat_oleh, data);
      sumberNomor = um.nomor;
      keterangan = keterangan || `Uang muka ${um.nomor}: ${um.keperluan}`.slice(0, 500);
      break;
    }
    case 'KEKURANGAN_UANG_MUKA': {
      const pj = await satu(conn, 'SELECT * FROM pertanggungjawaban_uang_muka WHERE id = ? FOR UPDATE', [data.sumber_id || 0]);
      if (!pj) throw galatMasukan('Pilih pertanggungjawaban uang muka.', { sumber_id: 'Wajib diisi.' });
      const siap = pj.status === 'DISETUJUI' && pj.hasil === 'KURANG' && (!pj.bkk_id || pj.bkk_id === bkkIdLama);
      if (!siap) throw galatKonflik(`Pertanggungjawaban ${pj.nomor} tidak memiliki kekurangan yang menunggu dibayar.`);
      const utangKry = await akunSistem('akun_utang_karyawan', conn);
      baris = [{ uraian: `Kekurangan uang muka menurut ${pj.nomor}`, akun_id: utangKry.id, departemen_id: pj.departemen_id, pemasok_id: null, faktur_id: null, ref_nomor: pj.nomor, jumlah: dariSen(-keSen(pj.selisih)) }];
      penerima = await penerimaKaryawan(conn, pj.dibuat_oleh, data);
      sumberNomor = pj.nomor;
      keterangan = keterangan || `Pembayaran kekurangan uang muka ${pj.nomor}`;
      break;
    }
    case 'PEMBENTUKAN_KAS_KECIL': {
      const dana = await satu(conn, 'SELECT * FROM dana_kas_kecil WHERE id = ? FOR UPDATE', [data.sumber_id || 0]);
      if (!dana || !dana.aktif) throw galatMasukan('Pilih dana kas kecil yang aktif.', { sumber_id: 'Wajib diisi.' });
      const aktif = await satu(
        conn,
        "SELECT nomor FROM bukti_kas_keluar WHERE jenis = 'PEMBENTUKAN_KAS_KECIL' AND sumber_id = ? AND status IN (?) AND id <> ?",
        [dana.id, STATUS_BKK_AKTIF, bkkIdLama],
      );
      if (aktif) throw galatKonflik(`Dana ${dana.nama} sudah punya BKK pembentukan ${aktif.nomor} yang belum selesai.`);
      const jumlah = data.jumlah ?? kurang(dana.dana_diusulkan, dana.jumlah_dana);
      if (keSen(jumlah) <= 0) throw galatMasukan(`Dana ${dana.nama} sudah terbentuk penuh. Isi jumlah bila ingin menambah dana.`, { jumlah: 'Isi jumlah penambahan.' });
      baris = [{ uraian: `${keSen(dana.jumlah_dana) > 0 ? 'Penambahan' : 'Pembentukan'} ${dana.nama}`, akun_id: dana.akun_id, departemen_id: dana.departemen_id, pemasok_id: null, faktur_id: null, ref_nomor: dana.kode, jumlah }];
      penerima = await penerimaKaryawan(conn, dana.pemegang_id, data);
      sumberNomor = dana.kode;
      keterangan = keterangan || baris[0].uraian;
      break;
    }
    case 'PENGISIAN_KAS_KECIL': {
      const pdk = await satu(conn, 'SELECT * FROM pengisian_kas_kecil WHERE id = ? FOR UPDATE', [data.sumber_id || 0]);
      if (!pdk) throw galatMasukan('Pilih permintaan pengisian kas kecil.', { sumber_id: 'Wajib diisi.' });
      periksaSumber(pdk, ['DIAJUKAN'], ['DIPROSES'], bkkIdLama, 'Pengisian kas kecil');
      const dana = await satu(conn, 'SELECT * FROM dana_kas_kecil WHERE id = ?', [pdk.dana_id]);
      const rekap = await semua(
        conn,
        `SELECT k.akun_id, k.departemen_id, a.nama AS akun_nama, SUM(k.jumlah) AS jumlah, COUNT(*) AS n
           FROM pengeluaran_kas_kecil k JOIN akun a ON a.id = k.akun_id
          WHERE k.pengisian_id = ? AND k.status = 'DIBAYAR' GROUP BY k.akun_id, k.departemen_id ORDER BY a.kode`,
        [pdk.id],
      );
      if (!rekap.length) throw galatKonflik('Pengisian ini tidak memuat bukti pengeluaran yang sudah dibayar.');
      baris = rekap.map((r) => ({ uraian: `${r.akun_nama} (${r.n} bukti)`, akun_id: r.akun_id, departemen_id: r.departemen_id, pemasok_id: null, faktur_id: null, ref_nomor: pdk.nomor, jumlah: r.jumlah }));
      penerima = await penerimaKaryawan(conn, dana.pemegang_id, data);
      sumberNomor = pdk.nomor;
      keterangan = keterangan || `Pengisian kembali ${dana.nama} menurut ${pdk.nomor}`;
      break;
    }
    default:
      throw galatMasukan('Jenis BKK tidak dikenal.');
  }

  if (data.metode_bayar === 'TRANSFER' && !(penerima.bank_nama && penerima.bank_rekening && penerima.bank_atas_nama)) {
    throw galatMasukan(
      pemasokId ? 'Data rekening bank pemasok belum lengkap. Minta Staf Pembelian melengkapinya.' : 'Transfer membutuhkan nama bank, nomor rekening, dan atas nama penerima.',
      { penerima_bank_rekening: 'Lengkapi rekening penerima.' },
    );
  }
  const bruto = jumlahkan(baris, (b) => b.jumlah);
  const totalPotongan = jumlahkan(potongan, (p) => p.jumlah);
  const bayar = kurang(bruto, totalPotongan);
  if (keSen(bayar) <= 0) throw galatMasukan('Jumlah dibayar harus lebih dari nol.');
  return { baris, potongan, penerima, pemasokId, sumberNomor, keterangan: String(keterangan).slice(0, 500), bruto, totalPotongan, bayar };
}

async function simpanIsiBKK(conn, bkkId, s) {
  await jalankan(conn, 'DELETE FROM bukti_kas_keluar_detail WHERE bkk_id = ?', [bkkId]);
  await jalankan(conn, 'DELETE FROM bukti_kas_keluar_potongan WHERE bkk_id = ?', [bkkId]);
  await jalankan(
    conn,
    'INSERT INTO bukti_kas_keluar_detail (bkk_id, baris, uraian, akun_id, departemen_id, pemasok_id, faktur_id, ref_nomor, jumlah) VALUES ?',
    [s.baris.map((b, i) => [bkkId, i + 1, b.uraian.slice(0, 255), b.akun_id, b.departemen_id, b.pemasok_id, b.faktur_id, b.ref_nomor, b.jumlah])],
  );
  if (s.potongan.length) {
    await jalankan(conn, 'INSERT INTO bukti_kas_keluar_potongan (bkk_id, pajak_id, akun_id, dasar, tarif, jumlah, uraian) VALUES ?', [
      s.potongan.map((p) => [bkkId, p.pajak_id, p.akun_id, p.dasar, p.tarif, p.jumlah, p.uraian]),
    ]);
  }
}

async function tandaiSumber(conn, jenis, sumberId, bkkId) {
  if (jenis === 'PERMINTAAN_PEMBAYARAN') await jalankan(conn, "UPDATE permintaan_pembayaran SET status = 'DIPROSES', bkk_id = ? WHERE id = ?", [bkkId, sumberId]);
  if (jenis === 'UANG_MUKA') await jalankan(conn, "UPDATE uang_muka SET status = 'DIPROSES', bkk_id = ? WHERE id = ?", [bkkId, sumberId]);
  if (jenis === 'KEKURANGAN_UANG_MUKA') await jalankan(conn, 'UPDATE pertanggungjawaban_uang_muka SET bkk_id = ? WHERE id = ?', [bkkId, sumberId]);
  if (jenis === 'PENGISIAN_KAS_KECIL') await jalankan(conn, "UPDATE pengisian_kas_kecil SET status = 'DIPROSES', bkk_id = ? WHERE id = ?", [bkkId, sumberId]);
}

/** Kembalikan dokumen sumber ke status siap diproses (BKK dibatalkan). */
export async function lepasSumberBKK(conn, bkk) {
  if (bkk.jenis === 'PERMINTAAN_PEMBAYARAN') await jalankan(conn, "UPDATE permintaan_pembayaran SET status = 'DISETUJUI', bkk_id = NULL WHERE id = ? AND bkk_id = ?", [bkk.sumber_id, bkk.id]);
  if (bkk.jenis === 'UANG_MUKA') await jalankan(conn, "UPDATE uang_muka SET status = 'DISETUJUI', bkk_id = NULL WHERE id = ? AND bkk_id = ?", [bkk.sumber_id, bkk.id]);
  if (bkk.jenis === 'KEKURANGAN_UANG_MUKA') await jalankan(conn, 'UPDATE pertanggungjawaban_uang_muka SET bkk_id = NULL WHERE id = ? AND bkk_id = ?', [bkk.sumber_id, bkk.id]);
  if (bkk.jenis === 'PENGISIAN_KAS_KECIL') await jalankan(conn, "UPDATE pengisian_kas_kecil SET status = 'DIAJUKAN', bkk_id = NULL WHERE id = ? AND bkk_id = ?", [bkk.sumber_id, bkk.id]);
}

export async function buatBKK(conn, ctx, input) {
  const data = validasi(skemaBKK, { tanggal: hariIni(), tanggal_rencana_bayar: input?.tanggal || hariIni(), ...input });
  const s = await susunBKK(conn, data);
  const sumberId = data.jenis === 'PEMBAYARAN_FAKTUR' ? null : data.sumber_id;
  const nomor = await nomorBaru(conn, 'BKK', data.tanggal);
  const r = await jalankan(
    conn,
    `INSERT INTO bukti_kas_keluar (nomor, tanggal, jenis, sumber_id, sumber_nomor, pemasok_id, penerima_nama, penerima_bank_nama, penerima_bank_rekening,
       penerima_bank_atas_nama, rekening_kas_id, metode_bayar, tanggal_rencana_bayar, keterangan, jumlah_bruto, jumlah_potongan, jumlah_bayar, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor, data.tanggal, data.jenis, sumberId, s.sumberNomor, s.pemasokId, s.penerima.nama, s.penerima.bank_nama, s.penerima.bank_rekening,
      s.penerima.bank_atas_nama, data.rekening_kas_id, data.metode_bayar, data.tanggal_rencana_bayar, s.keterangan, s.bruto, s.totalPotongan, s.bayar, ctx.user.id],
  );
  await simpanIsiBKK(conn, r.insertId, s);
  await tandaiSumber(conn, data.jenis, sumberId, r.insertId);
  await catatAudit(conn, ctx, {
    aksi: 'BUAT',
    entitas: 'bukti_kas_keluar',
    entitasId: r.insertId,
    ringkasan: `BKK ${nomor} ${JENIS_BKK[data.jenis].toLowerCase()} kepada ${s.penerima.nama}: bruto ${s.bruto}, dibayar ${s.bayar}`,
    sesudah: data,
  });
  return { id: r.insertId, nomor, jumlah_bruto: s.bruto, jumlah_potongan: s.totalPotongan, jumlah_bayar: s.bayar };
}

export async function ubahBKK(conn, ctx, bkkId, input) {
  const bkk = await kunciBaris(conn, 'bukti_kas_keluar', bkkId, 'BKK');
  if (bkk.dibuat_oleh !== ctx.user.id) throw galatAkses('Hanya pembuat BKK yang dapat mengubahnya.');
  pastikanStatus(bkk, ['DRAFT', 'DITOLAK'], 'diubah');
  const data = validasi(skemaBKK, { ...input, jenis: bkk.jenis, sumber_id: bkk.sumber_id, pemasok_id: bkk.jenis === 'PEMBAYARAN_FAKTUR' ? bkk.pemasok_id : input?.pemasok_id });
  const s = await susunBKK(conn, data, bkkId);
  await jalankan(
    conn,
    `UPDATE bukti_kas_keluar SET tanggal = ?, penerima_nama = ?, penerima_bank_nama = ?, penerima_bank_rekening = ?, penerima_bank_atas_nama = ?,
       rekening_kas_id = ?, metode_bayar = ?, tanggal_rencana_bayar = ?, keterangan = ?, jumlah_bruto = ?, jumlah_potongan = ?, jumlah_bayar = ?, status = 'DRAFT'
     WHERE id = ?`,
    [data.tanggal, s.penerima.nama, s.penerima.bank_nama, s.penerima.bank_rekening, s.penerima.bank_atas_nama, data.rekening_kas_id, data.metode_bayar,
      data.tanggal_rencana_bayar, s.keterangan, s.bruto, s.totalPotongan, s.bayar, bkkId],
  );
  await simpanIsiBKK(conn, bkkId, s);
  await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'bukti_kas_keluar', entitasId: bkkId, ringkasan: `BKK ${bkk.nomor} diubah`, sebelum: bkk, sesudah: data });
}

/** Rekening transfer pemasok harus terverifikasi dan sama dengan data pemasok terkini. */
export async function periksaRekeningPemasok(conn, bkk) {
  if (bkk.metode_bayar !== 'TRANSFER' || !bkk.pemasok_id) return;
  const p = await satu(conn, 'SELECT nama, bank_nomor_rekening, rekening_terverifikasi FROM pemasok WHERE id = ?', [bkk.pemasok_id]);
  if (!p.rekening_terverifikasi) {
    throw galatKonflik(`Rekening bank ${p.nama} belum diverifikasi Kepala Bagian Akuntansi. Transfer belum dapat diproses.`);
  }
  if (p.bank_nomor_rekening !== bkk.penerima_bank_rekening) {
    throw galatKonflik(`Rekening ${p.nama} di data pemasok berbeda dengan rekening di BKK. Ubah BKK agar memakai rekening terverifikasi terbaru.`);
  }
}

export async function ajukanBKK(conn, ctx, bkkId) {
  const bkk = await kunciBaris(conn, 'bukti_kas_keluar', bkkId, 'BKK');
  if (bkk.dibuat_oleh !== ctx.user.id) throw galatAkses('Hanya pembuat BKK yang dapat mengajukannya.');
  pastikanStatus(bkk, ['DRAFT', 'DITOLAK'], 'diajukan');
  await periksaRekeningPemasok(conn, bkk);
  // Faktur mungkin berubah sejak BKK dibuat (misalnya dibayar melalui BKK lain): periksa ulang sisanya.
  const baris = await semua(conn, 'SELECT faktur_id, jumlah FROM bukti_kas_keluar_detail WHERE bkk_id = ? AND faktur_id IS NOT NULL', [bkkId]);
  for (const b of baris) {
    const f = await satu(conn, 'SELECT nomor_faktur, status FROM faktur_pemasok WHERE id = ? FOR UPDATE', [b.faktur_id]);
    const sisa = await sisaTersediaFaktur(conn, b.faktur_id, bkkId);
    if (!['TERVERIFIKASI', 'DIBAYAR_SEBAGIAN'].includes(f.status) || keSen(b.jumlah) > keSen(sisa)) {
      throw galatKonflik(`Faktur ${f.nomor_faktur} tidak lagi memiliki sisa utang sebesar yang diminta. Ubah BKK ini.`);
    }
  }
  const h = await ajukanDokumen(conn, ctx, {
    jenis: 'BKK',
    doc: bkk,
    nilai: bkk.jumlah_bruto,
    ringkasan: `${JENIS_BKK[bkk.jenis]}: ${bkk.penerima_nama}`,
    departemenId: null,
  });
  await catatAudit(conn, ctx, { aksi: 'AJUKAN', entitas: 'bukti_kas_keluar', entitasId: bkkId, ringkasan: `BKK ${bkk.nomor} diajukan` });
  return h;
}

export async function batalBKK(conn, ctx, bkkId, alasan) {
  if (!alasan?.trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const bkk = await kunciBaris(conn, 'bukti_kas_keluar', bkkId, 'BKK');
  if (['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(bkk.status)) {
    if (bkk.dibuat_oleh !== ctx.user.id && !punya(ctx.user, 'MANAJER_KEUANGAN')) throw galatAkses('BKK ini hanya dapat dibatalkan pembuatnya atau Manajer Keuangan.');
  } else if (bkk.status === 'DISETUJUI') {
    if (!punya(ctx.user, 'MANAJER_KEUANGAN')) throw galatAkses('BKK yang sudah disetujui hanya dapat dibatalkan Manajer Keuangan.');
  } else {
    pastikanStatus(bkk, ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'], 'dibatalkan');
  }
  await batalkanPersetujuan(conn, 'BKK', bkkId);
  await lepasSumberBKK(conn, bkk);
  await jalankan(conn, "UPDATE bukti_kas_keluar SET status = 'BATAL', dibatalkan_oleh = ?, dibatalkan_pada = NOW(), alasan_batal = ? WHERE id = ?", [ctx.user.id, alasan.trim().slice(0, 255), bkkId]);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'bukti_kas_keluar', entitasId: bkkId, ringkasan: `BKK ${bkk.nomor} dibatalkan: ${alasan}` });
}

const BKK_SELECT = `SELECT b.*, r.kode AS rekening_kode, r.nama AS rekening_nama, r.bank_nama AS rekening_bank, r.nomor_rekening AS rekening_nomor,
    u.nama_lengkap AS dibuat_nama, u.jabatan AS dibuat_jabatan, p.nomor AS pembayaran_nomor, p.tanggal AS tanggal_bayar, p.nomor_warkat, p.nomor_referensi,
    pm.rekening_terverifikasi
  FROM bukti_kas_keluar b JOIN rekening_kas r ON r.id = b.rekening_kas_id JOIN pengguna u ON u.id = b.dibuat_oleh
  LEFT JOIN pembayaran p ON p.id = b.pembayaran_id LEFT JOIN pemasok pm ON pm.id = b.pemasok_id`;

router.get('/bkk', perlu(...PERAN_LIHAT), async (req, res) => {
  const q = req.query;
  const syarat = ['1 = 1'];
  const params = [];
  if (q.status) { syarat.push('b.status IN (?)'); params.push(String(q.status).split(',')); }
  if (q.jenis) { syarat.push('b.jenis = ?'); params.push(String(q.jenis)); }
  if (q.pemasok_id) { syarat.push('b.pemasok_id = ?'); params.push(Number(q.pemasok_id)); }
  if (q.rekening_kas_id) { syarat.push('b.rekening_kas_id = ?'); params.push(Number(q.rekening_kas_id)); }
  if (q.dari) { syarat.push('b.tanggal >= ?'); params.push(q.dari); }
  if (q.sampai) { syarat.push('b.tanggal <= ?'); params.push(q.sampai); }
  if (q.cari) { syarat.push('(b.nomor LIKE ? OR b.penerima_nama LIKE ? OR b.keterangan LIKE ? OR b.sumber_nomor LIKE ?)'); params.push(`%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`, `%${q.cari}%`); }
  const urut = q.status === 'DISETUJUI' ? 'b.tanggal_rencana_bayar, b.id' : 'b.tanggal DESC, b.id DESC';
  res.json(await semua(pool, `${BKK_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY ${urut} LIMIT 500`, params));
});

export async function detailBKK(db, user, bkkId) {
  const b = await satu(db, `${BKK_SELECT} WHERE b.id = ?`, [bkkId]);
  if (!b) throw galatTidakAda('BKK tidak ditemukan.');
  if (!punya(user, PERAN_LIHAT)) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  const baris = await semua(
    db,
    `SELECT d.*, a.kode AS akun_kode, a.nama AS akun_nama, dp.nama AS departemen_nama, f.nomor_faktur, f.tanggal_jatuh_tempo
       FROM bukti_kas_keluar_detail d JOIN akun a ON a.id = d.akun_id LEFT JOIN departemen dp ON dp.id = d.departemen_id
       LEFT JOIN faktur_pemasok f ON f.id = d.faktur_id WHERE d.bkk_id = ? ORDER BY d.baris`,
    [bkkId],
  );
  const potongan = await semua(
    db,
    `SELECT p.*, a.kode AS akun_kode, a.nama AS akun_nama, pj.kode AS pajak_kode FROM bukti_kas_keluar_potongan p
       JOIN akun a ON a.id = p.akun_id JOIN pajak pj ON pj.id = p.pajak_id WHERE p.bkk_id = ? ORDER BY p.id`,
    [bkkId],
  );
  const pembayaran = await semua(
    db,
    `SELECT p.id, p.nomor, p.tanggal, p.metode, p.nomor_warkat, p.nomor_referensi, p.jumlah, p.status, p.tanggal_kliring, p.alasan_batal,
            u.nama_lengkap AS dibayar_nama, ub.nama_lengkap AS dibatalkan_nama
       FROM pembayaran p JOIN pengguna u ON u.id = p.dibuat_oleh LEFT JOIN pengguna ub ON ub.id = p.dibatalkan_oleh
      WHERE p.bkk_id = ? ORDER BY p.id`,
    [bkkId],
  );
  const rekeningAkun = await satu(db, 'SELECT a.kode, a.nama FROM rekening_kas r JOIN akun a ON a.id = r.akun_id WHERE r.id = ?', [b.rekening_kas_id]);
  return {
    ...b,
    jenis_label: JENIS_BKK[b.jenis],
    rekening_akun: rekeningAkun,
    baris,
    potongan,
    pembayaran,
    persetujuan: await riwayatPersetujuan(db, 'BKK', bkkId),
    boleh_memutuskan: await bolehMemutuskan(db, user, 'BKK', bkkId),
    jumlah_lampiran: await jumlahLampiran(db, 'BKK', bkkId),
  };
}

router.get('/bkk/sumber', perlu('AKUNTANSI'), async (req, res) => {
  const jenis = String(req.query.jenis || '');
  if (jenis === 'PEMBAYARAN_FAKTUR') {
    if (req.query.pemasok_id) {
      const rows = await semua(
        pool,
        `SELECT f.id, f.nomor, f.nomor_faktur, f.tanggal_faktur, f.tanggal_jatuh_tempo, f.total_utang, f.terbayar, f.status,
                f.total_utang - f.terbayar - COALESCE((SELECT SUM(d.jumlah) FROM bukti_kas_keluar_detail d JOIN bukti_kas_keluar b ON b.id = d.bkk_id
                  WHERE d.faktur_id = f.id AND b.status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK')), 0) AS sisa_tersedia
           FROM faktur_pemasok f WHERE f.pemasok_id = ? AND f.status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN')
          HAVING sisa_tersedia > 0 ORDER BY f.tanggal_jatuh_tempo, f.id`,
        [Number(req.query.pemasok_id)],
      );
      return res.json(rows);
    }
    return res.json(
      await semua(
        pool,
        `SELECT p.id, p.kode, p.nama, p.rekening_terverifikasi, p.bank_nomor_rekening, COUNT(f.id) AS jumlah_faktur, SUM(f.total_utang - f.terbayar) AS sisa,
                MIN(f.tanggal_jatuh_tempo) AS jatuh_tempo_terdekat
           FROM faktur_pemasok f JOIN pemasok p ON p.id = f.pemasok_id
          WHERE f.status IN ('TERVERIFIKASI','DIBAYAR_SEBAGIAN') GROUP BY p.id ORDER BY jatuh_tempo_terdekat`,
      ),
    );
  }
  const kueri = {
    PERMINTAAN_PEMBAYARAN: `SELECT d.id, d.nomor, d.tanggal, d.penerima_nama AS penerima, d.keterangan, d.total AS jumlah, d.tanggal_dibutuhkan, dp.nama AS departemen_nama
        FROM permintaan_pembayaran d JOIN departemen dp ON dp.id = d.departemen_id WHERE d.status = 'DISETUJUI' ORDER BY d.tanggal_dibutuhkan, d.id`,
    UANG_MUKA: `SELECT d.id, d.nomor, d.tanggal, u.nama_lengkap AS penerima, d.keperluan AS keterangan, d.jumlah, dp.nama AS departemen_nama
        FROM uang_muka d JOIN pengguna u ON u.id = d.dibuat_oleh JOIN departemen dp ON dp.id = d.departemen_id WHERE d.status = 'DISETUJUI' ORDER BY d.tanggal, d.id`,
    KEKURANGAN_UANG_MUKA: `SELECT d.id, d.nomor, d.tanggal, u.nama_lengkap AS penerima, CONCAT('Kekurangan uang muka ', um.nomor) AS keterangan, -d.selisih AS jumlah
        FROM pertanggungjawaban_uang_muka d JOIN uang_muka um ON um.id = d.uang_muka_id JOIN pengguna u ON u.id = d.dibuat_oleh
       WHERE d.status = 'DISETUJUI' AND d.hasil = 'KURANG' AND d.bkk_id IS NULL ORDER BY d.tanggal`,
    PEMBENTUKAN_KAS_KECIL: `SELECT d.id, d.kode AS nomor, d.nama AS keterangan, u.nama_lengkap AS penerima, d.dana_diusulkan, d.jumlah_dana,
        GREATEST(d.dana_diusulkan - d.jumlah_dana, 0) AS jumlah
        FROM dana_kas_kecil d JOIN pengguna u ON u.id = d.pemegang_id
       WHERE d.aktif = 1 AND NOT EXISTS (SELECT 1 FROM bukti_kas_keluar b WHERE b.jenis = 'PEMBENTUKAN_KAS_KECIL' AND b.sumber_id = d.id
         AND b.status IN ('DRAFT','DIAJUKAN','DISETUJUI','DITOLAK')) ORDER BY d.kode`,
    PENGISIAN_KAS_KECIL: `SELECT p.id, p.nomor, p.tanggal, u.nama_lengkap AS penerima, CONCAT('Pengisian ', dn.nama) AS keterangan, p.total AS jumlah
        FROM pengisian_kas_kecil p JOIN dana_kas_kecil dn ON dn.id = p.dana_id JOIN pengguna u ON u.id = dn.pemegang_id
       WHERE p.status = 'DIAJUKAN' ORDER BY p.tanggal, p.id`,
  }[jenis];
  if (!kueri) throw galatMasukan('Jenis BKK tidak dikenal.');
  res.json(await semua(pool, kueri));
});

router.get('/bkk/:id', perlu(...PERAN_LIHAT), async (req, res) => {
  res.json(await detailBKK(pool, req.user, Number(req.params.id)));
});
router.post('/bkk', perlu('AKUNTANSI'), async (req, res) => {
  res.status(201).json(await tx((conn) => buatBKK(conn, req.ctx, req.body)));
});
router.put('/bkk/:id', perlu('AKUNTANSI'), async (req, res) => {
  await tx((conn) => ubahBKK(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});
router.post('/bkk/:id/ajukan', perlu('AKUNTANSI'), async (req, res) => {
  res.json(await tx((conn) => ajukanBKK(conn, req.ctx, Number(req.params.id))));
});
router.post('/bkk/:id/batal', perlu('AKUNTANSI', 'MANAJER_KEUANGAN'), async (req, res) => {
  await tx((conn) => batalBKK(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});
