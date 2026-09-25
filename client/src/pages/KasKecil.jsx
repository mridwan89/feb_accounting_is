// Kas kecil sistem imprest: dana, pengeluaran (PKK), pengisian kembali (PDK), dan opname fisik.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PERAN_KEUANGAN } from '../konstanta.js';
import { angka, hariIni, jumlahkan, rupiah, tanggal, terbilang, waktu } from '../format.js';
import { useAksi, useApi, useDana, useDepartemen, usePilihanAkun } from '../components/data.js';
import { SaringDaftar, TombolCetak, useAksiDokumen, useSaring } from '../components/Dokumen.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import { PanelPersetujuan } from '../components/Persetujuan.jsx';
import {
  AreaTeks, BarisKosong, Centang, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Modal, Muat, Pesan, Pilihan, Status, TautanDok, TautanTombol, Tombol,
  TotalRingkas, useFormulir, useKonfirmasi,
} from '../components/ui.jsx';
import { PesanDokumen } from './Permintaan.jsx';

const PECAHAN_KERTAS = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const PECAHAN_LOGAM = [1000, 500, 200, 100];
const STATUS_PKK = [['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DISETUJUI', 'Disetujui'], ['DITOLAK', 'Ditolak'], ['DIBAYAR', 'Dibayar'], ['DIGANTI', 'Diganti'], ['BATAL', 'Batal']];
const STATUS_PDK = [['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DITOLAK', 'Ditolak'], ['DIPROSES', 'Diproses'], ['DIBAYAR', 'Dibayar'], ['BATAL', 'Batal']];

function Meter({ persen }) {
  const nada = persen < 25 ? 'bahaya' : persen < 50 ? 'peringatan' : '';
  return (
    <div className={`meter ${nada}`} role="img" aria-label={`${persen}% dari dana tetap`} style={{ minWidth: 90 }}>
      <div style={{ width: `${Math.min(100, Math.max(0, persen))}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- dana kas kecil

function FormDana({ awal, onTutup }) {
  const f = useFormulir(awal);
  const { jalankan, sibuk } = useAksi();
  const dept = useDepartemen();
  const pemegang = useApi('/pengguna/pilihan?peran=KAS_KECIL');
  const akun = usePilihanAkun({ kategori: ['ASET'] });
  const v = f.nilai;
  const simpan = async () => {
    const data = { ...v, aktif: v.aktif };
    const r = await jalankan(() => (awal.id ? api.put(`/dana-kas-kecil/${awal.id}`, data) : api.post('/dana-kas-kecil', data)), {
      setGalat: f.setGalat,
      sukses: awal.id ? 'Data dana kas kecil tersimpan.' : 'Dana kas kecil ditambahkan. Bentuk dananya melalui BKK pembentukan dana.',
    });
    if (r.ok) onTutup();
  };
  return (
    <Modal
      judul={awal.id ? `Ubah dana ${awal.kode}` : 'Tambah dana kas kecil'}
      onTutup={onTutup}
      lebar
      kaki={
        <>
          <Tombol onClick={onTutup}>Batal</Tombol>
          <Tombol varian="utama" onClick={simpan} sibuk={sibuk}>
            Simpan dana
          </Tombol>
        </>
      }
    >
      <div className="formulir">
        <Kolom label="Kode" galat={f.galat.kode} lebar={3}>
          <Masukan {...f.ikat('kode')} salah={!!f.galat.kode} placeholder="KK-GUDANG" onChange={(e) => f.atur('kode', e.target.value.toUpperCase())} />
        </Kolom>
        <Kolom label="Nama dana" galat={f.galat.nama} lebar={5}>
          <Masukan {...f.ikat('nama')} salah={!!f.galat.nama} />
        </Kolom>
        <Kolom label="Departemen" galat={f.galat.departemen_id} lebar={4}>
          <Pilihan pilihan={(dept.data || []).filter((d) => d.aktif).map((d) => [d.id, d.nama])} kosong="Pilih departemen" {...f.ikat('departemen_id')} salah={!!f.galat.departemen_id} />
        </Kolom>
        <Kolom label="Pemegang dana" galat={f.galat.pemegang_id} bantuan="Hanya pengguna berperan Pemegang Kas Kecil." lebar={6}>
          <Pilihan pilihan={(pemegang.data || []).map((u) => [u.id, `${u.nama_lengkap}${u.jabatan ? `, ${u.jabatan}` : ''}`])} kosong="Pilih pemegang" {...f.ikat('pemegang_id')} salah={!!f.galat.pemegang_id} />
        </Kolom>
        <Kolom label="Akun kas kecil" galat={f.galat.akun_id} bantuan="Akun aset khusus untuk dana ini." lebar={6}>
          <Kombo pilihan={akun} value={v.akun_id} onChange={(x) => f.atur('akun_id', x)} salah={!!f.galat.akun_id} />
        </Kolom>
        <Kolom label="Dana tetap yang diusulkan (Rp)" galat={f.galat.dana_diusulkan} lebar={4}>
          <InputUang value={v.dana_diusulkan} onChange={(x) => f.atur('dana_diusulkan', x)} salah={!!f.galat.dana_diusulkan} />
        </Kolom>
        <Kolom label="Batas per transaksi (Rp)" galat={f.galat.batas_transaksi} lebar={4}>
          <InputUang value={v.batas_transaksi} onChange={(x) => f.atur('batas_transaksi', x)} salah={!!f.galat.batas_transaksi} />
        </Kolom>
        <Kolom label="Status" lebar={4}>
          <Centang label="Dana aktif" checked={v.aktif} onChange={(x) => f.atur('aktif', x)} />
        </Kolom>
      </div>
    </Modal>
  );
}

export function HalamanDana() {
  const { punya, pengguna } = useAuth();
  const q = useDana();
  const [form, setForm] = useState(null);
  const bolehUbah = punya('MANAJER_KEUANGAN');
  return (
    <>
      <Kepala
        judul="Dana kas kecil"
        sub="Sistem imprest: dana tetap = uang tunai di tangan + bukti yang sudah dibayar tetapi belum diganti."
        aksi={
          <>
            {punya('AKUNTANSI') && <TautanTombol ke="/bkk/baru?jenis=PEMBENTUKAN_KAS_KECIL">Bentuk atau tambah dana</TautanTombol>}
            {bolehUbah && (
              <Tombol varian="utama" ikon="tambah" onClick={() => setForm({ kode: '', nama: '', pemegang_id: '', departemen_id: '', akun_id: '', dana_diusulkan: '', batas_transaksi: '', aktif: true })}>
                Tambah dana
              </Tombol>
            )}
          </>
        }
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Dana</th>
                    <th>Pemegang</th>
                    <th className="angka">Dana tetap</th>
                    <th className="angka">Bukti belum diganti</th>
                    <th className="angka">Saldo tunai</th>
                    <th>Posisi</th>
                    <th className="angka">Batas per transaksi</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Belum ada dana kas kecil" />}
                  {data.map((d) => (
                    <tr key={d.id} className={d.aktif ? '' : 'redup'}>
                      <td>
                        <div className="tebal">{d.nama}</div>
                        <div className="kecil sangat-lemah">
                          {d.kode} · {d.akun_kode} {d.akun_nama}
                        </div>
                      </td>
                      <td>
                        {d.pemegang_nama}
                        <div className="kecil sangat-lemah">{d.departemen_nama}</div>
                      </td>
                      <td className="angka">
                        {rupiah(d.jumlah_dana)}
                        {Number(d.jumlah_dana) !== Number(d.dana_diusulkan) && <div className="kecil sangat-lemah">diusulkan {rupiah(d.dana_diusulkan)}</div>}
                      </td>
                      <td className="angka">{rupiah(d.bukti_belum_diganti)}</td>
                      <td className="angka">{rupiah(d.saldo_tunai)}</td>
                      <td style={{ minWidth: 120 }}>
                        <Meter persen={d.persen_saldo} />
                        <div className="kecil sangat-lemah">{angka(d.persen_saldo)}%</div>
                      </td>
                      <td className="angka">{rupiah(d.batas_transaksi)}</td>
                      <td className="aksi-baris">
                        <Link to={`/laporan/kas-kecil?dana_id=${d.id}`}>Laporan</Link>
                        {d.pemegang_id === pengguna.id && (
                          <>
                            {' · '}
                            <Link to={`/pdk/baru?dana_id=${d.id}`}>Ajukan pengisian</Link>
                          </>
                        )}
                        {bolehUbah && (
                          <>
                            {' · '}
                            <button type="button" className="tombol hantu kecil" onClick={() => setForm({ ...d, aktif: !!d.aktif })}>
                              Ubah
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kartu>
        )}
      </Muat>
      {form && <FormDana awal={form} onTutup={() => setForm(null)} />}
    </>
  );
}

// ---------------------------------------------------------------- pengeluaran kas kecil (PKK)

export function DaftarPKK() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring(['status', 'cari', 'dari', 'sampai', 'dana_id']);
  const dana = useDana();
  const q = useApi(`/pkk${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Pengeluaran kas kecil"
        sub="Belanja kecil yang dibayar tunai oleh pemegang kas kecil setelah disetujui atasan."
        aksi={punya('PEMOHON') && <TautanTombol ke="/pkk/baru" varian="utama" ikon="tambah">Ajukan pengeluaran</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={STATUS_PKK} placeholder="Nomor, keperluan, atau nomor nota">
          <Kolom label="Dana">
            <Pilihan pilihan={(dana.data || []).map((d) => [d.id, d.nama])} kosong="Semua dana" value={saring.nilai.dana_id} onChange={(e) => saring.atur('dana_id', e.target.value)} />
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
                    <th>Dana</th>
                    <th>Pemohon</th>
                    <th>Keperluan</th>
                    <th>Akun</th>
                    <th className="angka">Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Tidak ada pengeluaran kas kecil yang cocok dengan penyaring" />}
                  {data.map((d) => (
                    <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/pkk/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td className="nowrap">{tanggal(d.tanggal)}</td>
                      <td>{d.dana_nama}</td>
                      <td>
                        {d.dibuat_nama}
                        <div className="kecil sangat-lemah">{d.departemen_nama}</div>
                      </td>
                      <td>{d.keperluan}</td>
                      <td className="kecil">
                        {d.akun_kode} {d.akun_nama}
                      </td>
                      <td className="angka">{rupiah(d.jumlah)}</td>
                      <td>
                        <Status kode={d.status} />
                        {d.nomor_bukti && <div className="kecil sangat-lemah">Nota {d.nomor_bukti}</div>}
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

function FormPKK({ awal, id }) {
  const navigate = useNavigate();
  const f = useFormulir(awal);
  const { jalankan, sibuk } = useAksi();
  const dana = useDana();
  const akun = usePilihanAkun({ pembebanan: true, kategori: ['BEBAN', 'ASET', 'LIABILITAS'] });
  const v = f.nilai;
  const daftarDana = (dana.data || []).filter((d) => d.aktif && Number(d.jumlah_dana) > 0);
  const terpilih = daftarDana.find((d) => String(d.id) === String(v.dana_id));

  const kirim = async (e) => {
    e.preventDefault();
    const data = { tanggal: v.tanggal, dana_id: v.dana_id, keperluan: v.keperluan, akun_id: v.akun_id, jumlah: v.jumlah };
    const r = await jalankan(() => (id ? api.put(`/pkk/${id}`, data) : api.post('/pkk', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (id ? 'Perubahan tersimpan.' : `Pengeluaran kas kecil ${h.nomor} tersimpan sebagai draf.`),
    });
    if (r.ok) navigate(`/pkk/${id || r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul="Data pengeluaran">
        <div className="formulir">
          <Kolom label="Tanggal" galat={f.galat.tanggal} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
          </Kolom>
          <Kolom label="Dana kas kecil" galat={f.galat.dana_id} lebar={5}>
            <Pilihan pilihan={daftarDana.map((d) => [d.id, `${d.nama} (pemegang ${d.pemegang_nama})`])} kosong="Pilih dana" {...f.ikat('dana_id')} salah={!!f.galat.dana_id} />
          </Kolom>
          <Kolom label="Jumlah (Rp)" galat={f.galat.jumlah} bantuan={terpilih ? `Maksimal ${rupiah(terpilih.batas_transaksi)} per transaksi.` : undefined} lebar={4}>
            <InputUang value={v.jumlah} onChange={(x) => f.atur('jumlah', x)} salah={!!f.galat.jumlah} />
          </Kolom>
          <Kolom label="Keperluan" galat={f.galat.keperluan} lebar={7}>
            <AreaTeks {...f.ikat('keperluan')} salah={!!f.galat.keperluan} rows={2} maxLength={500} />
          </Kolom>
          <Kolom label="Akun pembebanan" galat={f.galat.akun_id} lebar={5}>
            <Kombo pilihan={akun} value={v.akun_id} onChange={(x) => f.atur('akun_id', x)} salah={!!f.galat.akun_id} placeholder="Ketik kode atau nama akun" />
          </Kolom>
        </div>
        {terpilih && Number(v.jumlah) > Number(terpilih.batas_transaksi) && (
          <Pesan jenis="peringatan">Jumlah melebihi batas kas kecil per transaksi. Ajukan melalui permintaan pembayaran.</Pesan>
        )}
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

export function HalamanFormPKK() {
  const { id } = useParams();
  const q = useApi(id ? `/pkk/${id}` : null);
  return (
    <>
      <Kepala judul={id ? 'Ubah pengeluaran kas kecil' : 'Pengeluaran kas kecil baru'} remah={[{ label: 'Pengeluaran kas kecil', ke: '/pkk' }]} />
      {id ? (
        <Muat kueri={q}>{(d) => <FormPKK id={id} awal={{ tanggal: d.tanggal, dana_id: d.dana_id, keperluan: d.keperluan, akun_id: d.akun_id, jumlah: Number(d.jumlah) }} />}</Muat>
      ) : (
        <FormPKK awal={{ tanggal: hariIni(), dana_id: '', keperluan: '', akun_id: '', jumlah: '' }} />
      )}
    </>
  );
}

function DialogBayarPKK({ pkk, onTutup }) {
  const f = useFormulir({ tanggal_bayar: hariIni(), nomor_bukti: '' });
  const { jalankan, sibuk } = useAksi();
  const bayar = async () => {
    const r = await jalankan(() => api.post(`/pkk/${pkk.id}/bayar`, f.nilai), { setGalat: f.setGalat, sukses: `${pkk.nomor} dibayar tunai ${rupiah(pkk.jumlah)}.` });
    if (r.ok) onTutup();
  };
  return (
    <Modal
      judul={`Bayar ${pkk.nomor}`}
      onTutup={onTutup}
      kaki={
        <>
          <Tombol onClick={onTutup}>Batal</Tombol>
          <Tombol varian="sukses" onClick={bayar} sibuk={sibuk}>
            Catat pembayaran tunai
          </Tombol>
        </>
      }
    >
      <p>
        Serahkan uang tunai {rupiah(pkk.jumlah)} kepada {pkk.dibuat_nama}, minta nota atau kuitansi, lalu catat nomornya.
      </p>
      <div className="formulir">
        <Kolom label="Tanggal bayar" galat={f.galat.tanggal_bayar} lebar={6}>
          <Masukan type="date" {...f.ikat('tanggal_bayar')} salah={!!f.galat.tanggal_bayar} />
        </Kolom>
        <Kolom label="Nomor nota atau kuitansi" galat={f.galat.nomor_bukti} lebar={6}>
          <Masukan {...f.ikat('nomor_bukti')} salah={!!f.galat.nomor_bukti} maxLength={50} autoFocus />
        </Kolom>
      </div>
    </Modal>
  );
}

export function DetailPKK() {
  const { id } = useParams();
  const q = useApi(`/pkk/${id}`);
  return <Muat kueri={q}>{(d) => <IsiDetailPKK k={d} />}</Muat>;
}

function IsiDetailPKK({ k }) {
  const { pengguna, punya } = useAuth();
  const aksi = useAksiDokumen('/pkk', k.id, 'Pengeluaran kas kecil');
  const [bayar, setBayar] = useState(false);
  const pembuat = k.dibuat_oleh === pengguna.id;
  const pemegang = k.pemegang_id === pengguna.id;
  const bisaUbah = pembuat && ['DRAFT', 'DITOLAK'].includes(k.status);
  return (
    <>
      <Kepala
        judul={k.nomor}
        status={<Status kode={k.status} />}
        remah={[{ label: 'Pengeluaran kas kecil', ke: '/pkk' }]}
        sub={k.keperluan}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/pkk/${k.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'].includes(k.status) && (
              <Tombol varian="bahaya" onClick={() => aksi.batal()} disabled={aksi.sibuk}>
                Batalkan
              </Tombol>
            )}
            <TombolCetak jenis="PKK" id={k.id} label={['DIBAYAR', 'DIGANTI'].includes(k.status) ? 'Cetak bukti pengeluaran' : 'Cetak permintaan'} />
            {pemegang && k.status === 'DISETUJUI' && punya('KAS_KECIL') && (
              <Tombol varian="sukses" ikon="koin" onClick={() => setBayar(true)}>
                Bayar tunai
              </Tombol>
            )}
            {bisaUbah && (
              <Tombol varian="utama" ikon="kirim" onClick={aksi.ajukan} sibuk={aksi.sibuk}>
                Ajukan pengeluaran
              </Tombol>
            )}
          </>
        }
      />
      <PesanDokumen doc={k} labelDok="pengeluaran" perluLampiran={false} />
      {pemegang && k.status === 'DISETUJUI' && (
        <Pesan jenis="info">Pengeluaran ini sudah disetujui dan menunggu Anda bayar tunai dari {k.dana_nama}.</Pesan>
      )}
      <div className="grid-2-1">
        <div>
          <Kartu judul="Rincian pengeluaran">
            <Info
              butir={[
                ['Tanggal', tanggal(k.tanggal, true)],
                ['Dana kas kecil', k.dana_nama],
                ['Pemegang dana', k.pemegang_nama],
                ['Pemohon', k.dibuat_nama],
                ['Departemen', k.departemen_nama],
                ['Akun pembebanan', `${k.akun_kode} ${k.akun_nama}`],
                ['Jumlah', rupiah(k.jumlah)],
                k.tanggal_bayar && ['Tanggal dibayar', tanggal(k.tanggal_bayar, true)],
                k.nomor_bukti && ['Nomor nota atau kuitansi', k.nomor_bukti],
                k.pengisian_nomor && ['Diganti melalui', <TautanDok jenis="PDK" id={k.pengisian_id}>{k.pengisian_nomor}</TautanDok>],
              ]}
            />
            <div className="terbilang" style={{ textAlign: 'left', padding: '12px 0 0' }}>
              Terbilang: {terbilang(k.jumlah)}
            </div>
          </Kartu>
        </div>
        <div>
          <PanelPersetujuan jenis="PKK" id={k.id} riwayat={k.persetujuan} boleh={k.boleh_memutuskan} />
          <PanelLampiran jenis="PKK" id={k.id} bolehUnggah={(pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(k.status)) || (pemegang && ['DISETUJUI', 'DIBAYAR'].includes(k.status))} bolehHapus={bisaUbah} judul="Nota dan lampiran" />
        </div>
      </div>
      {bayar && <DialogBayarPKK pkk={k} onTutup={() => setBayar(false)} />}
    </>
  );
}

// ---------------------------------------------------------------- pengisian kembali (PDK)

export function DaftarPDK() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring(['status', 'dana_id']);
  const dana = useDana();
  const q = useApi(`/pdk${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Pengisian kembali kas kecil"
        sub="Pemegang dana mengajukan penggantian atas bukti yang sudah dibayar; Akuntansi memprosesnya menjadi BKK."
        aksi={punya('KAS_KECIL') && <TautanTombol ke="/pdk/baru" varian="utama" ikon="tambah">Ajukan pengisian</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={STATUS_PDK} tanggal={false} cari={false}>
          <Kolom label="Dana">
            <Pilihan pilihan={(dana.data || []).map((d) => [d.id, d.nama])} kosong="Semua dana" value={saring.nilai.dana_id} onChange={(e) => saring.atur('dana_id', e.target.value)} />
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
                    <th>Dana</th>
                    <th>Diajukan oleh</th>
                    <th className="angka">Jumlah pengisian</th>
                    <th>Status</th>
                    <th>BKK</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={7} judul="Belum ada pengisian kembali" />}
                  {data.map((d) => (
                    <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/pdk/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td className="nowrap">{tanggal(d.tanggal)}</td>
                      <td>{d.dana_nama}</td>
                      <td>{d.dibuat_nama}</td>
                      <td className="angka">{rupiah(d.total)}</td>
                      <td>
                        <Status kode={d.status} />
                      </td>
                      <td>{d.bkk_nomor || '-'}</td>
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

function FormPDK({ awal, id, buktiTerpasang = [] }) {
  const navigate = useNavigate();
  const { pengguna } = useAuth();
  const f = useFormulir(awal);
  const [pilih, setPilih] = useState(new Set(awal.pkk_ids));
  const { jalankan, sibuk } = useAksi();
  const dana = useDana();
  const danaSaya = (dana.data || []).filter((d) => d.pemegang_id === pengguna.id && d.aktif);
  const danaId = f.nilai.dana_id;
  const bebas = useApi(danaId ? `/pkk?dana_id=${danaId}&belum_diganti=1` : null);
  const daftar = useMemo(() => {
    const peta = new Map();
    for (const b of buktiTerpasang) peta.set(b.id, b);
    for (const b of bebas.data || []) if (!b.pengisian_id || b.pengisian_id === Number(id)) peta.set(b.id, b);
    return [...peta.values()].sort((a, b) => (a.tanggal_bayar < b.tanggal_bayar ? -1 : 1));
  }, [bebas.data, buktiTerpasang, id]);
  const terpilih = daftar.filter((b) => pilih.has(b.id));
  const total = jumlahkan(terpilih, (b) => b.jumlah);
  const rekap = Object.values(
    terpilih.reduce((acc, b) => {
      const k = `${b.akun_kode}`;
      acc[k] = acc[k] || { akun: `${b.akun_kode} ${b.akun_nama}`, jumlah: 0, n: 0 };
      acc[k].jumlah += Number(b.jumlah);
      acc[k].n += 1;
      return acc;
    }, {}),
  );

  const kirim = async (e) => {
    e.preventDefault();
    const data = { dana_id: danaId, tanggal: f.nilai.tanggal, keterangan: f.nilai.keterangan, pkk_ids: [...pilih] };
    const r = await jalankan(() => (id ? api.put(`/pdk/${id}`, data) : api.post('/pdk', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (id ? 'Perubahan pengisian tersimpan.' : `Pengisian ${h.nomor} sebesar ${rupiah(h.total)} tersimpan sebagai draf.`),
    });
    if (r.ok) navigate(`/pdk/${id || r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul="Data pengisian">
        <div className="formulir">
          <Kolom label="Dana kas kecil" galat={f.galat.dana_id} lebar={5}>
            {id ? (
              <Masukan readOnly value={danaSaya.find((d) => String(d.id) === String(danaId))?.nama || ''} />
            ) : (
              <Pilihan
                pilihan={danaSaya.map((d) => [d.id, d.nama])}
                kosong={danaSaya.length ? 'Pilih dana' : 'Anda tidak memegang dana kas kecil'}
                value={danaId}
                onChange={(e) => {
                  f.atur('dana_id', e.target.value);
                  setPilih(new Set());
                }}
                salah={!!f.galat.dana_id}
              />
            )}
          </Kolom>
          <Kolom label="Tanggal" galat={f.galat.tanggal} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
          </Kolom>
          <Kolom label="Keterangan" opsional lebar={4}>
            <Masukan {...f.ikat('keterangan')} maxLength={500} />
          </Kolom>
        </div>
      </Kartu>
      <Kartu
        judul="Bukti pengeluaran yang dimintakan penggantian"
        aksi={
          daftar.length > 0 && (
            <Tombol kecil onClick={() => setPilih(pilih.size === daftar.length ? new Set() : new Set(daftar.map((b) => b.id)))}>
              {pilih.size === daftar.length ? 'Kosongkan pilihan' : 'Pilih semua'}
            </Tombol>
          )
        }
        rapat
      >
        {f.galat.pkk_ids && (
          <div style={{ padding: '12px 16px 0' }}>
            <Pesan jenis="galat">{f.galat.pkk_ids}</Pesan>
          </div>
        )}
        <div className="tabel-bungkus">
          <table className="tabel">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Nomor</th>
                <th>Dibayar</th>
                <th>Keperluan</th>
                <th>Akun</th>
                <th>Nota</th>
                <th className="angka">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {!danaId && <BarisKosong kolom={7} judul="Pilih dana terlebih dahulu" />}
              {danaId && daftar.length === 0 && <BarisKosong kolom={7} judul="Tidak ada bukti yang sudah dibayar dan belum diganti" />}
              {daftar.map((b) => (
                <tr key={b.id} className={pilih.has(b.id) ? 'dipilih' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${b.nomor}`}
                      checked={pilih.has(b.id)}
                      onChange={(e) => {
                        const s = new Set(pilih);
                        if (e.target.checked) s.add(b.id);
                        else s.delete(b.id);
                        setPilih(s);
                      }}
                    />
                  </td>
                  <td className="nomor">{b.nomor}</td>
                  <td className="nowrap">{tanggal(b.tanggal_bayar)}</td>
                  <td>{b.keperluan}</td>
                  <td className="kecil">
                    {b.akun_kode} {b.akun_nama}
                  </td>
                  <td>{b.nomor_bukti}</td>
                  <td className="angka">{rupiah(b.jumlah)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rekap.length > 0 && (
          <div style={{ padding: '8px 16px' }}>
            <div className="bagian-judul" style={{ marginBottom: 6 }}>
              Rekap per akun
            </div>
            <table className="tabel">
              <tbody>
                {rekap.map((r) => (
                  <tr key={r.akun}>
                    <td>{r.akun}</td>
                    <td className="kecil sangat-lemah">{r.n} bukti</td>
                    <td className="angka">{rupiah(r.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TotalRingkas baris={[['Total pengisian', total, true]]} />
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

export function HalamanFormPDK() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const q = useApi(id ? `/pdk/${id}` : null);
  return (
    <>
      <Kepala judul={id ? 'Ubah pengisian kembali' : 'Ajukan pengisian kembali'} remah={[{ label: 'Pengisian kembali', ke: '/pdk' }]} />
      {id ? (
        <Muat kueri={q}>
          {(d) => <FormPDK id={id} buktiTerpasang={d.bukti} awal={{ dana_id: d.dana_id, tanggal: d.tanggal, keterangan: d.keterangan || '', pkk_ids: d.bukti.map((b) => b.id) }} />}
        </Muat>
      ) : (
        <FormPDK awal={{ dana_id: params.get('dana_id') || '', tanggal: hariIni(), keterangan: '', pkk_ids: [] }} />
      )}
    </>
  );
}

export function DetailPDK() {
  const { id } = useParams();
  const q = useApi(`/pdk/${id}`);
  return <Muat kueri={q}>{(d) => <IsiDetailPDK p={d} />}</Muat>;
}

function IsiDetailPDK({ p }) {
  const { pengguna, punya } = useAuth();
  const aksi = useAksiDokumen('/pdk', p.id, 'Pengisian kembali');
  const konfirmasi = useKonfirmasi();
  const pembuat = p.dibuat_oleh === pengguna.id;
  const bisaUbah = pembuat && ['DRAFT', 'DITOLAK'].includes(p.status);
  const ajukan = () => aksi.jalankan(() => api.post(`/pdk/${p.id}/ajukan`), { sukses: 'Pengisian diajukan ke Akuntansi untuk dibuatkan BKK.' });
  const tolak = async () => {
    const r = await konfirmasi({ judul: `Tolak ${p.nomor}`, label: 'Tolak pengisian', bahaya: true, alasan: { label: 'Alasan penolakan', maks: 500 } });
    if (r) await aksi.jalankan(() => api.post(`/pdk/${p.id}/tolak`, { catatan: r.alasan }), { sukses: 'Pengisian dikembalikan kepada pemegang dana.' });
  };
  return (
    <>
      <Kepala
        judul={p.nomor}
        status={<Status kode={p.status} />}
        remah={[{ label: 'Pengisian kembali', ke: '/pdk' }]}
        sub={`${p.dana_nama} · ${p.bukti.length} bukti`}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/pdk/${p.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(p.status) && (
              <Tombol varian="bahaya" onClick={() => aksi.batal({ pesan: 'Bukti-bukti di dalamnya kembali tersedia untuk pengisian berikutnya.' })} disabled={aksi.sibuk}>
                Batalkan
              </Tombol>
            )}
            {punya('AKUNTANSI') && p.status === 'DIAJUKAN' && (
              <Tombol varian="bahaya" onClick={tolak} disabled={aksi.sibuk}>
                Tolak
              </Tombol>
            )}
            <TombolCetak jenis="PDK" id={p.id} />
            {punya('AKUNTANSI') && p.status === 'DIAJUKAN' && (
              <TautanTombol ke={`/bkk/baru?jenis=PENGISIAN_KAS_KECIL&sumber_id=${p.id}`} varian="utama" ikon="keluar">Buat BKK pengisian</TautanTombol>
            )}
            {bisaUbah && (
              <Tombol varian="utama" ikon="kirim" onClick={ajukan} sibuk={aksi.sibuk}>
                Ajukan ke Akuntansi
              </Tombol>
            )}
          </>
        }
      />
      {p.status === 'DITOLAK' && p.catatan_tolak && <Pesan jenis="galat" judul="Dikembalikan oleh Akuntansi">{p.catatan_tolak}</Pesan>}
      {p.status === 'BATAL' && p.alasan_batal && <Pesan jenis="peringatan" judul="Dokumen dibatalkan">{p.alasan_batal}</Pesan>}
      <div className="grid-2-1">
        <div>
          <Kartu judul="Bukti pengeluaran" rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Dibayar</th>
                  <th>Keperluan</th>
                  <th>Akun</th>
                  <th>Nota</th>
                  <th className="angka">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {p.bukti.length === 0 && <BarisKosong kolom={6} judul="Belum ada bukti" />}
                {p.bukti.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <TautanDok jenis="PKK" id={b.id}>{b.nomor}</TautanDok>
                    </td>
                    <td className="nowrap">{tanggal(b.tanggal_bayar)}</td>
                    <td>{b.keperluan}</td>
                    <td className="kecil">
                      {b.akun_kode} {b.akun_nama}
                    </td>
                    <td>{b.nomor_bukti}</td>
                    <td className="angka">{rupiah(b.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TotalRingkas baris={[['Total pengisian', p.total, true]]} nilaiTerbilang={p.total} />
          </Kartu>
          <Kartu judul="Rekap per akun dan departemen" rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Akun</th>
                  <th>Departemen</th>
                  <th className="angka">Bukti</th>
                  <th className="angka">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {p.rekap.map((r) => (
                  <tr key={`${r.akun_id}-${r.departemen_id}`}>
                    <td>
                      {r.akun_kode} {r.akun_nama}
                    </td>
                    <td>{r.departemen_nama}</td>
                    <td className="angka">{r.jumlah_bukti}</td>
                    <td className="angka">{rupiah(r.jumlah)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kartu>
        </div>
        <div>
          <Kartu judul="Posisi dana">
            <Info
              butir={[
                ['Dana', p.dana_nama],
                ['Diajukan oleh', p.dibuat_nama],
                ['Tanggal', tanggal(p.tanggal, true)],
                ['Dana tetap', rupiah(p.posisi.jumlah_dana)],
                ['Bukti belum diganti', rupiah(p.posisi.bukti_belum_diganti)],
                ['Saldo tunai', rupiah(p.posisi.saldo_tunai)],
                p.bkk_nomor && ['BKK', punya(PERAN_KEUANGAN) ? <TautanDok jenis="BKK" id={p.bkk_id}>{p.bkk_nomor}</TautanDok> : p.bkk_nomor],
                p.keterangan && ['Keterangan', p.keterangan],
              ]}
            />
            <div style={{ marginTop: 12 }}>
              <Meter persen={p.posisi.persen_saldo} />
            </div>
          </Kartu>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- opname kas kecil

export function DaftarOpname() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const q = useApi('/opname');
  return (
    <>
      <Kepala
        judul="Opname kas kecil"
        sub="Penghitungan fisik uang tunai secara mendadak oleh pemeriksa yang bukan pemegang dana."
        aksi={punya('AUDITOR', 'SPV_AKUNTANSI') && <TautanTombol ke="/opname/baru" varian="utama" ikon="tambah">Opname baru</TautanTombol>}
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Waktu opname</th>
                    <th>Dana</th>
                    <th>Pemeriksa</th>
                    <th className="angka">Seharusnya</th>
                    <th className="angka">Fisik</th>
                    <th className="angka">Selisih</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Belum ada opname" />}
                  {data.map((o) => (
                    <tr key={o.id} className="klik" onClick={() => navigate(`/opname/${o.id}`)}>
                      <td className="nomor">{o.nomor}</td>
                      <td className="nowrap">{waktu(o.waktu_opname)}</td>
                      <td>
                        {o.dana_nama}
                        <div className="kecil sangat-lemah">Pemegang {o.pemegang_nama}</div>
                      </td>
                      <td>{o.dibuat_nama}</td>
                      <td className="angka">{rupiah(o.saldo_seharusnya)}</td>
                      <td className="angka">{rupiah(o.total_fisik)}</td>
                      <td className={`angka ${Number(o.selisih) < 0 ? 'teks-bahaya' : Number(o.selisih) > 0 ? 'teks-peringatan' : ''}`}>{rupiah(o.selisih)}</td>
                      <td>
                        <Status kode={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kartu>
        )}
      </Muat>
    </>
  );
}

const sekarangLokal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function FormOpname({ awal, id }) {
  const navigate = useNavigate();
  const { pengguna } = useAuth();
  const f = useFormulir(awal);
  const { jalankan, sibuk } = useAksi();
  const dana = useDana();
  const pilihanDana = (dana.data || []).filter((d) => d.pemegang_id !== pengguna.id && Number(d.jumlah_dana) > 0);
  const pratinjau = useApi(f.nilai.dana_id ? `/opname/pratinjau?dana_id=${f.nilai.dana_id}` : null);
  const r = f.nilai.rincian;
  const fisik = [...PECAHAN_KERTAS.map((n) => n * Number(r.kertas[n] || 0)), ...PECAHAN_LOGAM.map((n) => n * Number(r.logam[n] || 0))].reduce((a, b) => a + b, 0);
  const seharusnya = Number(pratinjau.data?.saldo_seharusnya ?? 0);
  const aturLembar = (jenis, n, v) => f.atur('rincian', { ...r, [jenis]: { ...r[jenis], [n]: v.replace(/\D/g, '') } });

  const kirim = async (e) => {
    e.preventDefault();
    const bersih = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, Number(v)]));
    const data = { dana_id: f.nilai.dana_id, waktu_opname: f.nilai.waktu_opname, keterangan: f.nilai.keterangan, rincian: { kertas: bersih(r.kertas), logam: bersih(r.logam) } };
    const h = await jalankan(() => (id ? api.put(`/opname/${id}`, data) : api.post('/opname', data)), {
      setGalat: f.setGalat,
      sukses: id ? 'Hasil opname diperbarui.' : 'Hasil opname tersimpan sebagai draf. Finalkan setelah ditandatangani kedua pihak.',
    });
    if (h.ok) navigate(`/opname/${id || h.hasil.id}`);
  };

  const Baris = ({ jenis, n }) => (
    <tr key={`${jenis}${n}`}>
      <td>
        {jenis === 'kertas' ? 'Uang kertas' : 'Uang logam'} {rupiah(n)}
      </td>
      <td style={{ width: 130 }}>
        <Masukan className="angka" inputMode="numeric" value={r[jenis][n] ?? ''} onChange={(e) => aturLembar(jenis, n, e.target.value)} aria-label={`Jumlah ${jenis} ${n}`} />
      </td>
      <td className="angka">{rupiah(n * Number(r[jenis][n] || 0))}</td>
    </tr>
  );

  return (
    <form onSubmit={kirim} noValidate>
      <div className="grid-2-1">
        <Kartu judul="Rincian uang tunai" rapat>
          <table className="tabel">
            <thead>
              <tr>
                <th>Pecahan</th>
                <th>Lembar/keping</th>
                <th className="angka">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {PECAHAN_KERTAS.map((n) => Baris({ jenis: 'kertas', n }))}
              {PECAHAN_LOGAM.map((n) => Baris({ jenis: 'logam', n }))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total uang tunai fisik</td>
                <td className="angka">{rupiah(fisik)}</td>
              </tr>
            </tfoot>
          </table>
        </Kartu>
        <div>
          <Kartu judul="Data opname">
            <div className="formulir">
              <Kolom label="Dana kas kecil" galat={f.galat.dana_id} lebar={12}>
                {id ? (
                  <Masukan readOnly value={awal.dana_nama} />
                ) : (
                  <Pilihan pilihan={pilihanDana.map((d) => [d.id, `${d.nama} (${d.pemegang_nama})`])} kosong="Pilih dana" {...f.ikat('dana_id')} salah={!!f.galat.dana_id} />
                )}
              </Kolom>
              <Kolom label="Waktu opname" galat={f.galat.waktu_opname} lebar={12}>
                <Masukan type="datetime-local" {...f.ikat('waktu_opname')} salah={!!f.galat.waktu_opname} />
              </Kolom>
              <Kolom label="Keterangan" opsional lebar={12}>
                <AreaTeks {...f.ikat('keterangan')} rows={2} maxLength={500} placeholder="Misalnya penjelasan pemegang dana atas selisih" />
              </Kolom>
            </div>
          </Kartu>
          {pratinjau.data && (
            <Kartu judul="Perhitungan">
              <Info
                butir={[
                  ['Dana tetap', rupiah(pratinjau.data.jumlah_dana)],
                  ['Bukti belum diganti', rupiah(pratinjau.data.bukti_belum_diganti)],
                  ['Saldo tunai seharusnya', rupiah(seharusnya)],
                  ['Uang tunai fisik', rupiah(fisik)],
                  ['Selisih', <span className={fisik - seharusnya < 0 ? 'teks-bahaya' : fisik - seharusnya > 0 ? 'teks-peringatan' : 'teks-sukses'}>{rupiah(fisik - seharusnya)}</span>],
                ]}
              />
            </Kartu>
          )}
        </div>
      </div>
      <div className="baris-aksi">
        <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
        <Tombol type="submit" varian="utama" sibuk={sibuk}>
          {id ? 'Simpan perubahan' : 'Simpan hasil opname'}
        </Tombol>
      </div>
    </form>
  );
}

export function HalamanFormOpname() {
  const { id } = useParams();
  const q = useApi(id ? `/opname/${id}` : null);
  const kosong = { kertas: {}, logam: {} };
  return (
    <>
      <Kepala judul={id ? 'Ubah hasil opname' : 'Opname kas kecil'} remah={[{ label: 'Opname kas kecil', ke: '/opname' }]} />
      {id ? (
        <Muat kueri={q}>
          {(o) => (
            <FormOpname
              id={id}
              awal={{ dana_id: o.dana_id, dana_nama: o.dana_nama, waktu_opname: String(o.waktu_opname).slice(0, 16).replace(' ', 'T'), keterangan: o.keterangan || '', rincian: { kertas: o.rincian?.kertas || {}, logam: o.rincian?.logam || {} } }}
            />
          )}
        </Muat>
      ) : (
        <FormOpname awal={{ dana_id: '', waktu_opname: sekarangLokal(), keterangan: '', rincian: kosong }} />
      )}
    </>
  );
}

export function DetailOpname() {
  const { id } = useParams();
  const q = useApi(`/opname/${id}`);
  const { pengguna } = useAuth();
  const { jalankan, sibuk } = useAksi();
  const konfirmasi = useKonfirmasi();
  return (
    <Muat kueri={q}>
      {(o) => {
        const pemeriksa = o.dibuat_oleh === pengguna.id;
        const finalkan = async () => {
          const r = await konfirmasi({ judul: `Finalkan ${o.nomor}`, pesan: 'Setelah difinalkan, angka opname tidak dapat diubah lagi. Pastikan berita acara sudah ditandatangani pemeriksa dan pemegang dana.', label: 'Finalkan opname' });
          if (r) await jalankan(() => api.post(`/opname/${o.id}/final`), { sukses: 'Opname difinalkan.' });
        };
        const selisih = Number(o.selisih);
        return (
          <>
            <Kepala
              judul={o.nomor}
              status={<Status kode={o.status} />}
              remah={[{ label: 'Opname kas kecil', ke: '/opname' }]}
              sub={`${o.dana_nama} · ${waktu(o.waktu_opname)}`}
              aksi={
                <>
                  {pemeriksa && o.status === 'DRAFT' && <TautanTombol ke={`/opname/${o.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
                  <TombolCetak jenis="OPN" id={o.id} label="Cetak berita acara" />
                  {pemeriksa && o.status === 'DRAFT' && (
                    <Tombol varian="utama" onClick={finalkan} sibuk={sibuk}>
                      Finalkan opname
                    </Tombol>
                  )}
                </>
              }
            />
            {selisih !== 0 && (
              <Pesan jenis={selisih < 0 ? 'galat' : 'peringatan'} judul={selisih < 0 ? 'Uang tunai kurang' : 'Uang tunai lebih'}>
                Selisih {rupiah(Math.abs(selisih))}. Minta penjelasan tertulis pemegang dana; penyelesaiannya dicatat melalui bukti memorial yang disetujui Manajer Keuangan.
              </Pesan>
            )}
            <div className="grid-2-1">
              <Kartu judul="Rincian uang tunai" rapat>
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Pecahan</th>
                      <th className="angka">Lembar/keping</th>
                      <th className="angka">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(o.rincian?.baris || []).map((b) => (
                      <tr key={`${b.jenis}${b.nilai}`}>
                        <td>
                          {b.jenis === 'kertas' ? 'Uang kertas' : 'Uang logam'} {rupiah(b.nilai)}
                        </td>
                        <td className="angka">{angka(b.lembar)}</td>
                        <td className="angka">{rupiah(b.jumlah)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>Total uang tunai fisik</td>
                      <td className="angka">{rupiah(o.total_fisik)}</td>
                    </tr>
                  </tfoot>
                </table>
              </Kartu>
              <Kartu judul="Perhitungan">
                <Info
                  butir={[
                    ['Dana', o.dana_nama],
                    ['Pemegang dana', o.pemegang_nama],
                    ['Pemeriksa', `${o.dibuat_nama}${o.dibuat_jabatan ? `, ${o.dibuat_jabatan}` : ''}`],
                    ['Dana tetap', rupiah(o.jumlah_dana)],
                    ['Bukti belum diganti', rupiah(o.bukti_belum_diganti)],
                    ['Saldo tunai seharusnya', rupiah(o.saldo_seharusnya)],
                    ['Uang tunai fisik', rupiah(o.total_fisik)],
                    ['Selisih', <span className={selisih < 0 ? 'teks-bahaya' : selisih > 0 ? 'teks-peringatan' : 'teks-sukses'}>{rupiah(selisih)}</span>],
                    o.keterangan && ['Keterangan', o.keterangan],
                    o.difinalkan_pada && ['Difinalkan', waktu(o.difinalkan_pada)],
                  ]}
                />
              </Kartu>
            </div>
          </>
        );
      }}
    </Muat>
  );
}
