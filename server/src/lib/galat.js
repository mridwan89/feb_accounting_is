/** Galat bisnis yang pesannya aman ditampilkan ke pengguna. */
export class GalatApp extends Error {
  constructor(status, pesan, detail) {
    super(pesan);
    this.status = status;
    this.detail = detail;
  }
}

export const galatMasukan = (pesan, detail) => new GalatApp(400, pesan, detail);
export const galatAutentikasi = (pesan = 'Sesi Anda berakhir. Silakan masuk kembali.') => new GalatApp(401, pesan);
export const galatAkses = (pesan = 'Anda tidak berwenang melakukan tindakan ini.') => new GalatApp(403, pesan);
export const galatTidakAda = (pesan = 'Data tidak ditemukan.') => new GalatApp(404, pesan);
export const galatKonflik = (pesan) => new GalatApp(409, pesan);
