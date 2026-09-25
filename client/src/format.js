// Format angka, Rupiah, tanggal, dan terbilang gaya Indonesia.

const f0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1250000 -> "1.250.000"; 1250000.5 -> "1.250.000,50". */
export function angka(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '-';
  const v = Number(nilai);
  if (!Number.isFinite(v)) return '-';
  return Math.round(v * 100) % 100 === 0 ? f0.format(v) : f2.format(v);
}

/** "Rp1.250.000" (tanpa spasi, sesuai gaya penulisan Rupiah). */
export function rupiah(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '-';
  const v = Number(nilai);
  return `${v < 0 ? '-' : ''}Rp${angka(Math.abs(v))}`;
}

/** Angka ringkas untuk sumbu grafik: 1,2 jt / 350 rb / 4,5 M. */
export function ringkas(nilai) {
  const v = Math.abs(Number(nilai) || 0);
  const tanda = Number(nilai) < 0 ? '-' : '';
  const f = (x) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(x);
  if (v >= 1e12) return `${tanda}${f(v / 1e12)} T`;
  if (v >= 1e9) return `${tanda}${f(v / 1e9)} M`;
  if (v >= 1e6) return `${tanda}${f(v / 1e6)} jt`;
  if (v >= 1e3) return `${tanda}${f(v / 1e3)} rb`;
  return `${tanda}${f(v)}`;
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2026-09-25" -> "25 Sep 2026" atau "25 September 2026". */
export function tanggal(tgl, panjang = false) {
  if (!tgl) return '-';
  const [y, m, d] = String(tgl).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '-';
  return `${d} ${(panjang ? BULAN : BULAN_PENDEK)[m - 1]} ${y}`;
}

/** "2026-09-25 14:30:05" -> "25 Sep 2026 14.30". */
export function waktu(dt) {
  if (!dt) return '-';
  const s = String(dt);
  return `${tanggal(s.slice(0, 10))} ${s.slice(11, 16).replace(':', '.')}`;
}

export const namaBulan = (bulan) => BULAN[bulan - 1];
export const bulanPendek = (bulan) => BULAN_PENDEK[bulan - 1];

export function hariIni() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function tambahHari(tgl, n) {
  const [y, m, d] = tgl.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function awalBulanIni() {
  return `${hariIni().slice(0, 8)}01`;
}

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

function eja(n) {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${eja(n - 10)} belas`;
  if (n < 100) return `${eja(Math.floor(n / 10))} puluh${n % 10 ? ` ${eja(n % 10)}` : ''}`;
  if (n < 200) return `seratus${n - 100 ? ` ${eja(n - 100)}` : ''}`;
  if (n < 1000) return `${eja(Math.floor(n / 100))} ratus${n % 100 ? ` ${eja(n % 100)}` : ''}`;
  if (n < 2000) return `seribu${n - 1000 ? ` ${eja(n - 1000)}` : ''}`;
  const tingkat = [
    [1e12, 'triliun'],
    [1e9, 'miliar'],
    [1e6, 'juta'],
    [1e3, 'ribu'],
  ];
  for (const [besar, nama] of tingkat) {
    if (n >= besar) {
      const depan = Math.floor(n / besar);
      const sisa = n % besar;
      return `${eja(depan)} ${nama}${sisa ? ` ${eja(sisa)}` : ''}`;
    }
  }
  return '';
}

/** Terbilang Rupiah: 1250000 -> "Satu juta dua ratus lima puluh ribu rupiah". */
export function terbilang(nilai) {
  const sen = Math.round(Math.abs(Number(nilai) || 0) * 100);
  const rp = Math.floor(sen / 100);
  const s = sen % 100;
  let teks = `${rp === 0 ? 'nol' : eja(rp)} rupiah`;
  if (s) teks += ` ${eja(s)} sen`;
  if (Number(nilai) < 0) teks = `minus ${teks}`;
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

/** Ubah teks masukan uang gaya Indonesia ("1.250.000,50") menjadi angka. */
export function uraiUang(teks) {
  if (teks === null || teks === undefined) return '';
  const bersih = String(teks).replace(/\s|Rp/gi, '').replace(/\./g, '').replace(',', '.');
  if (bersih === '' || bersih === '-') return '';
  const v = Number(bersih);
  return Number.isFinite(v) ? v : '';
}

/** Jumlahkan dalam satuan sen agar bebas galat pembulatan. */
export function jumlahkan(daftar, ambil = (x) => x) {
  return daftar.reduce((a, x) => a + Math.round(Number(ambil(x) || 0) * 100), 0) / 100;
}

export function kali(qty, harga) {
  return Math.round(Number(qty || 0) * Number(harga || 0) * 100) / 100;
}

/** Pajak = dasar x tarif%, dibulatkan ke bawah ke rupiah penuh (sama dengan perhitungan server). */
export function hitungPajak(dasar, tarifPersen) {
  const sen = BigInt(Math.round(Number(dasar || 0) * 100));
  const milli = BigInt(Math.round(Number(tarifPersen || 0) * 1000));
  return Number((sen * milli) / 100000n / 100n);
}
