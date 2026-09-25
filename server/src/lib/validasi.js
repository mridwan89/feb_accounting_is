import { z } from 'zod';
import { galatMasukan } from './galat.js';

// Pesan validasi dalam bahasa Indonesia yang mudah dipahami pengguna.
z.config({
  customError: (iss) => {
    if (iss.code === 'invalid_type') {
      if (iss.input === undefined || iss.input === null || iss.input === '') return 'Wajib diisi.';
      if (iss.expected === 'number') return 'Harus berupa angka.';
      if (iss.expected === 'array') return 'Daftar tidak valid.';
      return 'Isian tidak valid.';
    }
    if (iss.code === 'too_small') {
      if (iss.origin === 'string') return iss.minimum <= 1 ? 'Wajib diisi.' : `Minimal ${iss.minimum} karakter.`;
      if (iss.origin === 'array') return iss.minimum <= 1 ? 'Minimal satu baris.' : `Minimal ${iss.minimum} baris.`;
      if (iss.origin === 'number') return iss.inclusive ? `Minimal ${iss.minimum}.` : `Harus lebih dari ${iss.minimum}.`;
    }
    if (iss.code === 'too_big') {
      if (iss.origin === 'string') return `Maksimal ${iss.maximum} karakter.`;
      if (iss.origin === 'number') return `Maksimal ${iss.maximum}.`;
      if (iss.origin === 'array') return `Maksimal ${iss.maximum} baris.`;
    }
    if (iss.code === 'invalid_value') return 'Pilihan tidak valid.';
    return undefined;
  },
});

export { z };

export const tanggal = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus TTTT-BB-HH.');
export const uang = () => z.coerce.number().refine((v) => Number.isFinite(v), 'Harus berupa angka.');
export const uangPositif = () => uang().refine((v) => v > 0, 'Harus lebih dari 0.');
export const id = () => z.coerce.number().int().positive();
export const idOpsional = () =>
  z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), z.coerce.number().int().positive().nullable());
export const teks = (maks = 255) => z.string().trim().min(1).max(maks);
export const teksOpsional = (maks = 255) =>
  z.preprocess((v) => (v === undefined || v === null ? null : String(v).trim() || null), z.string().max(maks).nullable());

/** Validasi data; bila gagal lempar galat 400 dengan pesan per kolom. */
export function validasi(skema, data) {
  const hasil = skema.safeParse(data ?? {});
  if (hasil.success) return hasil.data;
  const galat = {};
  for (const isu of hasil.error.issues) {
    const kunci = isu.path.join('.') || '_';
    if (!galat[kunci]) galat[kunci] = isu.message;
  }
  throw galatMasukan('Periksa kembali isian yang ditandai.', galat);
}

/** Boolean yang juga menerima 'true'/'false'/'1'/'0' dari formulir. */
export const bool = () =>
  z.preprocess((v) => {
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    if (v === false || v === 'false' || v === 0 || v === '0') return false;
    return v;
  }, z.boolean());

/** Tanggal opsional: string kosong dianggap null. */
export const tanggalOpsional = () =>
  z.preprocess((v) => (v === undefined || v === null || v === '' ? null : v), tanggal().nullable());
