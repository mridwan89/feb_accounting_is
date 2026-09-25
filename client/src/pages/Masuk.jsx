// Halaman masuk dan halaman ganti kata sandi (termasuk ganti wajib pada masuk pertama).
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Kartu, Kepala, Kolom, Masukan, Pesan, Tombol, useToast } from '../components/ui.jsx';

export function HalamanMasuk() {
  const { masuk, pesan, perusahaan } = useAuth();
  const [cari] = useSearchParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    document.title = 'Masuk | SIAPKas';
  }, []);

  const kirim = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setGalat('Isi nama pengguna dan kata sandi.');
      return;
    }
    setSibuk(true);
    setGalat('');
    try {
      await masuk(username.trim(), password);
      const ke = cari.get('ke');
      navigate(ke && ke.startsWith('/') && !ke.startsWith('//') ? ke : '/', { replace: true });
    } catch (err) {
      setGalat(err.message);
      setPassword('');
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="halaman-masuk">
      <div className="panel-merek">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <img src="/ikon.svg" alt="" width="40" height="40" />
          <strong style={{ color: '#fff', fontSize: 18 }}>SIAPKas</strong>
        </div>
        <div>
          <h1>Pengeluaran kas yang tercatat dari permintaan sampai rekonsiliasi bank</h1>
          <p>Setiap pembayaran berangkat dari dokumen sumber, melewati persetujuan berjenjang, dan meninggalkan jejak audit yang dapat ditelusuri.</p>
        </div>
        <div className="kecil" style={{ color: '#8fa1b8' }}>
          {perusahaan?.perusahaan_nama || 'Sistem Informasi Akuntansi Pengeluaran Kas'}
        </div>
      </div>
      <div className="panel-form">
        <form onSubmit={kirim} noValidate>
          <div>
            <h2 style={{ fontSize: 20 }}>Masuk ke SIAPKas</h2>
            <p className="lemah" style={{ marginTop: 4 }}>
              Gunakan akun yang diberikan Administrator Sistem.
            </p>
          </div>
          {pesan && !galat && <Pesan jenis="peringatan">{pesan}</Pesan>}
          {galat && <Pesan jenis="galat">{galat}</Pesan>}
          <Kolom label="Nama pengguna" lebar={12}>
            <Masukan value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          </Kolom>
          <Kolom label="Kata sandi" lebar={12}>
            <Masukan type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Kolom>
          <Tombol type="submit" varian="utama" sibuk={sibuk} style={{ width: '100%', height: 40 }}>
            Masuk
          </Tombol>
          <p className="kecil sangat-lemah" style={{ margin: 0 }}>
            Akun terkunci sementara setelah beberapa kali salah kata sandi. Lupa kata sandi? Hubungi Administrator Sistem untuk mengatur ulang.
          </p>
        </form>
      </div>
    </div>
  );
}

export function HalamanGantiSandi() {
  const { pengguna, perbaruiPengguna, keluar } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [nilai, setNilai] = useState({ lama: '', baru: '', ulang: '' });
  const [galat, setGalat] = useState({});
  const [sibuk, setSibuk] = useState(false);
  const wajib = pengguna?.harus_ganti_password;
  const atur = (k) => (e) => {
    setNilai((n) => ({ ...n, [k]: e.target.value }));
    setGalat((g) => ({ ...g, [k]: undefined }));
  };

  const kirim = async (e) => {
    e.preventDefault();
    const g = {};
    if (!nilai.lama) g.lama = 'Wajib diisi.';
    if (!nilai.baru) g.baru = 'Wajib diisi.';
    if (nilai.baru && nilai.ulang !== nilai.baru) g.ulang = 'Belum sama dengan kata sandi baru.';
    if (Object.keys(g).length) {
      setGalat(g);
      return;
    }
    setSibuk(true);
    try {
      const r = await api.post('/auth/ganti-sandi', { password_lama: nilai.lama, password_baru: nilai.baru });
      perbaruiPengguna(r.pengguna);
      toast.sukses('Kata sandi berhasil diganti. Sesi Anda di komputer lain sudah diakhiri.');
      navigate('/', { replace: true });
    } catch (err) {
      setGalat({ lama: err.galat?.password_lama, baru: err.galat?.password_baru, umum: err.galat?.password_lama || err.galat?.password_baru ? '' : err.message });
    } finally {
      setSibuk(false);
    }
  };

  const isi = (
    <form onSubmit={kirim} noValidate className="formulir kotak-sandi" style={{ gridTemplateColumns: '1fr' }}>
      {wajib && (
        <Pesan jenis="peringatan" judul="Ganti kata sandi sebelum melanjutkan">
          Kata sandi Anda baru dibuat atau diatur ulang oleh Administrator. Buat kata sandi pribadi yang hanya Anda ketahui.
        </Pesan>
      )}
      {galat.umum && <Pesan jenis="galat">{galat.umum}</Pesan>}
      <Kolom label="Kata sandi lama" galat={galat.lama} lebar={12}>
        <Masukan type="password" value={nilai.lama} onChange={atur('lama')} salah={!!galat.lama} autoComplete="current-password" autoFocus />
      </Kolom>
      <Kolom label="Kata sandi baru" galat={galat.baru} bantuan="Minimal 8 karakter, memuat huruf dan angka, dan tidak memuat nama pengguna." lebar={12}>
        <Masukan type="password" value={nilai.baru} onChange={atur('baru')} salah={!!galat.baru} autoComplete="new-password" />
      </Kolom>
      <Kolom label="Ulangi kata sandi baru" galat={galat.ulang} lebar={12}>
        <Masukan type="password" value={nilai.ulang} onChange={atur('ulang')} salah={!!galat.ulang} autoComplete="new-password" />
      </Kolom>
      <div className="baris-aksi" style={{ justifyContent: 'flex-start' }}>
        <Tombol type="submit" varian="utama" sibuk={sibuk}>
          Simpan kata sandi baru
        </Tombol>
        {wajib ? (
          <Tombol varian="hantu" onClick={() => keluar()}>
            Keluar
          </Tombol>
        ) : (
          <Tombol varian="hantu" onClick={() => navigate(-1)}>
            Batal
          </Tombol>
        )}
      </div>
    </form>
  );

  if (wajib) {
    return (
      <div className="halaman-masuk" style={{ gridTemplateColumns: '1fr' }}>
        <div className="panel-form">
          <div style={{ width: 'min(440px, 100%)' }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Halo, {pengguna.nama_lengkap}</h2>
            {isi}
          </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <Kepala judul="Ganti kata sandi" sub="Kata sandi baru berlaku segera. Sesi Anda di komputer lain akan diakhiri." />
      <Kartu className="halaman-kecil">{isi}</Kartu>
    </>
  );
}
