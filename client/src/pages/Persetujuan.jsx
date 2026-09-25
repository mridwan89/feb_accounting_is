// Kotak persetujuan: dokumen yang langkah persetujuannya sedang menunggu keputusan pengguna.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { RUTE_DOKUMEN } from '../konstanta.js';
import { hariIni, rupiah, waktu } from '../format.js';
import { useApi } from '../components/data.js';
import { BarisKosong, Kartu, Kepala, Muat } from '../components/ui.jsx';

const lamaMenunggu = (dt) => {
  const hari = Math.round((Date.parse(hariIni()) - Date.parse(String(dt).slice(0, 10))) / 86400000);
  return hari <= 0 ? 'hari ini' : `${hari} hari`;
};

export function HalamanPersetujuan() {
  const q = useApi('/persetujuan/tugas', { refetchInterval: 60_000 });
  const navigate = useNavigate();
  const [jenis, setJenis] = useState('');

  return (
    <>
      <Kepala judul="Kotak persetujuan" sub="Buka dokumen untuk memeriksa isi, lampiran, dan riwayatnya sebelum menyetujui atau menolak." />
      <Muat kueri={q}>
        {(data) => {
          const kelompok = [...new Map(data.map((d) => [d.jenis_dokumen, d.jenis_label])).entries()];
          const tampil = jenis ? data.filter((d) => d.jenis_dokumen === jenis) : data;
          return (
            <Kartu rapat>
              {kelompok.length > 1 && (
                <div className="saring" style={{ alignItems: 'center' }}>
                  <div className="tombol-grup" role="group" aria-label="Saring jenis dokumen">
                    <button type="button" className={jenis === '' ? 'aktif' : ''} onClick={() => setJenis('')}>
                      Semua ({data.length})
                    </button>
                    {kelompok.map(([kode, label]) => (
                      <button type="button" key={kode} className={jenis === kode ? 'aktif' : ''} onClick={() => setJenis(kode)}>
                        {label} ({data.filter((d) => d.jenis_dokumen === kode).length})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="tabel-bungkus">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Dokumen</th>
                      <th>Ringkasan</th>
                      <th>Diajukan oleh</th>
                      <th>Langkah</th>
                      <th className="angka">Nilai</th>
                      <th>Menunggu sejak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tampil.length === 0 && (
                      <BarisKosong kolom={6} judul="Tidak ada dokumen yang menunggu keputusan Anda">
                        Dokumen baru akan muncul di sini ketika langkah persetujuannya sampai pada peran Anda.
                      </BarisKosong>
                    )}
                    {tampil.map((r) => (
                      <tr key={r.id} className="klik" onClick={() => navigate(`${RUTE_DOKUMEN[r.jenis_dokumen]}/${r.dokumen_id}`)}>
                        <td>
                          <div className="nomor">{r.nomor_dokumen}</div>
                          <div className="kecil sangat-lemah">{r.jenis_label}</div>
                        </td>
                        <td>{r.ringkasan}</td>
                        <td>
                          {r.pembuat_nama}
                          {r.departemen_nama && <div className="kecil sangat-lemah">{r.departemen_nama}</div>}
                        </td>
                        <td>
                          {r.nama_langkah}
                          {r.putaran > 1 && <div className="kecil sangat-lemah">Pengajuan ke-{r.putaran}</div>}
                        </td>
                        <td className="angka">{rupiah(r.nilai)}</td>
                        <td className="nowrap">
                          {waktu(r.menunggu_sejak)}
                          <div className="kecil sangat-lemah">{lamaMenunggu(r.menunggu_sejak)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Kartu>
          );
        }}
      </Muat>
    </>
  );
}
