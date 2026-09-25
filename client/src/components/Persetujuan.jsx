// Panel riwayat persetujuan elektronik beserta tombol setujui/tolak bagi penyetuju yang berwenang.
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';
import { waktu } from '../format.js';
import { useAksi } from './data.js';
import { AreaTeks, Kartu, Kolom, Pesan, Status, Tombol } from './ui.jsx';

const HASIL = {
  LANJUT: 'Dokumen disetujui dan diteruskan ke langkah persetujuan berikutnya.',
  SELESAI: 'Dokumen disetujui. Seluruh langkah persetujuan sudah lengkap.',
  DITOLAK: 'Dokumen ditolak dan dikembalikan kepada pembuatnya.',
};

export function Linimasa({ riwayat }) {
  if (!riwayat?.length) return <p className="lemah">Belum ada langkah persetujuan. Langkah dibuat saat dokumen diajukan.</p>;
  const putaran = [...new Set(riwayat.map((r) => r.putaran))];
  return putaran.map((p) => (
    <div key={p} style={{ marginBottom: 8 }}>
      {putaran.length > 1 && <div className="kecil lemah tebal" style={{ margin: '4px 0' }}>Pengajuan ke-{p}</div>}
      <ol className="linimasa">
        {riwayat
          .filter((r) => r.putaran === p)
          .map((r) => (
            <li key={r.id}>
              <span className={`titik ${r.status}`} aria-hidden="true" />
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{r.nama_langkah}</strong>
                  <Status kode={r.status} />
                </div>
                <div className="kecil lemah">
                  {r.peran_nama}
                  {r.diputuskan_nama && (
                    <>
                      {' '}
                      · {r.diputuskan_nama}
                      {r.diputuskan_jabatan ? `, ${r.diputuskan_jabatan}` : ''} · {waktu(r.diputuskan_pada)}
                    </>
                  )}
                </div>
                {r.catatan && <div className="catatan">{r.catatan}</div>}
              </div>
            </li>
          ))}
      </ol>
    </div>
  ));
}

export function PanelPersetujuan({ jenis, id, riwayat, boleh, sebelumSetuju }) {
  const { jalankan, sibuk } = useAksi();
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState('');

  const putuskan = async (aksi) => {
    if (aksi === 'tolak' && !catatan.trim()) {
      setGalat('Tulis alasan penolakan agar pembuat dapat memperbaikinya.');
      return;
    }
    const r = await jalankan(() => api.post(`/persetujuan/${jenis}/${id}/${aksi}`, { catatan }), { sukses: (h) => HASIL[h.hasil] });
    if (r.ok) setCatatan('');
  };

  return (
    <Kartu judul="Persetujuan">
      <Linimasa riwayat={riwayat} />
      {boleh && (
        <div style={{ borderTop: '1px solid var(--garis)', paddingTop: 12, marginTop: 4 }}>
          <Pesan jenis="info">Dokumen ini menunggu keputusan Anda. Periksa isi, lampiran, dan dokumen dasarnya sebelum memutuskan.</Pesan>
          {sebelumSetuju}
          <Kolom label="Catatan" opsional bantuan="Wajib diisi bila menolak." galat={galat} lebar={12}>
            <AreaTeks
              value={catatan}
              salah={!!galat}
              maxLength={500}
              onChange={(e) => {
                setCatatan(e.target.value);
                setGalat('');
              }}
            />
          </Kolom>
          <div className="baris-aksi">
            <Tombol varian="bahaya" onClick={() => putuskan('tolak')} disabled={sibuk}>
              Tolak dokumen
            </Tombol>
            <Tombol varian="sukses" onClick={() => putuskan('setujui')} sibuk={sibuk}>
              Setujui dokumen
            </Tombol>
          </div>
          <div className="kecil lemah" style={{ textAlign: 'right', marginTop: 6 }}>
            <Link to="/persetujuan">Kembali ke kotak persetujuan</Link>
          </div>
        </div>
      )}
    </Kartu>
  );
}
