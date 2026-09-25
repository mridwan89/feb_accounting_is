// Bagian yang berulang di halaman dokumen: penyaring daftar di URL, editor baris rincian, tombol cetak, dan aksi umum.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, qs } from '../api.js';
import { useAksi } from './data.js';
import { Ikon } from './Ikon.jsx';
import { Kolom, Masukan, Pilihan, TautanTombol, Tombol, useKonfirmasi } from './ui.jsx';

/** Penyaring daftar yang disimpan di URL agar bisa dibagikan dan bertahan saat kembali dari halaman detail. */
export function useSaring(kunci = ['status', 'cari', 'dari', 'sampai']) {
  const [params, setParams] = useSearchParams();
  const nilai = Object.fromEntries(kunci.map((k) => [k, params.get(k) || '']));
  const aturBanyak = (obj) => {
    const baru = new URLSearchParams(params);
    for (const [k, v] of Object.entries(obj)) {
      if (v === '' || v === null || v === undefined) baru.delete(k);
      else baru.set(k, v);
    }
    // Penyaring berubah: kembali ke halaman pertama.
    if (!('halaman' in obj)) baru.delete('halaman');
    setParams(baru, { replace: true });
  };
  const atur = (k, v) => aturBanyak({ [k]: v });
  return { nilai, atur, aturBanyak, qs: qs(nilai) };
}

export function SaringDaftar({ saring, status, tanggal = true, cari = true, placeholder = 'Nomor, nama, atau keterangan', children }) {
  const [teks, setTeks] = useState(saring.nilai.cari || '');
  useEffect(() => {
    const t = setTimeout(() => {
      if (teks !== (saring.nilai.cari || '')) saring.atur('cari', teks.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [teks]);
  return (
    <div className="saring">
      {cari && (
        <Kolom label="Cari" className="lebar">
          <Masukan type="search" value={teks} placeholder={placeholder} onChange={(e) => setTeks(e.target.value)} />
        </Kolom>
      )}
      {status && (
        <Kolom label="Status">
          <Pilihan pilihan={status} kosong="Semua status" value={saring.nilai.status} onChange={(e) => saring.atur('status', e.target.value)} />
        </Kolom>
      )}
      {tanggal && (
        <>
          <Kolom label="Dari tanggal">
            <Masukan type="date" value={saring.nilai.dari} onChange={(e) => saring.atur('dari', e.target.value)} />
          </Kolom>
          <Kolom label="Sampai tanggal">
            <Masukan type="date" value={saring.nilai.sampai} onChange={(e) => saring.atur('sampai', e.target.value)} />
          </Kolom>
        </>
      )}
      {children}
    </div>
  );
}

/**
 * Editor baris rincian. kolom: [{ kunci, label, lebar?, angka?, isi: (baris, ubah, galat, i) => elemen }].
 * Galat server berbentuk `${awalan}.${i}.${kunci}`.
 */
export function EditorBaris({ baris, setBaris, kolom, barisBaru, galat = {}, awalan = 'baris', minimal = 1, maksimal = 100, tambahLabel = 'Tambah baris', kaki }) {
  const ubah = (i) => (k, v) => setBaris(baris.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  return (
    <div className="tabel-bungkus">
      <table className="tabel editor-baris">
        <thead>
          <tr>
            <th style={{ width: 36 }}>No</th>
            {kolom.map((k) => (
              <th key={k.kunci} className={k.angka ? 'angka' : ''} style={k.lebar ? { width: k.lebar } : undefined}>
                {k.label}
              </th>
            ))}
            <th className="aksi" aria-label="Aksi" />
          </tr>
        </thead>
        <tbody>
          {baris.map((b, i) => (
            <tr key={b._kunci || i}>
              <td className="sangat-lemah">{i + 1}</td>
              {kolom.map((k) => {
                const g = galat[`${awalan}.${i}.${k.kunci}`];
                return (
                  <td key={k.kunci}>
                    {k.isi(b, ubah(i), g, i)}
                    {g && <div className="kecil teks-bahaya">{g}</div>}
                  </td>
                );
              })}
              <td className="aksi">
                {baris.length > minimal && (
                  <button type="button" className="tombol-ikon" aria-label={`Hapus baris ${i + 1}`} title="Hapus baris" onClick={() => setBaris(baris.filter((_, j) => j !== i))}>
                    <Ikon nama="silang" width={16} height={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        {kaki}
      </table>
      {barisBaru && baris.length < maksimal && (
        <div style={{ padding: '8px 0' }}>
          <Tombol kecil ikon="tambah" onClick={() => setBaris([...baris, { ...barisBaru(), _kunci: `${Date.now()}-${Math.random()}` }])}>
            {tambahLabel}
          </Tombol>
        </div>
      )}
      {galat[awalan] && <div className="kecil teks-bahaya">{galat[awalan]}</div>}
    </div>
  );
}

export function TombolCetak({ jenis, id, label = 'Cetak', varian = '' }) {
  return (
    <TautanTombol ke={`/cetak/${jenis}/${id}`} ikon="cetak" varian={varian}>
      {label}
    </TautanTombol>
  );
}

/** Aksi umum dokumen: ajukan dan batalkan dengan alasan. */
export function useAksiDokumen(dasar, id, label = 'Dokumen') {
  const { jalankan, sibuk } = useAksi();
  const konfirmasi = useKonfirmasi();
  const ajukan = () =>
    jalankan(() => api.post(`${dasar}/${id}/ajukan`), {
      sukses: (h) =>
        h?.status === 'DISETUJUI' && h?.langkah === 0
          ? `${label} langsung disetujui karena nilainya di bawah batas persetujuan.`
          : `${label} diajukan dan menunggu persetujuan.`,
    });
  const batal = async (opsi = {}) => {
    const r = await konfirmasi({
      judul: opsi.judul || `Batalkan ${label.toLowerCase()}`,
      pesan: opsi.pesan || `${label} yang dibatalkan tetap tersimpan dengan status Batal dan tidak dapat diproses lagi.`,
      label: opsi.labelTombol || `Batalkan ${label.toLowerCase()}`,
      bahaya: true,
      alasan: { label: 'Alasan pembatalan' },
    });
    if (!r) return { ok: false };
    return jalankan(() => api.post(`${opsi.url || `${dasar}/${id}/batal`}`, { alasan: r.alasan, ...(opsi.data || {}) }), { sukses: opsi.sukses || `${label} dibatalkan.` });
  };
  return { ajukan, batal, jalankan, sibuk, konfirmasi };
}
