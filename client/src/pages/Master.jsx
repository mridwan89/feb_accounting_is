// Data master: pemasok (dengan verifikasi rekening oleh pihak lain), bagan akun, kode pajak, rekening bank, dan departemen.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { angka, rupiah, waktu } from '../format.js';
import { useAksi, useApi, useDepartemen, usePajak, usePilihanAkun, useRekening } from '../components/data.js';
import { SaringDaftar, useSaring } from '../components/Dokumen.jsx';
import {
  AreaTeks, BarisKosong, Centang, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Modal, Muat, Pesan, Pilihan, Status, TautanTombol, Tombol, useFormulir,
  useKonfirmasi,
} from '../components/ui.jsx';

/**
 * Formulir dalam dialog yang dibangun dari daftar kolom.
 * kolom: [{ kunci, label, jenis: teks|angka|uang|pilihan|kombo|centang|area|sandi, pilihan, lebar, bantuan, opsional, kunciSaatUbah, transform }]
 */
export function FormDialog({ judul, awal, kolom, simpan, onTutup, labelSimpan = 'Simpan', ubah = false, catatan }) {
  const f = useFormulir(awal);
  const { jalankan, sibuk } = useAksi();
  const kirim = async () => {
    const r = await jalankan(() => simpan(f.nilai), { setGalat: f.setGalat, sukses: 'Data tersimpan.' });
    if (r.ok) onTutup(r.hasil);
  };
  return (
    <Modal
      judul={judul}
      onTutup={onTutup}
      lebar={kolom.length > 6}
      kaki={
        <>
          <Tombol onClick={() => onTutup()}>Batal</Tombol>
          <Tombol varian="utama" onClick={kirim} sibuk={sibuk}>
            {labelSimpan}
          </Tombol>
        </>
      }
    >
      {catatan}
      <div className="formulir">
        {kolom.map((k) => {
          const g = f.galat[k.kunci];
          const kunci = ubah && k.kunciSaatUbah;
          let isi;
          if (k.jenis === 'centang') isi = <Centang label={k.labelCentang || k.label} checked={f.nilai[k.kunci]} onChange={(x) => f.atur(k.kunci, x)} disabled={kunci} />;
          else if (k.jenis === 'pilihan') isi = <Pilihan pilihan={k.pilihan} kosong={k.kosong} {...f.ikat(k.kunci)} salah={!!g} disabled={kunci} />;
          else if (k.jenis === 'kombo') isi = <Kombo pilihan={k.pilihan} value={f.nilai[k.kunci]} onChange={(x) => f.atur(k.kunci, x)} salah={!!g} disabled={kunci} />;
          else if (k.jenis === 'uang') isi = <InputUang value={f.nilai[k.kunci]} onChange={(x) => f.atur(k.kunci, x)} salah={!!g} disabled={kunci} />;
          else if (k.jenis === 'area') isi = <AreaTeks {...f.ikat(k.kunci)} salah={!!g} rows={2} disabled={kunci} />;
          else
            isi = (
              <Masukan
                type={k.jenis === 'angka' ? 'number' : k.jenis === 'sandi' ? 'password' : 'text'}
                value={f.nilai[k.kunci] ?? ''}
                onChange={(e) => f.atur(k.kunci, k.transform ? k.transform(e.target.value) : e.target.value)}
                salah={!!g}
                disabled={kunci}
                step={k.jenis === 'angka' ? 'any' : undefined}
                autoComplete={k.jenis === 'sandi' ? 'new-password' : undefined}
              />
            );
          return (
            <Kolom key={k.kunci} label={k.jenis === 'centang' ? k.judulCentang || '' : k.label} opsional={k.opsional} galat={g} bantuan={k.bantuan} lebar={k.lebar || 6}>
              {isi}
            </Kolom>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- pemasok

export function DaftarPemasok() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring(['cari', 'belum_verifikasi']);
  const q = useApi(`/pemasok${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Pemasok"
        sub="Data pemasok dipelihara Staf Pembelian. Perubahan rekening bank wajib diverifikasi Kepala Bagian Akuntansi sebelum dipakai untuk transfer."
        aksi={punya('PEMBELIAN') && <TautanTombol ke="/pemasok/baru" varian="utama" ikon="tambah">Tambah pemasok</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} tanggal={false} placeholder="Nama atau kode pemasok">
          <Kolom label="Rekening">
            <Pilihan pilihan={[['1', 'Menunggu verifikasi']]} kosong="Semua" value={saring.nilai.belum_verifikasi} onChange={(e) => saring.atur('belum_verifikasi', e.target.value)} />
          </Kolom>
        </SaringDaftar>
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama</th>
                    <th>Kota</th>
                    <th>Pajak</th>
                    <th className="angka">Termin</th>
                    <th>Rekening bank</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={7} judul="Tidak ada pemasok yang cocok" />}
                  {data.map((p) => (
                    <tr key={p.id} className={`klik ${p.aktif ? '' : 'redup'}`} onClick={() => navigate(`/pemasok/${p.id}`)}>
                      <td className="nomor">{p.kode}</td>
                      <td>{p.nama}</td>
                      <td>{p.kota || '-'}</td>
                      <td className="kecil">
                        {p.pkp ? 'PKP' : 'Non-PKP'}
                        <div className={p.npwp ? 'sangat-lemah' : 'teks-peringatan'}>{p.npwp || 'Tanpa NPWP'}</div>
                      </td>
                      <td className="angka">{p.termin_hari} hari</td>
                      <td className="kecil">
                        {p.bank_nomor_rekening ? (
                          <>
                            {p.bank_nama} {p.bank_nomor_rekening}
                            <div>{p.rekening_terverifikasi ? <span className="teks-sukses">Terverifikasi</span> : <span className="teks-bahaya">Menunggu verifikasi</span>}</div>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <Status kode={p.aktif ? 'AKTIF' : 'TUTUP'} label={p.aktif ? 'Aktif' : 'Nonaktif'} />
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

function FormPemasok({ awal, id }) {
  const navigate = useNavigate();
  const f = useFormulir(awal);
  const { jalankan, sibuk } = useAksi();
  const v = f.nilai;
  const rekeningBerubah = id && (v.bank_nama !== awal.bank_nama || v.bank_nomor_rekening !== awal.bank_nomor_rekening || v.bank_atas_nama !== awal.bank_atas_nama);
  const kirim = async (e) => {
    e.preventDefault();
    const r = await jalankan(() => (id ? api.put(`/pemasok/${id}`, v) : api.post('/pemasok', v)), {
      setGalat: f.setGalat,
      sukses: rekeningBerubah ? 'Data pemasok tersimpan. Rekening baru menunggu verifikasi Kepala Bagian Akuntansi.' : 'Data pemasok tersimpan.',
    });
    if (r.ok) navigate(`/pemasok/${id || r.hasil.id}`);
  };
  const T = (kunci, label, lebar, props = {}) => (
    <Kolom label={label} galat={f.galat[kunci]} lebar={lebar} opsional={props.opsional} bantuan={props.bantuan}>
      <Masukan {...f.ikat(kunci)} salah={!!f.galat[kunci]} maxLength={props.maks} onChange={(e) => f.atur(kunci, props.besar ? e.target.value.toUpperCase() : e.target.value)} />
    </Kolom>
  );
  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul="Identitas">
        <div className="formulir">
          {T('kode', 'Kode', 3, { maks: 20, besar: true })}
          {T('nama', 'Nama pemasok', 5, { maks: 150 })}
          {T('kontak', 'Nama kontak', 4, { maks: 100, opsional: true })}
          {T('alamat', 'Alamat', 6, { maks: 255, opsional: true })}
          {T('kota', 'Kota', 2, { maks: 80, opsional: true })}
          {T('telepon', 'Telepon', 2, { maks: 40, opsional: true })}
          {T('email', 'Email', 2, { maks: 100, opsional: true })}
        </div>
      </Kartu>
      <Kartu judul="Perpajakan dan pembayaran">
        <div className="formulir">
          {T('npwp', 'NPWP', 4, { maks: 20, opsional: true, bantuan: '15 atau 16 digit. Tanpa NPWP, tarif PPh 23 dikenakan dua kali lipat.' })}
          <Kolom label="Status PPN" galat={f.galat.pkp} lebar={4}>
            <Centang label="Pengusaha Kena Pajak (PKP)" checked={v.pkp} onChange={(x) => f.atur('pkp', x)} />
          </Kolom>
          <Kolom label="Termin pembayaran (hari)" galat={f.galat.termin_hari} lebar={4}>
            <Masukan type="number" min="0" max="365" {...f.ikat('termin_hari')} salah={!!f.galat.termin_hari} />
          </Kolom>
          {T('bank_nama', 'Nama bank', 4, { maks: 60, opsional: true })}
          {T('bank_nomor_rekening', 'Nomor rekening', 4, { maks: 40, opsional: true })}
          {T('bank_atas_nama', 'Atas nama', 4, { maks: 150, opsional: true })}
          <Kolom label="Catatan" opsional lebar={8}>
            <Masukan {...f.ikat('catatan')} maxLength={255} />
          </Kolom>
          <Kolom label="Status" lebar={4}>
            <Centang label="Pemasok aktif" checked={v.aktif} onChange={(x) => f.atur('aktif', x)} />
          </Kolom>
        </div>
        {rekeningBerubah && (
          <Pesan jenis="peringatan">
            Rekening bank berubah. Setelah disimpan, rekening berstatus menunggu verifikasi dan tidak dapat dipakai untuk transfer sampai diverifikasi pengguna lain. Perubahan ini tercatat di log audit.
          </Pesan>
        )}
      </Kartu>
      <div className="baris-aksi">
        <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
        <Tombol type="submit" varian="utama" sibuk={sibuk}>
          Simpan pemasok
        </Tombol>
      </div>
    </form>
  );
}

export function HalamanFormPemasok() {
  const { id } = useParams();
  const q = useApi(id ? `/pemasok/${id}` : null);
  const kosong = { kode: '', nama: '', alamat: '', kota: '', telepon: '', email: '', kontak: '', npwp: '', pkp: false, termin_hari: 30, bank_nama: '', bank_nomor_rekening: '', bank_atas_nama: '', catatan: '', aktif: true };
  return (
    <>
      <Kepala judul={id ? 'Ubah pemasok' : 'Pemasok baru'} remah={[{ label: 'Pemasok', ke: '/pemasok' }]} />
      {id ? (
        <Muat kueri={q}>
          {(p) => (
            <FormPemasok
              id={id}
              awal={Object.fromEntries(Object.keys(kosong).map((k) => [k, k === 'pkp' || k === 'aktif' ? !!p[k] : p[k] ?? '']))}
            />
          )}
        </Muat>
      ) : (
        <FormPemasok awal={kosong} />
      )}
    </>
  );
}

export function DetailPemasok() {
  const { id } = useParams();
  const { pengguna, punya } = useAuth();
  const q = useApi(`/pemasok/${id}`);
  const { jalankan, sibuk } = useAksi();
  const konfirmasi = useKonfirmasi();
  return (
    <Muat kueri={q}>
      {(p) => {
        const bolehVerifikasi = punya('SPV_AKUNTANSI') && p.bank_nomor_rekening && !p.rekening_terverifikasi && p.rekening_diubah_oleh !== pengguna.id;
        const verifikasi = async () => {
          const r = await konfirmasi({
            judul: `Verifikasi rekening ${p.nama}`,
            pesan: (
              <>
                <p>
                  {p.bank_nama} {p.bank_nomor_rekening} a.n. {p.bank_atas_nama}
                </p>
                <p className="lemah">
                  Konfirmasi rekening ini langsung ke pemasok melalui nomor telepon yang sudah terdaftar sebelumnya, bukan melalui kontak yang tercantum pada surat atau email permintaan perubahan.
                </p>
              </>
            ),
            label: 'Rekening sudah saya konfirmasi',
          });
          if (r) await jalankan(() => api.post(`/pemasok/${p.id}/verifikasi-rekening`), { sukses: 'Rekening pemasok terverifikasi.' });
        };
        return (
          <>
            <Kepala
              judul={p.nama}
              status={<Status kode={p.aktif ? 'AKTIF' : 'TUTUP'} label={p.aktif ? 'Aktif' : 'Nonaktif'} />}
              remah={[{ label: 'Pemasok', ke: '/pemasok' }]}
              sub={`${p.kode}${p.kota ? ` · ${p.kota}` : ''}`}
              aksi={
                <>
                  {punya(['AKUNTANSI', 'SPV_AKUNTANSI', 'MANAJER_KEUANGAN', 'DIREKTUR', 'AUDITOR']) && (
                    <TautanTombol ke={`/laporan/buku-pembantu-utang?pemasok_id=${p.id}`}>Buku pembantu utang</TautanTombol>
                  )}
                  {punya('PEMBELIAN') && <TautanTombol ke={`/pemasok/${p.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
                  {bolehVerifikasi && (
                    <Tombol varian="utama" ikon="perisai" onClick={verifikasi} sibuk={sibuk}>
                      Verifikasi rekening
                    </Tombol>
                  )}
                </>
              }
            />
            {p.bank_nomor_rekening && !p.rekening_terverifikasi && (
              <Pesan jenis="peringatan" judul="Rekening menunggu verifikasi">
                Diubah oleh {p.rekening_diubah_nama || '-'} pada {waktu(p.rekening_diubah_pada)}. Transfer kepada pemasok ini belum dapat diproses.
                {punya('SPV_AKUNTANSI') && p.rekening_diubah_oleh === pengguna.id && ' Verifikasi harus dilakukan pengguna lain karena Anda yang mengubahnya.'}
              </Pesan>
            )}
            <div className="grid-2">
              <Kartu judul="Identitas dan pajak">
                <Info
                  butir={[
                    ['Kode', p.kode],
                    ['Alamat', [p.alamat, p.kota].filter(Boolean).join(', ')],
                    ['Telepon', p.telepon],
                    ['Email', p.email],
                    ['Kontak', p.kontak],
                    ['NPWP', p.npwp || 'Tidak ada'],
                    ['Status PPN', p.pkp ? 'PKP' : 'Bukan PKP'],
                    ['Termin pembayaran', `${p.termin_hari} hari`],
                    p.catatan && ['Catatan', p.catatan],
                  ]}
                />
              </Kartu>
              <Kartu judul="Rekening bank">
                <Info
                  butir={[
                    ['Bank', p.bank_nama],
                    ['Nomor rekening', p.bank_nomor_rekening],
                    ['Atas nama', p.bank_atas_nama],
                    ['Status', p.bank_nomor_rekening ? (p.rekening_terverifikasi ? <span className="teks-sukses tebal">Terverifikasi</span> : <span className="teks-bahaya tebal">Menunggu verifikasi</span>) : 'Belum ada rekening'],
                    p.rekening_diubah_pada && ['Terakhir diubah', `${p.rekening_diubah_nama || '-'}, ${waktu(p.rekening_diubah_pada)}`],
                    p.rekening_diverifikasi_pada && ['Diverifikasi', `${p.rekening_diverifikasi_nama}, ${waktu(p.rekening_diverifikasi_pada)}`],
                  ]}
                />
                {punya('AUDITOR', 'ADMIN') && (
                  <p className="kecil" style={{ marginTop: 12 }}>
                    <Link to={`/admin/audit?entitas=pemasok&entitas_id=${p.id}`}>Lihat riwayat perubahan di log audit</Link>
                  </p>
                )}
              </Kartu>
            </div>
          </>
        );
      }}
    </Muat>
  );
}

// ---------------------------------------------------------------- bagan akun

const KATEGORI = [['ASET', 'Aset'], ['LIABILITAS', 'Liabilitas'], ['EKUITAS', 'Ekuitas'], ['PENDAPATAN', 'Pendapatan'], ['BEBAN', 'Beban']];

export function HalamanAkun() {
  const { punya } = useAuth();
  const q = useApi('/akun');
  const [form, setForm] = useState(null);
  const [cari, setCari] = useState('');
  const semua = q.data || [];
  const peta = new Map(semua.map((a) => [a.id, a]));
  const tingkat = (a) => {
    let n = 0;
    let x = a;
    while (x?.induk_id && n < 6) {
      x = peta.get(x.induk_id);
      n += 1;
    }
    return n;
  };
  const tampil = semua.filter((a) => !cari || `${a.kode} ${a.nama}`.toLowerCase().includes(cari.toLowerCase()));
  const kolom = [
    { kunci: 'kode', label: 'Kode', lebar: 4, bantuan: 'Format K-GGNN, misalnya 6-1104.' },
    { kunci: 'nama', label: 'Nama akun', lebar: 8 },
    { kunci: 'kategori', label: 'Kategori', jenis: 'pilihan', pilihan: KATEGORI, lebar: 4 },
    { kunci: 'saldo_normal', label: 'Saldo normal', jenis: 'pilihan', pilihan: [['D', 'Debit'], ['K', 'Kredit']], lebar: 4 },
    { kunci: 'tipe', label: 'Tipe', jenis: 'pilihan', pilihan: [['DETAIL', 'Detail (dipakai transaksi)'], ['INDUK', 'Induk (pengelompokan)']], lebar: 4 },
    { kunci: 'induk_id', label: 'Akun induk', jenis: 'pilihan', kosong: 'Tanpa induk', pilihan: semua.filter((a) => a.tipe === 'INDUK').map((a) => [a.id, `${a.kode} ${a.nama}`]), lebar: 8, opsional: true },
    { kunci: 'aktif', label: 'Aktif', jenis: 'centang', labelCentang: 'Akun aktif', lebar: 4 },
  ];
  return (
    <>
      <Kepala
        judul="Bagan akun"
        sub="Akun yang sudah dipakai jurnal tidak dapat diubah kode, kategori, saldo normal, atau tipenya; nonaktifkan lalu buat akun baru bila perlu."
        aksi={punya('SPV_AKUNTANSI') && <Tombol varian="utama" ikon="tambah" onClick={() => setForm({ kode: '', nama: '', kategori: 'BEBAN', saldo_normal: 'D', tipe: 'DETAIL', induk_id: '', aktif: true })}>Tambah akun</Tombol>}
      />
      <Kartu rapat>
        <div className="saring">
          <Kolom label="Cari" className="lebar">
            <Masukan type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Kode atau nama akun" />
          </Kolom>
        </div>
        <Muat kueri={q}>
          {() => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama</th>
                    <th>Kategori</th>
                    <th>Saldo normal</th>
                    <th>Tipe</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((a) => (
                    <tr key={a.id} className={a.aktif ? '' : 'redup'}>
                      <td className={a.tipe === 'INDUK' ? 'tebal' : ''}>{a.kode}</td>
                      <td style={{ paddingLeft: 10 + tingkat(a) * 18 }} className={a.tipe === 'INDUK' ? 'tebal' : ''}>
                        {a.nama}
                      </td>
                      <td>{KATEGORI.find((k) => k[0] === a.kategori)?.[1]}</td>
                      <td>{a.saldo_normal === 'D' ? 'Debit' : 'Kredit'}</td>
                      <td>{a.tipe === 'INDUK' ? 'Induk' : 'Detail'}</td>
                      <td>{a.aktif ? 'Aktif' : 'Nonaktif'}</td>
                      <td className="aksi-baris">
                        {punya('SPV_AKUNTANSI') && (
                          <Tombol kecil varian="hantu" onClick={() => setForm({ ...a, induk_id: a.induk_id || '', aktif: !!a.aktif })}>
                            Ubah
                          </Tombol>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Muat>
      </Kartu>
      {form && (
        <FormDialog
          judul={form.id ? `Ubah akun ${form.kode}` : 'Tambah akun'}
          awal={form}
          kolom={kolom}
          ubah={!!form.id}
          simpan={(v) => (form.id ? api.put(`/akun/${form.id}`, v) : api.post('/akun', v))}
          onTutup={() => setForm(null)}
          labelSimpan="Simpan akun"
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- pajak

export function HalamanPajak() {
  const { punya } = useAuth();
  const q = usePajak();
  const akun = usePilihanAkun({ kategori: ['ASET', 'LIABILITAS'] });
  const [form, setForm] = useState(null);
  const kolom = [
    { kunci: 'kode', label: 'Kode', lebar: 4, transform: (x) => x.toUpperCase() },
    { kunci: 'nama', label: 'Nama', lebar: 8 },
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilihan', pilihan: [['PPN', 'PPN'], ['PPH', 'PPh']], lebar: 4 },
    { kunci: 'tarif', label: 'Tarif (%)', jenis: 'angka', lebar: 4 },
    { kunci: 'akun_id', label: 'Akun', jenis: 'kombo', pilihan: akun, lebar: 12, bantuan: 'PPN masukan: akun aset. PPh dipotong: akun utang pajak.' },
    { kunci: 'naik_tanpa_npwp', label: '', jenis: 'centang', labelCentang: 'Tarif dua kali lipat bila penerima tanpa NPWP (PPh 23)', lebar: 8 },
    { kunci: 'aktif', label: '', jenis: 'centang', labelCentang: 'Kode pajak aktif', lebar: 4 },
  ];
  return (
    <>
      <Kepala
        judul="Kode pajak"
        sub="Pajak dihitung dari dasar dikali tarif lalu dibulatkan ke bawah ke rupiah penuh."
        aksi={punya('SPV_AKUNTANSI') && <Tombol varian="utama" ikon="tambah" onClick={() => setForm({ kode: '', nama: '', jenis: 'PPH', tarif: '', akun_id: '', naik_tanpa_npwp: false, aktif: true })}>Tambah kode pajak</Tombol>}
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Jenis</th>
                  <th className="angka">Tarif</th>
                  <th>Akun</th>
                  <th>Tanpa NPWP</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className={p.aktif ? '' : 'redup'}>
                    <td className="nomor">{p.kode}</td>
                    <td>{p.nama}</td>
                    <td>{p.jenis === 'PPH' ? 'PPh' : 'PPN'}</td>
                    <td className="angka">{angka(p.tarif)}%</td>
                    <td>
                      {p.akun_kode} {p.akun_nama}
                    </td>
                    <td>{p.naik_tanpa_npwp ? 'Dua kali lipat' : '-'}</td>
                    <td>{p.aktif ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="aksi-baris">
                      {punya('SPV_AKUNTANSI') && (
                        <Tombol kecil varian="hantu" onClick={() => setForm({ ...p, tarif: Number(p.tarif), naik_tanpa_npwp: !!p.naik_tanpa_npwp, aktif: !!p.aktif })}>
                          Ubah
                        </Tombol>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kartu>
        )}
      </Muat>
      {form && (
        <FormDialog
          judul={form.id ? `Ubah ${form.kode}` : 'Tambah kode pajak'}
          awal={form}
          kolom={kolom}
          simpan={(v) => (form.id ? api.put(`/pajak/${form.id}`, v) : api.post('/pajak', v))}
          onTutup={() => setForm(null)}
          labelSimpan="Simpan kode pajak"
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- rekening bank

export function HalamanRekening() {
  const { punya } = useAuth();
  const q = useRekening();
  const akun = usePilihanAkun({ kategori: ['ASET'] });
  const [form, setForm] = useState(null);
  const kolom = [
    { kunci: 'kode', label: 'Kode', lebar: 4, transform: (x) => x.toUpperCase() },
    { kunci: 'nama', label: 'Nama rekening', lebar: 8 },
    { kunci: 'bank_nama', label: 'Bank', lebar: 4 },
    { kunci: 'nomor_rekening', label: 'Nomor rekening', lebar: 4 },
    { kunci: 'atas_nama', label: 'Atas nama', lebar: 4, opsional: true },
    { kunci: 'akun_id', label: 'Akun kas di bank', jenis: 'kombo', pilihan: akun, lebar: 8, bantuan: 'Satu akun hanya untuk satu rekening.' },
    { kunci: 'aktif', label: '', jenis: 'centang', labelCentang: 'Rekening aktif', lebar: 4 },
  ];
  return (
    <>
      <Kepala
        judul="Rekening bank"
        sub="Rekening sumber pembayaran. Saldo buku dihitung dari jurnal."
        aksi={punya('MANAJER_KEUANGAN') && <Tombol varian="utama" ikon="tambah" onClick={() => setForm({ kode: '', nama: '', bank_nama: '', nomor_rekening: '', atas_nama: '', akun_id: '', aktif: true })}>Tambah rekening</Tombol>}
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Bank dan nomor</th>
                  <th>Akun</th>
                  <th className="angka">Saldo buku</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className={r.aktif ? '' : 'redup'}>
                    <td className="nomor">{r.kode}</td>
                    <td>{r.nama}</td>
                    <td>
                      {r.bank_nama} {r.nomor_rekening}
                      <div className="kecil sangat-lemah">{r.atas_nama}</div>
                    </td>
                    <td>
                      {r.akun_kode} {r.akun_nama}
                    </td>
                    <td className="angka">{rupiah(r.saldo_buku)}</td>
                    <td>{r.aktif ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="aksi-baris">
                      {punya('MANAJER_KEUANGAN') && (
                        <Tombol kecil varian="hantu" onClick={() => setForm({ ...r, atas_nama: r.atas_nama || '', aktif: !!r.aktif })}>
                          Ubah
                        </Tombol>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kartu>
        )}
      </Muat>
      {form && (
        <FormDialog
          judul={form.id ? `Ubah ${form.kode}` : 'Tambah rekening bank'}
          awal={form}
          kolom={kolom}
          simpan={(v) => (form.id ? api.put(`/rekening-kas/${form.id}`, v) : api.post('/rekening-kas', v))}
          onTutup={() => setForm(null)}
          labelSimpan="Simpan rekening"
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- departemen

export function HalamanDepartemen() {
  const { punya } = useAuth();
  const q = useDepartemen();
  const [form, setForm] = useState(null);
  return (
    <>
      <Kepala
        judul="Departemen"
        sub="Departemen menentukan lingkup persetujuan Kepala Departemen dan pembebanan biaya."
        aksi={punya('ADMIN') && <Tombol varian="utama" ikon="tambah" onClick={() => setForm({ kode: '', nama: '', aktif: true })}>Tambah departemen</Tombol>}
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id} className={d.aktif ? '' : 'redup'}>
                    <td className="nomor">{d.kode}</td>
                    <td>{d.nama}</td>
                    <td>{d.aktif ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="aksi-baris">
                      {punya('ADMIN') && (
                        <Tombol kecil varian="hantu" onClick={() => setForm({ ...d, aktif: !!d.aktif })}>
                          Ubah
                        </Tombol>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kartu>
        )}
      </Muat>
      {form && (
        <FormDialog
          judul={form.id ? `Ubah ${form.kode}` : 'Tambah departemen'}
          awal={form}
          ubah={!!form.id}
          kolom={[
            { kunci: 'kode', label: 'Kode', lebar: 4, kunciSaatUbah: true, transform: (x) => x.toUpperCase(), bantuan: '2 sampai 10 huruf kapital atau angka.' },
            { kunci: 'nama', label: 'Nama departemen', lebar: 8 },
            { kunci: 'aktif', label: '', jenis: 'centang', labelCentang: 'Departemen aktif', lebar: 12 },
          ]}
          simpan={(v) => (form.id ? api.put(`/departemen/${form.id}`, { nama: v.nama, aktif: v.aktif }) : api.post('/departemen', v))}
          onTutup={() => setForm(null)}
          labelSimpan="Simpan departemen"
        />
      )}
    </>
  );
}
