// Blanko formulir kosong untuk prosedur darurat saat server tidak dapat diakses (D05 bagian 7).
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth.jsx';
import { Kepala, Pesan, Tombol } from '../components/ui.jsx';
import { Ikon } from '../components/Ikon.jsx';
import { Kop, TandaTangan } from './Cetak.jsx';
import '../styles/cetak.css';

const Garis = ({ label, lebar = '100%' }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '42mm 1fr', gap: 6, alignItems: 'end', margin: '4px 0', width: lebar, fontSize: '9.5pt' }}>
    <span>{label}</span>
    <div className="garis-isi" />
  </div>
);

const Centang = ({ pilihan }) => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '9.5pt', margin: '4px 0' }}>
    {pilihan.map((p) => (
      <span key={p}>
        <span className="kotak-centang" />
        {p}
      </span>
    ))}
  </div>
);

function TabelKosong({ kolom, baris = 8 }) {
  return (
    <table className="cetak-tabel">
      <thead>
        <tr>
          {kolom.map(([k, w]) => (
            <th key={k} style={w ? { width: w } : undefined}>
              {k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: baris }, (_, i) => (
          <tr key={i} className="kosong-baris">
            {kolom.map(([k]) => (
              <td key={k} />
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={kolom.length - 1}>Jumlah</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

const Terbilang = () => (
  <div className="cetak-terbilang" style={{ minHeight: '12mm' }}>
    <b>Terbilang:</b>
  </div>
);

export const BLANKO = {
  PP: {
    judul: 'Permintaan pembayaran',
    isi: () => (
      <>
        <Garis label="Tanggal" />
        <Garis label="Pemohon dan departemen" />
        <Garis label="Tanggal dibutuhkan" />
        <Garis label="Dibayarkan kepada" />
        <Garis label="Bank, nomor rekening, a.n." />
        <Garis label="Keterangan" />
        <Garis label="Dokumen pendukung" />
        <TabelKosong kolom={[['No', '10mm'], ['Uraian'], ['Akun', '40mm'], ['Jumlah (Rp)', '38mm']]} baris={6} />
        <Terbilang />
      </>
    ),
    ttd: [['Pemohon'], ['Disetujui, atasan'], ['Diterima, Akuntansi']],
  },
  PUM: {
    judul: 'Permintaan uang muka kerja',
    isi: () => (
      <>
        <Garis label="Tanggal" />
        <Garis label="Pemohon dan departemen" />
        <Garis label="Keperluan" />
        <Garis label="" />
        <Garis label="Tanggal kegiatan selesai" />
        <Garis label="Tenggat pertanggungjawaban" />
        <Garis label="Jumlah (Rp)" />
        <Terbilang />
        <div className="cetak-catatan">Saya bersedia mempertanggungjawabkan uang muka ini dengan bukti yang sah paling lambat pada tenggat di atas.</div>
      </>
    ),
    ttd: [['Pemohon'], ['Disetujui, atasan'], ['Diterima, penerima uang']],
  },
  PJUM: {
    judul: 'Pertanggungjawaban uang muka kerja',
    isi: () => (
      <>
        <Garis label="Tanggal" />
        <Garis label="Nomor uang muka" />
        <Garis label="Pemohon dan departemen" />
        <Garis label="Jumlah uang muka (Rp)" />
        <TabelKosong kolom={[['No', '10mm'], ['Tanggal', '24mm'], ['Uraian'], ['Akun', '32mm'], ['No. bukti', '26mm'], ['Jumlah (Rp)', '34mm']]} baris={10} />
        <Garis label="Selisih (Rp)" />
        <Centang pilihan={['Pas', 'Sisa dikembalikan ke kas', 'Kekurangan dibayar perusahaan']} />
      </>
    ),
    ttd: [['Pemohon'], ['Disetujui, atasan'], ['Diverifikasi, Akuntansi']],
  },
  PKK: {
    judul: 'Pengeluaran kas kecil',
    isi: () => (
      <>
        <Centang pilihan={['Permintaan (sebelum dibayar)', 'Bukti pengeluaran (sesudah dibayar)']} />
        <Garis label="Tanggal" />
        <Garis label="Dana kas kecil" />
        <Garis label="Pemohon dan departemen" />
        <Garis label="Keperluan" />
        <Garis label="Akun" />
        <Garis label="Jumlah (Rp)" />
        <Terbilang />
        <Garis label="Tanggal dibayar" />
        <Garis label="Nomor nota atau kuitansi" />
      </>
    ),
    ttd: [['Pemohon'], ['Disetujui, atasan'], ['Dibayar, pemegang kas kecil'], ['Diterima, penerima uang']],
  },
  BKK: {
    judul: 'Bukti kas keluar',
    isi: () => (
      <>
        <Garis label="Tanggal" />
        <Centang pilihan={['Pembayaran faktur', 'Permintaan pembayaran', 'Uang muka', 'Kekurangan uang muka', 'Pembentukan kas kecil', 'Pengisian kas kecil']} />
        <Garis label="Dokumen sumber" />
        <Garis label="Dibayarkan kepada" />
        <Garis label="Rekening penerima" />
        <Garis label="Rekening sumber" />
        <Centang pilihan={['Cek', 'Bilyet giro', 'Transfer']} />
        <TabelKosong kolom={[['Uraian'], ['Akun', '38mm'], ['Debit (Rp)', '32mm'], ['Kredit (Rp)', '32mm']]} baris={6} />
        <Garis label="Jumlah dibayar (Rp)" />
        <Terbilang />
        <Garis label="Nomor cek, BG, atau referensi" />
      </>
    ),
    ttd: [['Dibuat, Akuntansi'], ['Diperiksa, Ka. Bag. Akuntansi'], ['Disetujui, Manajer Keuangan'], ['Disetujui, Direktur'], ['Dibayar, Kasir'], ['Diterima, penerima']],
  },
  BKM: {
    judul: 'Bukti kas masuk',
    isi: () => (
      <>
        <Garis label="Tanggal" />
        <Garis label="Rekening penerima" />
        <Centang pilihan={['Sisa uang muka', 'Pengembalian dana kas kecil', 'Penerimaan lain']} />
        <Garis label="Dokumen rujukan" />
        <Garis label="Diterima dari" />
        <Garis label="Keterangan" />
        <Garis label="Akun lawan" />
        <Garis label="Jumlah (Rp)" />
        <Terbilang />
      </>
    ),
    ttd: [['Diterima, Kasir'], ['Disetor oleh']],
  },
  OPN: {
    judul: 'Berita acara opname kas kecil',
    isi: () => (
      <>
        <Garis label="Tanggal dan jam" />
        <Garis label="Dana kas kecil" />
        <Garis label="Pemegang dana" />
        <table className="cetak-tabel">
          <thead>
            <tr>
              <th>Pecahan</th>
              <th style={{ width: '32mm' }}>Lembar/keping</th>
              <th style={{ width: '40mm' }}>Nilai (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {['Kertas 100.000', 'Kertas 50.000', 'Kertas 20.000', 'Kertas 10.000', 'Kertas 5.000', 'Kertas 2.000', 'Kertas 1.000', 'Logam 1.000', 'Logam 500', 'Logam 200', 'Logam 100'].map((p) => (
              <tr key={p}>
                <td>Uang {p.toLowerCase()}</td>
                <td />
                <td />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Jumlah uang tunai fisik</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <Garis label="Dana tetap" />
        <Garis label="Bukti belum diganti" />
        <Garis label="Saldo seharusnya" />
        <Garis label="Selisih" />
      </>
    ),
    ttd: [['Pemeriksa'], ['Pemegang kas kecil']],
  },
};

export function HalamanBlanko() {
  return (
    <>
      <Kepala judul="Blanko formulir" sub="Formulir kosong untuk prosedur darurat bila server tidak dapat diakses lebih dari dua jam. Cetak persediaan secukupnya dan simpan di Bagian Keuangan." />
      <Pesan jenis="peringatan" judul="Prosedur darurat">
        Hanya diaktifkan oleh Manajer Keuangan. Formulir diberi nomor DARURAT-TANGGAL-URUT, ditandatangani basah sesuai matriks otorisasi, lalu dientri ke SIAPKas paling lambat satu hari kerja setelah sistem pulih.
      </Pesan>
      <div className="katalog-laporan">
        {Object.entries(BLANKO).map(([kode, b]) => (
          <Link key={kode} to={`/cetak/blanko/${kode}`}>
            <span className="kode">{kode}</span>
            <strong>{b.judul}</strong>
            <span>Blanko satu halaman A4</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export function CetakBlanko() {
  const { jenis } = useParams();
  const navigate = useNavigate();
  const { perusahaan } = useAuth();
  const b = BLANKO[jenis];
  useEffect(() => {
    document.title = `Blanko ${jenis} | SIAPKas`;
  }, [jenis]);
  if (!b) return <Pesan jenis="galat">Blanko tidak dikenal.</Pesan>;
  return (
    <div className="cetak-latar">
      <div className="cetak-alat">
        <div className="kiri">
          <Tombol ikon="kembali" onClick={() => navigate(-1)}>
            Kembali
          </Tombol>
        </div>
        <div className="kanan">
          <span className="catatan">Blanko tidak dicatat sebagai cetakan dokumen.</span>
          <Tombol varian="utama" onClick={() => window.print()}>
            <Ikon nama="cetak" /> Cetak blanko
          </Tombol>
        </div>
      </div>
      <div className="halaman-a4">
        <Kop tanda="FORMULIR DARURAT" subTanda="diisi tangan" />
        <div className="judul-form">
          <h1>{b.judul}</h1>
          <div className="nomor">Nomor darurat: DARURAT-........................-.........</div>
          <div className="sub">Nomor SIAPKas setelah dientri: ....................................</div>
        </div>
        {b.isi()}
        <TandaTangan kolom={b.ttd} kota={perusahaan.perusahaan_kota} />
        <div className="cetak-kaki">
          <span>Formulir darurat. Wajib dientri ke SIAPKas paling lambat satu hari kerja setelah sistem pulih, dengan pindaian formulir ini sebagai lampiran.</span>
          <span>{jenis}</span>
        </div>
      </div>
    </div>
  );
}
