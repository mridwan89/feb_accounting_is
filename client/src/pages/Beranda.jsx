// Beranda: tugas yang menunggu, angka kunci, grafik pembayaran dan umur utang, posisi kas kecil, dan pintasan sesuai peran.
import { Link } from 'react-router';
import { useAuth } from '../auth.jsx';
import { angka, bulanPendek, ringkas, rupiah, tanggal } from '../format.js';
import { useApi } from '../components/data.js';
import { GrafikBatangH, GrafikKolom, WARNA_UMUR } from '../components/Grafik.jsx';
import { Ikon } from '../components/Ikon.jsx';
import { Kartu, Kepala, Muat, Pesan } from '../components/ui.jsx';

const PINTASAN = [
  { peran: ['PEMOHON'], ke: '/pp/baru', ikon: 'dokumen', judul: 'Buat permintaan pembayaran', ket: 'Tagihan di luar pesanan pembelian' },
  { peran: ['PEMOHON'], ke: '/uang-muka/baru', ikon: 'dompet', judul: 'Ajukan uang muka kerja', ket: 'Dana kegiatan yang dipertanggungjawabkan kemudian' },
  { peran: ['PEMOHON'], ke: '/pkk/baru', ikon: 'koin', judul: 'Ajukan pengeluaran kas kecil', ket: 'Belanja kecil dibayar tunai' },
  { peran: ['PEMOHON'], ke: '/permintaan', ikon: 'daftar', judul: 'Permintaan saya', ket: 'Posisi setiap permintaan Anda' },
  { peran: ['PEMBELIAN'], ke: '/po/baru', ikon: 'keranjang', judul: 'Buat pesanan pembelian', ket: 'PO untuk pemasok terdaftar' },
  { peran: ['GUDANG'], ke: '/penerimaan/baru', ikon: 'kotak', judul: 'Catat penerimaan', ket: 'LPB untuk barang, BAST untuk jasa' },
  { peran: ['AKUNTANSI'], ke: '/faktur/baru', ikon: 'faktur', judul: 'Catat faktur pemasok', ket: 'Dicocokkan otomatis dengan PO dan LPB' },
  { peran: ['AKUNTANSI'], ke: '/bkk/baru', ikon: 'keluar', judul: 'Buat bukti kas keluar', ket: 'Perintah bayar untuk Kasir' },
  { peran: ['KASIR'], ke: '/pembayaran', ikon: 'bayar', judul: 'Antrean pembayaran', ket: 'BKK yang sudah disetujui lengkap' },
  { peran: ['KASIR'], ke: '/bkm/baru', ikon: 'masuk', judul: 'Catat kas masuk', ket: 'Sisa uang muka dan pengembalian dana' },
  { peran: ['KAS_KECIL'], ke: '/pdk/baru', ikon: 'isi', judul: 'Ajukan pengisian kembali', ket: 'Dari bukti yang sudah dibayar' },
  { peran: ['SPV_AKUNTANSI'], ke: '/rekonsiliasi', ikon: 'timbang', judul: 'Rekonsiliasi bank', ket: 'Susun dan finalkan per bulan' },
  { peran: ['AUDITOR', 'SPV_AKUNTANSI'], ke: '/opname/baru', ikon: 'hitung', judul: 'Opname kas kecil', ket: 'Hitung fisik uang tunai' },
  { peran: ['AUDITOR'], ke: '/laporan/pengecualian', ikon: 'perisai', judul: 'Laporan pengecualian', ket: 'Transaksi yang perlu ditelaah' },
  { peran: ['MANAJER_KEUANGAN', 'DIREKTUR'], ke: '/laporan/faktur-jatuh-tempo', ikon: 'kalender', judul: 'Faktur jatuh tempo', ket: 'Rencana kebutuhan kas' },
  { peran: ['ADMIN'], ke: '/admin/pengguna', ikon: 'orang', judul: 'Kelola pengguna', ket: 'Akun, peran, dan kunci akun' },
  { peran: ['ADMIN', 'AUDITOR'], ke: '/admin/audit', ikon: 'jejak', judul: 'Log audit', ket: 'Jejak seluruh perubahan data' },
];

/** Enam bulan terakhir berakhir di bulan berjalan, bulan tanpa pembayaran diisi nol. */
function enamBulan(perTanggal, data) {
  const [t, b] = perTanggal.split('-').map(Number);
  const hasil = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(t, b - 1 - i, 1));
    const kunci = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const baris = data.find((x) => x.bulan === kunci);
    hasil.push({
      kategori: `${bulanPendek(d.getUTCMonth() + 1)} ${String(d.getUTCFullYear()).slice(2)}`,
      nilai: Number(baris?.nilai || 0),
      catatan: `${baris?.n || 0} pembayaran`,
    });
  }
  return hasil;
}

function Ubin({ k }) {
  const uang = k.jenis !== 'angka';
  return (
    <div className={`ubin ${k.nada || ''}`}>
      <div className="label">{k.label}</div>
      <div className="nilai">{uang ? `Rp${ringkas(k.nilai)}` : angka(k.nilai)}</div>
      <div className="ket">{uang ? `${rupiah(k.nilai)}${k.keterangan ? ` · ${k.keterangan}` : ''}` : k.keterangan}</div>
    </div>
  );
}

function IsiBeranda({ d }) {
  const { punya } = useAuth();
  const pintasan = PINTASAN.filter((p) => punya(p.peran));
  const adaGrafik = d.pembayaran_bulanan || d.umur_utang;
  const umur = d.umur_utang ? d.umur_utang.kelompok.map((k, i) => ({ label: k.label, nilai: Number(d.umur_utang.total[k.kunci] || 0), warna: WARNA_UMUR[i] })) : [];

  const tugas = (
    <Kartu judul="Tugas Anda" rapat>
      {d.tugas.length === 0 ? (
        <p className="lemah" style={{ padding: 16, margin: 0 }}>
          Tidak ada tugas yang menunggu.
        </p>
      ) : (
        <ul className="daftar-tugas">
          {d.tugas.map((t) => (
            <li key={t.label}>
              <Link to={t.tautan}>
                <span>{t.label}</span>
                <span className="jumlah">{t.jumlah}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Kartu>
  );

  const dana =
    d.dana?.length > 0 ? (
      <Kartu judul="Dana kas kecil yang Anda pegang">
        {d.dana.map((x) => {
          const nada = x.persen_saldo < 25 ? 'bahaya' : x.persen_saldo < 50 ? 'peringatan' : '';
          return (
            <div key={x.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <Link to="/dana-kas-kecil" className="tebal">
                  {x.nama}
                </Link>
                <span className="angka">{rupiah(x.saldo_tunai)}</span>
              </div>
              <div className={`meter ${nada}`} style={{ margin: '6px 0 4px' }} role="img" aria-label={`Saldo tunai ${x.persen_saldo}% dari dana tetap`}>
                <div style={{ width: `${Math.min(100, Math.max(0, x.persen_saldo))}%` }} />
              </div>
              <div className="kecil lemah">
                Saldo tunai {x.persen_saldo.toLocaleString('id-ID')}% dari dana tetap {rupiah(x.jumlah_dana)}. Bukti belum diganti {rupiah(x.bukti_belum_diganti)}.
              </div>
            </div>
          );
        })}
      </Kartu>
    ) : null;

  const kartuPintasan =
    pintasan.length > 0 ? (
      <Kartu judul="Pintasan">
        <div className="pintasan">
          {pintasan.map((p) => (
            <Link key={p.ke} to={p.ke}>
              <Ikon nama={p.ikon} />
              <div>
                <strong>{p.judul}</strong>
                <span>{p.ket}</span>
              </div>
            </Link>
          ))}
        </div>
      </Kartu>
    ) : null;

  return (
    <>
      {d.peringatan.map((p) => (
        <Pesan key={p} jenis="peringatan">
          {p}
        </Pesan>
      ))}
      {d.kartu.length > 0 && (
        <div className="ubin-baris">
          {d.kartu.map((k) => (
            <Ubin key={k.label} k={k} />
          ))}
        </div>
      )}
      {adaGrafik ? (
        <div className="grid-2-1">
          <div>
            {d.pembayaran_bulanan && (
              <Kartu judul="Pembayaran enam bulan terakhir" aksi={<Link to="/laporan/register-cek">Register pembayaran</Link>}>
                <GrafikKolom data={enamBulan(d.per_tanggal, d.pembayaran_bulanan)} judulTabel="Bulan" labelAria="Grafik kolom nilai pembayaran per bulan" />
              </Kartu>
            )}
            {d.umur_utang && (
              <Kartu judul="Umur utang usaha" aksi={<Link to="/laporan/umur-utang">Laporan umur utang</Link>}>
                <GrafikBatangH data={umur} />
              </Kartu>
            )}
            {kartuPintasan}
          </div>
          <div>
            {tugas}
            {d.saldo_bank && (
              <Kartu judul="Saldo buku rekening bank" rapat>
                <table className="tabel">
                  <tbody>
                    {d.saldo_bank.map((s) => (
                      <tr key={s.kode}>
                        <td>
                          <div className="tebal">{s.nama}</div>
                          <div className="kecil sangat-lemah">{s.kode}</div>
                        </td>
                        <td className="angka">{rupiah(s.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Kartu>
            )}
            {dana}
          </div>
        </div>
      ) : (
        <div className="grid-2-1">
          <div>{kartuPintasan}</div>
          <div>
            {tugas}
            {dana}
          </div>
        </div>
      )}
    </>
  );
}

export function HalamanBeranda() {
  const { pengguna } = useAuth();
  const q = useApi('/dasbor', { refetchInterval: 120_000 });
  return (
    <>
      <Kepala judul="Beranda" sub={q.data ? `${pengguna.nama_lengkap} · posisi per ${tanggal(q.data.per_tanggal, true)}` : pengguna.nama_lengkap} />
      <Muat kueri={q}>{(d) => <IsiBeranda d={d} />}</Muat>
    </>
  );
}
