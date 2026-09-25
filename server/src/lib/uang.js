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

/**
 * Bagi `total` sebanding `bobot` (daftar nilai uang). Pembagian dalam rupiah penuh bila total bulat rupiah,
 * sisa pembulatan masuk ke bobot terbesar sehingga jumlah hasil selalu sama persis dengan total.
 */
export function bagiProporsional(total, bobot) {
  const unit = keSen(total) % 100 === 0 ? 100n : 1n;
  const t = BigInt(keSen(total)) / unit;
  const b = bobot.map((x) => BigInt(keSen(x)));
  const jumlahBobot = b.reduce((a, x) => a + x, 0n);
  if (jumlahBobot === 0n) return bobot.map(() => 0);
  const hasil = b.map((x) => (t * x) / jumlahBobot);
  const sisa = t - hasil.reduce((a, x) => a + x, 0n);
  let terbesar = 0;
  b.forEach((x, i) => {
    if (x > b[terbesar]) terbesar = i;
  });
  hasil[terbesar] += sisa;
  return hasil.map((x) => Number(x * unit) / 100);
}

/** Tarif pajak efektif: tarif dinaikkan sekian persen bila penerima tanpa NPWP (PPh 23: 100%, PPh 21: 20%). */
export function tarifEfektif(pajak, tanpaNpwp) {
  const naik = tanpaNpwp ? Number(pajak.persen_naik_tanpa_npwp || 0) : 0;
  return Math.round(Number(pajak.tarif) * (100 + naik) * 10) / 1000;
}

export const sama = (a, b) => keSen(a) === keSen(b);
export const kurang = (a, b) => dariSen(keSen(a) - keSen(b));
export const tambah = (a, b) => dariSen(keSen(a) + keSen(b));
