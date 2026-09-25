// Lapisan akses API: menyisipkan token sesi, menerjemahkan galat, dan memberi tahu aplikasi saat sesi berakhir.
const KUNCI_TOKEN = 'siapkas.token';

export const sesi = {
  ambil: () => sessionStorage.getItem(KUNCI_TOKEN),
  simpan: (t) => sessionStorage.setItem(KUNCI_TOKEN, t),
  hapus: () => sessionStorage.removeItem(KUNCI_TOKEN),
};

export class GalatApi extends Error {
  constructor(status, pesan, galat, kode) {
    super(pesan);
    this.status = status;
    this.galat = galat || {};
    this.kode = kode;
  }
}

let penanganSesi = () => {};
export function aturPenanganSesi(fn) {
  penanganSesi = fn;
}

async function minta(metode, url, body, { mentah = false } = {}) {
  const headers = {};
  const token = sesi.ambil();
  if (token) headers.Authorization = `Bearer ${token}`;
  let isi;
  if (body instanceof FormData) isi = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    isi = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${url}`, { method: metode, headers, body: isi });
  } catch {
    throw new GalatApi(0, 'Tidak dapat terhubung ke server. Periksa sambungan jaringan kantor, lalu coba lagi.');
  }
  if (res.ok && mentah) return res;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const galat = new GalatApi(res.status, data?.pesan || `Permintaan gagal (kode ${res.status}).`, data?.galat, data?.kode);
    if (res.status === 401 && url !== '/auth/masuk') penanganSesi('KELUAR', galat);
    if (res.status === 403 && data?.kode === 'GANTI_SANDI') penanganSesi('GANTI_SANDI', galat);
    throw galat;
  }
  return data;
}

export const api = {
  get: (url) => minta('GET', url),
  post: (url, body = {}) => minta('POST', url, body),
  put: (url, body = {}) => minta('PUT', url, body),
  hapus: (url) => minta('DELETE', url),
  unggah: (url, berkas) => {
    const fd = new FormData();
    fd.append('berkas', berkas);
    return minta('POST', url, fd);
  },
  blob: async (url) => (await minta('GET', url, undefined, { mentah: true })).blob(),
};

/** Susun query string dari objek, mengabaikan nilai kosong. */
export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}
