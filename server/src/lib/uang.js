// Perhitungan uang dilakukan dalam satuan sen (bilangan bulat) agar bebas galat pembulatan.

export const keSen = (nilai) => Math.round(Number(nilai || 0) * 100);
export const dariSen = (sen) => sen / 100;

/** Bulatkan ke 2 desimal (setengah ke atas). */
export const bulat2 = (nilai) => dariSen(keSen(nilai));

/** Jumlahkan nilai uang; `ambil` opsional untuk memilih kolom dari objek. */
export function jumlahkan(daftar, ambil = (x) => x) {
  return dariSen(daftar.reduce((acc, x) => acc + keSen(ambil(x)), 0));
}

/** Kuantitas x harga, dibulatkan setengah ke atas ke 2 desimal. Nilai non-negatif. */
export function kali(qty, harga) {
  const q = BigInt(Math.round(Number(qty) * 100));
  const h = BigInt(Math.round(Number(harga) * 100));
  const sen = (q * h + 50n) / 100n;
  return Number(sen) / 100;
}

/** Pajak = dasar x tarif%, dibulatkan ke bawah ke rupiah penuh. Tarif hingga 3 desimal. */
export function hitungPajak(dasar, tarifPersen) {
  const sen = BigInt(keSen(dasar));
  const milli = BigInt(Math.round(Number(tarifPersen) * 1000));
  const pajakSen = (sen * milli) / 100000n;
  return Number(pajakSen / 100n);
}

export const sama = (a, b) => keSen(a) === keSen(b);
export const kurang = (a, b) => dariSen(keSen(a) - keSen(b));
export const tambah = (a, b) => dariSen(keSen(a) + keSen(b));
