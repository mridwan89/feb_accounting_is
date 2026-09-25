import { jalankan } from '../db.js';
import { galatKonflik } from './galat.js';
import { catatAudit } from './audit.js';
import { definisiDokumen, kunciBaris } from './dokumen.js';
import { mulaiPersetujuan, putuskan } from './persetujuan.js';

/**
 * Ajukan dokumen ke alur persetujuan. Bila tidak ada langkah yang berlaku (nilai di bawah semua batas),
 * dokumen langsung dianggap disetujui melalui kait onDisetujui.
 */
export async function ajukanDokumen(conn, ctx, { jenis, doc, nilai, ringkasan, departemenId }) {
  const def = definisiDokumen(jenis);
  const jumlahLangkah = await mulaiPersetujuan(conn, ctx, {
    jenis,
    dokumenId: doc.id,
    nomor: doc.nomor,
    nilai,
    ringkasan,
    pembuatId: doc.dibuat_oleh,
    departemenId,
  });
  if (jumlahLangkah === 0) {
    await def.onDisetujui(conn, ctx, doc);
    return { status: 'DISETUJUI', langkah: 0 };
  }
  await jalankan(conn, `UPDATE ${def.tabel} SET status = ? WHERE id = ?`, [def.statusMenunggu, doc.id]);
  return { status: def.statusMenunggu, langkah: jumlahLangkah };
}

/** Proses keputusan setuju/tolak atas dokumen yang sedang menunggu persetujuan. */
export async function prosesKeputusan(conn, ctx, { jenis, dokumenId, keputusan, catatan }) {
  const def = definisiDokumen(jenis);
  const doc = await kunciBaris(conn, def.tabel, dokumenId, def.label);
  if (doc.status !== def.statusMenunggu) throw galatKonflik(`${def.label} ${doc.nomor} tidak sedang menunggu persetujuan.`);
  const h = await putuskan(conn, ctx, { jenis, dokumenId, keputusan, catatan });
  if (h.hasil === 'SELESAI') await def.onDisetujui(conn, ctx, doc);
  if (h.hasil === 'DITOLAK') await def.onDitolak(conn, ctx, doc, catatan);
  await catatAudit(conn, ctx, {
    aksi: keputusan === 'SETUJUI' ? 'SETUJUI' : 'TOLAK',
    entitas: def.tabel,
    entitasId: dokumenId,
    ringkasan: `${def.label} ${doc.nomor}: ${h.langkah.nama_langkah} ${keputusan === 'SETUJUI' ? 'disetujui' : 'ditolak'}${catatan ? `. Catatan: ${catatan}` : ''}`,
  });
  return { hasil: h.hasil };
}
