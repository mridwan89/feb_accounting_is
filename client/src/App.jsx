// Perutean aplikasi: halaman masuk, halaman cetak (tanpa menu), dan seluruh halaman kerja di dalam kerangka menu.
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth.jsx';
import { Layout } from './components/Layout.jsx';
import { Memuat, Pesan, TautanTombol, Tombol } from './components/ui.jsx';
import { HalamanCetak } from './cetak/Cetak.jsx';
import { CetakBlanko, HalamanBlanko } from './cetak/Blanko.jsx';
import { HalamanGantiSandi, HalamanMasuk } from './pages/Masuk.jsx';
import { HalamanBeranda } from './pages/Beranda.jsx';
import { HalamanPersetujuan } from './pages/Persetujuan.jsx';
import { DaftarPP, DetailPP, HalamanFormPP, HalamanPermintaanSaya } from './pages/Permintaan.jsx';
import { DaftarPJUM, DaftarUangMuka, DetailPJUM, DetailUangMuka, HalamanFormPJUM, HalamanFormUangMuka } from './pages/UangMuka.jsx';
import {
  DaftarOpname, DaftarPDK, DaftarPKK, DetailOpname, DetailPDK, DetailPKK, HalamanDana, HalamanFormOpname, HalamanFormPDK, HalamanFormPKK,
} from './pages/KasKecil.jsx';
import { DaftarPenerimaan, DaftarPO, DetailPenerimaan, DetailPO, HalamanFormPenerimaan, HalamanFormPO } from './pages/Pembelian.jsx';
import { DaftarFaktur, DetailFaktur, HalamanFormFaktur, HalamanSaldoAwalFaktur } from './pages/Faktur.jsx';
import { DaftarBKK, DetailBKK, HalamanFormBKK } from './pages/Bkk.jsx';
import { DaftarBKM, DetailBKM, DetailBukuCek, DetailPembayaran, HalamanBayar, HalamanBukuCek, HalamanFormBKM, HalamanPembayaran } from './pages/Kas.jsx';
import { DaftarRekonsiliasi, DetailRekonsiliasi } from './pages/Rekonsiliasi.jsx';
import { DaftarJM, DaftarJurnal, DetailJM, DetailJurnal, HalamanFormJM, HalamanPeriode } from './pages/Akuntansi.jsx';
import { HalamanLaporan, HalamanSatuLaporan } from './pages/Laporan.jsx';
import { DaftarPemasok, DetailPemasok, HalamanAkun, HalamanDepartemen, HalamanFormPemasok, HalamanPajak, HalamanRekening } from './pages/Master.jsx';
import { HalamanAturan, HalamanAudit, HalamanKonflik, HalamanPengaturan, HalamanPengguna, HalamanSesi } from './pages/Admin.jsx';

function Terlindungi() {
  const { status, pengguna, pesan, muat } = useAuth();
  const lokasi = useLocation();
  if (status === 'memuat') return <Memuat teks="Memuat profil pengguna..." />;
  if (status === 'galat') {
    return (
      <div style={{ maxWidth: 520, margin: '15vh auto', padding: 16 }}>
        <Pesan jenis="galat" judul="Server tidak dapat dihubungi">
          {pesan}
        </Pesan>
        <Tombol varian="utama" onClick={muat}>
          Coba hubungkan lagi
        </Tombol>
      </div>
    );
  }
  if (status !== 'masuk') return <Navigate to={`/masuk?ke=${encodeURIComponent(lokasi.pathname + lokasi.search)}`} replace />;
  if (pengguna.harus_ganti_password) return <HalamanGantiSandi />;
  return <Outlet />;
}

function RuteMasuk() {
  const { status } = useAuth();
  if (status === 'masuk') return <Navigate to="/" replace />;
  if (status === 'memuat') return <Memuat />;
  return <HalamanMasuk />;
}

function TidakDitemukan() {
  return (
    <div className="kosong" style={{ paddingTop: 80 }}>
      <strong>Halaman tidak ditemukan</strong>
      <p>Alamat yang Anda buka tidak ada atau sudah dipindahkan.</p>
      <TautanTombol ke="/" varian="utama">
        Kembali ke beranda
      </TautanTombol>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/masuk" element={<RuteMasuk />} />
      <Route element={<Terlindungi />}>
        <Route path="/cetak/blanko/:jenis" element={<CetakBlanko />} />
        <Route path="/cetak/:jenis/:id" element={<HalamanCetak />} />
        <Route element={<Layout />}>
          <Route index element={<HalamanBeranda />} />
          <Route path="ganti-sandi" element={<HalamanGantiSandi />} />
          <Route path="persetujuan" element={<HalamanPersetujuan />} />
          <Route path="permintaan" element={<HalamanPermintaanSaya />} />

          <Route path="pp" element={<DaftarPP />} />
          <Route path="pp/baru" element={<HalamanFormPP />} />
          <Route path="pp/:id" element={<DetailPP />} />
          <Route path="pp/:id/ubah" element={<HalamanFormPP />} />
          <Route path="uang-muka" element={<DaftarUangMuka />} />
          <Route path="uang-muka/baru" element={<HalamanFormUangMuka />} />
          <Route path="uang-muka/:id" element={<DetailUangMuka />} />
          <Route path="uang-muka/:id/ubah" element={<HalamanFormUangMuka />} />
          <Route path="pjum" element={<DaftarPJUM />} />
          <Route path="pjum/baru" element={<HalamanFormPJUM />} />
          <Route path="pjum/:id" element={<DetailPJUM />} />
          <Route path="pjum/:id/ubah" element={<HalamanFormPJUM />} />

          <Route path="pkk" element={<DaftarPKK />} />
          <Route path="pkk/baru" element={<HalamanFormPKK />} />
          <Route path="pkk/:id" element={<DetailPKK />} />
          <Route path="pkk/:id/ubah" element={<HalamanFormPKK />} />
          <Route path="dana-kas-kecil" element={<HalamanDana />} />
          <Route path="pdk" element={<DaftarPDK />} />
          <Route path="pdk/baru" element={<HalamanFormPDK />} />
          <Route path="pdk/:id" element={<DetailPDK />} />
          <Route path="pdk/:id/ubah" element={<HalamanFormPDK />} />
          <Route path="opname" element={<DaftarOpname />} />
          <Route path="opname/baru" element={<HalamanFormOpname />} />
          <Route path="opname/:id" element={<DetailOpname />} />
          <Route path="opname/:id/ubah" element={<HalamanFormOpname />} />

          <Route path="po" element={<DaftarPO />} />
          <Route path="po/baru" element={<HalamanFormPO />} />
          <Route path="po/:id" element={<DetailPO />} />
          <Route path="po/:id/ubah" element={<HalamanFormPO />} />
          <Route path="penerimaan" element={<DaftarPenerimaan />} />
          <Route path="penerimaan/baru" element={<HalamanFormPenerimaan />} />
          <Route path="penerimaan/:id" element={<DetailPenerimaan />} />
          <Route path="pemasok" element={<DaftarPemasok />} />
          <Route path="pemasok/baru" element={<HalamanFormPemasok />} />
          <Route path="pemasok/:id" element={<DetailPemasok />} />
          <Route path="pemasok/:id/ubah" element={<HalamanFormPemasok />} />

          <Route path="faktur" element={<DaftarFaktur />} />
          <Route path="faktur/baru" element={<HalamanFormFaktur />} />
          <Route path="faktur/saldo-awal" element={<HalamanSaldoAwalFaktur />} />
          <Route path="faktur/:id" element={<DetailFaktur />} />
          <Route path="faktur/:id/ubah" element={<HalamanFormFaktur />} />
          <Route path="bkk" element={<DaftarBKK />} />
          <Route path="bkk/baru" element={<HalamanFormBKK />} />
          <Route path="bkk/:id" element={<DetailBKK />} />
          <Route path="bkk/:id/ubah" element={<HalamanFormBKK />} />
          <Route path="pembayaran" element={<HalamanPembayaran />} />
          <Route path="pembayaran/baru" element={<HalamanBayar />} />
          <Route path="pembayaran/:id" element={<DetailPembayaran />} />
          <Route path="bkm" element={<DaftarBKM />} />
          <Route path="bkm/baru" element={<HalamanFormBKM />} />
          <Route path="bkm/:id" element={<DetailBKM />} />
          <Route path="buku-cek" element={<HalamanBukuCek />} />
          <Route path="buku-cek/:id" element={<DetailBukuCek />} />
          <Route path="rekonsiliasi" element={<DaftarRekonsiliasi />} />
          <Route path="rekonsiliasi/:id" element={<DetailRekonsiliasi />} />

          <Route path="jurnal" element={<DaftarJurnal />} />
          <Route path="jurnal/:id" element={<DetailJurnal />} />
          <Route path="jurnal-manual" element={<DaftarJM />} />
          <Route path="jurnal-manual/baru" element={<HalamanFormJM />} />
          <Route path="jurnal-manual/:id" element={<DetailJM />} />
          <Route path="jurnal-manual/:id/ubah" element={<HalamanFormJM />} />
          <Route path="periode" element={<HalamanPeriode />} />
          <Route path="laporan" element={<HalamanLaporan />} />
          <Route path="laporan/:kode" element={<HalamanSatuLaporan />} />

          <Route path="akun" element={<HalamanAkun />} />
          <Route path="pajak" element={<HalamanPajak />} />
          <Route path="rekening-kas" element={<HalamanRekening />} />
          <Route path="departemen" element={<HalamanDepartemen />} />

          <Route path="admin/pengguna" element={<HalamanPengguna />} />
          <Route path="admin/aturan-persetujuan" element={<HalamanAturan />} />
          <Route path="admin/konflik-peran" element={<HalamanKonflik />} />
          <Route path="admin/pengaturan" element={<HalamanPengaturan />} />
          <Route path="admin/audit" element={<HalamanAudit />} />
          <Route path="admin/sesi" element={<HalamanSesi />} />
          <Route path="blanko" element={<HalamanBlanko />} />
          <Route path="*" element={<TidakDitemukan />} />
        </Route>
      </Route>
    </Routes>
  );
}
