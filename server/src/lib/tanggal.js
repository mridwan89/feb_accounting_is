// Utilitas tanggal berbasis teks 'YYYY-MM-DD' dalam zona WIB, tanpa terpengaruh zona waktu mesin.

let hariIniTetap = process.env.SIAPKAS_HARI_INI || null;

/** Untuk uji dan data demo: kunci "hari ini" ke tanggal tertentu (null = tanggal nyata). */
export function aturHariIni(tgl) {
  hariIniTetap = tgl || null;
}

export function hariIni() {
  if (hariIniTetap) return hariIniTetap;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const keUtc = (tgl) => {
  const [y, m, d] = tgl.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const dariUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

export const tambahHari = (tgl, n) => dariUtc(keUtc(tgl) + n * 86400000);
export const selisihHari = (dari, sampai) => Math.round((keUtc(sampai) - keUtc(dari)) / 86400000);

export function akhirBulan(tahun, bulan) {
  return dariUtc(Date.UTC(tahun, bulan, 0));
}
export function awalBulan(tahun, bulan) {
  return `${tahun}-${String(bulan).padStart(2, '0')}-01`;
}
export function pecah(tgl) {
  const [tahun, bulan] = tgl.split('-').map(Number);
  return { tahun, bulan };
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const namaBulan = (bulan) => NAMA_BULAN[bulan - 1];
export const namaPeriode = (tahun, bulan) => `${namaBulan(bulan)} ${tahun}`;
