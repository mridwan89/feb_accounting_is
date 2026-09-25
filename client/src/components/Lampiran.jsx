// Panel lampiran dokumen: daftar berkas, unggah (pilih atau seret), pratinjau PDF/gambar, dan hapus sebelum diajukan.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { waktu } from '../format.js';
import { useAksi, useApi } from './data.js';
import { Ikon } from './Ikon.jsx';
import { Kartu, Modal, Tombol, useKonfirmasi, useToast } from './ui.jsx';

const ukuran = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function PratinjauBerkas({ berkas, onTutup }) {
  useEffect(() => () => URL.revokeObjectURL(berkas.url), [berkas.url]);
  return (
    <Modal
      judul={berkas.nama}
      lebar
      onTutup={onTutup}
      kaki={
        <>
          <a className="tombol" href={berkas.url} download={berkas.nama}>
            <Ikon nama="unduh" /> Unduh berkas
          </a>
          <Tombol varian="utama" onClick={onTutup}>
            Tutup
          </Tombol>
        </>
      }
    >
      {berkas.mime === 'application/pdf' ? (
        <iframe className="pratinjau-berkas" src={berkas.url} title={berkas.nama} />
      ) : (
        <img className="pratinjau-berkas" src={berkas.url} alt={berkas.nama} />
      )}
    </Modal>
  );
}

export function PanelLampiran({ jenis, id, bolehUnggah = false, bolehHapus = false, judul = 'Lampiran', catatan }) {
  const { pengguna } = useAuth();
  const toast = useToast();
  const konfirmasi = useKonfirmasi();
  const q = useApi(id ? `/lampiran/${jenis}/${id}` : null);
  const { jalankan, sibuk } = useAksi();
  const [pratinjau, setPratinjau] = useState(null);
  const [seret, setSeret] = useState(false);
  const inputRef = useRef(null);

  const unggah = async (daftar) => {
    for (const berkas of [...(daftar || [])]) {
      await jalankan(() => api.unggah(`/lampiran/${jenis}/${id}`, berkas), { sukses: `${berkas.name} berhasil diunggah.` });
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const lihat = async (l) => {
    try {
      const blob = await api.blob(`/lampiran-berkas/${l.id}`);
      setPratinjau({ url: URL.createObjectURL(blob), nama: l.nama_asli, mime: l.tipe_mime });
    } catch (e) {
      toast.galat(e.message);
    }
  };

  const hapus = async (l) => {
    const ok = await konfirmasi({ judul: 'Hapus lampiran', pesan: `Berkas ${l.nama_asli} akan dihapus dari dokumen ini.`, label: 'Hapus lampiran', bahaya: true });
    if (ok) await jalankan(() => api.hapus(`/lampiran-berkas/${l.id}`), { sukses: 'Lampiran dihapus.' });
  };

  const daftar = q.data || [];
  return (
    <Kartu judul={`${judul} (${daftar.length})`}>
      {catatan}
      {q.isPending ? (
        <p className="lemah">Memuat lampiran...</p>
      ) : daftar.length === 0 ? (
        <p className="lemah" style={{ margin: 0 }}>
          Belum ada lampiran.
        </p>
      ) : (
        <ul className="daftar-lampiran">
          {daftar.map((l) => (
            <li key={l.id}>
              <Ikon nama="klip" width={16} height={16} style={{ color: 'var(--teks-3)', flex: 'none' }} />
              <div className="berkas">
                <button type="button" onClick={() => lihat(l)}>
                  {l.nama_asli}
                </button>
                <small>
                  {ukuran(l.ukuran)} · {l.diunggah_nama} · {waktu(l.diunggah_pada)}
                </small>
              </div>
              {bolehHapus && l.diunggah_oleh === pengguna?.id && (
                <button type="button" className="tombol-ikon" onClick={() => hapus(l)} aria-label={`Hapus ${l.nama_asli}`} title="Hapus lampiran">
                  <Ikon nama="silang" width={16} height={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {bolehUnggah && (
        <div
          className={`unggah-zona ${seret ? 'aktif' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setSeret(true);
          }}
          onDragLeave={() => setSeret(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSeret(false);
            unggah(e.dataTransfer.files);
          }}
        >
          <div>Seret berkas ke sini, atau</div>
          <label className="tombol kecil" style={{ marginTop: 6 }}>
            <Ikon nama="unggah" /> {sibuk ? 'Mengunggah...' : 'Pilih berkas'}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              multiple
              hidden
              disabled={sibuk}
              onChange={(e) => unggah(e.target.files)}
            />
          </label>
          <div className="kecil sangat-lemah" style={{ marginTop: 6 }}>
            PDF, JPG, atau PNG. Berkas diperiksa dari isinya, bukan dari nama berkas.
          </div>
        </div>
      )}
      {pratinjau && <PratinjauBerkas berkas={pratinjau} onTutup={() => setPratinjau(null)} />}
    </Kartu>
  );
}
