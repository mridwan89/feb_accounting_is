// Uang muka kerja (PUM) dan pertanggungjawabannya (PJUM).
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PERAN_KEUANGAN } from '../konstanta.js';
import { hariIni, jumlahkan, rupiah, tambahHari, tanggal, terbilang } from '../format.js';
import { useAksi, useApi, usePilihanAkun } from '../components/data.js';
import { EditorBaris, SaringDaftar, TombolCetak, useAksiDokumen, useSaring } from '../components/Dokumen.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import { PanelPersetujuan } from '../components/Persetujuan.jsx';
import {
  AreaTeks, BarisKosong, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Muat, Pesan, Pilihan, Status, TautanDok, TautanTombol, Tombol, TotalRingkas,
  useFormulir,
} from '../components/ui.jsx';
import { PesanDokumen } from './Permintaan.jsx';

const STATUS_UM = [
  ['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DISETUJUI', 'Disetujui'], ['DITOLAK', 'Ditolak'], ['DIPROSES', 'Diproses'], ['DIBAYAR', 'Dibayar'], ['SELESAI', 'Selesai'], ['BATAL', 'Batal'],
];
const STATUS_PJ = [['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DISETUJUI', 'Disetujui'], ['DITOLAK', 'Ditolak'], ['SELESAI', 'Selesai'], ['BATAL', 'Batal']];
const HASIL = { PAS: 'Pas, tidak ada selisih', SISA: 'Ada sisa yang dikembalikan', KURANG: 'Ada kekurangan yang dibayar perusahaan' };

function useHariBatasPJ() {
  const q = useApi('/pengaturan', { staleTime: 300_000 });
  return Number(q.data?.find((p) => p.kunci === 'hari_batas_pj_uang_muka')?.nilai || 7);
}

// ---------------------------------------------------------------- PUM

export function DaftarUangMuka() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring();
  const q = useApi(`/uang-muka${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Uang muka kerja"
        sub="Dana kegiatan yang diberikan di muka dan wajib dipertanggungjawabkan paling lambat pada tenggatnya."
        aksi={punya('PEMOHON') && <TautanTombol ke="/uang-muka/baru" varian="utama" ikon="tambah">Ajukan uang muka</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={STATUS_UM} placeholder="Nomor, keperluan, atau nama pemohon" />
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Tanggal</th>
                    <th>Pemohon</th>
                    <th>Keperluan</th>
                    <th className="angka">Jumlah</th>
                    <th>Tenggat pertanggungjawaban</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={7} judul="Tidak ada uang muka yang cocok dengan penyaring" />}
                  {data.map((d) => (
                    <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/uang-muka/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td className="nowrap">{tanggal(d.tanggal)}</td>
                      <td>
                        {d.dibuat_nama}
                        <div className="kecil sangat-lemah">{d.departemen_nama}</div>
                      </td>
                      <td>{d.keperluan}</td>
                      <td className="angka">{rupiah(d.jumlah)}</td>
                      <td className="nowrap">
                        {tanggal(d.tanggal_batas_pj)}
                        {d.lewat_tenggat && <div className="kecil teks-bahaya">Lewat {d.hari_lewat_tenggat} hari</div>}
                      </td>
                      <td>
                        <Status kode={d.status} />
                        {d.pjum_status && <div className="kecil sangat-lemah">Pertanggungjawaban: {d.pjum_status.toLowerCase()}</div>}
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

function FormPUM({ awal, id }) {
  const navigate = useNavigate();
  const f = useFormulir(awal);
  const { jalankan, sibuk } = useAksi();
  const hariBatas = useHariBatasPJ();
  const milikSaya = useApi('/uang-muka?saya=1&status=DIBAYAR');
  const lewat = (milikSaya.data || []).find((d) => d.lewat_tenggat);
  const v = f.nilai;

  const kirim = async (e) => {
    e.preventDefault();
    const data = { tanggal: v.tanggal, keperluan: v.keperluan, jumlah: v.jumlah, tanggal_selesai_kegiatan: v.tanggal_selesai_kegiatan };
    const r = await jalankan(() => (id ? api.put(`/uang-muka/${id}`, data) : api.post('/uang-muka', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (id ? 'Perubahan uang muka tersimpan.' : `Permintaan uang muka ${h.nomor} tersimpan sebagai draf.`),
    });
    if (r.ok) navigate(`/uang-muka/${id || r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      {lewat && (
        <Pesan jenis="galat" judul={`Uang muka ${lewat.nomor} sudah lewat tenggat`}>
          Anda baru dapat mengajukan uang muka baru setelah menyelesaikan pertanggungjawaban uang muka tersebut.
        </Pesan>
      )}
      <Kartu judul="Data uang muka">
        <div className="formulir">
          <Kolom label="Tanggal permintaan" galat={f.galat.tanggal} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
          </Kolom>
          <Kolom label="Jumlah uang muka (Rp)" galat={f.galat.jumlah} lebar={3}>
            <InputUang value={v.jumlah} onChange={(x) => f.atur('jumlah', x)} salah={!!f.galat.jumlah} />
          </Kolom>
          <Kolom label="Tanggal kegiatan selesai" galat={f.galat.tanggal_selesai_kegiatan} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal_selesai_kegiatan')} salah={!!f.galat.tanggal_selesai_kegiatan} />
          </Kolom>
          <Kolom label="Tenggat pertanggungjawaban" bantuan={`${hariBatas} hari setelah kegiatan selesai.`} lebar={3}>
            <Masukan readOnly value={v.tanggal_selesai_kegiatan ? tanggal(tambahHari(v.tanggal_selesai_kegiatan, hariBatas), true) : ''} />
          </Kolom>
          <Kolom label="Keperluan" galat={f.galat.keperluan} lebar={12}>
            <AreaTeks {...f.ikat('keperluan')} salah={!!f.galat.keperluan} maxLength={500} placeholder="Kegiatan, tempat, dan rincian perkiraan biaya" />
          </Kolom>
          {v.jumlah > 0 && <div className="kolom l12 terbilang" style={{ textAlign: 'left', padding: 0 }}>Terbilang: {terbilang(v.jumlah)}</div>}
        </div>
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

export function HalamanFormUangMuka() {
  const { id } = useParams();
  const q = useApi(id ? `/uang-muka/${id}` : null);
  const judul = id ? 'Ubah permintaan uang muka' : 'Permintaan uang muka baru';
  const remah = [{ label: 'Uang muka kerja', ke: '/uang-muka' }];
  return (
    <>
      <Kepala judul={judul} remah={remah} />
      {id ? (
        <Muat kueri={q}>
          {(d) => <FormPUM id={id} awal={{ tanggal: d.tanggal, keperluan: d.keperluan, jumlah: Number(d.jumlah), tanggal_selesai_kegiatan: d.tanggal_selesai_kegiatan }} />}
        </Muat>
      ) : (
        <FormPUM awal={{ tanggal: hariIni(), keperluan: '', jumlah: '', tanggal_selesai_kegiatan: '' }} />
      )}
    </>
  );
}

export function DetailUangMuka() {
  const { id } = useParams();
  const q = useApi(`/uang-muka/${id}`);
  return <Muat kueri={q}>{(d) => <IsiDetailUangMuka um={d} />}</Muat>;
}

function IsiDetailUangMuka({ um }) {
  const { pengguna, punya } = useAuth();
  const aksi = useAksiDokumen('/uang-muka', um.id, 'Permintaan uang muka');
  const pembuat = um.dibuat_oleh === pengguna.id;
  const bisaUbah = pembuat && ['DRAFT', 'DITOLAK'].includes(um.status);
  return (
    <>
      <Kepala
        judul={um.nomor}
        status={<Status kode={um.status} />}
        remah={[{ label: 'Uang muka kerja', ke: '/uang-muka' }]}
        sub={um.keperluan}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/uang-muka/${um.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'].includes(um.status) && (
              <Tombol varian="bahaya" onClick={() => aksi.batal()} disabled={aksi.sibuk}>
                Batalkan
              </Tombol>
            )}
            <TombolCetak jenis="PUM" id={um.id} />
            {pembuat && um.status === 'DIBAYAR' && !um.pjum_id && (
              <TautanTombol ke={`/pjum/baru?uang_muka_id=${um.id}`} varian="utama" ikon="centang">Buat pertanggungjawaban</TautanTombol>
            )}
            {bisaUbah && (
              <Tombol varian="utama" ikon="kirim" onClick={aksi.ajukan} sibuk={aksi.sibuk}>
                Ajukan uang muka
              </Tombol>
            )}
          </>
        }
      />
      <PesanDokumen doc={um} labelDok="permintaan" perluLampiran={false} />
      {um.lewat_tenggat && (
        <Pesan jenis="galat" judul="Pertanggungjawaban sudah lewat tenggat">
          Tenggat {tanggal(um.tanggal_batas_pj, true)} terlewati {um.hari_lewat_tenggat} hari. Pemohon tidak dapat mengajukan uang muka baru sebelum pertanggungjawaban ini selesai.
        </Pesan>
      )}
      <div className="grid-2-1">
        <div>
          <Kartu judul="Rincian uang muka">
            <Info
              butir={[
                ['Tanggal permintaan', tanggal(um.tanggal, true)],
                ['Pemohon', um.dibuat_nama],
                ['Departemen', um.departemen_nama],
                ['Jumlah', rupiah(um.jumlah)],
                ['Kegiatan selesai', tanggal(um.tanggal_selesai_kegiatan, true)],
                ['Tenggat pertanggungjawaban', tanggal(um.tanggal_batas_pj, true)],
                um.bkk_nomor && ['Bukti kas keluar', punya(PERAN_KEUANGAN) ? <TautanDok jenis="BKK" id={um.bkk_id}>{um.bkk_nomor}</TautanDok> : um.bkk_nomor],
                um.tanggal_bayar && ['Tanggal dibayar', tanggal(um.tanggal_bayar, true)],
                um.pjum_id && ['Pertanggungjawaban', <TautanDok jenis="PJUM" id={um.pjum_id}>Lihat pertanggungjawaban ({um.pjum_status.toLowerCase()})</TautanDok>],
              ]}
            />
            <div className="terbilang" style={{ textAlign: 'left', padding: '12px 0 0' }}>
              Terbilang: {terbilang(um.jumlah)}
            </div>
          </Kartu>
        </div>
        <div>
          <PanelPersetujuan jenis="PUM" id={um.id} riwayat={um.persetujuan} boleh={um.boleh_memutuskan} />
          <PanelLampiran jenis="PUM" id={um.id} bolehUnggah={(pembuat && !['BATAL', 'SELESAI'].includes(um.status)) || (punya('AKUNTANSI', 'KASIR') && ['DISETUJUI', 'DIPROSES', 'DIBAYAR'].includes(um.status))} bolehHapus={bisaUbah} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- PJUM

export function DaftarPJUM() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring(['status', 'cari', 'hasil']);
  const q = useApi(`/pjum${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Pertanggungjawaban uang muka"
        sub="Realisasi pemakaian uang muka beserta bukti belanjanya."
        aksi={punya('PEMOHON') && <TautanTombol ke="/pjum/baru" varian="utama" ikon="tambah">Buat pertanggungjawaban</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={STATUS_PJ} tanggal={false} placeholder="Nomor, nomor uang muka, atau nama">
          <Kolom label="Hasil">
            <Pilihan pilihan={Object.entries(HASIL)} kosong="Semua hasil" value={saring.nilai.hasil} onChange={(e) => saring.atur('hasil', e.target.value)} />
          </Kolom>
        </SaringDaftar>
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Tanggal</th>
                    <th>Uang muka</th>
                    <th>Pemohon</th>
                    <th className="angka">Uang muka</th>
                    <th className="angka">Realisasi</th>
                    <th className="angka">Selisih</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Tidak ada pertanggungjawaban yang cocok dengan penyaring" />}
                  {data.map((d) => (
                    <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/pjum/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td className="nowrap">{tanggal(d.tanggal)}</td>
                      <td>
                        {d.uang_muka_nomor}
                        <div className="kecil sangat-lemah">{d.keperluan}</div>
                      </td>
                      <td>{d.dibuat_nama}</td>
                      <td className="angka">{rupiah(d.jumlah_uang_muka)}</td>
                      <td className="angka">{rupiah(d.total_realisasi)}</td>
                      <td className="angka">{rupiah(d.selisih)}</td>
                      <td>
                        <Status kode={d.status} />
                        {d.hasil && <div className="kecil sangat-lemah">{HASIL[d.hasil]}</div>}
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

function RingkasanSelisih({ uangMuka, realisasi }) {
  const selisih = Math.round((Number(uangMuka || 0) - Number(realisasi || 0)) * 100) / 100;
  return (
    <div className="ringkas-angka">
      <div>
        <div className="label">Uang muka diterima</div>
        <div className="nilai">{rupiah(uangMuka)}</div>
      </div>
      <div>
        <div className="label">Total realisasi</div>
        <div className="nilai">{rupiah(realisasi)}</div>
      </div>
      <div>
        <div className="label">{selisih > 0 ? 'Sisa yang dikembalikan ke kas' : selisih < 0 ? 'Kekurangan yang dibayar perusahaan' : 'Selisih'}</div>
        <div className={`nilai ${selisih > 0 ? 'sukses' : selisih < 0 ? 'bahaya' : ''}`}>{rupiah(Math.abs(selisih))}</div>
      </div>
    </div>
  );
}

function FormPJUM({ awal, id, uangMuka }) {
  const navigate = useNavigate();
  const f = useFormulir(awal);
  const [baris, setBaris] = useState(awal.baris);
  const { jalankan, sibuk } = useAksi();
  const akun = usePilihanAkun({ pembebanan: true, kategori: ['BEBAN', 'ASET', 'LIABILITAS'] });
  const pilihanUM = useApi(id ? null : '/uang-muka?saya=1&status=DIBAYAR');
  const daftarUM = (pilihanUM.data || []).filter((u) => !u.pjum_status || u.pjum_status === 'BATAL');
  const um = uangMuka || daftarUM.find((u) => String(u.id) === String(f.nilai.uang_muka_id));
  const realisasi = jumlahkan(baris, (b) => b.jumlah);

  const kirim = async (e) => {
    e.preventDefault();
    const data = {
      uang_muka_id: f.nilai.uang_muka_id,
      tanggal: f.nilai.tanggal,
      keterangan: f.nilai.keterangan,
      baris: baris.map(({ tanggal: t, uraian, akun_id, nomor_bukti, jumlah }) => ({ tanggal: t, uraian, akun_id, nomor_bukti, jumlah })),
    };
    const r = await jalankan(() => (id ? api.put(`/pjum/${id}`, data) : api.post('/pjum', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (id ? 'Perubahan pertanggungjawaban tersimpan.' : `Pertanggungjawaban ${h.nomor} tersimpan sebagai draf. Unggah bukti belanja, lalu ajukan.`),
    });
    if (r.ok) navigate(`/pjum/${id || r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul="Uang muka yang dipertanggungjawabkan">
        <div className="formulir">
          <Kolom label="Uang muka" galat={f.galat.uang_muka_id} lebar={6}>
            {id ? (
              <Masukan readOnly value={`${uangMuka.nomor}: ${uangMuka.keperluan}`} />
            ) : (
              <Pilihan
                pilihan={daftarUM.map((u) => [u.id, `${u.nomor}: ${u.keperluan} (${rupiah(u.jumlah)})`])}
                kosong={pilihanUM.isPending ? 'Memuat...' : daftarUM.length ? 'Pilih uang muka yang sudah dibayar' : 'Tidak ada uang muka yang menunggu pertanggungjawaban'}
                value={f.nilai.uang_muka_id}
                onChange={(e) => f.atur('uang_muka_id', e.target.value)}
                salah={!!f.galat.uang_muka_id}
              />
            )}
          </Kolom>
          <Kolom label="Tanggal pertanggungjawaban" galat={f.galat.tanggal} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
          </Kolom>
          <Kolom label="Tenggat" lebar={3}>
            <Masukan readOnly value={um ? tanggal(um.tanggal_batas_pj, true) : ''} />
          </Kolom>
          <Kolom label="Keterangan" opsional lebar={12}>
            <AreaTeks {...f.ikat('keterangan')} rows={2} maxLength={500} />
          </Kolom>
        </div>
      </Kartu>
      <Kartu judul="Realisasi belanja">
        <EditorBaris
          baris={baris}
          setBaris={setBaris}
          galat={f.galat}
          barisBaru={() => ({ tanggal: f.nilai.tanggal, uraian: '', akun_id: '', nomor_bukti: '', jumlah: '' })}
          kolom={[
            { kunci: 'tanggal', label: 'Tanggal', lebar: 150, isi: (b, ubah, g) => <Masukan type="date" value={b.tanggal} onChange={(e) => ubah('tanggal', e.target.value)} salah={!!g} aria-label="Tanggal" /> },
            { kunci: 'uraian', label: 'Uraian', isi: (b, ubah, g) => <Masukan value={b.uraian} onChange={(e) => ubah('uraian', e.target.value)} salah={!!g} maxLength={255} aria-label="Uraian" /> },
            { kunci: 'akun_id', label: 'Akun', lebar: '26%', isi: (b, ubah, g) => <Kombo pilihan={akun} value={b.akun_id} onChange={(x) => ubah('akun_id', x)} salah={!!g} placeholder="Kode atau nama akun" /> },
            { kunci: 'nomor_bukti', label: 'No. bukti', lebar: 120, isi: (b, ubah) => <Masukan value={b.nomor_bukti} onChange={(e) => ubah('nomor_bukti', e.target.value)} maxLength={50} aria-label="Nomor bukti" /> },
            { kunci: 'jumlah', label: 'Jumlah (Rp)', angka: true, lebar: 150, isi: (b, ubah, g) => <InputUang value={b.jumlah} onChange={(x) => ubah('jumlah', x)} salah={!!g} aria-label="Jumlah" /> },
          ]}
        />
        {um && <RingkasanSelisih uangMuka={um.jumlah} realisasi={realisasi} />}
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

export function HalamanFormPJUM() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const q = useApi(id ? `/pjum/${id}` : null);
  const judul = id ? 'Ubah pertanggungjawaban' : 'Pertanggungjawaban uang muka baru';
  const remah = [{ label: 'Pertanggungjawaban', ke: '/pjum' }];
  const baru = () => ({ tanggal: hariIni(), uraian: '', akun_id: '', nomor_bukti: '', jumlah: '' });
  return (
    <>
      <Kepala judul={judul} remah={remah} />
      {id ? (
        <Muat kueri={q}>
          {(d) => (
            <FormPJUM
              id={id}
              uangMuka={{ nomor: d.uang_muka_nomor, keperluan: d.keperluan, jumlah: d.jumlah_uang_muka, tanggal_batas_pj: d.tanggal_batas_pj }}
              awal={{
                uang_muka_id: d.uang_muka_id,
                tanggal: d.tanggal,
                keterangan: d.keterangan || '',
                baris: d.baris.map((b) => ({ tanggal: b.tanggal, uraian: b.uraian, akun_id: b.akun_id, nomor_bukti: b.nomor_bukti || '', jumlah: Number(b.jumlah), _kunci: b.id })),
              }}
            />
          )}
        </Muat>
      ) : (
        <FormPJUM awal={{ uang_muka_id: params.get('uang_muka_id') || '', tanggal: hariIni(), keterangan: '', baris: [baru()] }} />
      )}
    </>
  );
}

export function DetailPJUM() {
  const { id } = useParams();
  const q = useApi(`/pjum/${id}`);
  return <Muat kueri={q}>{(d) => <IsiDetailPJUM pj={d} />}</Muat>;
}

function IsiDetailPJUM({ pj }) {
  const { pengguna, punya } = useAuth();
  const aksi = useAksiDokumen('/pjum', pj.id, 'Pertanggungjawaban');
  const pembuat = pj.dibuat_oleh === pengguna.id;
  const bisaUbah = pembuat && ['DRAFT', 'DITOLAK'].includes(pj.status);
  const selisih = Number(pj.selisih);
  return (
    <>
      <Kepala
        judul={pj.nomor}
        status={<Status kode={pj.status} />}
        remah={[{ label: 'Pertanggungjawaban', ke: '/pjum' }]}
        sub={`Pertanggungjawaban ${pj.uang_muka_nomor}: ${pj.keperluan}`}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/pjum/${pj.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(pj.status) && (
              <Tombol varian="bahaya" onClick={() => aksi.batal()} disabled={aksi.sibuk}>
                Batalkan
              </Tombol>
            )}
            <TombolCetak jenis="PJUM" id={pj.id} />
            {bisaUbah && (
              <Tombol varian="utama" ikon="kirim" onClick={aksi.ajukan} sibuk={aksi.sibuk}>
                Ajukan pertanggungjawaban
              </Tombol>
            )}
          </>
        }
      />
      <PesanDokumen doc={pj} labelDok="pertanggungjawaban" />
      {pj.status === 'DISETUJUI' && pj.hasil === 'SISA' && !pj.bkm_nomor && (
        <Pesan jenis="peringatan" judul="Sisa uang muka belum disetor">
          Setorkan {rupiah(selisih)} ke Kasir. Kasir mencatatnya sebagai bukti kas masuk, lalu uang muka dinyatakan selesai.
        </Pesan>
      )}
      {pj.status === 'DISETUJUI' && pj.hasil === 'KURANG' && (
        <Pesan jenis="info" judul="Kekurangan akan dibayar perusahaan">
          Staf Akuntansi membuat BKK kekurangan sebesar {rupiah(-selisih)} untuk dibayarkan kepada pemohon.
        </Pesan>
      )}
      <div className="grid-2-1">
        <div>
          <Kartu judul="Ringkasan" rapat>
            <RingkasanSelisih uangMuka={pj.jumlah_uang_muka} realisasi={pj.total_realisasi} />
            <div style={{ padding: 16 }}>
              <Info
                butir={[
                  ['Uang muka', <TautanDok jenis="PUM" id={pj.uang_muka_id}>{pj.uang_muka_nomor}</TautanDok>],
                  ['Pemohon', pj.dibuat_nama],
                  ['Departemen', pj.departemen_nama],
                  ['Tanggal', tanggal(pj.tanggal, true)],
                  ['Tenggat', tanggal(pj.tanggal_batas_pj, true)],
                  pj.hasil && ['Hasil penyelesaian', HASIL[pj.hasil]],
                  pj.bkk_nomor && ['BKK kekurangan', punya(PERAN_KEUANGAN) ? <TautanDok jenis="BKK" id={pj.bkk_id}>{pj.bkk_nomor}</TautanDok> : pj.bkk_nomor],
                  pj.bkm_nomor && ['Bukti kas masuk sisa', punya(PERAN_KEUANGAN) ? <TautanDok jenis="BKM" id={pj.bkm_id}>{pj.bkm_nomor}</TautanDok> : pj.bkm_nomor],
                  pj.keterangan && ['Keterangan', pj.keterangan],
                ]}
              />
            </div>
          </Kartu>
          <Kartu judul="Realisasi belanja" rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tanggal</th>
                  <th>Uraian</th>
                  <th>Akun</th>
                  <th>No. bukti</th>
                  <th className="angka">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {pj.baris.map((b) => (
                  <tr key={b.id}>
                    <td>{b.baris}</td>
                    <td className="nowrap">{tanggal(b.tanggal)}</td>
                    <td>{b.uraian}</td>
                    <td>
                      {b.akun_kode} {b.akun_nama}
                    </td>
                    <td>{b.nomor_bukti || '-'}</td>
                    <td className="angka">{rupiah(b.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TotalRingkas baris={[['Total realisasi', pj.total_realisasi, true]]} nilaiTerbilang={pj.total_realisasi} />
          </Kartu>
        </div>
        <div>
          <PanelPersetujuan jenis="PJUM" id={pj.id} riwayat={pj.persetujuan} boleh={pj.boleh_memutuskan} />
          <PanelLampiran jenis="PJUM" id={pj.id} bolehUnggah={(pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(pj.status)) || (punya('AKUNTANSI', 'SPV_AKUNTANSI', 'KASIR') && ['DISETUJUI', 'SELESAI'].includes(pj.status))} bolehHapus={bisaUbah} judul="Bukti belanja" />
          {pj.status !== 'BATAL' && (
            <p className="kecil lemah" style={{ marginTop: 12 }}>
              <Link to={`/uang-muka/${pj.uang_muka_id}`}>Lihat permintaan uang muka asal</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
