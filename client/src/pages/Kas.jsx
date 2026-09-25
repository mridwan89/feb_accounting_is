// Fungsi kas: antrean dan pencatatan pembayaran BKK, register pembayaran, bukti kas masuk, serta buku cek dan bilyet giro.
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, qs } from '../api.js';
import { useAuth } from '../auth.jsx';
import { JENIS_BKK, METODE } from '../konstanta.js';
import { hariIni, rupiah, tanggal, terbilang, waktu } from '../format.js';
import { useAksi, useApi, useDana, usePilihanAkun, usePilihanPemasok, useRekening } from '../components/data.js';
import { SaringDaftar, TombolCetak, useSaring } from '../components/Dokumen.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import {
  AreaTeks, BarisKosong, Centang, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Modal, Muat, Pesan, Pilihan, Status, Tab, TautanDok, TautanTombol, Tombol,
  useFormulir, useKonfirmasi,
} from '../components/ui.jsx';

// ---------------------------------------------------------------- antrean dan register pembayaran

function Antrean() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const q = useApi('/pembayaran/antrean');
  return (
    <Muat kueri={q}>
      {(data) => {
        const total = data.reduce((a, b) => a + Number(b.jumlah_bayar), 0);
        return (
          <>
            <div className="ringkas-angka">
              <div>
                <div className="label">BKK menunggu dibayar</div>
                <div className="nilai">{data.length}</div>
              </div>
              <div>
                <div className="label">Total yang harus dibayar</div>
                <div className="nilai">{rupiah(total)}</div>
              </div>
              <div>
                <div className="label">Rencana bayar hari ini atau lewat</div>
                <div className="nilai">{data.filter((d) => d.tanggal_rencana_bayar <= hariIni()).length}</div>
              </div>
            </div>
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>BKK</th>
                    <th>Rencana bayar</th>
                    <th>Penerima</th>
                    <th>Jenis</th>
                    <th>Rekening dan metode</th>
                    <th className="angka">Jumlah dibayar</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={7} judul="Antrean kosong">BKK yang sudah disetujui lengkap akan muncul di sini.</BarisKosong>}
                  {data.map((d) => (
                    <tr key={d.id} className="klik" onClick={() => navigate(`/bkk/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td className={`nowrap ${d.tanggal_rencana_bayar < hariIni() ? 'teks-bahaya' : ''}`}>{tanggal(d.tanggal_rencana_bayar)}</td>
                      <td>
                        {d.penerima_nama}
                        {d.metode_bayar === 'TRANSFER' && d.pemasok_id && !d.rekening_terverifikasi && <div className="kecil teks-bahaya">Rekening belum terverifikasi</div>}
                      </td>
                      <td>{JENIS_BKK[d.jenis]}</td>
                      <td>
                        {d.rekening_nama}
                        <div className="kecil sangat-lemah">{METODE[d.metode_bayar]}</div>
                      </td>
                      <td className="angka">{rupiah(d.jumlah_bayar)}</td>
                      <td className="aksi-baris" onClick={(e) => e.stopPropagation()}>
                        {punya('KASIR') && (
                          <TautanTombol ke={`/pembayaran/baru?bkk_id=${d.id}`} varian="sukses" kecil>
                            Bayar
                          </TautanTombol>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      }}
    </Muat>
  );
}

function Register() {
  const navigate = useNavigate();
  const saring = useSaring(['status', 'cari', 'dari', 'sampai', 'metode', 'belum_kliring', 'tab']);
  const { tab, ...lain } = saring.nilai;
  const q = useApi(`/pembayaran${qs(lain)}`);
  return (
    <>
      <SaringDaftar saring={saring} status={[['DIBAYAR', 'Dibayar'], ['BATAL', 'Batal']]} placeholder="Nomor pembayaran, cek, penerima, atau BKK">
        <Kolom label="Metode">
          <Pilihan pilihan={Object.entries(METODE)} kosong="Semua metode" value={saring.nilai.metode} onChange={(e) => saring.atur('metode', e.target.value)} />
        </Kolom>
        <Kolom label="Kliring">
          <Pilihan pilihan={[['1', 'Belum kliring']]} kosong="Semua" value={saring.nilai.belum_kliring} onChange={(e) => saring.atur('belum_kliring', e.target.value)} />
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
                  <th>BKK</th>
                  <th>Penerima</th>
                  <th>Metode</th>
                  <th>Cek, BG, atau referensi</th>
                  <th className="angka">Jumlah</th>
                  <th>Kliring</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && <BarisKosong kolom={9} judul="Tidak ada pembayaran yang cocok dengan penyaring" />}
                {data.map((p) => (
                  <tr key={p.id} className={`klik ${p.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/pembayaran/${p.id}`)}>
                    <td className="nomor">{p.nomor}</td>
                    <td className="nowrap">{tanggal(p.tanggal)}</td>
                    <td>{p.bkk_nomor}</td>
                    <td>{p.penerima_nama}</td>
                    <td>
                      {METODE[p.metode]}
                      <div className="kecil sangat-lemah">{p.rekening_kode}</div>
                    </td>
                    <td>{p.nomor_warkat || p.nomor_referensi}</td>
                    <td className="angka">{rupiah(p.jumlah)}</td>
                    <td className="nowrap">{p.tanggal_kliring ? tanggal(p.tanggal_kliring) : '-'}</td>
                    <td>
                      <Status kode={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Muat>
    </>
  );
}

export function HalamanPembayaran() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'antrean';
  return (
    <>
      <Kepala judul="Pembayaran" sub="Kasir hanya membayar BKK yang sudah disetujui lengkap. Setiap pembayaran langsung membentuk jurnal pengeluaran kas." />
      <Kartu rapat>
        <Tab
          pilihan={[
            ['antrean', 'Antrean pembayaran'],
            ['register', 'Register pembayaran'],
          ]}
          aktif={tab}
          onPilih={(k) => setParams(k === 'antrean' ? {} : { tab: k }, { replace: true })}
        />
        {tab === 'antrean' ? <Antrean /> : <Register />}
      </Kartu>
    </>
  );
}

// ---------------------------------------------------------------- catat pembayaran

function FormBayar({ bkk }) {
  const navigate = useNavigate();
  const { pengguna } = useAuth();
  const f = useFormulir({ tanggal: hariIni(), warkat_id: '', tanggal_jatuh_tempo_bg: '', nomor_referensi: '' });
  const { jalankan, sibuk } = useAksi();
  const warkat = useApi(bkk.metode_bayar !== 'TRANSFER' ? `/warkat/tersedia?rekening_kas_id=${bkk.rekening_kas_id}&jenis=${bkk.metode_bayar}` : null);
  const usulan = warkat.data?.[0];
  const warkatId = f.nilai.warkat_id || usulan?.id || '';
  const ikutMenyetujui = bkk.persetujuan.some((p) => p.status === 'DISETUJUI' && p.diputuskan_oleh === pengguna.id);
  const dilarang = bkk.dibuat_oleh === pengguna.id ? 'Anda pembuat BKK ini sehingga tidak dapat mencatat pembayarannya.' : ikutMenyetujui ? 'Anda ikut menyetujui BKK ini sehingga tidak dapat mencatat pembayarannya.' : null;
  const belumVerifikasi = bkk.metode_bayar === 'TRANSFER' && bkk.pemasok_id && !bkk.rekening_terverifikasi;

  const kirim = async (e) => {
    e.preventDefault();
    const data = { bkk_id: bkk.id, tanggal: f.nilai.tanggal };
    if (bkk.metode_bayar === 'TRANSFER') data.nomor_referensi = f.nilai.nomor_referensi;
    else data.warkat_id = warkatId;
    if (bkk.metode_bayar === 'BG') data.tanggal_jatuh_tempo_bg = f.nilai.tanggal_jatuh_tempo_bg;
    const r = await jalankan(() => api.post('/pembayaran', data), { setGalat: f.setGalat, sukses: (h) => `Pembayaran ${h.nomor} tercatat dan diposting ke jurnal ${h.jurnal}.` });
    if (r.ok) navigate(`/pembayaran/${r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      {dilarang && <Pesan jenis="galat">{dilarang}</Pesan>}
      {belumVerifikasi && <Pesan jenis="galat">Rekening pemasok belum diverifikasi. Transfer tidak dapat dicatat sampai Kepala Bagian Akuntansi memverifikasinya.</Pesan>}
      <div className="grid-2-1">
        <Kartu judul={`${METODE[bkk.metode_bayar]} dari ${bkk.rekening_nama}`}>
          <div className="formulir">
            <Kolom label="Tanggal bayar" galat={f.galat.tanggal} lebar={4}>
              <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
            </Kolom>
            {bkk.metode_bayar === 'TRANSFER' ? (
              <Kolom label="Nomor referensi transfer" galat={f.galat.nomor_referensi} bantuan="Salin dari bukti transaksi internet banking." lebar={8}>
                <Masukan {...f.ikat('nomor_referensi')} salah={!!f.galat.nomor_referensi} maxLength={60} autoFocus />
              </Kolom>
            ) : (
              <Kolom
                label={`Nomor ${bkk.metode_bayar === 'CEK' ? 'cek' : 'bilyet giro'}`}
                galat={f.galat.warkat_id}
                bantuan={usulan ? `Lembar terkecil yang tersedia diusulkan: ${usulan.nomor}. Pakai lembar fisik dengan nomor yang sama.` : 'Tidak ada lembar tersedia. Daftarkan buku baru di menu Buku cek dan BG.'}
                lebar={8}
              >
                <Pilihan
                  pilihan={(warkat.data || []).map((w) => [w.id, w.nomor])}
                  kosong={warkat.isPending ? 'Memuat...' : 'Tidak ada lembar tersedia'}
                  value={warkatId}
                  onChange={(e) => f.atur('warkat_id', e.target.value)}
                  salah={!!f.galat.warkat_id}
                />
              </Kolom>
            )}
            {bkk.metode_bayar === 'BG' && (
              <Kolom label="Tanggal efektif bilyet giro" galat={f.galat.tanggal_jatuh_tempo_bg} lebar={4}>
                <Masukan type="date" {...f.ikat('tanggal_jatuh_tempo_bg')} salah={!!f.galat.tanggal_jatuh_tempo_bg} />
              </Kolom>
            )}
          </div>
        </Kartu>
        <Kartu judul="Yang dibayar">
          <Info
            butir={[
              ['BKK', <Link to={`/bkk/${bkk.id}`}>{bkk.nomor}</Link>],
              ['Penerima', bkk.penerima_nama],
              bkk.penerima_bank_rekening && ['Rekening tujuan', `${bkk.penerima_bank_nama} ${bkk.penerima_bank_rekening} a.n. ${bkk.penerima_bank_atas_nama}`],
              ['Jumlah dibayar', <strong>{rupiah(bkk.jumlah_bayar)}</strong>],
            ]}
          />
          <div className="terbilang" style={{ textAlign: 'left', padding: '10px 0 0' }}>
            {terbilang(bkk.jumlah_bayar)}
          </div>
        </Kartu>
      </div>
      <div className="baris-aksi">
        <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
        <Tombol type="submit" varian="sukses" sibuk={sibuk} disabled={!!dilarang || belumVerifikasi}>
          Catat pembayaran
        </Tombol>
      </div>
    </form>
  );
}

export function HalamanBayar() {
  const [params] = useSearchParams();
  const id = params.get('bkk_id');
  const q = useApi(id ? `/bkk/${id}` : null);
  return (
    <>
      <Kepala judul="Catat pembayaran" remah={[{ label: 'Pembayaran', ke: '/pembayaran' }]} sub="Periksa BKK dan tanda tangan persetujuannya sebelum menyerahkan cek atau menjalankan transfer." />
      {!id ? (
        <Pesan jenis="info">
          Pilih BKK dari <Link to="/pembayaran">antrean pembayaran</Link>.
        </Pesan>
      ) : (
        <Muat kueri={q}>
          {(bkk) =>
            bkk.status !== 'DISETUJUI' ? (
              <Pesan jenis="galat">
                {bkk.nomor} berstatus {bkk.status.toLowerCase()} sehingga tidak dapat dibayar. <Link to={`/bkk/${bkk.id}`}>Buka BKK</Link>
              </Pesan>
            ) : (
              <FormBayar bkk={bkk} />
            )
          }
        </Muat>
      )}
    </>
  );
}

// ---------------------------------------------------------------- detail pembayaran

function DialogBatalBayar({ p, onTutup }) {
  const [alasan, setAlasan] = useState('');
  const [batalBkk, setBatalBkk] = useState(false);
  const [galat, setGalat] = useState('');
  const { jalankan, sibuk } = useAksi();
  const lanjut = async () => {
    if (!alasan.trim()) {
      setGalat('Wajib diisi.');
      return;
    }
    const r = await jalankan(() => api.post(`/pembayaran/${p.id}/batal`, { alasan, batalkan_bkk: batalBkk }), { sukses: (h) => `Pembayaran dibatalkan dengan jurnal pembalik ${h.jurnal_pembalik}.` });
    if (r.ok) onTutup();
  };
  return (
    <Modal
      judul={`Batalkan pembayaran ${p.nomor}`}
      onTutup={onTutup}
      kaki={
        <>
          <Tombol onClick={onTutup}>Batal</Tombol>
          <Tombol varian="bahaya-penuh" onClick={lanjut} sibuk={sibuk}>
            Batalkan pembayaran
          </Tombol>
        </>
      }
    >
      <p>
        Jurnal pengeluaran kas dibalik dengan jurnal pembalik bertanggal hari ini, dokumen sumber dikembalikan ke posisi sebelum dibayar
        {p.nomor_warkat ? `, dan lembar ${p.nomor_warkat} ditandai batal` : ''}. Jejak pembayaran tetap tersimpan.
      </p>
      <Kolom label="Alasan pembatalan" galat={galat} lebar={12}>
        <AreaTeks
          value={alasan}
          salah={!!galat}
          autoFocus
          maxLength={255}
          onChange={(e) => {
            setAlasan(e.target.value);
            setGalat('');
          }}
        />
      </Kolom>
      <div style={{ marginTop: 10 }}>
        <Centang label="Batalkan juga BKK-nya (tidak akan dibayar ulang)" checked={batalBkk} onChange={setBatalBkk} />
      </div>
    </Modal>
  );
}

export function DetailPembayaran() {
  const { id } = useParams();
  const { punya } = useAuth();
  const q = useApi(`/pembayaran/${id}`);
  const [batal, setBatal] = useState(false);
  const { jalankan, sibuk } = useAksi();
  const konfirmasi = useKonfirmasi();
  const [tglKliring, setTglKliring] = useState('');
  return (
    <Muat kueri={q}>
      {(p) => {
        const kliring = async (hapus) => {
          if (hapus) {
            const r = await konfirmasi({ judul: 'Hapus tanda kliring', pesan: `Tanda kliring ${p.nomor} akan dihapus sehingga pembayaran kembali tercatat beredar.`, label: 'Hapus tanda kliring' });
            if (!r) return;
          }
          await jalankan(() => api.post(`/pembayaran/${p.id}/kliring`, { tanggal_kliring: hapus ? null : tglKliring || hariIni() }), { sukses: hapus ? 'Tanda kliring dihapus.' : 'Tanggal kliring dicatat.' });
        };
        return (
          <>
            <Kepala
              judul={p.nomor}
              status={<Status kode={p.status} />}
              remah={[{ label: 'Pembayaran', ke: '/pembayaran?tab=register' }]}
              sub={`${METODE[p.metode]} ${p.nomor_warkat || p.nomor_referensi} · ${p.penerima_nama}`}
              aksi={
                <>
                  {punya('MANAJER_KEUANGAN') && p.status === 'DIBAYAR' && !p.tanggal_kliring && (
                    <Tombol varian="bahaya" onClick={() => setBatal(true)}>
                      Batalkan pembayaran
                    </Tombol>
                  )}
                  <TombolCetak jenis="BYR" id={p.id} label={p.metode === 'TRANSFER' ? 'Cetak instruksi transfer' : 'Cetak tanda terima'} />
                </>
              }
            />
            {p.status === 'BATAL' && (
              <Pesan jenis="peringatan" judul={`Dibatalkan oleh ${p.dibatalkan_nama} pada ${waktu(p.dibatalkan_pada)}`}>
                {p.alasan_batal}. Jurnal pembalik: {p.jurnal_batal_nomor}.
              </Pesan>
            )}
            <div className="grid-2-1">
              <Kartu judul="Data pembayaran">
                <Info
                  butir={[
                    ['Tanggal bayar', tanggal(p.tanggal, true)],
                    ['BKK', <Link to={`/bkk/${p.bkk_id}`}>{p.bkk_nomor}</Link>],
                    ['Jenis', JENIS_BKK[p.bkk_jenis]],
                    ['Penerima', p.penerima_nama],
                    p.penerima_bank_rekening && ['Rekening tujuan', `${p.penerima_bank_nama} ${p.penerima_bank_rekening} a.n. ${p.penerima_bank_atas_nama}`],
                    ['Rekening sumber', `${p.rekening_nama} (${p.rekening_nomor})`],
                    ['Metode', METODE[p.metode]],
                    p.nomor_warkat && ['Nomor warkat', p.nomor_warkat],
                    p.tanggal_jatuh_tempo_bg && ['Tanggal efektif BG', tanggal(p.tanggal_jatuh_tempo_bg, true)],
                    p.nomor_referensi && ['Referensi transfer', p.nomor_referensi],
                    ['Jumlah', <strong>{rupiah(p.jumlah)}</strong>],
                    ['Dicatat oleh', p.dibayar_nama],
                    ['Jurnal', p.jurnal_id ? <Link to={`/jurnal/${p.jurnal_id}`}>{p.jurnal_nomor}</Link> : '-'],
                    ['Tanggal kliring', p.tanggal_kliring ? tanggal(p.tanggal_kliring, true) : 'Belum kliring'],
                  ]}
                />
                <div className="terbilang" style={{ textAlign: 'left', padding: '12px 0 0' }}>
                  Terbilang: {terbilang(p.jumlah)}
                </div>
              </Kartu>
              <div>
                {punya('SPV_AKUNTANSI') && p.status === 'DIBAYAR' && (
                  <Kartu judul="Kliring bank">
                    <p className="kecil lemah" style={{ marginTop: 0 }}>
                      Tandai tanggal pembayaran ini muncul di rekening koran. Biasanya dilakukan dari halaman rekonsiliasi bank.
                    </p>
                    <div className="formulir">
                      <Kolom label="Tanggal kliring" lebar={12}>
                        <Masukan type="date" value={tglKliring || p.tanggal_kliring || ''} onChange={(e) => setTglKliring(e.target.value)} />
                      </Kolom>
                    </div>
                    <div className="baris-aksi">
                      {p.tanggal_kliring && (
                        <Tombol onClick={() => kliring(true)} disabled={sibuk}>
                          Hapus tanda kliring
                        </Tombol>
                      )}
                      <Tombol varian="utama" onClick={() => kliring(false)} sibuk={sibuk}>
                        Simpan tanggal kliring
                      </Tombol>
                    </div>
                  </Kartu>
                )}
                <PanelLampiran jenis="BYR" id={p.id} bolehUnggah={p.status !== 'BATAL' && punya('KASIR')} judul="Bukti transfer dan tanda terima" />
              </div>
            </div>
            {batal && <DialogBatalBayar p={p} onTutup={() => setBatal(false)} />}
          </>
        );
      }}
    </Muat>
  );
}

// ---------------------------------------------------------------- bukti kas masuk (BKM)

const SUMBER_BKM = { PENGEMBALIAN_UANG_MUKA: 'Pengembalian sisa uang muka', PENGEMBALIAN_KAS_KECIL: 'Pengembalian dana kas kecil', LAINNYA: 'Penerimaan lain' };

export function DaftarBKM() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring(['dari', 'sampai', 'sumber']);
  const q = useApi(`/bkm${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Bukti kas masuk"
        sub="Uang yang kembali ke rekening perusahaan dalam siklus pengeluaran: sisa uang muka, pengembalian dana kas kecil, dan pengembalian dari pemasok."
        aksi={punya('KASIR') && <TautanTombol ke="/bkm/baru" varian="utama" ikon="tambah">Catat kas masuk</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} cari={false}>
          <Kolom label="Sumber">
            <Pilihan pilihan={Object.entries(SUMBER_BKM)} kosong="Semua sumber" value={saring.nilai.sumber} onChange={(e) => saring.atur('sumber', e.target.value)} />
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
                    <th>Sumber</th>
                    <th>Diterima dari</th>
                    <th>Keterangan</th>
                    <th>Rekening</th>
                    <th className="angka">Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Belum ada bukti kas masuk" />}
                  {data.map((k) => (
                    <tr key={k.id} className={`klik ${k.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/bkm/${k.id}`)}>
                      <td className="nomor">{k.nomor}</td>
                      <td className="nowrap">{tanggal(k.tanggal)}</td>
                      <td>{SUMBER_BKM[k.sumber]}</td>
                      <td>{k.diterima_dari}</td>
                      <td>{k.keterangan}</td>
                      <td>{k.rekening_kode}</td>
                      <td className="angka">{rupiah(k.jumlah)}</td>
                      <td>
                        <Status kode={k.status} />
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

export function HalamanFormBKM() {
  const navigate = useNavigate();
  const f = useFormulir({ sumber: 'PENGEMBALIAN_UANG_MUKA', sumber_id: '', tanggal: hariIni(), rekening_kas_id: '', diterima_dari: '', keterangan: '', jumlah: '', akun_lawan_id: '', pemasok_id: '' });
  const { jalankan, sibuk } = useAksi();
  const rekening = useRekening();
  const dana = useDana();
  const pjum = useApi(f.nilai.sumber === 'PENGEMBALIAN_UANG_MUKA' ? '/bkm/sumber?sumber=PENGEMBALIAN_UANG_MUKA' : null);
  const akun = usePilihanAkun({});
  const pemasok = usePilihanPemasok({ aktif: false });
  const atur = useApi('/pengaturan', { staleTime: 300_000 });
  const kodeUtang = atur.data?.find((p) => p.kunci === 'akun_utang_usaha')?.nilai;
  const akunTerpilih = akun.find((a) => String(a.nilai) === String(f.nilai.akun_lawan_id));
  const v = f.nilai;
  const danaTerpilih = (dana.data || []).find((d) => String(d.id) === String(v.sumber_id));

  const kirim = async (e) => {
    e.preventDefault();
    const data = { ...v };
    if (v.sumber !== 'LAINNYA') {
      delete data.akun_lawan_id;
      delete data.pemasok_id;
    }
    const r = await jalankan(() => api.post('/bkm', data), { setGalat: f.setGalat, sukses: (h) => `Bukti kas masuk ${h.nomor} tercatat, jurnal ${h.jurnal}.` });
    if (r.ok) navigate(`/bkm/${r.hasil.id}`);
  };

  return (
    <>
      <Kepala judul="Catat kas masuk" remah={[{ label: 'Bukti kas masuk', ke: '/bkm' }]} sub="Catat setelah uang benar-benar diterima di rekening atau disetor tunai ke bank." />
      <form onSubmit={kirim} noValidate>
        <Kartu>
          <div className="formulir">
            <Kolom label="Sumber penerimaan" lebar={6}>
              <Pilihan
                pilihan={Object.entries(SUMBER_BKM)}
                value={v.sumber}
                onChange={(e) => f.setNilai((n) => ({ ...n, sumber: e.target.value, sumber_id: '', jumlah: '' }))}
              />
            </Kolom>
            <Kolom label="Tanggal diterima" galat={f.galat.tanggal} lebar={3}>
              <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
            </Kolom>
            <Kolom label="Rekening penerima" galat={f.galat.rekening_kas_id} lebar={3}>
              <Pilihan pilihan={(rekening.data || []).filter((r) => r.aktif).map((r) => [r.id, r.nama])} kosong="Pilih rekening" {...f.ikat('rekening_kas_id')} salah={!!f.galat.rekening_kas_id} />
            </Kolom>
            {v.sumber === 'PENGEMBALIAN_UANG_MUKA' && (
              <Kolom label="Pertanggungjawaban dengan sisa" galat={f.galat.sumber_id} lebar={12}>
                <Pilihan
                  pilihan={(pjum.data || []).map((p) => [p.id, `${p.nomor} (uang muka ${p.uang_muka_nomor}) ${p.penerima}: sisa ${rupiah(p.jumlah)}`])}
                  kosong={pjum.isPending ? 'Memuat...' : (pjum.data || []).length ? 'Pilih pertanggungjawaban' : 'Tidak ada sisa uang muka yang menunggu disetor'}
                  value={v.sumber_id}
                  onChange={(e) => {
                    const p = (pjum.data || []).find((x) => String(x.id) === e.target.value);
                    f.setNilai((n) => ({ ...n, sumber_id: e.target.value, jumlah: p ? Number(p.jumlah) : '' }));
                  }}
                  salah={!!f.galat.sumber_id}
                />
              </Kolom>
            )}
            {v.sumber === 'PENGEMBALIAN_KAS_KECIL' && (
              <Kolom label="Dana kas kecil" galat={f.galat.sumber_id} bantuan={danaTerpilih ? `Uang tunai dana saat ini ${rupiah(danaTerpilih.saldo_tunai)}.` : undefined} lebar={12}>
                <Pilihan pilihan={(dana.data || []).filter((d) => Number(d.jumlah_dana) > 0).map((d) => [d.id, `${d.nama} (${d.pemegang_nama})`])} kosong="Pilih dana" {...f.ikat('sumber_id')} salah={!!f.galat.sumber_id} />
              </Kolom>
            )}
            {v.sumber === 'LAINNYA' && (
              <>
                <Kolom label="Akun lawan" galat={f.galat.akun_lawan_id} bantuan="Misalnya Utang Usaha untuk pengembalian kelebihan bayar pemasok." lebar={6}>
                  <Kombo pilihan={akun} value={v.akun_lawan_id} onChange={(x) => f.atur('akun_lawan_id', x)} salah={!!f.galat.akun_lawan_id} />
                </Kolom>
                {akunTerpilih && akunTerpilih.kode === kodeUtang && (
                  <Kolom label="Pemasok" galat={f.galat.pemasok_id} lebar={6}>
                    <Kombo pilihan={pemasok} value={v.pemasok_id} onChange={(x) => f.atur('pemasok_id', x)} salah={!!f.galat.pemasok_id} />
                  </Kolom>
                )}
              </>
            )}
            <Kolom label="Diterima dari" opsional={v.sumber !== 'LAINNYA'} galat={f.galat.diterima_dari} lebar={6}>
              <Masukan {...f.ikat('diterima_dari')} salah={!!f.galat.diterima_dari} maxLength={150} />
            </Kolom>
            <Kolom label="Jumlah (Rp)" galat={f.galat.jumlah} lebar={6}>
              <InputUang value={v.jumlah} onChange={(x) => f.atur('jumlah', x)} salah={!!f.galat.jumlah} readOnly={v.sumber === 'PENGEMBALIAN_UANG_MUKA'} />
            </Kolom>
            <Kolom label="Keterangan" opsional={v.sumber !== 'LAINNYA'} galat={f.galat.keterangan} lebar={12}>
              <AreaTeks {...f.ikat('keterangan')} salah={!!f.galat.keterangan} rows={2} maxLength={500} />
            </Kolom>
          </div>
          {Number(v.jumlah) > 0 && <div className="terbilang" style={{ textAlign: 'left', padding: '10px 0 0' }}>Terbilang: {terbilang(v.jumlah)}</div>}
        </Kartu>
        <div className="baris-aksi">
          <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
          <Tombol type="submit" varian="utama" sibuk={sibuk}>
            Simpan bukti kas masuk
          </Tombol>
        </div>
      </form>
    </>
  );
}

export function DetailBKM() {
  const { id } = useParams();
  const { punya } = useAuth();
  const q = useApi(`/bkm/${id}`);
  const konfirmasi = useKonfirmasi();
  const { jalankan, sibuk } = useAksi();
  return (
    <Muat kueri={q}>
      {(k) => {
        const batal = async () => {
          const r = await konfirmasi({ judul: `Batalkan ${k.nomor}`, pesan: 'Jurnal penerimaan kas dibalik dan dokumen sumber dikembalikan ke posisi semula.', label: 'Batalkan bukti kas masuk', bahaya: true, alasan: { label: 'Alasan pembatalan' } });
          if (r) await jalankan(() => api.post(`/bkm/${k.id}/batal`, { alasan: r.alasan }), { sukses: 'Bukti kas masuk dibatalkan.' });
        };
        return (
          <>
            <Kepala
              judul={k.nomor}
              status={<Status kode={k.status} />}
              remah={[{ label: 'Bukti kas masuk', ke: '/bkm' }]}
              sub={`${SUMBER_BKM[k.sumber]} · ${k.diterima_dari}`}
              aksi={
                <>
                  {punya('MANAJER_KEUANGAN') && k.status === 'DICATAT' && (
                    <Tombol varian="bahaya" onClick={batal} disabled={sibuk}>
                      Batalkan
                    </Tombol>
                  )}
                  <TombolCetak jenis="BKM" id={k.id} />
                </>
              }
            />
            {k.status === 'BATAL' && k.alasan_batal && <Pesan jenis="peringatan" judul="Dibatalkan">{k.alasan_batal}</Pesan>}
            <div className="grid-2-1">
              <Kartu judul="Data penerimaan">
                <Info
                  butir={[
                    ['Tanggal', tanggal(k.tanggal, true)],
                    ['Sumber', SUMBER_BKM[k.sumber]],
                    k.sumber === 'PENGEMBALIAN_UANG_MUKA' && ['Pertanggungjawaban', <TautanDok jenis="PJUM" id={k.sumber_id}>Lihat pertanggungjawaban</TautanDok>],
                    ['Diterima dari', k.diterima_dari],
                    ['Rekening penerima', k.rekening_nama],
                    ['Akun lawan', `${k.akun_lawan_kode} ${k.akun_lawan_nama}`],
                    ['Jumlah', <strong>{rupiah(k.jumlah)}</strong>],
                    ['Jurnal', k.jurnal_id ? <Link to={`/jurnal/${k.jurnal_id}`}>{k.jurnal_nomor}</Link> : '-'],
                    ['Dicatat oleh', k.dibuat_nama],
                    ['Keterangan', k.keterangan],
                  ]}
                />
                <div className="terbilang" style={{ textAlign: 'left', padding: '12px 0 0' }}>
                  Terbilang: {terbilang(k.jumlah)}
                </div>
              </Kartu>
              <PanelLampiran jenis="BKM" id={k.id} bolehUnggah={k.status !== 'BATAL' && punya('KASIR')} judul="Bukti setor" />
            </div>
          </>
        );
      }}
    </Muat>
  );
}

// ---------------------------------------------------------------- buku cek dan bilyet giro

function FormBukuCek({ onTutup }) {
  const rekening = useRekening();
  const f = useFormulir({ rekening_kas_id: '', jenis: 'CEK', seri: '', nomor_awal: '', nomor_akhir: '', digit: 6, tanggal_terima: hariIni() });
  const { jalankan, sibuk } = useAksi();
  const v = f.nilai;
  const jumlah = Number(v.nomor_akhir) >= Number(v.nomor_awal) && v.nomor_awal ? Number(v.nomor_akhir) - Number(v.nomor_awal) + 1 : 0;
  const simpan = async () => {
    const r = await jalankan(() => api.post('/buku-cek', v), { setGalat: f.setGalat, sukses: `Buku ${v.jenis === 'CEK' ? 'cek' : 'bilyet giro'} berisi ${jumlah} lembar terdaftar.` });
    if (r.ok) onTutup();
  };
  return (
    <Modal
      judul="Daftarkan buku cek atau bilyet giro"
      onTutup={onTutup}
      kaki={
        <>
          <Tombol onClick={onTutup}>Batal</Tombol>
          <Tombol varian="utama" onClick={simpan} sibuk={sibuk}>
            Daftarkan buku
          </Tombol>
        </>
      }
    >
      <div className="formulir">
        <Kolom label="Rekening" galat={f.galat.rekening_kas_id} lebar={8}>
          <Pilihan pilihan={(rekening.data || []).filter((r) => r.aktif).map((r) => [r.id, r.nama])} kosong="Pilih rekening" {...f.ikat('rekening_kas_id')} salah={!!f.galat.rekening_kas_id} />
        </Kolom>
        <Kolom label="Jenis" lebar={4}>
          <Pilihan pilihan={[['CEK', 'Cek'], ['BG', 'Bilyet giro']]} {...f.ikat('jenis')} />
        </Kolom>
        <Kolom label="Seri" opsional galat={f.galat.seri} bantuan="Huruf di depan nomor, misalnya CA." lebar={4}>
          <Masukan {...f.ikat('seri')} salah={!!f.galat.seri} maxLength={4} onChange={(e) => f.atur('seri', e.target.value.toUpperCase())} />
        </Kolom>
        <Kolom label="Nomor awal" galat={f.galat.nomor_awal} lebar={4}>
          <Masukan type="number" min="1" {...f.ikat('nomor_awal')} salah={!!f.galat.nomor_awal} />
        </Kolom>
        <Kolom label="Nomor akhir" galat={f.galat.nomor_akhir} lebar={4}>
          <Masukan type="number" min="1" {...f.ikat('nomor_akhir')} salah={!!f.galat.nomor_akhir} />
        </Kolom>
        <Kolom label="Jumlah digit" lebar={4}>
          <Masukan type="number" min="4" max="10" {...f.ikat('digit')} />
        </Kolom>
        <Kolom label="Tanggal diterima dari bank" galat={f.galat.tanggal_terima} lebar={8}>
          <Masukan type="date" {...f.ikat('tanggal_terima')} salah={!!f.galat.tanggal_terima} />
        </Kolom>
      </div>
      {jumlah > 0 && (
        <p className="kecil lemah" style={{ marginTop: 10 }}>
          {jumlah} lembar: {v.seri ? `${v.seri} ` : ''}
          {String(v.nomor_awal).padStart(Number(v.digit) || 6, '0')} sampai {v.seri ? `${v.seri} ` : ''}
          {String(v.nomor_akhir).padStart(Number(v.digit) || 6, '0')}.
        </p>
      )}
    </Modal>
  );
}

export function HalamanBukuCek() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const q = useApi('/buku-cek');
  const [form, setForm] = useState(false);
  return (
    <>
      <Kepala
        judul="Buku cek dan bilyet giro"
        sub="Setiap lembar tercatat: tersedia, terpakai untuk pembayaran tertentu, atau batal beserta alasannya."
        aksi={punya('KASIR') && <Tombol varian="utama" ikon="tambah" onClick={() => setForm(true)}>Daftarkan buku baru</Tombol>}
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Rekening</th>
                    <th>Jenis</th>
                    <th>Rentang nomor</th>
                    <th>Diterima</th>
                    <th className="angka">Tersedia</th>
                    <th className="angka">Terpakai</th>
                    <th className="angka">Batal</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Belum ada buku cek atau bilyet giro" />}
                  {data.map((b) => (
                    <tr key={b.id} className="klik" onClick={() => navigate(`/buku-cek/${b.id}`)}>
                      <td>
                        {b.rekening_nama}
                        <div className="kecil sangat-lemah">{b.rekening_kode}</div>
                      </td>
                      <td>{b.jenis === 'CEK' ? 'Cek' : 'Bilyet giro'}</td>
                      <td className="nowrap">
                        {b.seri} {String(b.nomor_awal).padStart(b.digit, '0')} sampai {String(b.nomor_akhir).padStart(b.digit, '0')}
                      </td>
                      <td className="nowrap">{tanggal(b.tanggal_terima)}</td>
                      <td className={`angka ${Number(b.tersedia) < 10 && b.status === 'AKTIF' ? 'teks-peringatan tebal' : ''}`}>{b.tersedia}</td>
                      <td className="angka">{b.terpakai}</td>
                      <td className="angka">{b.batal}</td>
                      <td>
                        <Status kode={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kartu>
        )}
      </Muat>
      {form && <FormBukuCek onTutup={() => setForm(false)} />}
    </>
  );
}

export function DetailBukuCek() {
  const { id } = useParams();
  const { punya } = useAuth();
  const buku = useApi('/buku-cek');
  const q = useApi(`/buku-cek/${id}/warkat`);
  const konfirmasi = useKonfirmasi();
  const { jalankan } = useAksi();
  const b = (buku.data || []).find((x) => String(x.id) === String(id));
  const batal = async (w) => {
    const r = await konfirmasi({ judul: `Batalkan lembar ${w.nomor}`, pesan: 'Simpan lembar fisiknya dan beri tanda BATAL; lembar yang dibatalkan tetap tercatat dalam register.', label: 'Batalkan lembar', bahaya: true, alasan: { label: 'Alasan', bantuan: 'Misalnya: salah tulis, rusak, atau hilang (lapor ke bank).' } });
    if (r) await jalankan(() => api.post(`/warkat/${w.id}/batal`, { alasan: r.alasan }), { sukses: `Lembar ${w.nomor} dibatalkan.` });
  };
  return (
    <>
      <Kepala
        judul={b ? `${b.jenis === 'CEK' ? 'Buku cek' : 'Buku bilyet giro'} ${b.seri} ${String(b.nomor_awal).padStart(b.digit, '0')}` : 'Buku cek'}
        remah={[{ label: 'Buku cek dan BG', ke: '/buku-cek' }]}
        sub={b ? `${b.rekening_nama} · ${b.tersedia} tersedia, ${b.terpakai} terpakai, ${b.batal} batal` : undefined}
        status={b && <Status kode={b.status} />}
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor lembar</th>
                    <th>Status</th>
                    <th>Pembayaran</th>
                    <th>Penerima</th>
                    <th className="angka">Jumlah</th>
                    <th>Keterangan</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.map((w) => (
                    <tr key={w.id} className={w.status === 'BATAL' ? 'redup' : ''}>
                      <td className="tebal nowrap">{w.nomor}</td>
                      <td>
                        <Status kode={w.status} />
                      </td>
                      <td>
                        {w.pembayaran_id ? <Link to={`/pembayaran/${w.pembayaran_id}`}>{w.pembayaran_nomor}</Link> : '-'}
                        {w.pembayaran_tanggal && <div className="kecil sangat-lemah">{tanggal(w.pembayaran_tanggal)} · {w.bkk_nomor}</div>}
                      </td>
                      <td>{w.penerima_nama || '-'}</td>
                      <td className="angka">{w.jumlah ? rupiah(w.jumlah) : '-'}</td>
                      <td className="kecil">
                        {w.keterangan}
                        {w.dibatalkan_nama && (
                          <div className="sangat-lemah">
                            Dibatalkan {w.dibatalkan_nama}, {waktu(w.dibatalkan_pada)}
                          </div>
                        )}
                      </td>
                      <td className="aksi-baris">
                        {punya('KASIR') && w.status === 'TERSEDIA' && (
                          <Tombol kecil varian="bahaya" onClick={() => batal(w)}>
                            Batalkan lembar
                          </Tombol>
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
    </>
  );
}
