import { Router } from 'express';
import { pool, tx, jalankan, satu, semua } from '../db.js';
import { galatMasukan, galatTidakAda, galatKonflik, galatAkses } from '../lib/galat.js';
import { z, validasi, id, idOpsional, teks, teksOpsional, bool, tanggal } from '../lib/validasi.js';
import { catatAudit } from '../lib/audit.js';
import { perlu } from '../lib/akses.js';
import { keSen, dariSen } from '../lib/uang.js';

export const router = Router();

const PERAN_LIHAT_KAS = ['KASIR', 'AKUNTANSI', 'SPV_AKUNTANSI', 'MANAJER_KEUANGAN', 'DIREKTUR', 'AUDITOR'];

// ---------------------------------------------------------------- departemen

const skemaDepartemen = z.object({
  kode: z.string().trim().regex(/^[A-Z0-9]{2,10}$/, 'Kode 2 sampai 10 huruf kapital atau angka.'),
  nama: teks(100),
  aktif: bool().optional(),
});

router.get('/departemen', async (_req, res) => {
  res.json(await semua(pool, 'SELECT * FROM departemen ORDER BY kode'));
});

router.post('/departemen', perlu('ADMIN'), async (req, res) => {
  const data = validasi(skemaDepartemen, req.body);
  const hasil = await tx(async (conn) => {
    if (await satu(conn, 'SELECT id FROM departemen WHERE kode = ?', [data.kode])) throw galatMasukan('Kode sudah dipakai.', { kode: 'Kode sudah dipakai.' });
    const r = await jalankan(conn, 'INSERT INTO departemen (kode, nama, aktif) VALUES (?, ?, ?)', [data.kode, data.nama, data.aktif === false ? 0 : 1]);
    await catatAudit(conn, req.ctx, { aksi: 'BUAT', entitas: 'departemen', entitasId: r.insertId, ringkasan: `Departemen ${data.kode} ${data.nama}`, sesudah: data });
    return { id: r.insertId };
  });
  res.status(201).json(hasil);
});

router.put('/departemen/:id', perlu('ADMIN'), async (req, res) => {
  const data = validasi(skemaDepartemen.omit({ kode: true }), req.body);
  await tx(async (conn) => {
    const lama = await satu(conn, 'SELECT * FROM departemen WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!lama) throw galatTidakAda('Departemen tidak ditemukan.');
    await jalankan(conn, 'UPDATE departemen SET nama = ?, aktif = ? WHERE id = ?', [data.nama, data.aktif === false ? 0 : 1, lama.id]);
    await catatAudit(conn, req.ctx, { aksi: 'UBAH', entitas: 'departemen', entitasId: lama.id, ringkasan: `Departemen ${lama.kode} diubah`, sebelum: lama, sesudah: data });
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- bagan akun

const skemaAkun = z.object({
  kode: z.string().trim().regex(/^\d-\d{4}$/, 'Format kode K-GGNN, misalnya 6-1104.'),
  nama: teks(150),
  kategori: z.enum(['ASET', 'LIABILITAS', 'EKUITAS', 'PENDAPATAN', 'BEBAN']),
  saldo_normal: z.enum(['D', 'K']),
  tipe: z.enum(['INDUK', 'DETAIL']),
  induk_id: idOpsional(),
  aktif: bool().optional(),
});

router.get('/akun', async (req, res) => {
  const syarat = ['1 = 1'];
  const params = [];
  if (req.query.detail === '1') syarat.push("a.tipe = 'DETAIL'");
  if (req.query.aktif === '1') syarat.push('a.aktif = 1');
  if (req.query.kategori) { syarat.push('a.kategori IN (?)'); params.push(String(req.query.kategori).split(',')); }
  res.json(
    await semua(
      pool,
      `SELECT a.*, i.kode AS induk_kode, i.nama AS induk_nama,
              EXISTS (SELECT 1 FROM jurnal_detail jd WHERE jd.akun_id = a.id) AS terpakai
         FROM akun a LEFT JOIN akun i ON i.id = a.induk_id WHERE ${syarat.join(' AND ')} ORDER BY a.kode`,
      params,
    ),
  );
});

async function periksaInduk(conn, indukId) {
  if (!indukId) return;
  const induk = await satu(conn, 'SELECT tipe FROM akun WHERE id = ?', [indukId]);
  if (!induk || induk.tipe !== 'INDUK') throw galatMasukan('Akun induk harus bertipe induk.', { induk_id: 'Pilih akun bertipe induk.' });
}

router.post('/akun', perlu('SPV_AKUNTANSI'), async (req, res) => {
  const data = validasi(skemaAkun, req.body);
  const hasil = await tx(async (conn) => {
    if (await satu(conn, 'SELECT id FROM akun WHERE kode = ?', [data.kode])) throw galatMasukan('Kode akun sudah dipakai.', { kode: 'Kode sudah dipakai.' });
    await periksaInduk(conn, data.induk_id);
    const r = await jalankan(
      conn,
      'INSERT INTO akun (kode, nama, kategori, saldo_normal, tipe, induk_id, aktif) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.kode, data.nama, data.kategori, data.saldo_normal, data.tipe, data.induk_id, data.aktif === false ? 0 : 1],
    );
    await catatAudit(conn, req.ctx, { aksi: 'BUAT', entitas: 'akun', entitasId: r.insertId, ringkasan: `Akun ${data.kode} ${data.nama}`, sesudah: data });
    return { id: r.insertId };
  });
  res.status(201).json(hasil);
});

router.put('/akun/:id', perlu('SPV_AKUNTANSI'), async (req, res) => {
  const data = validasi(skemaAkun, req.body);
  await tx(async (conn) => {
    const lama = await satu(conn, 'SELECT * FROM akun WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!lama) throw galatTidakAda('Akun tidak ditemukan.');
    const terpakai = await satu(conn, 'SELECT 1 AS ada FROM jurnal_detail WHERE akun_id = ? LIMIT 1', [lama.id]);
    if (terpakai && (data.kode !== lama.kode || data.kategori !== lama.kategori || data.saldo_normal !== lama.saldo_normal || data.tipe !== lama.tipe)) {
      throw galatMasukan('Akun sudah dipakai jurnal: kode, kategori, saldo normal, dan tipe tidak dapat diubah. Nonaktifkan lalu buat akun baru bila perlu.');
    }
    if (data.kode !== lama.kode && (await satu(conn, 'SELECT id FROM akun WHERE kode = ? AND id <> ?', [data.kode, lama.id]))) {
      throw galatMasukan('Kode akun sudah dipakai.', { kode: 'Kode sudah dipakai.' });
    }
    if (data.induk_id === lama.id) throw galatMasukan('Akun tidak boleh menjadi induk dirinya sendiri.');
    await periksaInduk(conn, data.induk_id);
    await jalankan(
      conn,
      'UPDATE akun SET kode = ?, nama = ?, kategori = ?, saldo_normal = ?, tipe = ?, induk_id = ?, aktif = ? WHERE id = ?',
      [data.kode, data.nama, data.kategori, data.saldo_normal, data.tipe, data.induk_id, data.aktif === false ? 0 : 1, lama.id],
    );
    await catatAudit(conn, req.ctx, { aksi: 'UBAH', entitas: 'akun', entitasId: lama.id, ringkasan: `Akun ${lama.kode} diubah`, sebelum: lama, sesudah: data });
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- pajak

const skemaPajak = z.object({
  kode: z.string().trim().regex(/^[A-Z0-9_]{2,20}$/, 'Kode 2 sampai 20 huruf kapital, angka, atau garis bawah.'),
  nama: teks(150),
  jenis: z.enum(['PPN', 'PPH']),
  tarif: z.coerce.number().min(0).max(100),
  akun_id: id(),
  naik_tanpa_npwp: bool().optional(),
  aktif: bool().optional(),
});

router.get('/pajak', async (_req, res) => {
  res.json(await semua(pool, 'SELECT p.*, a.kode AS akun_kode, a.nama AS akun_nama FROM pajak p JOIN akun a ON a.id = p.akun_id ORDER BY p.jenis, p.kode'));
});

async function simpanPajak(conn, ctx, idPajak, input) {
  const data = validasi(skemaPajak, input);
  const akun = await satu(conn, "SELECT id FROM akun WHERE id = ? AND tipe = 'DETAIL'", [data.akun_id]);
  if (!akun) throw galatMasukan('Pilih akun detail.', { akun_id: 'Pilih akun detail.' });
  const nilai = [data.kode, data.nama, data.jenis, data.tarif, data.akun_id, data.naik_tanpa_npwp ? 1 : 0, data.aktif === false ? 0 : 1];
  if (idPajak) {
    const lama = await satu(conn, 'SELECT * FROM pajak WHERE id = ? FOR UPDATE', [idPajak]);
    if (!lama) throw galatTidakAda('Kode pajak tidak ditemukan.');
    await jalankan(conn, 'UPDATE pajak SET kode = ?, nama = ?, jenis = ?, tarif = ?, akun_id = ?, naik_tanpa_npwp = ?, aktif = ? WHERE id = ?', [...nilai, idPajak]);
    await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'pajak', entitasId: idPajak, ringkasan: `Pajak ${data.kode} diubah`, sebelum: lama, sesudah: data });
    return idPajak;
  }
  if (await satu(conn, 'SELECT id FROM pajak WHERE kode = ?', [data.kode])) throw galatMasukan('Kode pajak sudah dipakai.', { kode: 'Kode sudah dipakai.' });
  const r = await jalankan(conn, 'INSERT INTO pajak (kode, nama, jenis, tarif, akun_id, naik_tanpa_npwp, aktif) VALUES (?, ?, ?, ?, ?, ?, ?)', nilai);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'pajak', entitasId: r.insertId, ringkasan: `Pajak ${data.kode}`, sesudah: data });
  return r.insertId;
}

router.post('/pajak', perlu('SPV_AKUNTANSI'), async (req, res) => {
  res.status(201).json({ id: await tx((conn) => simpanPajak(conn, req.ctx, null, req.body)) });
});
router.put('/pajak/:id', perlu('SPV_AKUNTANSI'), async (req, res) => {
  await tx((conn) => simpanPajak(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- pemasok

const kosongJadiNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

const skemaPemasok = z
  .object({
    kode: z.string().trim().regex(/^[A-Za-z0-9-]{2,20}$/, 'Kode 2 sampai 20 huruf, angka, atau tanda hubung.'),
    nama: teks(150),
    alamat: teksOpsional(255),
    kota: teksOpsional(80),
    telepon: teksOpsional(40),
    email: z.preprocess(kosongJadiNull, z.string().email('Format email belum benar.').max(100).nullable()),
    kontak: teksOpsional(100),
    npwp: z.preprocess(kosongJadiNull, z.string().max(20).nullable()),
    pkp: bool().optional(),
    termin_hari: z.coerce.number().int().min(0).max(365),
    bank_nama: teksOpsional(60),
    bank_nomor_rekening: z.preprocess(kosongJadiNull, z.string().regex(/^[0-9-. ]{5,40}$/, 'Nomor rekening hanya angka.').nullable()),
    bank_atas_nama: teksOpsional(150),
    catatan: teksOpsional(255),
    aktif: bool().optional(),
  })
  .superRefine((d, c) => {
    if (d.npwp) {
      const digit = d.npwp.replace(/\D/g, '');
      if (digit.length !== 15 && digit.length !== 16) c.addIssue({ code: 'custom', path: ['npwp'], message: 'NPWP harus 15 atau 16 digit.' });
    }
    if (d.pkp && !d.npwp) c.addIssue({ code: 'custom', path: ['npwp'], message: 'Pemasok PKP wajib punya NPWP.' });
    const bank = [d.bank_nama, d.bank_nomor_rekening, d.bank_atas_nama];
    if (bank.some(Boolean) && !bank.every(Boolean)) {
      for (const [k, v] of [['bank_nama', d.bank_nama], ['bank_nomor_rekening', d.bank_nomor_rekening], ['bank_atas_nama', d.bank_atas_nama]]) {
        if (!v) c.addIssue({ code: 'custom', path: [k], message: 'Lengkapi data rekening bank.' });
      }
    }
  });

const PEMASOK_SELECT = `SELECT p.*, uu.nama_lengkap AS rekening_diubah_nama, uv.nama_lengkap AS rekening_diverifikasi_nama
  FROM pemasok p LEFT JOIN pengguna uu ON uu.id = p.rekening_diubah_oleh LEFT JOIN pengguna uv ON uv.id = p.rekening_diverifikasi_oleh`;

router.get('/pemasok', async (req, res) => {
  const syarat = ['1 = 1'];
  const params = [];
  if (req.query.aktif === '1') syarat.push('p.aktif = 1');
  if (req.query.cari) { syarat.push('(p.nama LIKE ? OR p.kode LIKE ?)'); params.push(`%${req.query.cari}%`, `%${req.query.cari}%`); }
  if (req.query.belum_verifikasi === '1') syarat.push('p.bank_nomor_rekening IS NOT NULL AND p.rekening_terverifikasi = 0');
  res.json(await semua(pool, `${PEMASOK_SELECT} WHERE ${syarat.join(' AND ')} ORDER BY p.nama`, params));
});

router.get('/pemasok/:id', async (req, res) => {
  const p = await satu(pool, `${PEMASOK_SELECT} WHERE p.id = ?`, [req.params.id]);
  if (!p) throw galatTidakAda('Pemasok tidak ditemukan.');
  res.json(p);
});

export async function simpanPemasok(conn, ctx, idPemasok, input) {
  const data = validasi(skemaPemasok, input);
  const nilai = [
    data.kode, data.nama, data.alamat, data.kota, data.telepon, data.email, data.kontak, data.npwp,
    data.pkp ? 1 : 0, data.termin_hari, data.bank_nama, data.bank_nomor_rekening, data.bank_atas_nama, data.catatan,
    data.aktif === false ? 0 : 1,
  ];
  if (idPemasok) {
    const lama = await satu(conn, 'SELECT * FROM pemasok WHERE id = ? FOR UPDATE', [idPemasok]);
    if (!lama) throw galatTidakAda('Pemasok tidak ditemukan.');
    if (data.kode !== lama.kode && (await satu(conn, 'SELECT id FROM pemasok WHERE kode = ? AND id <> ?', [data.kode, idPemasok]))) {
      throw galatMasukan('Kode pemasok sudah dipakai.', { kode: 'Kode sudah dipakai.' });
    }
    await jalankan(
      conn,
      `UPDATE pemasok SET kode = ?, nama = ?, alamat = ?, kota = ?, telepon = ?, email = ?, kontak = ?, npwp = ?, pkp = ?,
         termin_hari = ?, bank_nama = ?, bank_nomor_rekening = ?, bank_atas_nama = ?, catatan = ?, aktif = ? WHERE id = ?`,
      [...nilai, idPemasok],
    );
    const rekeningBerubah =
      (lama.bank_nama || null) !== data.bank_nama ||
      (lama.bank_nomor_rekening || null) !== data.bank_nomor_rekening ||
      (lama.bank_atas_nama || null) !== data.bank_atas_nama;
    if (rekeningBerubah) {
      await jalankan(
        conn,
        `UPDATE pemasok SET rekening_terverifikasi = 0, rekening_diubah_oleh = ?, rekening_diubah_pada = NOW(),
           rekening_diverifikasi_oleh = NULL, rekening_diverifikasi_pada = NULL WHERE id = ?`,
        [ctx.user.id, idPemasok],
      );
      await catatAudit(conn, ctx, {
        aksi: 'UBAH_REKENING',
        entitas: 'pemasok',
        entitasId: idPemasok,
        ringkasan: `Rekening bank ${lama.nama} diubah dan menunggu verifikasi`,
        sebelum: { bank_nama: lama.bank_nama, bank_nomor_rekening: lama.bank_nomor_rekening, bank_atas_nama: lama.bank_atas_nama },
        sesudah: { bank_nama: data.bank_nama, bank_nomor_rekening: data.bank_nomor_rekening, bank_atas_nama: data.bank_atas_nama },
      });
    }
    await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'pemasok', entitasId: idPemasok, ringkasan: `Pemasok ${lama.kode} diubah`, sebelum: lama, sesudah: data });
    return idPemasok;
  }
  if (await satu(conn, 'SELECT id FROM pemasok WHERE kode = ?', [data.kode])) throw galatMasukan('Kode pemasok sudah dipakai.', { kode: 'Kode sudah dipakai.' });
  const r = await jalankan(
    conn,
    `INSERT INTO pemasok (kode, nama, alamat, kota, telepon, email, kontak, npwp, pkp, termin_hari, bank_nama,
       bank_nomor_rekening, bank_atas_nama, catatan, aktif, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...nilai, ctx.user.id],
  );
  if (data.bank_nomor_rekening) {
    await jalankan(conn, 'UPDATE pemasok SET rekening_diubah_oleh = ?, rekening_diubah_pada = NOW() WHERE id = ?', [ctx.user.id, r.insertId]);
  }
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'pemasok', entitasId: r.insertId, ringkasan: `Pemasok ${data.kode} ${data.nama}`, sesudah: data });
  return r.insertId;
}

router.post('/pemasok', perlu('PEMBELIAN'), async (req, res) => {
  res.status(201).json({ id: await tx((conn) => simpanPemasok(conn, req.ctx, null, req.body)) });
});
router.put('/pemasok/:id', perlu('PEMBELIAN'), async (req, res) => {
  await tx((conn) => simpanPemasok(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});

export async function verifikasiRekeningPemasok(conn, ctx, idPemasok) {
  const p = await satu(conn, 'SELECT * FROM pemasok WHERE id = ? FOR UPDATE', [idPemasok]);
  if (!p) throw galatTidakAda('Pemasok tidak ditemukan.');
  if (!p.bank_nomor_rekening) throw galatMasukan('Pemasok ini belum punya data rekening bank.');
  if (p.rekening_terverifikasi) throw galatKonflik('Rekening pemasok ini sudah terverifikasi.');
  if (p.rekening_diubah_oleh === ctx.user.id) throw galatAkses('Rekening tidak dapat diverifikasi oleh pengguna yang mengubahnya.');
  await jalankan(conn, 'UPDATE pemasok SET rekening_terverifikasi = 1, rekening_diverifikasi_oleh = ?, rekening_diverifikasi_pada = NOW() WHERE id = ?', [ctx.user.id, p.id]);
  await catatAudit(conn, ctx, {
    aksi: 'VERIFIKASI_REKENING',
    entitas: 'pemasok',
    entitasId: p.id,
    ringkasan: `Rekening ${p.bank_nama} ${p.bank_nomor_rekening} a.n. ${p.bank_atas_nama} milik ${p.nama} diverifikasi`,
  });
}

router.post('/pemasok/:id/verifikasi-rekening', perlu('SPV_AKUNTANSI'), async (req, res) => {
  await tx((conn) => verifikasiRekeningPemasok(conn, req.ctx, Number(req.params.id)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- rekening kas dan bank

const skemaRekening = z.object({
  kode: z.string().trim().regex(/^[A-Z0-9-]{2,20}$/, 'Kode 2 sampai 20 huruf kapital, angka, atau tanda hubung.'),
  nama: teks(100),
  bank_nama: teks(60),
  nomor_rekening: teks(40),
  atas_nama: teksOpsional(150),
  akun_id: id(),
  aktif: bool().optional(),
});

async function periksaAkunKas(conn, akunId, kecualiRekening, kecualiDana) {
  const a = await satu(conn, "SELECT id FROM akun WHERE id = ? AND tipe = 'DETAIL' AND kategori = 'ASET' AND aktif = 1", [akunId]);
  if (!a) throw galatMasukan('Pilih akun detail berkategori aset.', { akun_id: 'Pilih akun detail berkategori aset.' });
  const dipakaiRek = await satu(conn, 'SELECT kode FROM rekening_kas WHERE akun_id = ? AND id <> ?', [akunId, kecualiRekening || 0]);
  const dipakaiDana = await satu(conn, 'SELECT kode FROM dana_kas_kecil WHERE akun_id = ? AND id <> ?', [akunId, kecualiDana || 0]);
  if (dipakaiRek || dipakaiDana) throw galatMasukan('Akun ini sudah dipakai rekening atau dana kas kecil lain.', { akun_id: 'Akun sudah dipakai.' });
}

router.get('/rekening-kas', async (_req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT r.*, a.kode AS akun_kode, a.nama AS akun_nama,
              (SELECT COALESCE(SUM(jd.debit - jd.kredit), 0) FROM jurnal_detail jd WHERE jd.akun_id = r.akun_id) AS saldo_buku
         FROM rekening_kas r JOIN akun a ON a.id = r.akun_id ORDER BY r.kode`,
    ),
  );
});

async function simpanRekening(conn, ctx, idRek, input) {
  const data = validasi(skemaRekening, input);
  await periksaAkunKas(conn, data.akun_id, idRek, null);
  const nilai = [data.kode, data.nama, data.bank_nama, data.nomor_rekening, data.atas_nama, data.akun_id, data.aktif === false ? 0 : 1];
  if (idRek) {
    const lama = await satu(conn, 'SELECT * FROM rekening_kas WHERE id = ? FOR UPDATE', [idRek]);
    if (!lama) throw galatTidakAda('Rekening tidak ditemukan.');
    await jalankan(conn, 'UPDATE rekening_kas SET kode = ?, nama = ?, bank_nama = ?, nomor_rekening = ?, atas_nama = ?, akun_id = ?, aktif = ? WHERE id = ?', [...nilai, idRek]);
    await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'rekening_kas', entitasId: idRek, ringkasan: `Rekening ${lama.kode} diubah`, sebelum: lama, sesudah: data });
    return idRek;
  }
  if (await satu(conn, 'SELECT id FROM rekening_kas WHERE kode = ?', [data.kode])) throw galatMasukan('Kode rekening sudah dipakai.', { kode: 'Kode sudah dipakai.' });
  const r = await jalankan(conn, 'INSERT INTO rekening_kas (kode, nama, bank_nama, nomor_rekening, atas_nama, akun_id, aktif) VALUES (?, ?, ?, ?, ?, ?, ?)', nilai);
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'rekening_kas', entitasId: r.insertId, ringkasan: `Rekening ${data.kode} ${data.nama}`, sesudah: data });
  return r.insertId;
}

router.post('/rekening-kas', perlu('MANAJER_KEUANGAN'), async (req, res) => {
  res.status(201).json({ id: await tx((conn) => simpanRekening(conn, req.ctx, null, req.body)) });
});
router.put('/rekening-kas/:id', perlu('MANAJER_KEUANGAN'), async (req, res) => {
  await tx((conn) => simpanRekening(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- buku cek dan warkat

const skemaBukuCek = z
  .object({
    rekening_kas_id: id(),
    jenis: z.enum(['CEK', 'BG']),
    seri: z.preprocess((v) => String(v ?? '').trim().toUpperCase(), z.string().regex(/^[A-Z]{0,4}$/, 'Seri maksimal 4 huruf.')),
    nomor_awal: z.coerce.number().int().positive(),
    nomor_akhir: z.coerce.number().int().positive(),
    digit: z.coerce.number().int().min(4).max(10).default(6),
    tanggal_terima: tanggal(),
  })
  .refine((d) => d.nomor_akhir >= d.nomor_awal, { path: ['nomor_akhir'], message: 'Nomor akhir harus lebih besar atau sama dengan nomor awal.' })
  .refine((d) => d.nomor_akhir - d.nomor_awal < 200, { path: ['nomor_akhir'], message: 'Satu buku maksimal 200 lembar.' });

export const formatNomorWarkat = (seri, urut, digit) => `${seri ? `${seri} ` : ''}${String(urut).padStart(digit, '0')}`;

router.get('/buku-cek', perlu(...PERAN_LIHAT_KAS), async (req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT b.*, r.kode AS rekening_kode, r.nama AS rekening_nama, u.nama_lengkap AS dibuat_nama,
              SUM(w.status = 'TERSEDIA') AS tersedia, SUM(w.status = 'TERPAKAI') AS terpakai, SUM(w.status = 'BATAL') AS batal
         FROM buku_cek b JOIN rekening_kas r ON r.id = b.rekening_kas_id JOIN pengguna u ON u.id = b.dibuat_oleh
         LEFT JOIN warkat w ON w.buku_cek_id = b.id
        ${req.query.rekening_kas_id ? 'WHERE b.rekening_kas_id = ?' : ''}
        GROUP BY b.id ORDER BY b.tanggal_terima DESC, b.id DESC`,
      req.query.rekening_kas_id ? [Number(req.query.rekening_kas_id)] : [],
    ),
  );
});

export async function buatBukuCek(conn, ctx, input) {
  const data = validasi(skemaBukuCek, input);
  const rek = await satu(conn, 'SELECT id, aktif FROM rekening_kas WHERE id = ?', [data.rekening_kas_id]);
  if (!rek || !rek.aktif) throw galatMasukan('Rekening tidak aktif.', { rekening_kas_id: 'Pilih rekening aktif.' });
  const tumpang = await satu(
    conn,
    `SELECT id, nomor_awal, nomor_akhir FROM buku_cek WHERE rekening_kas_id = ? AND jenis = ? AND seri = ?
       AND nomor_awal <= ? AND nomor_akhir >= ? LIMIT 1`,
    [data.rekening_kas_id, data.jenis, data.seri, data.nomor_akhir, data.nomor_awal],
  );
  if (tumpang) throw galatMasukan(`Rentang nomor bertumpang tindih dengan buku lain (${tumpang.nomor_awal} sampai ${tumpang.nomor_akhir}).`, { nomor_awal: 'Rentang sudah terdaftar.' });
  const r = await jalankan(
    conn,
    'INSERT INTO buku_cek (rekening_kas_id, jenis, seri, nomor_awal, nomor_akhir, digit, tanggal_terima, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [data.rekening_kas_id, data.jenis, data.seri, data.nomor_awal, data.nomor_akhir, data.digit, data.tanggal_terima, ctx.user.id],
  );
  const lembar = [];
  for (let n = data.nomor_awal; n <= data.nomor_akhir; n += 1) lembar.push([r.insertId, n, formatNomorWarkat(data.seri, n, data.digit)]);
  await jalankan(conn, 'INSERT INTO warkat (buku_cek_id, urut, nomor) VALUES ?', [lembar]);
  await catatAudit(conn, ctx, {
    aksi: 'BUAT',
    entitas: 'buku_cek',
    entitasId: r.insertId,
    ringkasan: `Buku ${data.jenis} ${formatNomorWarkat(data.seri, data.nomor_awal, data.digit)} sampai ${formatNomorWarkat(data.seri, data.nomor_akhir, data.digit)} (${lembar.length} lembar)`,
    sesudah: data,
  });
  return r.insertId;
}

router.post('/buku-cek', perlu('KASIR'), async (req, res) => {
  res.status(201).json({ id: await tx((conn) => buatBukuCek(conn, req.ctx, req.body)) });
});

router.get('/buku-cek/:id/warkat', perlu(...PERAN_LIHAT_KAS), async (req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT w.*, p.nomor AS pembayaran_nomor, p.tanggal AS pembayaran_tanggal, p.penerima_nama, p.jumlah,
              p.status AS pembayaran_status, b.nomor AS bkk_nomor, u.nama_lengkap AS dibatalkan_nama
         FROM warkat w
         LEFT JOIN pembayaran p ON p.id = w.pembayaran_id
         LEFT JOIN bukti_kas_keluar b ON b.id = p.bkk_id
         LEFT JOIN pengguna u ON u.id = w.dibatalkan_oleh
        WHERE w.buku_cek_id = ? ORDER BY w.urut`,
      [req.params.id],
    ),
  );
});

router.get('/warkat/tersedia', perlu(...PERAN_LIHAT_KAS), async (req, res) => {
  res.json(
    await semua(
      pool,
      `SELECT w.id, w.nomor, w.urut, b.jenis, b.id AS buku_cek_id FROM warkat w JOIN buku_cek b ON b.id = w.buku_cek_id
        WHERE w.status = 'TERSEDIA' AND b.status = 'AKTIF' AND b.rekening_kas_id = ? AND b.jenis = ?
        ORDER BY b.tanggal_terima, b.id, w.urut LIMIT 50`,
      [Number(req.query.rekening_kas_id), String(req.query.jenis || 'CEK')],
    ),
  );
});

export async function perbaruiStatusBukuCek(conn, bukuCekId) {
  const r = await satu(conn, "SELECT COUNT(*) AS n FROM warkat WHERE buku_cek_id = ? AND status = 'TERSEDIA'", [bukuCekId]);
  await jalankan(conn, "UPDATE buku_cek SET status = IF(? = 0, 'HABIS', 'AKTIF') WHERE id = ? AND status <> 'DITUTUP'", [r.n, bukuCekId]);
}

export async function batalkanWarkatKosong(conn, ctx, warkatId, alasan) {
  if (!alasan || !String(alasan).trim()) throw galatMasukan('Alasan pembatalan wajib diisi.', { alasan: 'Wajib diisi.' });
  const w = await satu(conn, 'SELECT * FROM warkat WHERE id = ? FOR UPDATE', [warkatId]);
  if (!w) throw galatTidakAda('Lembar warkat tidak ditemukan.');
  if (w.status !== 'TERSEDIA') throw galatKonflik(`Lembar ${w.nomor} berstatus ${w.status.toLowerCase()}; hanya lembar tersedia yang dapat dibatalkan di sini.`);
  await jalankan(conn, "UPDATE warkat SET status = 'BATAL', keterangan = ?, dibatalkan_oleh = ?, dibatalkan_pada = NOW() WHERE id = ?", [String(alasan).trim().slice(0, 255), ctx.user.id, w.id]);
  await perbaruiStatusBukuCek(conn, w.buku_cek_id);
  await catatAudit(conn, ctx, { aksi: 'BATAL', entitas: 'warkat', entitasId: w.id, ringkasan: `Lembar ${w.nomor} dibatalkan: ${alasan}` });
}

router.post('/warkat/:id/batal', perlu('KASIR'), async (req, res) => {
  await tx((conn) => batalkanWarkatKosong(conn, req.ctx, Number(req.params.id), req.body?.alasan));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- dana kas kecil

const skemaDana = z
  .object({
    kode: z.string().trim().regex(/^[A-Z0-9-]{2,20}$/, 'Kode 2 sampai 20 huruf kapital, angka, atau tanda hubung.'),
    nama: teks(100),
    pemegang_id: id(),
    departemen_id: id(),
    akun_id: id(),
    dana_diusulkan: z.coerce.number().positive(),
    batas_transaksi: z.coerce.number().positive(),
    aktif: bool().optional(),
  })
  .refine((d) => d.batas_transaksi <= d.dana_diusulkan, { path: ['batas_transaksi'], message: 'Batas per transaksi tidak boleh melebihi dana.' });

/** Posisi dana kas kecil sistem imprest. */
export async function posisiDana(db, danaId) {
  const d = await satu(db, 'SELECT id, jumlah_dana FROM dana_kas_kecil WHERE id = ?', [danaId]);
  if (!d) throw galatTidakAda('Dana kas kecil tidak ditemukan.');
  const r = await satu(
    db,
    `SELECT
       COALESCE(SUM(CASE WHEN k.status = 'DIBAYAR' THEN k.jumlah END), 0) AS bukti_belum_diganti,
       COALESCE(SUM(CASE WHEN k.status = 'DIBAYAR' AND k.pengisian_id IS NOT NULL
                          AND pi.status IN ('DIAJUKAN','DIPROSES') THEN k.jumlah END), 0) AS dalam_proses_pengisian,
       COALESCE(SUM(CASE WHEN k.status = 'DISETUJUI' THEN k.jumlah END), 0) AS disetujui_belum_dibayar
     FROM pengeluaran_kas_kecil k LEFT JOIN pengisian_kas_kecil pi ON pi.id = k.pengisian_id
     WHERE k.dana_id = ?`,
    [danaId],
  );
  const saldoTunai = dariSen(keSen(d.jumlah_dana) - keSen(r.bukti_belum_diganti));
  return {
    jumlah_dana: d.jumlah_dana,
    bukti_belum_diganti: r.bukti_belum_diganti,
    dalam_proses_pengisian: r.dalam_proses_pengisian,
    disetujui_belum_dibayar: r.disetujui_belum_dibayar,
    saldo_tunai: saldoTunai,
    persen_saldo: d.jumlah_dana > 0 ? Math.round((saldoTunai / d.jumlah_dana) * 1000) / 10 : 0,
  };
}

const DANA_SELECT = `SELECT d.*, u.nama_lengkap AS pemegang_nama, dp.nama AS departemen_nama, a.kode AS akun_kode, a.nama AS akun_nama
  FROM dana_kas_kecil d JOIN pengguna u ON u.id = d.pemegang_id JOIN departemen dp ON dp.id = d.departemen_id JOIN akun a ON a.id = d.akun_id`;

router.get('/dana-kas-kecil', async (_req, res) => {
  const rows = await semua(pool, `${DANA_SELECT} ORDER BY d.kode`);
  for (const r of rows) Object.assign(r, await posisiDana(pool, r.id));
  res.json(rows);
});

router.get('/dana-kas-kecil/:id', async (req, res) => {
  const d = await satu(pool, `${DANA_SELECT} WHERE d.id = ?`, [req.params.id]);
  if (!d) throw galatTidakAda('Dana kas kecil tidak ditemukan.');
  res.json({ ...d, posisi: await posisiDana(pool, d.id) });
});

async function simpanDana(conn, ctx, idDana, input) {
  const data = validasi(skemaDana, input);
  const pemegang = await satu(
    conn,
    "SELECT u.id FROM pengguna u JOIN pengguna_peran pp ON pp.pengguna_id = u.id WHERE u.id = ? AND u.aktif = 1 AND pp.peran_kode = 'KAS_KECIL'",
    [data.pemegang_id],
  );
  if (!pemegang) throw galatMasukan('Pemegang dana harus pengguna aktif berperan Pemegang Kas Kecil.', { pemegang_id: 'Pilih pengguna berperan Pemegang Kas Kecil.' });
  await periksaAkunKas(conn, data.akun_id, null, idDana);
  const nilai = [data.kode, data.nama, data.pemegang_id, data.departemen_id, data.akun_id, data.dana_diusulkan, data.batas_transaksi, data.aktif === false ? 0 : 1];
  if (idDana) {
    const lama = await satu(conn, 'SELECT * FROM dana_kas_kecil WHERE id = ? FOR UPDATE', [idDana]);
    if (!lama) throw galatTidakAda('Dana kas kecil tidak ditemukan.');
    if (lama.akun_id !== data.akun_id && keSen(lama.jumlah_dana) > 0) throw galatMasukan('Akun dana yang sudah dibentuk tidak dapat diganti.', { akun_id: 'Tidak dapat diganti.' });
    await jalankan(
      conn,
      'UPDATE dana_kas_kecil SET kode = ?, nama = ?, pemegang_id = ?, departemen_id = ?, akun_id = ?, dana_diusulkan = ?, batas_transaksi = ?, aktif = ? WHERE id = ?',
      [...nilai, idDana],
    );
    await catatAudit(conn, ctx, { aksi: 'UBAH', entitas: 'dana_kas_kecil', entitasId: idDana, ringkasan: `Dana ${lama.kode} diubah`, sebelum: lama, sesudah: data });
    return idDana;
  }
  if (await satu(conn, 'SELECT id FROM dana_kas_kecil WHERE kode = ?', [data.kode])) throw galatMasukan('Kode dana sudah dipakai.', { kode: 'Kode sudah dipakai.' });
  const r = await jalankan(
    conn,
    'INSERT INTO dana_kas_kecil (kode, nama, pemegang_id, departemen_id, akun_id, dana_diusulkan, batas_transaksi, aktif) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    nilai,
  );
  await catatAudit(conn, ctx, { aksi: 'BUAT', entitas: 'dana_kas_kecil', entitasId: r.insertId, ringkasan: `Dana ${data.kode} ${data.nama}`, sesudah: data });
  return r.insertId;
}

export const buatDana = (conn, ctx, input) => simpanDana(conn, ctx, null, input);

router.post('/dana-kas-kecil', perlu('MANAJER_KEUANGAN'), async (req, res) => {
  res.status(201).json({ id: await tx((conn) => simpanDana(conn, req.ctx, null, req.body)) });
});
router.put('/dana-kas-kecil/:id', perlu('MANAJER_KEUANGAN'), async (req, res) => {
  await tx((conn) => simpanDana(conn, req.ctx, Number(req.params.id), req.body));
  res.json({ ok: true });
});

// Dipakai modul lain
export async function ambilPemasok(db, idPemasok) {
  const p = await satu(db, 'SELECT * FROM pemasok WHERE id = ?', [idPemasok]);
  if (!p) throw galatTidakAda('Pemasok tidak ditemukan.');
  return p;
}

export { PERAN_LIHAT_KAS };
