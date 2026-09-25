import { jalankan, satu, semua } from '../db.js';
import { galatAkses, galatKonflik, galatMasukan } from './galat.js';
import { keSen } from './uang.js';
import { namaPeran } from './akses.js';

async function jumlahPenyetuju(conn, peran, departemenId, pembuatId) {
  const params = [peran, pembuatId];
  let sql = `SELECT COUNT(DISTINCT u.id) AS n FROM pengguna u
             JOIN pengguna_peran pp ON pp.pengguna_id = u.id
             WHERE u.aktif = 1 AND pp.peran_kode = ? AND u.id <> ?`;
  if (departemenId) {
    sql += ' AND u.departemen_id = ?';
    params.push(departemenId);
  }
  const r = await satu(conn, sql, params);
  return r.n;
}

async function pengguna(conn, id) {
  const u = await satu(conn, 'SELECT id, departemen_id FROM pengguna WHERE id = ?', [id]);
  const peran = await semua(conn, 'SELECT peran_kode FROM pengguna_peran WHERE pengguna_id = ?', [id]);
  return { ...u, peran: peran.map((p) => p.peran_kode) };
}

/**
 * Mulai putaran persetujuan baru untuk dokumen. Mengembalikan jumlah langkah yang dibuat;
 * 0 berarti tidak ada langkah yang berlaku sehingga dokumen langsung dianggap disetujui.
 */
export async function mulaiPersetujuan(conn, ctx, { jenis, dokumenId, nomor, nilai, ringkasan, pembuatId, departemenId }) {
  const aturan = await semua(
    conn,
    'SELECT * FROM aturan_persetujuan WHERE jenis_dokumen = ? AND aktif = 1 ORDER BY urutan',
    [jenis],
  );
  const pembuat = await pengguna(conn, pembuatId);
  let langkah = [];
  for (const a of aturan) {
    if (!(keSen(nilai) > keSen(a.batas_bawah))) continue;
    let peran = a.peran_kode;
    let lingkup = a.lingkup;
    let dept = lingkup === 'DEPARTEMEN' ? departemenId : null;
    let nama = a.nama_langkah;
    // Pembuat adalah pemegang peran langkah ini di departemen yang sama: alihkan ke peran pengganti.
    if (lingkup === 'DEPARTEMEN' && pembuat.peran.includes(peran) && pembuat.departemen_id === departemenId) {
      if (!a.peran_pengganti_kode) {
        throw galatMasukan(`Aturan persetujuan ${jenis} langkah ${a.urutan} tidak memiliki peran pengganti. Hubungi Administrator.`);
      }
      peran = a.peran_pengganti_kode;
      lingkup = 'GLOBAL';
      dept = null;
      nama = `${a.nama_langkah} (dialihkan ke ${await namaPeran(conn, peran)})`;
    }
    langkah.push({ urutan: a.urutan, nama, peran, lingkup, dept });
  }
  // Langkah dengan peran dan lingkup yang sama dengan langkah sesudahnya cukup diwakili langkah sesudahnya,
  // karena satu orang hanya boleh menyetujui satu langkah.
  langkah = langkah.filter(
    (l, i) => !langkah.slice(i + 1).some((m) => m.peran === l.peran && m.lingkup === l.lingkup && m.dept === l.dept),
  );
  for (const l of langkah) {
    const n = await jumlahPenyetuju(conn, l.peran, l.dept, pembuatId);
    if (n === 0) {
      const dept = l.dept ? await satu(conn, 'SELECT nama FROM departemen WHERE id = ?', [l.dept]) : null;
      throw galatMasukan(
        `Belum ada pengguna aktif berperan ${await namaPeran(conn, l.peran)}${dept ? ` di departemen ${dept.nama}` : ''} yang dapat menyetujui dokumen ini. Hubungi Administrator.`,
      );
    }
  }
  if (langkah.length === 0) return 0;

  const r = await satu(conn, 'SELECT COALESCE(MAX(putaran), 0) AS p FROM persetujuan WHERE jenis_dokumen = ? AND dokumen_id = ?', [jenis, dokumenId]);
  const putaran = r.p + 1;
  await jalankan(
    conn,
    `INSERT INTO persetujuan (jenis_dokumen, dokumen_id, nomor_dokumen, nilai, ringkasan, pembuat_id, departemen_id,
       putaran, urutan, nama_langkah, peran_kode, lingkup) VALUES ?`,
    [
      langkah.map((l) => [
        jenis,
        dokumenId,
        nomor,
        nilai,
        ringkasan ? String(ringkasan).slice(0, 255) : null,
        pembuatId,
        l.dept,
        putaran,
        l.urutan,
        l.nama.slice(0, 100),
        l.peran,
        l.lingkup,
      ]),
    ],
  );
  return langkah.length;
}

function periksaBolehMemutuskan(user, kini, semuaLangkah) {
  if (user.id === kini.pembuat_id) throw galatAkses('Anda pembuat dokumen ini sehingga tidak dapat menyetujui atau menolaknya.');
  if (!user.peran.includes(kini.peran_kode)) throw galatAkses('Langkah persetujuan saat ini bukan wewenang peran Anda.');
  if (kini.lingkup === 'DEPARTEMEN' && user.departemen_id !== kini.departemen_id) {
    throw galatAkses('Dokumen ini milik departemen lain.');
  }
  if (semuaLangkah.some((l) => l.status === 'DISETUJUI' && l.diputuskan_oleh === user.id)) {
    throw galatAkses('Anda sudah menyetujui langkah lain pada dokumen ini. Satu orang hanya menyetujui satu langkah.');
  }
}

async function langkahPutaranTerakhir(conn, jenis, dokumenId, kunci = false) {
  return semua(
    conn,
    `SELECT * FROM persetujuan WHERE jenis_dokumen = ? AND dokumen_id = ?
       AND putaran = (SELECT MAX(putaran) FROM persetujuan WHERE jenis_dokumen = ? AND dokumen_id = ?)
     ORDER BY urutan ${kunci ? 'FOR UPDATE' : ''}`,
    [jenis, dokumenId, jenis, dokumenId],
  );
}

/**
 * Putuskan langkah persetujuan yang sedang berjalan.
 * Hasil: 'LANJUT' (masih ada langkah berikutnya), 'SELESAI' (semua disetujui), atau 'DITOLAK'.
 */
export async function putuskan(conn, ctx, { jenis, dokumenId, keputusan, catatan }) {
  const langkah = await langkahPutaranTerakhir(conn, jenis, dokumenId, true);
  const kini = langkah.find((l) => l.status === 'MENUNGGU');
  if (!kini) throw galatKonflik('Dokumen ini tidak sedang menunggu persetujuan.');
  periksaBolehMemutuskan(ctx.user, kini, langkah);
  const catatanBersih = catatan ? String(catatan).trim().slice(0, 500) : null;

  if (keputusan === 'TOLAK') {
    if (!catatanBersih) throw galatMasukan('Alasan penolakan wajib diisi.', { catatan: 'Wajib diisi.' });
    await jalankan(
      conn,
      "UPDATE persetujuan SET status = 'DITOLAK', diputuskan_oleh = ?, diputuskan_pada = NOW(), catatan = ? WHERE id = ?",
      [ctx.user.id, catatanBersih, kini.id],
    );
    await jalankan(
      conn,
      "UPDATE persetujuan SET status = 'DIBATALKAN' WHERE jenis_dokumen = ? AND dokumen_id = ? AND status = 'MENUNGGU'",
      [jenis, dokumenId],
    );
    return { hasil: 'DITOLAK', langkah: kini };
  }
  if (keputusan !== 'SETUJUI') throw galatMasukan('Keputusan tidak dikenal.');
  await jalankan(
    conn,
    "UPDATE persetujuan SET status = 'DISETUJUI', diputuskan_oleh = ?, diputuskan_pada = NOW(), catatan = ? WHERE id = ?",
    [ctx.user.id, catatanBersih, kini.id],
  );
  const sisa = langkah.filter((l) => l.status === 'MENUNGGU' && l.id !== kini.id);
  return { hasil: sisa.length ? 'LANJUT' : 'SELESAI', langkah: kini };
}

/** Batalkan langkah yang masih menunggu (dokumen ditarik atau dibatalkan). */
export async function batalkanPersetujuan(conn, jenis, dokumenId) {
  await jalankan(
    conn,
    "UPDATE persetujuan SET status = 'DIBATALKAN' WHERE jenis_dokumen = ? AND dokumen_id = ? AND status = 'MENUNGGU'",
    [jenis, dokumenId],
  );
}

export async function riwayatPersetujuan(db, jenis, dokumenId) {
  return semua(
    db,
    `SELECT p.id, p.putaran, p.urutan, p.nama_langkah, p.peran_kode, pr.nama AS peran_nama, p.status,
            p.diputuskan_oleh, u.nama_lengkap AS diputuskan_nama, u.jabatan AS diputuskan_jabatan,
            p.diputuskan_pada, p.catatan, p.dibuat_pada
       FROM persetujuan p
       JOIN peran pr ON pr.kode = p.peran_kode
       LEFT JOIN pengguna u ON u.id = p.diputuskan_oleh
      WHERE p.jenis_dokumen = ? AND p.dokumen_id = ?
      ORDER BY p.putaran, p.urutan`,
    [jenis, dokumenId],
  );
}

/** Id pengguna yang pernah menyetujui langkah mana pun pada dokumen. */
export async function penyetujuDokumen(db, jenis, dokumenId) {
  const rows = await semua(
    db,
    "SELECT DISTINCT diputuskan_oleh FROM persetujuan WHERE jenis_dokumen = ? AND dokumen_id = ? AND status = 'DISETUJUI'",
    [jenis, dokumenId],
  );
  return rows.map((r) => r.diputuskan_oleh);
}

/** Apakah pengguna dapat memutuskan langkah yang sedang berjalan pada dokumen ini? */
export async function bolehMemutuskan(db, user, jenis, dokumenId) {
  const langkah = await langkahPutaranTerakhir(db, jenis, dokumenId);
  const kini = langkah.find((l) => l.status === 'MENUNGGU');
  if (!kini) return false;
  try {
    periksaBolehMemutuskan(user, kini, langkah);
    return true;
  } catch {
    return false;
  }
}

/** Kotak persetujuan: langkah yang sedang menunggu tindakan pengguna ini. */
export async function tugasPersetujuan(db, user) {
  if (!user.peran.length) return [];
  return semua(
    db,
    `SELECT p.id, p.jenis_dokumen, p.dokumen_id, p.nomor_dokumen, p.nilai, p.ringkasan, p.nama_langkah,
            p.putaran, p.urutan, u.nama_lengkap AS pembuat_nama, d.nama AS departemen_nama,
            COALESCE((SELECT MAX(z.diputuskan_pada) FROM persetujuan z
                       WHERE z.jenis_dokumen = p.jenis_dokumen AND z.dokumen_id = p.dokumen_id
                         AND z.putaran = p.putaran AND z.urutan < p.urutan), p.dibuat_pada) AS menunggu_sejak
       FROM persetujuan p
       JOIN pengguna u ON u.id = p.pembuat_id
       LEFT JOIN departemen d ON d.id = p.departemen_id
      WHERE p.status = 'MENUNGGU'
        AND p.peran_kode IN (?)
        AND (p.lingkup = 'GLOBAL' OR p.departemen_id = ?)
        AND p.pembuat_id <> ?
        AND NOT EXISTS (SELECT 1 FROM persetujuan x
                         WHERE x.jenis_dokumen = p.jenis_dokumen AND x.dokumen_id = p.dokumen_id
                           AND x.putaran = p.putaran AND x.urutan < p.urutan AND x.status = 'MENUNGGU')
        AND NOT EXISTS (SELECT 1 FROM persetujuan y
                         WHERE y.jenis_dokumen = p.jenis_dokumen AND y.dokumen_id = p.dokumen_id
                           AND y.putaran = p.putaran AND y.status = 'DISETUJUI' AND y.diputuskan_oleh = ?)
      ORDER BY menunggu_sejak`,
    [user.peran, user.departemen_id, user.id, user.id],
  );
}
