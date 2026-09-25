import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 16384;
const R = 8;
const P = 1;
const PANJANG = 64;

/** Format: scrypt$N$r$p$garam(base64)$hash(base64) */
export async function hashSandi(sandi) {
  const garam = randomBytes(16);
  const hash = await scryptAsync(sandi, garam, PANJANG, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${garam.toString('base64')}$${hash.toString('base64')}`;
}

export async function cocokSandi(sandi, tersimpan) {
  const bagian = String(tersimpan || '').split('$');
  if (bagian.length !== 6 || bagian[0] !== 'scrypt') return false;
  const [, n, r, p, garamB64, hashB64] = bagian;
  const target = Buffer.from(hashB64, 'base64');
  const hasil = await scryptAsync(sandi, Buffer.from(garamB64, 'base64'), target.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return hasil.length === target.length && timingSafeEqual(hasil, target);
}

/** Kembalikan pesan galat bila kata sandi melanggar kebijakan, atau null bila memenuhi. */
export function periksaKebijakanSandi(sandi, username, panjangMin = 8) {
  if (typeof sandi !== 'string' || sandi.length < panjangMin) return `Kata sandi minimal ${panjangMin} karakter.`;
  if (!/[A-Za-z]/.test(sandi) || !/[0-9]/.test(sandi)) return 'Kata sandi harus memuat huruf dan angka.';
  if (username && sandi.toLowerCase().includes(String(username).toLowerCase())) {
    return 'Kata sandi tidak boleh memuat nama pengguna.';
  }
  return null;
}

export const buatToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
