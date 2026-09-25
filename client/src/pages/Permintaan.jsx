// Permintaan pembayaran (PP) dan halaman "Permintaan saya" yang merangkum seluruh permintaan milik pemohon.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PERAN_KEUANGAN } from '../konstanta.js';
import { hariIni, jumlahkan, rupiah, tanggal } from '../format.js';
import { useAksi, useApi, usePilihanAkun, usePilihanPemasok } from '../components/data.js';
import { EditorBaris, SaringDaftar, TombolCetak, useAksiDokumen, useSaring } from '../components/Dokumen.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import { PanelPersetujuan } from '../components/Persetujuan.jsx';
import {
  AreaTeks, BarisKosong, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Muat, Pesan, Status, TautanDok, TautanTombol, Tombol, TotalRingkas,
  useFormulir,
} from '../components/ui.jsx';

const STATUS_PP = [
  ['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DISETUJUI', 'Disetujui'], ['DITOLAK', 'Ditolak'], ['DIPROSES', 'Diproses'], ['DIBAYAR', 'Dibayar'], ['BATAL', 'Batal'],
];

/** Catatan penolakan terakhir dari riwayat persetujuan. */
export function PesanDokumen({ doc, labelDok = 'dokumen', perluLampiran = true }) {
  const tolak = [...(doc.persetujuan || [])].reverse().find((p) => p.status === 'DITOLAK');
  return (
    <>
      {doc.status === 'DITOLAK' && tolak && (
        <Pesan jenis="galat" judul={`Ditolak oleh ${tolak.diputuskan_nama} (${tolak.nama_langkah})`}>
          {tolak.catatan} Perbaiki {labelDok}, lalu ajukan kembali.
        </Pesan>
      )}
      {doc.status === 'BATAL' && doc.alasan_batal && <Pesan jenis="peringatan" judul="Dokumen dibatalkan">{doc.alasan_batal}</Pesan>}
      {perluLampiran && ['DRAFT', 'DITOLAK'].includes(doc.status) && doc.jumlah_lampiran === 0 && (
        <Pesan jenis="info">Unggah minimal satu dokumen pendukung (nota, tagihan, atau kuitansi) sebelum mengajukan.</Pesan>
      )}
    </>
  );
}

// ---------------------------------------------------------------- daftar PP

export function DaftarPP() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring();
  const q = useApi(`/pp${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Permintaan pembayaran"
        sub="Tagihan di luar pesanan pembelian, misalnya listrik, sewa, jasa profesional, dan biaya perjalanan."
        aksi={punya('PEMOHON') && <TautanTombol ke="/pp/baru" varian="utama" ikon="tambah">Buat permintaan</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={STATUS_PP} />
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Tanggal</th>
                    <th>Pemohon</th>
                    <th>Penerima</th>
                    <th>Keterangan</th>
                    <th className="angka">Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={7} judul="Tidak ada permintaan pembayaran yang cocok dengan penyaring" />}
                  {data.map((d) => (
                    <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/pp/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td className="nowrap">{tanggal(d.tanggal)}</td>
                      <td>
                        {d.dibuat_nama}
                        <div className="kecil sangat-lemah">{d.departemen_nama}</div>
                      </td>
                      <td>{d.penerima_nama}</td>
                      <td>{d.keterangan}</td>
                      <td className="angka">{rupiah(d.total)}</td>
                      <td>
                        <Status kode={d.status} />
                        {d.bkk_nomor && <div className="kecil sangat-lemah">{d.bkk_nomor}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Muat>
      </Kartu>
    </>
  );
}

// ---------------------------------------------------------------- formulir PP

function FormPP({ awal, id }) {
  const navigate = useNavigate();
  const f = useFormulir(awal);
  const [baris, setBaris] = useState(awal.baris);
  const { jalankan, sibuk } = useAksi();
  const akun = usePilihanAkun({ pembebanan: true, kategori: ['BEBAN', 'ASET', 'LIABILITAS'] });
  const pemasok = usePilihanPemasok();
  const v = f.nilai;
  const pilihanPemasok = pemasok.find((p) => String(p.nilai) === String(v.pemasok_id))?.data;
  const total = jumlahkan(baris, (b) => b.jumlah);

  const kirim = async (e) => {
    e.preventDefault();
    const data = {
      tanggal: v.tanggal,
      tanggal_dibutuhkan: v.tanggal_dibutuhkan,
      keterangan: v.keterangan,
      dokumen_pendukung: v.dokumen_pendukung,
      pemasok_id: v.mode === 'PEMASOK' ? v.pemasok_id : null,
      penerima_nama: v.mode === 'LAIN' ? v.penerima_nama : null,
      penerima_bank_nama: v.mode === 'LAIN' ? v.penerima_bank_nama : null,
      penerima_bank_rekening: v.mode === 'LAIN' ? v.penerima_bank_rekening : null,
      penerima_bank_atas_nama: v.mode === 'LAIN' ? v.penerima_bank_atas_nama : null,
      baris: baris.map(({ uraian, akun_id, jumlah }) => ({ uraian, akun_id, jumlah })),
    };
    const r = await jalankan(() => (id ? api.put(`/pp/${id}`, data) : api.post('/pp', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (id ? 'Perubahan permintaan tersimpan.' : `Permintaan ${h.nomor} tersimpan sebagai draf. Unggah lampiran, lalu ajukan.`),
    });
    if (r.ok) navigate(`/pp/${id || r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul="Data permintaan">
        <div className="formulir">
          <Kolom label="Tanggal permintaan" galat={f.galat.tanggal} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
          </Kolom>
          <Kolom label="Tanggal dibutuhkan" opsional galat={f.galat.tanggal_dibutuhkan} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal_dibutuhkan')} salah={!!f.galat.tanggal_dibutuhkan} />
          </Kolom>
          <Kolom label="Penerima pembayaran" lebar={6}>
            <div className="tombol-grup" role="group" aria-label="Jenis penerima">
              <button type="button" className={v.mode === 'PEMASOK' ? 'aktif' : ''} onClick={() => f.atur('mode', 'PEMASOK')}>
                Pemasok terdaftar
              </button>
              <button type="button" className={v.mode === 'LAIN' ? 'aktif' : ''} onClick={() => f.atur('mode', 'LAIN')}>
                Pihak lain
              </button>
            </div>
          </Kolom>
          {v.mode === 'PEMASOK' ? (
            <>
              <Kolom label="Pemasok" galat={f.galat.pemasok_id} lebar={6}>
                <Kombo pilihan={pemasok} value={v.pemasok_id} onChange={(x) => f.atur('pemasok_id', x)} salah={!!f.galat.pemasok_id} placeholder="Ketik nama pemasok" />
              </Kolom>
              <Kolom label="Rekening pemasok" lebar={6}>
                <Masukan
                  readOnly
                  value={pilihanPemasok ? (pilihanPemasok.bank_nomor_rekening ? `${pilihanPemasok.bank_nama} ${pilihanPemasok.bank_nomor_rekening} a.n. ${pilihanPemasok.bank_atas_nama}` : 'Belum ada data rekening') : ''}
                />
              </Kolom>
            </>
          ) : (
            <>
              <Kolom label="Nama penerima" galat={f.galat.penerima_nama} lebar={6}>
                <Masukan {...f.ikat('penerima_nama')} salah={!!f.galat.penerima_nama} maxLength={150} />
              </Kolom>
              <Kolom label="Bank penerima" opsional lebar={2}>
                <Masukan {...f.ikat('penerima_bank_nama')} maxLength={60} />
              </Kolom>
              <Kolom label="Nomor rekening" opsional galat={f.galat.penerima_bank_rekening} lebar={2}>
                <Masukan {...f.ikat('penerima_bank_rekening')} salah={!!f.galat.penerima_bank_rekening} inputMode="numeric" maxLength={40} />
              </Kolom>
              <Kolom label="Atas nama" opsional lebar={2}>
                <Masukan {...f.ikat('penerima_bank_atas_nama')} maxLength={150} />
              </Kolom>
            </>
          )}
          <Kolom label="Keterangan" galat={f.galat.keterangan} lebar={6}>
            <AreaTeks {...f.ikat('keterangan')} salah={!!f.galat.keterangan} maxLength={500} placeholder="Untuk apa pembayaran ini" />
          </Kolom>
          <Kolom label="Dokumen pendukung" opsional bantuan="Misalnya: tagihan PLN September 2026 nomor 5123." lebar={6}>
            <Masukan {...f.ikat('dokumen_pendukung')} maxLength={255} />
          </Kolom>
        </div>
      </Kartu>
      <Kartu judul="Rincian pembebanan">
        <EditorBaris
          baris={baris}
          setBaris={setBaris}
          galat={f.galat}
          barisBaru={() => ({ uraian: '', akun_id: '', jumlah: '' })}
          kolom={[
            { kunci: 'uraian', label: 'Uraian', isi: (b, ubah, g) => <Masukan value={b.uraian} onChange={(e) => ubah('uraian', e.target.value)} salah={!!g} maxLength={255} aria-label="Uraian" /> },
            { kunci: 'akun_id', label: 'Akun pembebanan', lebar: '34%', isi: (b, ubah, g) => <Kombo pilihan={akun} value={b.akun_id} onChange={(x) => ubah('akun_id', x)} salah={!!g} placeholder="Ketik kode atau nama akun" /> },
            { kunci: 'jumlah', label: 'Jumlah (Rp)', angka: true, lebar: 170, isi: (b, ubah, g) => <InputUang value={b.jumlah} onChange={(x) => ubah('jumlah', x)} salah={!!g} aria-label="Jumlah" /> },
          ]}
          kaki={
            <tfoot>
              <tr>
                <td />
                <td colSpan={2}>Total</td>
                <td className="angka">{rupiah(total)}</td>
                <td />
              </tr>
            </tfoot>
          }
        />
        {f.galat.baris && <div className="kecil teks-bahaya">{f.galat.baris}</div>}
      </Kartu>
      <div className="baris-aksi">
        <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
        <Tombol type="submit" varian="utama" sibuk={sibuk}>
          {id ? 'Simpan perubahan' : 'Simpan sebagai draf'}
        </Tombol>
      </div>
    </form>
  );
}

export function HalamanFormPP() {
  const { id } = useParams();
  const q = useApi(id ? `/pp/${id}` : null);
  const judul = id ? 'Ubah permintaan pembayaran' : 'Permintaan pembayaran baru';
  const remah = [{ label: 'Permintaan pembayaran', ke: '/pp' }];
  if (!id) {
    const awal = { mode: 'LAIN', tanggal: hariIni(), tanggal_dibutuhkan: '', pemasok_id: '', penerima_nama: '', penerima_bank_nama: '', penerima_bank_rekening: '', penerima_bank_atas_nama: '', keterangan: '', dokumen_pendukung: '', baris: [{ uraian: '', akun_id: '', jumlah: '' }] };
    return (
      <>
        <Kepala judul={judul} remah={remah} />
        <FormPP awal={awal} />
      </>
    );
  }
  return (
    <>
      <Kepala judul={judul} remah={remah} />
      <Muat kueri={q}>
        {(pp) => (
          <FormPP
            id={id}
            awal={{
              mode: pp.pemasok_id ? 'PEMASOK' : 'LAIN',
              tanggal: pp.tanggal,
              tanggal_dibutuhkan: pp.tanggal_dibutuhkan || '',
              pemasok_id: pp.pemasok_id || '',
              penerima_nama: pp.penerima_nama || '',
              penerima_bank_nama: pp.penerima_bank_nama || '',
              penerima_bank_rekening: pp.penerima_bank_rekening || '',
              penerima_bank_atas_nama: pp.penerima_bank_atas_nama || '',
              keterangan: pp.keterangan || '',
              dokumen_pendukung: pp.dokumen_pendukung || '',
              baris: pp.baris.map((b) => ({ uraian: b.uraian, akun_id: b.akun_id, jumlah: Number(b.jumlah), _kunci: b.id })),
            }}
          />
        )}
      </Muat>
    </>
  );
}

// ---------------------------------------------------------------- detail PP

export function DetailPP() {
  const { id } = useParams();
  const q = useApi(`/pp/${id}`);
  return <Muat kueri={q}>{(pp) => <IsiDetailPP pp={pp} />}</Muat>;
}

function IsiDetailPP({ pp }) {
  const { pengguna, punya } = useAuth();
  const aksi = useAksiDokumen('/pp', pp.id, 'Permintaan pembayaran');
  const pembuat = pp.dibuat_oleh === pengguna.id;
  const bisaUbah = pembuat && ['DRAFT', 'DITOLAK'].includes(pp.status);
  const rekening = pp.penerima_bank_rekening ? `${pp.penerima_bank_nama} ${pp.penerima_bank_rekening} a.n. ${pp.penerima_bank_atas_nama}` : 'Tunai atau cek (tanpa rekening)';
  return (
    <>
      <Kepala
        judul={pp.nomor}
        status={<Status kode={pp.status} />}
        remah={[{ label: 'Permintaan pembayaran', ke: '/pp' }]}
        sub={pp.keterangan}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/pp/${pp.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'].includes(pp.status) && (
              <Tombol varian="bahaya" onClick={() => aksi.batal()} disabled={aksi.sibuk}>
                Batalkan
              </Tombol>
            )}
            <TombolCetak jenis="PP" id={pp.id} />
            {bisaUbah && (
              <Tombol varian="utama" ikon="kirim" onClick={aksi.ajukan} sibuk={aksi.sibuk}>
                Ajukan permintaan
              </Tombol>
            )}
          </>
        }
      />
      <PesanDokumen doc={pp} labelDok="permintaan" />
      <div className="grid-2-1">
        <div>
          <Kartu judul="Rincian permintaan">
            <Info
              butir={[
                ['Tanggal permintaan', tanggal(pp.tanggal, true)],
                ['Tanggal dibutuhkan', tanggal(pp.tanggal_dibutuhkan, true)],
                ['Pemohon', pp.dibuat_nama],
                ['Departemen', pp.departemen_nama],
                ['Penerima', pp.pemasok_id ? `${pp.penerima_nama} (pemasok terdaftar)` : pp.penerima_nama],
                ['Rekening penerima', rekening],
                ['Dokumen pendukung', pp.dokumen_pendukung],
                pp.bkk_nomor && ['Bukti kas keluar', punya(PERAN_KEUANGAN) ? <TautanDok jenis="BKK" id={pp.bkk_id}>{pp.bkk_nomor}</TautanDok> : pp.bkk_nomor],
                pp.tanggal_bayar && ['Tanggal dibayar', tanggal(pp.tanggal_bayar, true)],
              ]}
            />
          </Kartu>
          <Kartu judul="Rincian pembebanan" rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Uraian</th>
                  <th>Akun</th>
                  <th className="angka">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {pp.baris.map((b) => (
                  <tr key={b.id}>
                    <td>{b.baris}</td>
                    <td>{b.uraian}</td>
                    <td>
                      {b.akun_kode} {b.akun_nama}
                    </td>
                    <td className="angka">{rupiah(b.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TotalRingkas baris={[['Total permintaan', pp.total, true]]} nilaiTerbilang={pp.total} />
          </Kartu>
        </div>
        <div>
          <PanelPersetujuan jenis="PP" id={pp.id} riwayat={pp.persetujuan} boleh={pp.boleh_memutuskan} />
          <PanelLampiran jenis="PP" id={pp.id} bolehUnggah={(pembuat && !['BATAL', 'DIBAYAR'].includes(pp.status)) || (punya('AKUNTANSI', 'KASIR') && ['DISETUJUI', 'DIPROSES', 'DIBAYAR'].includes(pp.status))} bolehHapus={bisaUbah} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- permintaan saya

const KELOMPOK = {
  tindakan: { label: 'Perlu tindakan', status: ['DRAFT', 'DITOLAK'] },
  proses: { label: 'Dalam proses', status: ['DIAJUKAN', 'DISETUJUI', 'DIPROSES'] },
  selesai: { label: 'Selesai', status: ['DIBAYAR', 'SELESAI', 'DIGANTI'] },
};

export function HalamanPermintaanSaya() {
  const navigate = useNavigate();
  const pp = useApi('/pp?saya=1');
  const um = useApi('/uang-muka?saya=1');
  const pj = useApi('/pjum?saya=1');
  const kk = useApi('/pkk?saya=1');
  const [kelompok, setKelompok] = useState('');
  const siap = pp.data && um.data && pj.data && kk.data;
  const semua = siap
    ? [
        ...pp.data.map((d) => ({ jenis: 'Permintaan pembayaran', ke: `/pp/${d.id}`, nomor: d.nomor, tanggal: d.tanggal, uraian: d.keterangan, jumlah: d.total, status: d.status, id: `pp${d.id}` })),
        ...um.data.map((d) => ({ jenis: 'Uang muka', ke: `/uang-muka/${d.id}`, nomor: d.nomor, tanggal: d.tanggal, uraian: d.keperluan, jumlah: d.jumlah, status: d.status, id: `um${d.id}`, lewat: d.lewat_tenggat })),
        ...pj.data.map((d) => ({ jenis: 'Pertanggungjawaban', ke: `/pjum/${d.id}`, nomor: d.nomor, tanggal: d.tanggal, uraian: `${d.uang_muka_nomor}: ${d.keperluan}`, jumlah: d.total_realisasi, status: d.status, id: `pj${d.id}` })),
        ...kk.data.map((d) => ({ jenis: 'Kas kecil', ke: `/pkk/${d.id}`, nomor: d.nomor, tanggal: d.tanggal, uraian: d.keperluan, jumlah: d.jumlah, status: d.status, id: `kk${d.id}` })),
      ].sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b.nomor.localeCompare(a.nomor)))
    : [];
  const tampil = kelompok ? semua.filter((d) => KELOMPOK[kelompok].status.includes(d.status)) : semua;
  const perluPJ = (um.data || []).filter((d) => d.status === 'DIBAYAR' && (!d.pjum_status || ['DRAFT', 'DITOLAK'].includes(d.pjum_status)));

  return (
    <>
      <Kepala
        judul="Permintaan saya"
        sub="Semua permintaan yang Anda buat beserta posisinya saat ini."
        aksi={
          <>
            <TautanTombol ke="/pkk/baru" ikon="tambah">Kas kecil</TautanTombol>
            <TautanTombol ke="/uang-muka/baru" ikon="tambah">Uang muka</TautanTombol>
            <TautanTombol ke="/pp/baru" varian="utama" ikon="tambah">Permintaan pembayaran</TautanTombol>
          </>
        }
      />
      {perluPJ.map((d) => (
        <Pesan key={d.id} jenis={d.lewat_tenggat ? 'galat' : 'peringatan'} judul={`Uang muka ${d.nomor} perlu dipertanggungjawabkan`}>
          Tenggat {tanggal(d.tanggal_batas_pj, true)}
          {d.lewat_tenggat ? `, sudah lewat ${d.hari_lewat_tenggat} hari` : ''}.{' '}
          {d.pjum_id ? <Link to={`/pjum/${d.pjum_id}`}>Lanjutkan pertanggungjawaban</Link> : <Link to={`/pjum/baru?uang_muka_id=${d.id}`}>Buat pertanggungjawaban</Link>}
        </Pesan>
      ))}
      <Kartu rapat>
        <div className="saring" style={{ alignItems: 'center' }}>
          <div className="tombol-grup" role="group" aria-label="Saring posisi">
            <button type="button" className={kelompok === '' ? 'aktif' : ''} onClick={() => setKelompok('')}>
              Semua ({semua.length})
            </button>
            {Object.entries(KELOMPOK).map(([k, x]) => (
              <button type="button" key={k} className={kelompok === k ? 'aktif' : ''} onClick={() => setKelompok(k)}>
                {x.label} ({semua.filter((d) => x.status.includes(d.status)).length})
              </button>
            ))}
          </div>
        </div>
        {!siap ? (
          <p className="memuat">Memuat data...</p>
        ) : (
          <div className="tabel-bungkus">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Jenis</th>
                  <th>Tanggal</th>
                  <th>Uraian</th>
                  <th className="angka">Jumlah</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tampil.length === 0 && <BarisKosong kolom={6} judul="Belum ada permintaan pada kelompok ini" />}
                {tampil.map((d) => (
                  <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(d.ke)}>
                    <td className="nomor">{d.nomor}</td>
                    <td>{d.jenis}</td>
                    <td className="nowrap">{tanggal(d.tanggal)}</td>
                    <td>{d.uraian}</td>
                    <td className="angka">{rupiah(d.jumlah)}</td>
                    <td>
                      <Status kode={d.status} />
                      {d.lewat && <div className="kecil teks-bahaya">Lewat tenggat</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kartu>
    </>
  );
}
