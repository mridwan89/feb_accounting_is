import { satu } from '../db.js';
import { galatAkses, galatKonflik, galatTidakAda } from './galat.js';

// Registri jenis dokumen: tabel, label, status menunggu persetujuan, dan kait (hook) hasil persetujuan.
const registri = new Map();

export function daftarkanDokumen(jenis, definisi) {
  registri.set(jenis, { jenis, ...definisi });
}

export function definisiDokumen(jenis) {
  const d = registri.get(jenis);
  if (!d) throw galatTidakAda('Jenis dokumen tidak dikenal.');
  return d;
}

export async function kunciBaris(conn, tabel, id, label = 'Dokumen') {
  const row = await satu(conn, `SELECT * FROM ${tabel} WHERE id = ? FOR UPDATE`, [id]);
  if (!row) throw galatTidakAda(`${label} tidak ditemukan.`);
  return row;
}

export async function ambilBaris(db, tabel, id, label = 'Dokumen') {
  const row = await satu(db, `SELECT * FROM ${tabel} WHERE id = ?`, [id]);
  if (!row) throw galatTidakAda(`${label} tidak ditemukan.`);
  return row;
}

export const LABEL_STATUS = {
  DRAFT: 'draf',
  DIAJUKAN: 'diajukan',
  DISETUJUI: 'disetujui',
  DITOLAK: 'ditolak',
  DIPROSES: 'diproses',
  DIBAYAR: 'dibayar',
  BATAL: 'batal',
  SELESAI: 'selesai',
  DIGANTI: 'diganti',
  TERVERIFIKASI: 'terverifikasi',
  MENUNGGU_PERSETUJUAN: 'menunggu persetujuan',
  LUNAS: 'lunas',
  DIBAYAR_SEBAGIAN: 'dibayar sebagian',
  DITERIMA_SEBAGIAN: 'diterima sebagian',
  DITERIMA_PENUH: 'diterima penuh',
  DITUTUP: 'ditutup',
  FINAL: 'final',
  DICATAT: 'dicatat',
};

/** Tolak tindakan bila status dokumen tidak termasuk daftar yang diizinkan. */
export function pastikanStatus(doc, diizinkan, tindakan) {
  if (!diizinkan.includes(doc.status)) {
    const kini = LABEL_STATUS[doc.status] || doc.status;
    throw galatKonflik(`Dokumen ${doc.nomor || ''} berstatus ${kini}, sehingga tidak dapat ${tindakan}.`.replace('  ', ' '));
  }
}

export function pastikanPembuat(ctx, doc) {
  if (doc.dibuat_oleh !== ctx.user.id) throw galatAkses('Hanya pembuat dokumen yang dapat melakukan tindakan ini.');
}

/** Periksa hak lihat dokumen memakai aturan dari registri. */
export async function pastikanBolehLihat(db, user, jenis, id) {
  const def = definisiDokumen(jenis);
  const doc = await ambilBaris(db, def.tabel, id, def.label);
  const boleh = def.bolehLihat ? await def.bolehLihat(db, user, doc) : true;
  if (!boleh) throw galatAkses('Anda tidak berwenang melihat dokumen ini.');
  return { def, doc };
}

export async function jumlahLampiran(db, jenis, id) {
  const r = await satu(db, 'SELECT COUNT(*) AS n FROM lampiran WHERE jenis_dokumen = ? AND dokumen_id = ?', [jenis, id]);
  return r.n;
}
