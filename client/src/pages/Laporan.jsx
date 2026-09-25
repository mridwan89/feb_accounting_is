// Tiga belas laporan siklus pengeluaran kas (LAP-01 sampai LAP-13), masing-masing dapat dicetak dan diunduh sebagai CSV.
import { Link, useParams } from 'react-router';
import { qs } from '../api.js';
import { useAuth } from '../auth.jsx';
import { JENIS_BKK, METODE, PERAN_LAPORAN } from '../konstanta.js';
import { angka, awalBulanIni, hariIni, rupiah, tanggal, waktu } from '../format.js';
import { useApi, useDana, usePilihanAkun, usePilihanPemasok, useRekening } from '../components/data.js';
import { useSaring } from '../components/Dokumen.jsx';
import { GrafikBatangH, WARNA_UMUR } from '../components/Grafik.jsx';
import { BarisKosong, Kartu, Kepala, Kolom, Kombo, Masukan, Muat, Pesan, Pilihan, Status, Tombol } from '../components/ui.jsx';

// ---------------------------------------------------------------- katalog

export const KATALOG = [
  { kode: 'LAP-01', rute: 'register-bkk', judul: 'Register BKK', ket: 'Seluruh bukti kas keluar beserta jumlah bruto, potongan, dibayar, dan statusnya.', peran: [...PERAN_LAPORAN, 'KASIR'] },
  { kode: 'LAP-02', rute: 'register-cek', judul: 'Register cek dan pembayaran', ket: 'Pembayaran per warkat atau transfer, posisi buku cek, dan lembar yang dibatalkan.', peran: [...PERAN_LAPORAN, 'KASIR'] },
  { kode: 'LAP-03', rute: 'jurnal-pengeluaran-kas', judul: 'Jurnal pengeluaran kas', ket: 'Jurnal kolom: debit utang usaha dan lain-lain, kredit utang pajak dan bank.', peran: PERAN_LAPORAN },
  { kode: 'LAP-04', rute: 'buku-pembantu-utang', judul: 'Buku pembantu utang', ket: 'Mutasi dan saldo utang per pemasok.', peran: PERAN_LAPORAN },
  { kode: 'LAP-05', rute: 'saldo-utang', judul: 'Daftar saldo utang', ket: 'Saldo per pemasok dicocokkan dengan akun kontrol Utang Usaha dan sisa faktur.', peran: PERAN_LAPORAN },
  { kode: 'LAP-06', rute: 'umur-utang', judul: 'Umur utang', ket: 'Utang belum jatuh tempo sampai lewat 90 hari per pemasok.', peran: PERAN_LAPORAN },
  { kode: 'LAP-07', rute: 'faktur-jatuh-tempo', judul: 'Faktur jatuh tempo', ket: 'Faktur yang jatuh tempo dalam N hari sebagai rencana kebutuhan kas.', peran: [...PERAN_LAPORAN, 'KASIR'] },
  { kode: 'LAP-08', rute: 'kas-kecil', judul: 'Laporan kas kecil', ket: 'Mutasi dana kas kecil: pembentukan, pengeluaran, pengisian, dan saldo.', peran: [...PERAN_LAPORAN, 'KAS_KECIL'] },
  { kode: 'LAP-09', rute: 'uang-muka-beredar', judul: 'Uang muka beredar', ket: 'Uang muka yang sudah dibayar dan belum selesai dipertanggungjawabkan.', peran: PERAN_LAPORAN },
  { kode: 'LAP-10', rute: 'buku-besar', judul: 'Buku besar', ket: 'Mutasi per akun beserta saldo berjalan.', peran: PERAN_LAPORAN },
  { kode: 'LAP-11', rute: 'neraca-saldo', judul: 'Neraca saldo', ket: 'Saldo seluruh akun per tanggal tertentu dan pemeriksaan keseimbangan.', peran: PERAN_LAPORAN },
  { kode: 'LAP-12', rute: 'pengeluaran-departemen', judul: 'Pengeluaran per unit kerja', ket: 'Beban per unit kerja dan akun pada rentang tanggal.', peran: PERAN_LAPORAN },
  { kode: 'LAP-13', rute: 'pengecualian', judul: 'Laporan pengecualian', ket: 'Selisih yang disetujui, pembatalan, penolakan, keterlambatan, dan perubahan data sensitif.', peran: ['AUDITOR', 'WAKIL_DEKAN_2', 'DEKAN', 'KASUBAG_KEUANGAN'] },
];

export function HalamanLaporan() {
  const { punya } = useAuth();
  return (
    <>
      <Kepala judul="Laporan" sub="Pilih laporan. Semua laporan dapat dicetak atau diunduh sebagai CSV untuk diolah di lembar kerja." />
      <div className="katalog-laporan">
        {KATALOG.filter((l) => punya(l.peran)).map((l) => (
          <Link key={l.rute} to={`/laporan/${l.rute}`}>
            <span className="kode">{l.kode}</span>
            <strong>{l.judul}</strong>
            <span>{l.ket}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- perangkat bersama

function nilaiTampil(k, b) {
  if (k.tampil) return k.tampil(b);
  const v = b[k.kunci];
  if (k.uang) return rupiah(v);
  if (k.tanggal) return tanggal(v);
  if (k.angka) return angka(v);
  return v === null || v === undefined || v === '' ? '-' : v;
}

function TabelLaporan({ kolom, data, kaki, kosong = 'Tidak ada data pada penyaring ini', kelasBaris }) {
  return (
    <div className="tabel-bungkus">
      <table className="tabel">
        <thead>
          <tr>
            {kolom.map((k) => (
              <th key={k.kunci} className={k.uang || k.angka ? 'angka' : ''}>
                {k.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && <BarisKosong kolom={kolom.length} judul={kosong} />}
          {data.map((b, i) => (
            <tr key={i} className={kelasBaris?.(b) || ''}>
              {kolom.map((k) => (
                <td key={k.kunci} className={k.uang || k.angka ? 'angka' : k.nowrap ? 'nowrap' : ''}>
                  {nilaiTampil(k, b)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {kaki && <tfoot>{kaki}</tfoot>}
      </table>
    </div>
  );
}

function unduhCsv(nama, kolom, data) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const baris = [kolom.map((k) => esc(k.label)).join(','), ...data.map((b) => kolom.map((k) => esc(k.csv ? k.csv(b) : b[k.kunci])).join(','))];
  const blob = new Blob([`\uFEFF${baris.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nama}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Kerangka({ info, periode, filter, csv, children }) {
  const { institusi } = useAuth();
  return (
    <div className="laporan">
      <Kepala
        judul={info.judul}
        remah={[{ label: 'Laporan', ke: '/laporan' }, { label: info.kode }]}
        sub={info.ket}
        aksi={
          <>
            {csv && (
              <Tombol ikon="unduh" onClick={csv}>
                Unduh CSV
              </Tombol>
            )}
            <Tombol ikon="cetak" onClick={() => window.print()}>
              Cetak laporan
            </Tombol>
          </>
        }
      />
      <div className="kop-laporan hanya-cetak">
        <div className="nama">{[institusi.institusi_nama, institusi.institusi_induk].filter(Boolean).join(' ')}</div>
        <div className="judul">
          {info.kode} {info.judul}
        </div>
        <div className="periode">{periode}</div>
      </div>
      {filter && (
        <Kartu rapat className="tidak-cetak">
          <div className="saring">{filter}</div>
        </Kartu>
      )}
      {children}
    </div>
  );
}

function FilterTanggal({ saring, dari = true }) {
  return (
    <>
      {dari && (
        <Kolom label="Dari tanggal">
          <Masukan type="date" value={saring.nilai.dari} onChange={(e) => saring.atur('dari', e.target.value)} />
        </Kolom>
      )}
      <Kolom label={dari ? 'Sampai tanggal' : 'Per tanggal'}>
        <Masukan type="date" value={saring.nilai.sampai} onChange={(e) => saring.atur('sampai', e.target.value)} />
      </Kolom>
    </>
  );
}

function useRentang(kunciLain = []) {
  const saring = useSaring(['dari', 'sampai', ...kunciLain]);
  const nilai = { ...saring.nilai, dari: saring.nilai.dari || awalBulanIni(), sampai: saring.nilai.sampai || hariIni() };
  return { saring: { ...saring, nilai }, nilai, periode: `Periode ${tanggal(nilai.dari, true)} sampai ${tanggal(nilai.sampai, true)}` };
}

const Ringkas = ({ butir }) => (
  <div className="ringkas-angka">
    {butir.filter(Boolean).map(([label, nilai, nada]) => (
      <div key={label}>
        <div className="label">{label}</div>
        <div className={`nilai ${nada || ''}`}>{nilai}</div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------- LAP-01 register BKK

function RegisterBKK({ info }) {
  const { saring, nilai, periode } = useRentang(['status', 'jenis']);
  const q = useApi(`/laporan/register-bkk${qs(nilai)}`);
  const kolom = [
    { kunci: 'nomor', label: 'Nomor', tampil: (b) => <Link to={`/bkk/${b.id}`}>{b.nomor}</Link> },
    { kunci: 'tanggal', label: 'Tanggal', tanggal: true, nowrap: true },
    { kunci: 'jenis', label: 'Jenis', tampil: (b) => JENIS_BKK[b.jenis], csv: (b) => JENIS_BKK[b.jenis] },
    { kunci: 'penerima_nama', label: 'Penerima' },
    { kunci: 'sumber_nomor', label: 'Sumber' },
    { kunci: 'metode_bayar', label: 'Metode', tampil: (b) => METODE[b.metode_bayar] },
    { kunci: 'jumlah_bruto', label: 'Bruto', uang: true },
    { kunci: 'jumlah_potongan', label: 'Potongan', uang: true },
    { kunci: 'jumlah_bayar', label: 'Dibayar', uang: true },
    { kunci: 'bukti_bayar', label: 'Cek atau referensi' },
    { kunci: 'status', label: 'Status', tampil: (b) => <Status kode={b.status} /> },
  ];
  return (
    <Kerangka
      info={info}
      periode={periode}
      csv={q.data && (() => unduhCsv(`register-bkk_${nilai.dari}_${nilai.sampai}`, kolom, q.data.data))}
      filter={
        <>
          <FilterTanggal saring={saring} />
          <Kolom label="Jenis">
            <Pilihan pilihan={Object.entries(JENIS_BKK)} kosong="Semua jenis" value={nilai.jenis} onChange={(e) => saring.atur('jenis', e.target.value)} />
          </Kolom>
          <Kolom label="Status">
            <Pilihan pilihan={[['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DISETUJUI', 'Disetujui'], ['DITOLAK', 'Ditolak'], ['DIBAYAR', 'Dibayar'], ['BATAL', 'Batal']]} kosong="Semua status" value={nilai.status} onChange={(e) => saring.atur('status', e.target.value)} />
          </Kolom>
        </>
      }
    >
      <Muat kueri={q}>
        {(r) => (
          <Kartu rapat>
            <Ringkas butir={[['BKK berlaku', angka(r.total.jumlah)], ['Bruto', rupiah(r.total.bruto)], ['Potongan', rupiah(r.total.potongan)], ['Dibayar', rupiah(r.total.dibayar)]]} />
            <TabelLaporan kolom={kolom} data={r.data} kelasBaris={(b) => (b.status === 'BATAL' ? 'redup' : '')} />
            <p className="kecil sangat-lemah" style={{ padding: '6px 16px 10px', margin: 0 }}>
              Jumlah di atas tidak memasukkan BKK yang dibatalkan.
            </p>
          </Kartu>
        )}
      </Muat>
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-02 register cek

function RegisterCek({ info }) {
  const { saring, nilai, periode } = useRentang(['rekening_kas_id']);
  const rekening = useRekening();
  const q = useApi(`/laporan/register-cek${qs(nilai)}`);
  const kolom = [
    { kunci: 'tanggal', label: 'Tanggal', tanggal: true, nowrap: true },
    { kunci: 'nomor', label: 'Pembayaran', tampil: (b) => <Link to={`/pembayaran/${b.id}`}>{b.nomor}</Link> },
    { kunci: 'rekening_kode', label: 'Rekening' },
    { kunci: 'metode', label: 'Metode', tampil: (b) => METODE[b.metode] },
    { kunci: 'nomor_warkat', label: 'Nomor warkat atau referensi', tampil: (b) => b.nomor_warkat || b.nomor_referensi, csv: (b) => b.nomor_warkat || b.nomor_referensi },
    { kunci: 'tanggal_jatuh_tempo_bg', label: 'Efektif BG', tanggal: true },
    { kunci: 'penerima_nama', label: 'Penerima' },
    { kunci: 'bkk_nomor', label: 'BKK' },
    { kunci: 'jumlah', label: 'Jumlah', uang: true },
    { kunci: 'tanggal_kliring', label: 'Kliring', tanggal: true },
    { kunci: 'status', label: 'Status', tampil: (b) => <Status kode={b.status} /> },
  ];
  return (
    <Kerangka
      info={info}
      periode={periode}
      csv={q.data && (() => unduhCsv(`register-cek_${nilai.dari}_${nilai.sampai}`, kolom, q.data.pembayaran))}
      filter={
        <>
          <FilterTanggal saring={saring} />
          <Kolom label="Rekening">
            <Pilihan pilihan={(rekening.data || []).map((r) => [r.id, r.nama])} kosong="Semua rekening" value={nilai.rekening_kas_id} onChange={(e) => saring.atur('rekening_kas_id', e.target.value)} />
          </Kolom>
        </>
      }
    >
      <Muat kueri={q}>
        {(r) => (
          <>
            <Kartu judul="Pembayaran" rapat>
              <Ringkas butir={[['Pembayaran berlaku', angka(r.total.jumlah)], ['Nilai', rupiah(r.total.nilai)]]} />
              <TabelLaporan kolom={kolom} data={r.pembayaran} kelasBaris={(b) => (b.status === 'BATAL' ? 'redup' : '')} />
            </Kartu>
            <Kartu judul="Posisi buku cek dan bilyet giro" rapat>
              <TabelLaporan
                kolom={[
                  { kunci: 'rekening_kode', label: 'Rekening' },
                  { kunci: 'jenis', label: 'Jenis', tampil: (b) => (b.jenis === 'CEK' ? 'Cek' : 'Bilyet giro') },
                  { kunci: 'rentang', label: 'Rentang', tampil: (b) => `${b.seri} ${String(b.nomor_awal).padStart(b.digit, '0')} sampai ${String(b.nomor_akhir).padStart(b.digit, '0')}` },
                  { kunci: 'total', label: 'Lembar', angka: true },
                  { kunci: 'tersedia', label: 'Tersedia', angka: true },
                  { kunci: 'terpakai', label: 'Terpakai', angka: true },
                  { kunci: 'batal', label: 'Batal', angka: true },
                  { kunci: 'status', label: 'Status', tampil: (b) => <Status kode={b.status} /> },
                ]}
                data={r.buku}
              />
            </Kartu>
            <Kartu judul="Lembar kosong yang dibatalkan" rapat>
              <TabelLaporan
                kolom={[
                  { kunci: 'nomor', label: 'Nomor' },
                  { kunci: 'rekening_kode', label: 'Rekening' },
                  { kunci: 'keterangan', label: 'Alasan' },
                  { kunci: 'dibatalkan_nama', label: 'Dibatalkan oleh' },
                  { kunci: 'dibatalkan_pada', label: 'Waktu', tampil: (b) => waktu(b.dibatalkan_pada) },
                ]}
                data={r.warkat_batal}
                kosong="Tidak ada lembar yang dibatalkan pada rentang ini"
              />
            </Kartu>
          </>
        )}
      </Muat>
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-03 jurnal pengeluaran kas

function JurnalPengeluaranKas({ info }) {
  const { saring, nilai, periode } = useRentang(['rekening_kas_id']);
  const rekening = useRekening();
  const q = useApi(`/laporan/jurnal-pengeluaran-kas${qs(nilai)}`);
  const kolom = [
    { kunci: 'tanggal', label: 'Tanggal', tanggal: true, nowrap: true },
    { kunci: 'nomor', label: 'Jurnal', tampil: (b) => <Link to={`/jurnal/${b.id}`}>{b.nomor}</Link> },
    { kunci: 'bkk_nomor', label: 'BKK' },
    { kunci: 'bukti_bayar', label: 'Cek atau referensi' },
    { kunci: 'keterangan', label: 'Keterangan' },
    { kunci: 'debit_utang_usaha', label: 'Dr Utang usaha', uang: true },
    {
      kunci: 'debit_lain',
      label: 'Dr Lain-lain',
      tampil: (b) => b.debit_lain.map((l) => <div key={l.akun} className="kecil">{`${l.akun}: ${rupiah(l.jumlah)}`}</div>),
      csv: (b) => b.debit_lain.map((l) => `${l.akun}: ${l.jumlah}`).join('; '),
    },
    { kunci: 'debit_lain_total', label: 'Jumlah lain-lain', uang: true },
    { kunci: 'kredit_pajak', label: 'Cr Utang pajak', uang: true },
    { kunci: 'kredit_bank', label: 'Cr Bank', uang: true },
  ];
  return (
    <Kerangka
      info={info}
      periode={periode}
      csv={q.data && (() => unduhCsv(`jurnal-pengeluaran-kas_${nilai.dari}_${nilai.sampai}`, kolom, q.data.data))}
      filter={
        <>
          <FilterTanggal saring={saring} />
          <Kolom label="Rekening">
            <Pilihan pilihan={(rekening.data || []).map((r) => [r.id, r.nama])} kosong="Semua rekening" value={nilai.rekening_kas_id} onChange={(e) => saring.atur('rekening_kas_id', e.target.value)} />
          </Kolom>
        </>
      }
    >
      <Muat kueri={q}>
        {(r) => {
          const debit = Number(r.total.debit_utang_usaha) + Number(r.total.debit_lain_total);
          const kredit = Number(r.total.kredit_pajak) + Number(r.total.kredit_bank);
          return (
            <Kartu rapat>
              <TabelLaporan
                kolom={kolom}
                data={r.data}
                kelasBaris={(b) => (b.pembalik_dari_id ? 'selisih' : '')}
                kaki={
                  <tr>
                    <td colSpan={5}>Jumlah kolom</td>
                    <td className="angka">{rupiah(r.total.debit_utang_usaha)}</td>
                    <td />
                    <td className="angka">{rupiah(r.total.debit_lain_total)}</td>
                    <td className="angka">{rupiah(r.total.kredit_pajak)}</td>
                    <td className="angka">{rupiah(r.total.kredit_bank)}</td>
                  </tr>
                }
              />
              <p className="kecil" style={{ padding: '6px 16px 10px', margin: 0 }}>
                Pemeriksaan silang: total debit {rupiah(debit)} {Math.round(debit * 100) === Math.round(kredit * 100) ? 'sama dengan' : 'TIDAK sama dengan'} total kredit {rupiah(kredit)}. Baris berlatar kuning adalah jurnal pembalik (nilai negatif).
              </p>
            </Kartu>
          );
        }}
      </Muat>
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-04 buku pembantu utang

function BukuPembantuUtang({ info }) {
  const { saring, nilai, periode } = useRentang(['pemasok_id']);
  const pemasok = usePilihanPemasok({ aktif: false });
  const q = useApi(nilai.pemasok_id ? `/laporan/buku-pembantu-utang${qs(nilai)}` : null);
  const kolom = [
    { kunci: 'tanggal', label: 'Tanggal', tanggal: true, nowrap: true },
    { kunci: 'nomor', label: 'Jurnal', tampil: (b) => <Link to={`/jurnal/${b.jurnal_id}`}>{b.nomor}</Link> },
    { kunci: 'sumber_nomor', label: 'Sumber' },
    { kunci: 'uraian', label: 'Uraian', tampil: (b) => b.uraian || b.keterangan, csv: (b) => b.uraian || b.keterangan },
    { kunci: 'debit', label: 'Debit (bayar)', uang: true },
    { kunci: 'kredit', label: 'Kredit (utang)', uang: true },
    { kunci: 'saldo', label: 'Saldo', uang: true },
  ];
  return (
    <Kerangka
      info={info}
      periode={periode}
      csv={q.data && (() => unduhCsv(`buku-pembantu-utang_${q.data.pemasok.kode}`, kolom, q.data.data))}
      filter={
        <>
          <Kolom label="Pemasok" className="lebar">
            <Kombo pilihan={pemasok} value={nilai.pemasok_id} onChange={(x) => saring.atur('pemasok_id', x)} placeholder="Pilih pemasok" />
          </Kolom>
          <FilterTanggal saring={saring} />
        </>
      }
    >
      {!nilai.pemasok_id ? (
        <Pesan jenis="info">Pilih pemasok untuk menampilkan buku pembantunya.</Pesan>
      ) : (
        <Muat kueri={q}>
          {(r) => (
            <Kartu judul={r.pemasok.nama} rapat>
              <Ringkas butir={[['Saldo awal', rupiah(r.saldo_awal)], ['Mutasi debit', rupiah(r.total_debit)], ['Mutasi kredit', rupiah(r.total_kredit)], ['Saldo akhir', rupiah(r.saldo_akhir)]]} />
              <TabelLaporan kolom={kolom} data={r.data} kosong="Tidak ada mutasi pada rentang ini" />
            </Kartu>
          )}
        </Muat>
      )}
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-05 saldo utang

function SaldoUtang({ info }) {
  const saring = useSaring(['sampai']);
  const per = saring.nilai.sampai || hariIni();
  const q = useApi(`/laporan/saldo-utang?per_tanggal=${per}`);
  const kolom = [
    { kunci: 'kode', label: 'Kode' },
    { kunci: 'nama', label: 'Pemasok' },
    { kunci: 'jumlah_faktur', label: 'Faktur terbuka', angka: true },
    { kunci: 'sisa_faktur', label: 'Sisa faktur', uang: true },
    { kunci: 'saldo_buku_besar', label: 'Saldo buku pembantu', uang: true },
    { kunci: 'selisih', label: 'Selisih', uang: true },
  ];
  return (
    <Kerangka info={info} periode={`Per ${tanggal(per, true)}`} csv={q.data && (() => unduhCsv(`saldo-utang_${per}`, kolom, q.data.data))} filter={<FilterTanggal saring={saring} dari={false} />}>
      <Muat kueri={q}>
        {(r) => {
          const cocok = Number(r.total_buku_pembantu) === Number(r.saldo_akun_kontrol) && Number(r.total_sisa_faktur) === Number(r.saldo_akun_kontrol);
          return (
            <Kartu rapat>
              <Ringkas
                butir={[
                  ['Total buku pembantu', rupiah(r.total_buku_pembantu)],
                  ['Total sisa faktur', rupiah(r.total_sisa_faktur)],
                  [`Akun kontrol ${r.akun_kontrol}`, rupiah(r.saldo_akun_kontrol)],
                  ['Hasil pencocokan', cocok ? 'Cocok' : 'Berselisih', cocok ? 'sukses' : 'bahaya'],
                ]}
              />
              <TabelLaporan
                kolom={kolom}
                data={r.data}
                kelasBaris={(b) => (Number(b.selisih) !== 0 ? 'selisih' : '')}
                kaki={
                  <tr>
                    <td colSpan={3}>Jumlah</td>
                    <td className="angka">{rupiah(r.total_sisa_faktur)}</td>
                    <td className="angka">{rupiah(r.total_buku_pembantu)}</td>
                    <td />
                  </tr>
                }
              />
            </Kartu>
          );
        }}
      </Muat>
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-06 umur utang

function UmurUtang({ info }) {
  const q = useApi('/laporan/umur-utang');
  return (
    <Muat kueri={q}>
      {(r) => {
        const kolom = [
          { kunci: 'pemasok_kode', label: 'Kode' },
          { kunci: 'pemasok_nama', label: 'Pemasok' },
          ...r.kelompok.map((k) => ({ kunci: k.kunci, label: k.label, uang: true })),
          { kunci: 'total', label: 'Total', uang: true },
        ];
        return (
          <Kerangka info={info} periode={`Per ${tanggal(r.per_tanggal, true)}`} csv={() => unduhCsv(`umur-utang_${r.per_tanggal}`, kolom, r.data)}>
            <Kartu judul="Komposisi umur" className="halaman-kecil">
              <GrafikBatangH data={r.kelompok.map((k, i) => ({ label: k.label, nilai: Number(r.total[k.kunci]), warna: WARNA_UMUR[i] }))} />
            </Kartu>
            <Kartu judul="Rincian per pemasok" rapat>
              <TabelLaporan
                kolom={kolom}
                data={r.data}
                kaki={
                  <tr>
                    <td colSpan={2}>Jumlah</td>
                    {r.kelompok.map((k) => (
                      <td key={k.kunci} className="angka">
                        {rupiah(r.total[k.kunci])}
                      </td>
                    ))}
                    <td className="angka">{rupiah(r.total_semua)}</td>
                  </tr>
                }
              />
            </Kartu>
          </Kerangka>
        );
      }}
    </Muat>
  );
}

// ---------------------------------------------------------------- LAP-07 faktur jatuh tempo

function FakturJatuhTempo({ info }) {
  const saring = useSaring(['hari']);
  const hari = saring.nilai.hari || '14';
  const q = useApi(`/laporan/faktur-jatuh-tempo?hari=${hari}`);
  const kolom = [
    { kunci: 'tanggal_jatuh_tempo', label: 'Jatuh tempo', tanggal: true, nowrap: true },
    {
      kunci: 'hari_menuju_jatuh_tempo',
      label: 'Posisi',
      tampil: (b) => (b.hari_menuju_jatuh_tempo < 0 ? <span className="teks-bahaya">Lewat {-b.hari_menuju_jatuh_tempo} hari</span> : b.hari_menuju_jatuh_tempo === 0 ? 'Hari ini' : `${b.hari_menuju_jatuh_tempo} hari lagi`),
    },
    { kunci: 'pemasok_nama', label: 'Pemasok' },
    { kunci: 'nomor_faktur', label: 'Nomor faktur', tampil: (b) => <Link to={`/faktur/${b.id}`}>{b.nomor_faktur}</Link> },
    { kunci: 'sisa', label: 'Sisa utang', uang: true },
    { kunci: 'dalam_proses', label: 'Sedang di BKK', uang: true },
    { kunci: 'belum_diproses', label: 'Belum diproses', uang: true },
  ];
  return (
    <Kerangka
      info={info}
      periode={q.data ? `Jatuh tempo sampai ${tanggal(q.data.sampai, true)}` : ''}
      csv={q.data && (() => unduhCsv(`faktur-jatuh-tempo_${hari}hari`, kolom, q.data.data))}
      filter={
        <Kolom label="Jatuh tempo dalam">
          <Pilihan pilihan={[['7', '7 hari'], ['14', '14 hari'], ['30', '30 hari'], ['60', '60 hari']]} value={hari} onChange={(e) => saring.atur('hari', e.target.value)} />
        </Kolom>
      }
    >
      <Muat kueri={q}>
        {(r) => (
          <Kartu rapat>
            <Ringkas butir={[['Faktur', angka(r.data.length)], ['Total sisa utang', rupiah(r.total_sisa)], ['Sudah lewat jatuh tempo', rupiah(r.total_lewat), Number(r.total_lewat) > 0 ? 'bahaya' : '']]} />
            <TabelLaporan kolom={kolom} data={r.data} kosong="Tidak ada faktur yang jatuh tempo pada rentang ini" />
          </Kartu>
        )}
      </Muat>
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-08 kas kecil

function LaporanKasKecil({ info }) {
  const { pengguna, punya } = useAuth();
  const { saring, nilai, periode } = useRentang(['dana_id']);
  const dana = useDana();
  const pilihan = (dana.data || []).filter((d) => punya(PERAN_LAPORAN) || d.pemegang_id === pengguna.id);
  const q = useApi(nilai.dana_id ? `/laporan/kas-kecil${qs(nilai)}` : null);
  const kolom = [
    { kunci: 'tanggal', label: 'Tanggal', tanggal: true, nowrap: true },
    { kunci: 'dokumen', label: 'Dokumen' },
    { kunci: 'uraian', label: 'Uraian' },
    { kunci: 'masuk', label: 'Masuk', uang: true },
    { kunci: 'keluar', label: 'Keluar', uang: true },
    { kunci: 'saldo', label: 'Saldo tunai', uang: true },
  ];
  return (
    <Kerangka
      info={info}
      periode={periode}
      csv={q.data && (() => unduhCsv(`kas-kecil_${q.data.dana.kode}_${nilai.dari}_${nilai.sampai}`, kolom, q.data.data))}
      filter={
        <>
          <Kolom label="Dana">
            <Pilihan pilihan={pilihan.map((d) => [d.id, d.nama])} kosong="Pilih dana" value={nilai.dana_id} onChange={(e) => saring.atur('dana_id', e.target.value)} />
          </Kolom>
          <FilterTanggal saring={saring} />
        </>
      }
    >
      {!nilai.dana_id ? (
        <Pesan jenis="info">Pilih dana kas kecil.</Pesan>
      ) : (
        <Muat kueri={q}>
          {(r) => (
            <Kartu judul={`${r.dana.nama} · pemegang ${r.dana.pemegang_nama}`} rapat>
              <Ringkas
                butir={[
                  ['Dana tetap', rupiah(r.posisi.jumlah_dana)],
                  ['Saldo awal periode', rupiah(r.saldo_awal)],
                  ['Masuk', rupiah(r.total_masuk)],
                  ['Keluar', rupiah(r.total_keluar)],
                  ['Saldo akhir periode', rupiah(r.saldo_akhir)],
                  ['Bukti belum diganti saat ini', rupiah(r.posisi.bukti_belum_diganti)],
                ]}
              />
              <TabelLaporan kolom={kolom} data={r.data} kosong="Tidak ada mutasi pada rentang ini" />
            </Kartu>
          )}
        </Muat>
      )}
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-09 uang muka beredar

function UangMukaBeredar({ info }) {
  const q = useApi('/laporan/uang-muka-beredar');
  const kolom = [
    { kunci: 'nomor', label: 'Nomor', tampil: (b) => <Link to={`/uang-muka/${b.id}`}>{b.nomor}</Link> },
    { kunci: 'pemohon', label: 'Pemohon' },
    { kunci: 'departemen_nama', label: 'Unit kerja' },
    { kunci: 'keperluan', label: 'Keperluan' },
    { kunci: 'tanggal_bayar', label: 'Dibayar', tanggal: true, nowrap: true },
    { kunci: 'umur_hari', label: 'Umur (hari)', angka: true },
    { kunci: 'tanggal_batas_pj', label: 'Tenggat', tanggal: true, nowrap: true },
    { kunci: 'hari_lewat_tenggat', label: 'Lewat tenggat', tampil: (b) => (b.lewat_tenggat ? <span className="teks-bahaya">{b.hari_lewat_tenggat} hari</span> : '-') },
    { kunci: 'pjum_status', label: 'Pertanggungjawaban', tampil: (b) => (b.pjum_status ? <Status kode={b.pjum_status} /> : 'Belum dibuat') },
    { kunci: 'jumlah', label: 'Jumlah', uang: true },
  ];
  return (
    <Muat kueri={q}>
      {(r) => (
        <Kerangka info={info} periode={`Per ${tanggal(r.per_tanggal, true)}`} csv={() => unduhCsv(`uang-muka-beredar_${r.per_tanggal}`, kolom, r.data)}>
          <Kartu rapat>
            <Ringkas butir={[['Uang muka beredar', rupiah(r.total)], ['Lewat tenggat', `${rupiah(r.total_lewat_tenggat)} (${r.jumlah_lewat_tenggat} dokumen)`, r.jumlah_lewat_tenggat ? 'bahaya' : '']]} />
            <TabelLaporan kolom={kolom} data={r.data} kosong="Tidak ada uang muka yang beredar" kelasBaris={(b) => (b.lewat_tenggat ? 'selisih' : '')} />
          </Kartu>
        </Kerangka>
      )}
    </Muat>
  );
}

// ---------------------------------------------------------------- LAP-10 buku besar

function BukuBesar({ info }) {
  const { saring, nilai, periode } = useRentang(['akun_id']);
  const akun = usePilihanAkun({ semua: true });
  const q = useApi(nilai.akun_id ? `/laporan/buku-besar${qs(nilai)}` : null);
  const kolom = [
    { kunci: 'tanggal', label: 'Tanggal', tanggal: true, nowrap: true },
    { kunci: 'nomor', label: 'Jurnal', tampil: (b) => <Link to={`/jurnal/${b.jurnal_id}`}>{b.nomor}</Link> },
    { kunci: 'sumber_nomor', label: 'Sumber' },
    { kunci: 'uraian', label: 'Uraian', tampil: (b) => b.uraian || b.keterangan, csv: (b) => b.uraian || b.keterangan },
    { kunci: 'departemen_kode', label: 'Dept' },
    { kunci: 'debit', label: 'Debit', uang: true },
    { kunci: 'kredit', label: 'Kredit', uang: true },
    { kunci: 'saldo', label: 'Saldo', uang: true },
  ];
  return (
    <Kerangka
      info={info}
      periode={periode}
      csv={q.data && (() => unduhCsv(`buku-besar_${q.data.akun.kode}_${nilai.dari}_${nilai.sampai}`, kolom, q.data.data))}
      filter={
        <>
          <Kolom label="Akun" className="lebar">
            <Kombo pilihan={akun} value={nilai.akun_id} onChange={(x) => saring.atur('akun_id', x)} placeholder="Pilih akun" />
          </Kolom>
          <FilterTanggal saring={saring} />
        </>
      }
    >
      {!nilai.akun_id ? (
        <Pesan jenis="info">Pilih akun untuk menampilkan buku besarnya.</Pesan>
      ) : (
        <Muat kueri={q}>
          {(r) => (
            <Kartu judul={`${r.akun.kode} ${r.akun.nama} (saldo normal ${r.akun.saldo_normal === 'D' ? 'debit' : 'kredit'})`} rapat>
              <Ringkas butir={[['Saldo awal', rupiah(r.saldo_awal)], ['Debit', rupiah(r.total_debit)], ['Kredit', rupiah(r.total_kredit)], ['Saldo akhir', rupiah(r.saldo_akhir)]]} />
              <TabelLaporan kolom={kolom} data={r.data} kosong="Tidak ada mutasi pada rentang ini" />
            </Kartu>
          )}
        </Muat>
      )}
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-11 neraca saldo

function NeracaSaldo({ info }) {
  const saring = useSaring(['sampai']);
  const per = saring.nilai.sampai || hariIni();
  const q = useApi(`/laporan/neraca-saldo?sampai=${per}`);
  const kolom = [
    { kunci: 'kode', label: 'Kode' },
    { kunci: 'nama', label: 'Nama akun' },
    { kunci: 'kategori', label: 'Kategori', tampil: (b) => b.kategori.charAt(0) + b.kategori.slice(1).toLowerCase() },
    { kunci: 'saldo_debit', label: 'Debit', uang: true },
    { kunci: 'saldo_kredit', label: 'Kredit', uang: true },
  ];
  return (
    <Kerangka info={info} periode={`Per ${tanggal(per, true)}`} csv={q.data && (() => unduhCsv(`neraca-saldo_${per}`, kolom, q.data.data))} filter={<FilterTanggal saring={saring} dari={false} />}>
      <Muat kueri={q}>
        {(r) => (
          <Kartu rapat>
            <Ringkas butir={[['Total debit', rupiah(r.total_debit)], ['Total kredit', rupiah(r.total_kredit)], ['Keseimbangan', r.seimbang ? 'Seimbang' : 'Tidak seimbang', r.seimbang ? 'sukses' : 'bahaya']]} />
            <TabelLaporan
              kolom={kolom}
              data={r.data}
              kaki={
                <tr>
                  <td colSpan={3}>Jumlah</td>
                  <td className="angka">{rupiah(r.total_debit)}</td>
                  <td className="angka">{rupiah(r.total_kredit)}</td>
                </tr>
              }
            />
          </Kartu>
        )}
      </Muat>
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-12 pengeluaran per departemen

function PengeluaranDepartemen({ info }) {
  const { saring, nilai, periode } = useRentang();
  const q = useApi(`/laporan/pengeluaran-departemen${qs(nilai)}`);
  const kolom = [
    { kunci: 'departemen_nama', label: 'Unit kerja' },
    { kunci: 'akun_kode', label: 'Kode akun' },
    { kunci: 'akun_nama', label: 'Nama akun' },
    { kunci: 'jumlah', label: 'Jumlah', uang: true },
  ];
  return (
    <Kerangka info={info} periode={periode} csv={q.data && (() => unduhCsv(`pengeluaran-departemen_${nilai.dari}_${nilai.sampai}`, kolom, q.data.data))} filter={<FilterTanggal saring={saring} />}>
      <Muat kueri={q}>
        {(r) => (
          <div className="grid-2-1">
            <Kartu rapat>
              <TabelLaporan
                kolom={kolom}
                data={r.data}
                kaki={
                  <tr>
                    <td colSpan={3}>Total beban</td>
                    <td className="angka">{rupiah(r.total)}</td>
                  </tr>
                }
              />
            </Kartu>
            <Kartu judul="Beban per unit kerja">
              <GrafikBatangH data={r.per_departemen.map((d) => ({ label: d.departemen_nama, nilai: Number(d.jumlah), warna: '#2a78d6' }))} />
            </Kartu>
          </div>
        )}
      </Muat>
    </Kerangka>
  );
}

// ---------------------------------------------------------------- LAP-13 pengecualian

function Bagian({ judul, kolom, data, kosong }) {
  return (
    <Kartu judul={`${judul} (${data.length})`} rapat>
      <TabelLaporan kolom={kolom} data={data} kosong={kosong || 'Tidak ada'} />
    </Kartu>
  );
}

function Pengecualian({ info }) {
  const { saring, nilai, periode } = useRentang();
  const q = useApi(`/laporan/pengecualian${qs(nilai)}`);
  return (
    <Kerangka info={info} periode={periode} filter={<FilterTanggal saring={saring} />}>
      <Muat kueri={q}>
        {(r) => (
          <>
            <Bagian
              judul="Selisih pencocokan faktur yang disetujui"
              data={r.selisih_disetujui}
              kolom={[
                { kunci: 'nomor', label: 'Register', tampil: (b) => <Link to={`/faktur/${b.id}`}>{b.nomor}</Link> },
                { kunci: 'nomor_faktur', label: 'Nomor faktur' },
                { kunci: 'pemasok_nama', label: 'Pemasok' },
                { kunci: 'catatan_selisih', label: 'Selisih' },
                { kunci: 'disetujui_oleh', label: 'Disetujui oleh' },
                { kunci: 'diputuskan_pada', label: 'Waktu', tampil: (b) => waktu(b.diputuskan_pada) },
                { kunci: 'total_tagihan', label: 'Tagihan', uang: true },
              ]}
            />
            <Bagian
              judul="Pembayaran yang dibatalkan"
              data={r.pembayaran_batal}
              kolom={[
                { kunci: 'nomor', label: 'Pembayaran' },
                { kunci: 'bkk_nomor', label: 'BKK' },
                { kunci: 'bukti', label: 'Cek atau referensi' },
                { kunci: 'penerima_nama', label: 'Penerima' },
                { kunci: 'alasan_batal', label: 'Alasan' },
                { kunci: 'dibatalkan_oleh', label: 'Dibatalkan oleh' },
                { kunci: 'jumlah', label: 'Jumlah', uang: true },
              ]}
            />
            <Bagian
              judul="Lembar cek atau bilyet giro kosong yang dibatalkan"
              data={r.warkat_batal}
              kolom={[
                { kunci: 'nomor', label: 'Nomor' },
                { kunci: 'rekening_kode', label: 'Rekening' },
                { kunci: 'keterangan', label: 'Alasan' },
                { kunci: 'dibatalkan_oleh', label: 'Dibatalkan oleh' },
                { kunci: 'dibatalkan_pada', label: 'Waktu', tampil: (b) => waktu(b.dibatalkan_pada) },
              ]}
            />
            <Bagian
              judul="Dokumen yang ditolak"
              data={r.dokumen_ditolak}
              kolom={[
                { kunci: 'nomor_dokumen', label: 'Dokumen' },
                { kunci: 'nama_langkah', label: 'Langkah' },
                { kunci: 'pembuat', label: 'Pembuat' },
                { kunci: 'ditolak_oleh', label: 'Ditolak oleh' },
                { kunci: 'catatan', label: 'Alasan' },
                { kunci: 'nilai', label: 'Nilai', uang: true },
              ]}
            />
            <Bagian
              judul="Pembayaran faktur setelah jatuh tempo"
              data={r.bayar_terlambat}
              kolom={[
                { kunci: 'nomor_faktur', label: 'Faktur' },
                { kunci: 'pemasok_nama', label: 'Pemasok' },
                { kunci: 'tanggal_jatuh_tempo', label: 'Jatuh tempo', tanggal: true },
                { kunci: 'tanggal_bayar', label: 'Dibayar', tanggal: true },
                { kunci: 'hari_terlambat', label: 'Terlambat (hari)', angka: true },
                { kunci: 'jumlah', label: 'Jumlah', uang: true },
              ]}
            />
            <Bagian
              judul="Opname kas kecil dengan selisih"
              data={r.opname_selisih}
              kolom={[
                { kunci: 'nomor', label: 'Nomor' },
                { kunci: 'dana_nama', label: 'Dana' },
                { kunci: 'pemeriksa', label: 'Pemeriksa' },
                { kunci: 'saldo_seharusnya', label: 'Seharusnya', uang: true },
                { kunci: 'total_fisik', label: 'Fisik', uang: true },
                { kunci: 'selisih', label: 'Selisih', uang: true },
              ]}
            />
            <Bagian
              judul="Perubahan data sensitif dan keamanan"
              data={r.log_penting}
              kolom={[
                { kunci: 'waktu', label: 'Waktu', tampil: (b) => waktu(b.waktu) },
                { kunci: 'username', label: 'Pengguna' },
                { kunci: 'ip', label: 'Alamat IP' },
                { kunci: 'aksi', label: 'Aksi' },
                { kunci: 'ringkasan', label: 'Ringkasan' },
              ]}
            />
            <Bagian
              judul="Perubahan aturan persetujuan dan pengaturan"
              data={r.perubahan_aturan}
              kolom={[
                { kunci: 'waktu', label: 'Waktu', tampil: (b) => waktu(b.waktu) },
                { kunci: 'username', label: 'Pengguna' },
                { kunci: 'aksi', label: 'Aksi' },
                { kunci: 'ringkasan', label: 'Ringkasan' },
              ]}
            />
          </>
        )}
      </Muat>
    </Kerangka>
  );
}

// ---------------------------------------------------------------- perute laporan

const KOMPONEN = {
  'register-bkk': RegisterBKK,
  'register-cek': RegisterCek,
  'jurnal-pengeluaran-kas': JurnalPengeluaranKas,
  'buku-pembantu-utang': BukuPembantuUtang,
  'saldo-utang': SaldoUtang,
  'umur-utang': UmurUtang,
  'faktur-jatuh-tempo': FakturJatuhTempo,
  'kas-kecil': LaporanKasKecil,
  'uang-muka-beredar': UangMukaBeredar,
  'buku-besar': BukuBesar,
  'neraca-saldo': NeracaSaldo,
  'pengeluaran-departemen': PengeluaranDepartemen,
  pengecualian: Pengecualian,
};

export function HalamanSatuLaporan() {
  const { kode } = useParams();
  const { punya } = useAuth();
  const info = KATALOG.find((l) => l.rute === kode);
  const Komponen = KOMPONEN[kode];
  if (!info || !Komponen) {
    return <Pesan jenis="galat">Laporan tidak ditemukan. <Link to="/laporan">Kembali ke daftar laporan</Link></Pesan>;
  }
  if (!punya(info.peran)) {
    return <Pesan jenis="galat">Anda tidak berwenang membuka laporan ini.</Pesan>;
  }
  return <Komponen info={info} />;
}
