// Kerangka aplikasi: menu samping sesuai peran, bilah atas berisi identitas pengguna, dan area isi halaman.
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth.jsx';
import { MENU, PERAN_PENYETUJU } from '../konstanta.js';
import { useApi } from './data.js';
import { Ikon } from './Ikon.jsx';
import { TautanTombol, Tombol } from './ui.jsx';

export function Layout() {
  const { pengguna, institusi, punya, keluar } = useAuth();
  const navigate = useNavigate();
  const tugas = useApi(punya(PERAN_PENYETUJU) ? '/persetujuan/tugas' : null, { refetchInterval: 60_000 });
  const peranQ = useApi('/peran', { staleTime: Infinity });
  const namaPeran = (kode) => peranQ.data?.find((p) => p.kode === kode)?.nama || kode;

  const menu = MENU.map((k) => ({ ...k, butir: k.butir.filter((b) => !b.peran || punya(b.peran)) })).filter((k) => k.butir.length);

  return (
    <div className="kerangka">
      <aside className="sisi">
        <div className="sisi-merek">
          <img src="/ikon.svg" alt="" />
          <div>
            <strong>SIAPKas</strong>
            <span>Sistem informasi pengeluaran kas</span>
          </div>
        </div>
        <nav aria-label="Menu utama">
          {menu.map((k, i) => (
            <div className="sisi-kelompok" key={i}>
              {k.judul && <h4>{k.judul}</h4>}
              {k.butir.map((b) => (
                <NavLink key={b.ke} to={b.ke} end={b.ke === '/'} className={({ isActive }) => (isActive ? 'aktif' : '')}>
                  <Ikon nama={b.ikon} />
                  <span className="teks-menu">{b.label}</span>
                  {b.lencana === 'tugas' && tugas.data?.length > 0 && (
                    <span className="hitungan" aria-label={`${tugas.data.length} dokumen menunggu`}>
                      {tugas.data.length}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="badan">
        <header className="atas">
          <div className="atas-kiri">
            <span className="perusahaan">{[institusi.institusi_nama, institusi.institusi_induk].filter(Boolean).join(' ')}</span>
          </div>
          <div className="atas-kanan">
            <div className="pengguna-info" title={`Peran: ${pengguna.peran.map(namaPeran).join(', ')}`}>
              <strong>{pengguna.nama_lengkap}</strong>
              <span>
                {pengguna.jabatan ? `${pengguna.jabatan}, ` : ''}
                {pengguna.departemen_nama}
              </span>
            </div>
            <TautanTombol ke="/ganti-sandi" varian="hantu" kecil ikon="kunci">
              Ganti kata sandi
            </TautanTombol>
            <Tombol
              varian="hantu"
              kecil
              ikon="keluarAkun"
              onClick={async () => {
                await keluar();
                navigate('/masuk');
              }}
            >
              Keluar
            </Tombol>
          </div>
        </header>
        <main className="isi">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
