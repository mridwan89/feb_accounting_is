// Akuntansi: daftar dan rincian jurnal, ekspor CSV, bukti memorial (jurnal manual), serta periode dan tutup buku.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, qs } from '../api.js';
import { useAuth } from '../auth.jsx';
import { angka, awalBulanIni, hariIni, jumlahkan, namaBulan, rupiah, tanggal, waktu } from '../format.js';
import { useAksi, useApi, useDepartemen, usePilihanAkun, usePilihanPemasok } from '../components/data.js';
import { EditorBaris, SaringDaftar, TombolCetak, useAksiDokumen, useSaring } from '../components/Dokumen.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import { PanelPersetujuan } from '../components/Persetujuan.jsx';
import {
  BarisKosong, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Muat, Pesan, Pilihan, Status, TautanTombol, Tombol, useFormulir, useKonfirmasi,
  useToast,
} from '../components/ui.jsx';
import { PesanDokumen } from './Permintaan.jsx';

export const JENIS_JURNAL = { JP: 'Jurnal pembelian', JKK: 'Jurnal pengeluaran kas', JKM: 'Jurnal penerimaan kas', JU: 'Jurnal umum' };
const RUTE_SUMBER = { FB: '/faktur', BYR: '/pembayaran', BKM: '/bkm', PJUM: '/pjum', JM: '/jurnal-manual', RB: '/rekonsiliasi' };

export function TautanSumber({ tipe, id, nomor }) {
  if (!nomor) return '-';
  return RUTE_SUMBER[tipe] && id ? <Link to={`${RUTE_SUMBER[tipe]}/${id}`}>{nomor}</Link> : nomor;
}

/** Unduh berkas dari API (misalnya CSV) dengan nama tertentu. */
export async function unduh(url, nama) {
  const blob = await api.blob(url);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------- jurnal

export function DaftarJurnal() {
  const navigate = useNavigate();
  const toast = useToast();
  const saring = useSaring(['dari', 'sampai', 'jenis', 'cari', 'akun_id', 'halaman']);
  const akun = usePilihanAkun({ semua: true });
  const n = saring.nilai;
  const filter = { dari: n.dari || awalBulanIni(), sampai: n.sampai || hariIni(), jenis: n.jenis, cari: n.cari, akun_id: n.akun_id };
  const halaman = Number(n.halaman || 1);
  const q = useApi(`/jurnal${qs({ ...filter, halaman, per_halaman: 50 })}`);
  const [sibuk, setSibuk] = useState(false);
  const ekspor = async () => {
    setSibuk(true);
    try {
      await unduh(`/jurnal/ekspor${qs(filter)}`, `jurnal_${filter.dari}_${filter.sampai}.csv`);
      toast.sukses('Berkas CSV jurnal diunduh.');
    } catch (e) {
      toast.galat(e.message);
    } finally {
      setSibuk(false);
    }
  };
  return (
    <>
      <Kepala
        judul="Jurnal"
        sub="Jurnal terbentuk otomatis dari transaksi. Jurnal terposting tidak dapat diubah atau dihapus; koreksi memakai jurnal pembalik atau bukti memorial."
        aksi={
          <Tombol ikon="unduh" onClick={ekspor} sibuk={sibuk}>
            Unduh CSV
          </Tombol>
        }
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} placeholder="Nomor jurnal, keterangan, atau nomor sumber">
          <Kolom label="Jenis">
            <Pilihan pilihan={Object.entries(JENIS_JURNAL)} kosong="Semua jenis" value={n.jenis} onChange={(e) => saring.atur('jenis', e.target.value)} />
          </Kolom>
          <Kolom label="Akun" className="lebar">
            <Kombo pilihan={akun} value={n.akun_id} onChange={(x) => saring.atur('akun_id', x)} placeholder="Semua akun" />
          </Kolom>
        </SaringDaftar>
        <Muat kueri={q}>
          {(r) => (
            <>
              <div className="ringkas-angka">
                <div>
                  <div className="label">Jumlah jurnal</div>
                  <div className="nilai">{angka(r.total)}</div>
                </div>
                <div>
                  <div className="label">Total nilai</div>
                  <div className="nilai">{rupiah(r.nilai)}</div>
                </div>
                <div>
                  <div className="label">Periode</div>
                  <div className="nilai" style={{ fontSize: 14 }}>
                    {tanggal(filter.dari)} sampai {tanggal(filter.sampai)}
                  </div>
                </div>
              </div>
              <div className="tabel-bungkus">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Nomor</th>
                      <th>Tanggal</th>
                      <th>Jenis</th>
                      <th>Sumber</th>
                      <th>Keterangan</th>
                      <th className="angka">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data.length === 0 && <BarisKosong kolom={6} judul="Tidak ada jurnal pada rentang ini" />}
                    {r.data.map((j) => (
                      <tr key={j.id} className="klik" onClick={() => navigate(`/jurnal/${j.id}`)}>
                        <td className="nomor">{j.nomor}</td>
                        <td className="nowrap">{tanggal(j.tanggal)}</td>
                        <td>{j.jenis}</td>
                        <td>{j.sumber_nomor || '-'}</td>
                        <td>
                          {j.keterangan}
                          {j.dibalik_oleh_nomor && <div className="kecil teks-peringatan">Dibalik oleh {j.dibalik_oleh_nomor}</div>}
                          {j.pembalik_dari_nomor && <div className="kecil teks-peringatan">Pembalik {j.pembalik_dari_nomor}</div>}
                        </td>
                        <td className="angka">{rupiah(j.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.total > r.per_halaman && (
                <div className="baris-aksi" style={{ padding: '8px 16px', marginTop: 0, alignItems: 'center' }}>
                  <span className="kecil lemah">
                    Halaman {halaman} dari {Math.ceil(r.total / r.per_halaman)}
                  </span>
                  <Tombol kecil disabled={halaman <= 1} onClick={() => saring.atur('halaman', halaman - 1)}>
                    Sebelumnya
                  </Tombol>
                  <Tombol kecil disabled={halaman * r.per_halaman >= r.total} onClick={() => saring.atur('halaman', halaman + 1)}>
                    Berikutnya
                  </Tombol>
                </div>
              )}
            </>
          )}
        </Muat>
      </Kartu>
    </>
  );
}

export function DetailJurnal() {
  const { id } = useParams();
  const q = useApi(`/jurnal/${id}`);
  return (
    <Muat kueri={q}>
      {(j) => {
        const debit = jumlahkan(j.baris, (b) => b.debit);
        const kredit = jumlahkan(j.baris, (b) => b.kredit);
        return (
          <>
            <Kepala judul={j.nomor} remah={[{ label: 'Jurnal', ke: '/jurnal' }]} sub={`${JENIS_JURNAL[j.jenis]} · ${tanggal(j.tanggal, true)}`} />
            {j.dibalik_oleh_id && (
              <Pesan jenis="peringatan">
                Jurnal ini sudah dibalik oleh <Link to={`/jurnal/${j.dibalik_oleh_id}`}>{j.dibalik_oleh_nomor}</Link>.
              </Pesan>
            )}
            {j.pembalik_dari_id && (
              <Pesan jenis="info">
                Jurnal ini membalik <Link to={`/jurnal/${j.pembalik_dari_id}`}>{j.pembalik_dari_nomor}</Link>.
              </Pesan>
            )}
            <Kartu judul="Keterangan">
              <Info
                butir={[
                  ['Tanggal', tanggal(j.tanggal, true)],
                  ['Jenis', JENIS_JURNAL[j.jenis]],
                  ['Dokumen sumber', <TautanSumber tipe={j.sumber_tipe} id={j.sumber_id} nomor={j.sumber_nomor} />],
                  ['Diposting oleh', j.dibuat_nama],
                  ['Waktu posting', waktu(j.dibuat_pada)],
                  ['Keterangan', j.keterangan],
                ]}
              />
            </Kartu>
            <Kartu judul="Baris jurnal" rapat>
              <div className="tabel-bungkus">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Akun</th>
                      <th>Unit kerja</th>
                      <th>Pemasok</th>
                      <th>Keterangan</th>
                      <th className="angka">Debit</th>
                      <th className="angka">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.baris.map((b) => (
                      <tr key={b.id}>
                        <td>{b.baris}</td>
                        <td style={{ paddingLeft: Number(b.kredit) > 0 ? 28 : 10 }}>
                          {b.akun_kode} {b.akun_nama}
                        </td>
                        <td>{b.departemen_nama || '-'}</td>
                        <td>{b.pemasok_nama || '-'}</td>
                        <td>{b.keterangan}</td>
                        <td className="angka">{Number(b.debit) ? rupiah(b.debit) : ''}</td>
                        <td className="angka">{Number(b.kredit) ? rupiah(b.kredit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}>Jumlah</td>
                      <td className="angka">{rupiah(debit)}</td>
                      <td className="angka">{rupiah(kredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Kartu>
          </>
        );
      }}
    </Muat>
  );
}

// ---------------------------------------------------------------- bukti memorial (jurnal manual)

const JENIS_JM = { UMUM: 'Umum', PENYESUAIAN: 'Penyesuaian', SALDO_AWAL: 'Saldo awal' };

export function DaftarJM() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring(['status', 'dari', 'sampai']);
  const q = useApi(`/jurnal-manual${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Bukti memorial"
        sub="Jurnal manual untuk saldo awal, koreksi, dan penyesuaian. Setiap bukti memorial wajib disetujui Wakil Dekan II sebelum diposting."
        aksi={punya('STAF_KEUANGAN', 'KASUBAG_KEUANGAN') && <TautanTombol ke="/jurnal-manual/baru" varian="utama" ikon="tambah">Buat bukti memorial</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} cari={false} status={[['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DISETUJUI', 'Disetujui'], ['DITOLAK', 'Ditolak'], ['BATAL', 'Batal']]} />
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th>Keterangan</th>
                    <th className="angka">Nilai</th>
                    <th>Dibuat oleh</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={7} judul="Belum ada bukti memorial" />}
                  {data.map((m) => (
                    <tr key={m.id} className={`klik ${m.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/jurnal-manual/${m.id}`)}>
                      <td className="nomor">{m.nomor}</td>
                      <td className="nowrap">{tanggal(m.tanggal)}</td>
                      <td>{JENIS_JM[m.jenis]}</td>
                      <td>{m.keterangan}</td>
                      <td className="angka">{rupiah(m.total)}</td>
                      <td>{m.dibuat_nama}</td>
                      <td>
                        <Status kode={m.status} />
                        {m.jurnal_nomor && <div className="kecil sangat-lemah">{m.jurnal_nomor}</div>}
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

function FormJM({ awal, id }) {
  const navigate = useNavigate();
  const { punya } = useAuth();
  const f = useFormulir(awal);
  const [baris, setBaris] = useState(awal.baris);
  const { jalankan, sibuk } = useAksi();
  const akun = usePilihanAkun({});
  const pemasok = usePilihanPemasok({ aktif: false });
  const dept = useDepartemen();
  const debit = jumlahkan(baris, (b) => b.debit);
  const kredit = jumlahkan(baris, (b) => b.kredit);
  const seimbang = Math.round(debit * 100) === Math.round(kredit * 100) && debit > 0;

  const kirim = async (e) => {
    e.preventDefault();
    const data = {
      tanggal: f.nilai.tanggal,
      jenis: f.nilai.jenis,
      keterangan: f.nilai.keterangan,
      baris: baris.map((b) => ({ akun_id: b.akun_id, departemen_id: b.departemen_id || null, pemasok_id: b.pemasok_id || null, keterangan: b.keterangan, debit: b.debit || 0, kredit: b.kredit || 0 })),
    };
    const r = await jalankan(() => (id ? api.put(`/jurnal-manual/${id}`, data) : api.post('/jurnal-manual', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (id ? 'Perubahan bukti memorial tersimpan.' : `Bukti memorial ${h.nomor} tersimpan sebagai draf.`),
    });
    if (r.ok) navigate(`/jurnal-manual/${id || r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul="Data bukti memorial">
        <div className="formulir">
          <Kolom label="Tanggal" galat={f.galat.tanggal} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
          </Kolom>
          <Kolom label="Jenis" lebar={3}>
            <Pilihan pilihan={Object.entries(JENIS_JM).filter(([k]) => k !== 'SALDO_AWAL' || punya('KASUBAG_KEUANGAN'))} {...f.ikat('jenis')} />
          </Kolom>
          <Kolom label="Keterangan" galat={f.galat.keterangan} lebar={6}>
            <Masukan {...f.ikat('keterangan')} salah={!!f.galat.keterangan} maxLength={500} placeholder="Alasan jurnal dan dokumen dasarnya" />
          </Kolom>
        </div>
      </Kartu>
      <Kartu judul="Baris jurnal">
        <EditorBaris
          baris={baris}
          setBaris={setBaris}
          galat={f.galat}
          minimal={2}
          maksimal={500}
          barisBaru={() => ({ akun_id: '', departemen_id: '', pemasok_id: '', keterangan: '', debit: '', kredit: '' })}
          kolom={[
            { kunci: 'akun_id', label: 'Akun', lebar: '26%', isi: (b, ubah, g) => <Kombo pilihan={akun} value={b.akun_id} onChange={(x) => ubah('akun_id', x)} salah={!!g} placeholder="Kode atau nama akun" /> },
            {
              kunci: 'departemen_id',
              label: 'Unit kerja',
              lebar: 140,
              isi: (b, ubah) => <Pilihan pilihan={(dept.data || []).map((d) => [d.id, d.kode])} kosong="-" value={b.departemen_id || ''} onChange={(e) => ubah('departemen_id', e.target.value)} aria-label="Unit kerja" />,
            },
            { kunci: 'pemasok_id', label: 'Pemasok', lebar: '16%', isi: (b, ubah, g) => <Kombo pilihan={pemasok} value={b.pemasok_id} onChange={(x) => ubah('pemasok_id', x)} salah={!!g} placeholder="Untuk utang usaha" /> },
            { kunci: 'keterangan', label: 'Keterangan', isi: (b, ubah) => <Masukan value={b.keterangan} onChange={(e) => ubah('keterangan', e.target.value)} maxLength={255} aria-label="Keterangan baris" /> },
            { kunci: 'debit', label: 'Debit', angka: true, lebar: 130, isi: (b, ubah, g) => <InputUang value={b.debit} onChange={(x) => ubah('debit', x)} salah={!!g} aria-label="Debit" /> },
            { kunci: 'kredit', label: 'Kredit', angka: true, lebar: 130, isi: (b, ubah, g) => <InputUang value={b.kredit} onChange={(x) => ubah('kredit', x)} salah={!!g} aria-label="Kredit" /> },
          ]}
          kaki={
            <tfoot>
              <tr>
                <td />
                <td colSpan={4}>{seimbang ? <span className="teks-sukses">Seimbang</span> : <span className="teks-bahaya">Selisih {rupiah(Math.abs(debit - kredit))}</span>}</td>
                <td className="angka">{rupiah(debit)}</td>
                <td className="angka">{rupiah(kredit)}</td>
                <td />
              </tr>
            </tfoot>
          }
        />
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

export function HalamanFormJM() {
  const { id } = useParams();
  const q = useApi(id ? `/jurnal-manual/${id}` : null);
  const kosong = () => ({ akun_id: '', departemen_id: '', pemasok_id: '', keterangan: '', debit: '', kredit: '' });
  return (
    <>
      <Kepala judul={id ? 'Ubah bukti memorial' : 'Bukti memorial baru'} remah={[{ label: 'Bukti memorial', ke: '/jurnal-manual' }]} />
      {id ? (
        <Muat kueri={q}>
          {(m) => (
            <FormJM
              id={id}
              awal={{
                tanggal: m.tanggal,
                jenis: m.jenis,
                keterangan: m.keterangan,
                baris: m.baris.map((b) => ({
                  akun_id: b.akun_id,
                  departemen_id: b.departemen_id || '',
                  pemasok_id: b.pemasok_id || '',
                  keterangan: b.keterangan || '',
                  debit: Number(b.debit) || '',
                  kredit: Number(b.kredit) || '',
                  _kunci: b.id,
                })),
              }}
            />
          )}
        </Muat>
      ) : (
        <FormJM awal={{ tanggal: hariIni(), jenis: 'UMUM', keterangan: '', baris: [kosong(), kosong()] }} />
      )}
    </>
  );
}

export function DetailJM() {
  const { id } = useParams();
  const q = useApi(`/jurnal-manual/${id}`);
  return <Muat kueri={q}>{(m) => <IsiDetailJM m={m} />}</Muat>;
}

function IsiDetailJM({ m }) {
  const { pengguna, punya } = useAuth();
  const aksi = useAksiDokumen('/jurnal-manual', m.id, 'Bukti memorial');
  const pembuat = m.dibuat_oleh === pengguna.id;
  const bisaUbah = pembuat && ['DRAFT', 'DITOLAK'].includes(m.status);
  return (
    <>
      <Kepala
        judul={m.nomor}
        status={<Status kode={m.status} />}
        remah={[{ label: 'Bukti memorial', ke: '/jurnal-manual' }]}
        sub={`${JENIS_JM[m.jenis]} · ${m.keterangan}`}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/jurnal-manual/${m.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(m.status) && (
              <Tombol varian="bahaya" onClick={() => aksi.batal()} disabled={aksi.sibuk}>
                Batalkan
              </Tombol>
            )}
            <TombolCetak jenis="JM" id={m.id} />
            {bisaUbah && (
              <Tombol varian="utama" ikon="kirim" onClick={aksi.ajukan} sibuk={aksi.sibuk}>
                Ajukan bukti memorial
              </Tombol>
            )}
          </>
        }
      />
      <PesanDokumen doc={m} labelDok="bukti memorial" perluLampiran={false} />
      {m.jurnal_nomor && (
        <Pesan jenis="sukses">
          Sudah diposting sebagai <Link to={`/jurnal/${m.jurnal_id}`}>{m.jurnal_nomor}</Link>.
        </Pesan>
      )}
      <div className="grid-2-1">
        <Kartu judul="Baris jurnal" rapat>
          <div className="tabel-bungkus">
            <table className="tabel">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Akun</th>
                  <th>Unit kerja</th>
                  <th>Pemasok</th>
                  <th>Keterangan</th>
                  <th className="angka">Debit</th>
                  <th className="angka">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {m.baris.map((b) => (
                  <tr key={b.id}>
                    <td>{b.baris}</td>
                    <td>
                      {b.akun_kode} {b.akun_nama}
                    </td>
                    <td>{b.departemen_nama || '-'}</td>
                    <td>{b.pemasok_nama || '-'}</td>
                    <td>{b.keterangan}</td>
                    <td className="angka">{Number(b.debit) ? rupiah(b.debit) : ''}</td>
                    <td className="angka">{Number(b.kredit) ? rupiah(b.kredit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Jumlah</td>
                  <td className="angka">{rupiah(m.total)}</td>
                  <td className="angka">{rupiah(m.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Kartu>
        <div>
          <PanelPersetujuan jenis="JM" id={m.id} riwayat={m.persetujuan} boleh={m.boleh_memutuskan} />
          <PanelLampiran jenis="JM" id={m.id} bolehUnggah={m.status !== 'BATAL' && punya('STAF_KEUANGAN', 'KASUBAG_KEUANGAN')} bolehHapus={bisaUbah} judul="Dokumen dasar" />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- periode dan tutup buku

export function HalamanPeriode() {
  const { punya } = useAuth();
  const q = useApi('/periode');
  const [t, b] = hariIni().split('-').map(Number);
  const [pilih, setPilih] = useState(b === 1 ? { tahun: t - 1, bulan: 12 } : { tahun: t, bulan: b - 1 });
  const cek = useApi(`/periode/cek?tahun=${pilih.tahun}&bulan=${pilih.bulan}`);
  const { jalankan, sibuk } = useAksi();
  const konfirmasi = useKonfirmasi();
  const periode = (q.data || []).find((p) => p.tahun === pilih.tahun && p.bulan === pilih.bulan);
  const tutup = periode?.status === 'TUTUP';
  const nama = `${namaBulan(pilih.bulan)} ${pilih.tahun}`;
  const perhatian = (cek.data || []).filter((c) => c.status !== 'OK').length;

  const aksiTutup = async () => {
    const r = await konfirmasi({
      judul: `Tutup periode ${nama}`,
      pesan: perhatian ? `Masih ada ${perhatian} butir daftar periksa yang perlu perhatian. Periode tetap dapat ditutup, tetapi transaksi yang tertunda harus dicatat di periode berikutnya.` : 'Setelah ditutup, tidak ada transaksi yang dapat diposting dengan tanggal pada periode ini.',
      label: 'Tutup periode',
    });
    if (r) await jalankan(() => api.post('/periode/tutup', pilih), { sukses: `Periode ${nama} ditutup.` });
  };
  const aksiBuka = async () => {
    const r = await konfirmasi({ judul: `Buka kembali ${nama}`, pesan: 'Pembukaan kembali tercatat di log audit dan laporan pengecualian.', label: 'Buka periode', bahaya: true, alasan: { label: 'Alasan membuka kembali' } });
    if (r) await jalankan(() => api.post('/periode/buka', { ...pilih, alasan: r.alasan }), { sukses: `Periode ${nama} dibuka kembali.` });
  };

  const bulanPilihan = [];
  for (let i = 0; i < 18; i += 1) {
    const d = new Date(Date.UTC(t, b - 1 - i, 1));
    bulanPilihan.push([`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`, `${namaBulan(d.getUTCMonth() + 1)} ${d.getUTCFullYear()}`]);
  }

  return (
    <>
      <Kepala judul="Periode akuntansi" sub="Tutup buku bulanan mengunci periode dari posting. Pembukaan kembali hanya oleh Wakil Dekan II dengan alasan tertulis." />
      <div className="grid-2-1">
        <Kartu
          judul={`Daftar periksa tutup buku ${nama}`}
          aksi={
            <Pilihan
              pilihan={bulanPilihan}
              value={`${pilih.tahun}-${pilih.bulan}`}
              onChange={(e) => {
                const [th, bl] = e.target.value.split('-').map(Number);
                setPilih({ tahun: th, bulan: bl });
              }}
              aria-label="Pilih periode"
            />
          }
          rapat
        >
          <Muat kueri={cek}>
            {(data) => (
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Butir</th>
                    <th className="angka">Jumlah</th>
                    <th>Status</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.butir}>
                      <td>{c.butir}</td>
                      <td className="angka">{c.jumlah}</td>
                      <td>
                        <span className={`status-periksa ${c.status}`}>{c.status === 'OK' ? 'Beres' : 'Perlu perhatian'}</span>
                      </td>
                      <td className="kecil">{c.catatan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Muat>
          <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderTop: '1px solid var(--garis)' }}>
            <div>
              Status periode: <Status kode={tutup ? 'TUTUP' : 'BUKA'} />
              {tutup && periode.ditutup_nama && (
                <span className="kecil lemah">
                  {' '}
                  oleh {periode.ditutup_nama}, {waktu(periode.ditutup_pada)}
                </span>
              )}
            </div>
            {punya('WAKIL_DEKAN_2') &&
              (tutup ? (
                <Tombol varian="bahaya" onClick={aksiBuka} sibuk={sibuk}>
                  Buka kembali periode
                </Tombol>
              ) : (
                <Tombol varian="utama" onClick={aksiTutup} sibuk={sibuk}>
                  Tutup periode {nama}
                </Tombol>
              ))}
          </div>
        </Kartu>
        <Kartu judul="Riwayat periode" rapat>
          <Muat kueri={q}>
            {(data) => (
              <table className="tabel">
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={2} judul="Belum ada periode" />}
                  {data.map((p) => (
                    <tr key={p.id} className="klik" onClick={() => setPilih({ tahun: p.tahun, bulan: p.bulan })}>
                      <td>
                        {namaBulan(p.bulan)} {p.tahun}
                        {p.ditutup_nama && <div className="kecil sangat-lemah">Ditutup {p.ditutup_nama}</div>}
                      </td>
                      <td>
                        <Status kode={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Muat>
        </Kartu>
      </div>
    </>
  );
}
