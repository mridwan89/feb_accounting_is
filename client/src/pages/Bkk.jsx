// Bukti kas keluar (BKK): perintah bayar dari Akuntansi kepada Kasir, dibuat dari dokumen sumber yang sudah disetujui.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { JENIS_BKK, METODE } from '../konstanta.js';
import { hariIni, hitungPajak, jumlahkan, rupiah, tanggal } from '../format.js';
import { useAksi, useApi, useDepartemen, usePajak, usePilihanAkun, usePilihanPemasok, useRekening } from '../components/data.js';
import { SaringDaftar, TombolCetak, useAksiDokumen, useSaring } from '../components/Dokumen.jsx';
import { Ikon } from '../components/Ikon.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import { PanelPersetujuan } from '../components/Persetujuan.jsx';
import {
  AreaTeks, BarisKosong, Centang, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Muat, Pesan, Pilihan, Status, TautanDok, TautanTombol, Tombol,
  TotalRingkas, useFormulir,
} from '../components/ui.jsx';
import { PesanDokumen } from './Permintaan.jsx';

const STATUS_BKK = [['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DISETUJUI', 'Disetujui'], ['DITOLAK', 'Ditolak'], ['DIBAYAR', 'Dibayar'], ['BATAL', 'Batal']];
const JENIS_KARYAWAN = ['UANG_MUKA', 'KEKURANGAN_UANG_MUKA', 'PEMBENTUKAN_KAS_KECIL', 'PENGISIAN_KAS_KECIL'];
/** Jenis dokumen sumber per jenis BKK, untuk tautan dan lampiran dokumen dasar. */
const SUMBER = { PERMINTAAN_PEMBAYARAN: 'PP', UANG_MUKA: 'PUM', KEKURANGAN_UANG_MUKA: 'PJUM', PENGISIAN_KAS_KECIL: 'PDK' };

export function DaftarBKK() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring(['status', 'cari', 'dari', 'sampai', 'jenis']);
  const q = useApi(`/bkk${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Bukti kas keluar"
        sub="Setiap pembayaran dari rekening bank berangkat dari BKK yang sudah disetujui berjenjang."
        aksi={punya('AKUNTANSI') && <TautanTombol ke="/bkk/baru" varian="utama" ikon="tambah">Buat BKK</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={STATUS_BKK} placeholder="Nomor BKK, penerima, atau dokumen sumber">
          <Kolom label="Jenis">
            <Pilihan pilihan={Object.entries(JENIS_BKK)} kosong="Semua jenis" value={saring.nilai.jenis} onChange={(e) => saring.atur('jenis', e.target.value)} />
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
                    <th>Jenis</th>
                    <th>Penerima</th>
                    <th>Metode</th>
                    <th>Rencana bayar</th>
                    <th className="angka">Dibayar</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Tidak ada BKK yang cocok dengan penyaring" />}
                  {data.map((d) => (
                    <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/bkk/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td className="nowrap">{tanggal(d.tanggal)}</td>
                      <td>
                        {JENIS_BKK[d.jenis]}
                        {d.sumber_nomor && <div className="kecil sangat-lemah">{d.sumber_nomor}</div>}
                      </td>
                      <td>{d.penerima_nama}</td>
                      <td>
                        {METODE[d.metode_bayar]}
                        <div className="kecil sangat-lemah">{d.rekening_kode}</div>
                      </td>
                      <td className="nowrap">{tanggal(d.tanggal_rencana_bayar)}</td>
                      <td className="angka">{rupiah(d.jumlah_bayar)}</td>
                      <td>
                        <Status kode={d.status} />
                        {d.nomor_warkat && <div className="kecil sangat-lemah">{d.nomor_warkat}</div>}
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

// ---------------------------------------------------------------- formulir BKK

function PilihSumber({ jenis, value, onChange, galat }) {
  const q = useApi(`/bkk/sumber?jenis=${jenis}`);
  const data = q.data || [];
  return (
    <div className="tabel-bungkus">
      <table className="tabel">
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            <th>Dokumen</th>
            <th>Penerima</th>
            <th>Keterangan</th>
            <th className="angka">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {q.isPending && (
            <tr>
              <td colSpan={5} className="memuat">
                Memuat dokumen sumber...
              </td>
            </tr>
          )}
          {!q.isPending && data.length === 0 && <BarisKosong kolom={5} judul="Tidak ada dokumen yang siap dibuatkan BKK" />}
          {data.map((d) => (
            <tr key={d.id} className={`klik ${String(value) === String(d.id) ? 'dipilih' : ''}`} onClick={() => onChange(d)}>
              <td>
                <input type="radio" name="sumber" checked={String(value) === String(d.id)} onChange={() => onChange(d)} aria-label={`Pilih ${d.nomor}`} />
              </td>
              <td>
                <div className="nomor">{d.nomor}</div>
                <div className="kecil sangat-lemah">
                  {d.tanggal ? tanggal(d.tanggal) : ''}
                  {d.departemen_nama ? ` · ${d.departemen_nama}` : ''}
                </div>
              </td>
              <td>{d.penerima}</td>
              <td>{d.keterangan}</td>
              <td className="angka">{rupiah(d.jumlah)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {galat && <div className="kecil teks-bahaya" style={{ padding: '4px 0' }}>{galat}</div>}
    </div>
  );
}

function FormBKK({ bkk, awal }) {
  const navigate = useNavigate();
  const ubahMode = !!bkk;
  const { jalankan, sibuk } = useAksi();
  const rekening = useRekening();
  const pajak = usePajak();
  const dept = useDepartemen();
  const akunBeban = usePilihanAkun({ pembebanan: true, kategori: ['BEBAN', 'ASET', 'LIABILITAS'] });
  const pemasokSemua = usePilihanPemasok({ aktif: false });

  const f = useFormulir(
    bkk
      ? {
          jenis: bkk.jenis,
          sumber_id: bkk.sumber_id || '',
          pemasok_id: bkk.pemasok_id || '',
          tanggal: bkk.tanggal,
          rekening_kas_id: bkk.rekening_kas_id,
          metode_bayar: bkk.metode_bayar,
          tanggal_rencana_bayar: bkk.tanggal_rencana_bayar,
          keterangan: bkk.keterangan || '',
          penerima_bank_nama: bkk.penerima_bank_nama || '',
          penerima_bank_rekening: bkk.penerima_bank_rekening || '',
          penerima_bank_atas_nama: bkk.penerima_bank_atas_nama || '',
          penerima_tanpa_npwp: bkk.potongan.some((p) => (p.uraian || '').includes('tanpa NPWP')),
          jumlah: bkk.jenis === 'PEMBENTUKAN_KAS_KECIL' ? Number(bkk.jumlah_bruto) : '',
        }
      : {
          jenis: awal.jenis,
          sumber_id: awal.sumber_id,
          pemasok_id: awal.pemasok_id,
          tanggal: hariIni(),
          rekening_kas_id: '',
          metode_bayar: 'TRANSFER',
          tanggal_rencana_bayar: hariIni(),
          keterangan: '',
          penerima_bank_nama: '',
          penerima_bank_rekening: '',
          penerima_bank_atas_nama: '',
          penerima_tanpa_npwp: false,
          jumlah: '',
        },
  );
  const v = f.nilai;
  const [sumberDipilih, setSumberDipilih] = useState(null);
  const [faktur, setFaktur] = useState(() => (bkk ? Object.fromEntries(bkk.baris.filter((b) => b.faktur_id).map((b) => [b.faktur_id, { pilih: true, jumlah: Number(b.jumlah) }])) : {}));
  const [ubahBaris, setUbahBaris] = useState(() => (bkk && bkk.jenis === 'PERMINTAAN_PEMBAYARAN' ? Object.fromEntries(bkk.baris.map((b) => [b.baris, { akun_id: b.akun_id, departemen_id: b.departemen_id || '' }])) : {}));
  const [potongan, setPotongan] = useState(() => (bkk ? bkk.potongan.map((p) => ({ pajak_id: p.pajak_id, dasar: Number(p.dasar) })) : []));

  // Dokumen sumber rinci
  const daftarPemasok = useApi(v.jenis === 'PEMBAYARAN_FAKTUR' && !ubahMode ? '/bkk/sumber?jenis=PEMBAYARAN_FAKTUR' : null);
  const daftarFaktur = useApi(v.jenis === 'PEMBAYARAN_FAKTUR' && v.pemasok_id ? `/bkk/sumber?jenis=PEMBAYARAN_FAKTUR&pemasok_id=${v.pemasok_id}` : null);
  const pp = useApi(v.jenis === 'PERMINTAAN_PEMBAYARAN' && v.sumber_id ? `/pp/${v.sumber_id}` : null);
  const sumberList = useApi(v.jenis && v.jenis !== 'PEMBAYARAN_FAKTUR' && !ubahMode ? `/bkk/sumber?jenis=${v.jenis}` : null);
  const sumber = sumberDipilih || (sumberList.data || []).find((d) => String(d.id) === String(v.sumber_id));
  const pemasok = pemasokSemua.find((p) => String(p.nilai) === String(v.pemasok_id || pp.data?.pemasok_id))?.data;

  // Faktur yang bisa dipilih: sisa tersedia + jumlah yang sudah dialokasikan BKK ini (saat ubah).
  const fakturBaris = useMemo(() => {
    const dariBkk = new Map((bkk?.baris || []).filter((b) => b.faktur_id).map((b) => [b.faktur_id, b]));
    const peta = new Map();
    for (const x of daftarFaktur.data || []) peta.set(x.id, { ...x, maks: Number(x.sisa_tersedia) + Number(dariBkk.get(x.id)?.jumlah || 0) });
    for (const [idF, b] of dariBkk) {
      if (!peta.has(idF)) peta.set(idF, { id: idF, nomor: b.ref_nomor, nomor_faktur: b.nomor_faktur, tanggal_jatuh_tempo: b.tanggal_jatuh_tempo, maks: Number(b.jumlah) });
    }
    return [...peta.values()].sort((a, b) => (a.tanggal_jatuh_tempo < b.tanggal_jatuh_tempo ? -1 : 1));
  }, [daftarFaktur.data, bkk]);
  const fakturTerpilih = fakturBaris.filter((x) => faktur[x.id]?.pilih);

  // Perhitungan ringkas (server tetap menjadi penentu)
  let bruto = 0;
  if (v.jenis === 'PEMBAYARAN_FAKTUR') bruto = jumlahkan(fakturTerpilih, (x) => faktur[x.id].jumlah);
  else if (v.jenis === 'PERMINTAAN_PEMBAYARAN') bruto = Number(pp.data?.total || 0);
  else if (v.jenis === 'PEMBENTUKAN_KAS_KECIL') bruto = Number(v.jumlah || sumber?.jumlah || 0);
  else bruto = ubahMode ? Number(bkk.jumlah_bruto) : Number(sumber?.jumlah || 0);
  const tanpaNpwp = v.jenis === 'PERMINTAAN_PEMBAYARAN' ? (pp.data?.pemasok_id ? !pemasok?.npwp : !!v.penerima_tanpa_npwp) : false;
  const nilaiPotongan = potongan.map((p) => {
    const kode = (pajak.data || []).find((x) => String(x.id) === String(p.pajak_id));
    const tarif = kode ? Number(kode.tarif) * (kode.naik_tanpa_npwp && tanpaNpwp ? 2 : 1) : 0;
    return { ...p, kode, tarif, jumlah: kode ? hitungPajak(p.dasar, tarif) : 0 };
  });
  const totalPotongan = jumlahkan(nilaiPotongan, (p) => p.jumlah);
  const dibayar = Math.round((bruto - totalPotongan) * 100) / 100;

  const gantiJenis = (j) => {
    f.setNilai((n) => ({ ...n, jenis: j, sumber_id: '', pemasok_id: '', jumlah: '' }));
    setSumberDipilih(null);
    setFaktur({});
    setPotongan([]);
    setUbahBaris({});
  };

  const kirim = async (e) => {
    e.preventDefault();
    const data = {
      jenis: v.jenis,
      sumber_id: v.jenis === 'PEMBAYARAN_FAKTUR' ? null : v.sumber_id,
      pemasok_id: v.jenis === 'PEMBAYARAN_FAKTUR' ? v.pemasok_id : null,
      tanggal: v.tanggal,
      rekening_kas_id: v.rekening_kas_id,
      metode_bayar: v.metode_bayar,
      tanggal_rencana_bayar: v.tanggal_rencana_bayar,
      keterangan: v.keterangan,
      penerima_bank_nama: v.penerima_bank_nama,
      penerima_bank_rekening: v.penerima_bank_rekening,
      penerima_bank_atas_nama: v.penerima_bank_atas_nama,
      penerima_tanpa_npwp: v.penerima_tanpa_npwp,
    };
    if (v.jenis === 'PEMBAYARAN_FAKTUR') data.faktur = fakturTerpilih.map((x) => ({ faktur_id: x.id, jumlah: faktur[x.id].jumlah }));
    if (v.jenis === 'PERMINTAAN_PEMBAYARAN') {
      data.baris = Object.entries(ubahBaris).map(([baris, u]) => ({ baris: Number(baris), akun_id: u.akun_id, departemen_id: u.departemen_id || null }));
      data.potongan = potongan.filter((p) => p.pajak_id && p.dasar).map((p) => ({ pajak_id: p.pajak_id, dasar: p.dasar }));
    }
    if (v.jenis === 'PEMBENTUKAN_KAS_KECIL' && v.jumlah) data.jumlah = v.jumlah;
    const r = await jalankan(() => (ubahMode ? api.put(`/bkk/${bkk.id}`, data) : api.post('/bkk', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (ubahMode ? 'Perubahan BKK tersimpan.' : `BKK ${h.nomor} tersimpan sebagai draf dengan jumlah dibayar ${rupiah(h.jumlah_bayar)}.`),
    });
    if (r.ok) navigate(`/bkk/${ubahMode ? bkk.id : r.hasil.id}`);
  };

  const g = f.galat;
  const galatFaktur = (idF, k) => {
    const i = fakturTerpilih.findIndex((x) => x.id === idF);
    return i >= 0 ? g[`faktur.${i}.${k}`] : undefined;
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul="Jenis dan dokumen sumber">
        <div className="formulir">
          <Kolom label="Jenis BKK" galat={g.jenis} lebar={6}>
            <Pilihan pilihan={Object.entries(JENIS_BKK)} kosong="Pilih jenis pembayaran" value={v.jenis} onChange={(e) => gantiJenis(e.target.value)} disabled={ubahMode} />
          </Kolom>
          {v.jenis === 'PEMBAYARAN_FAKTUR' && (
            <Kolom label="Pemasok" galat={g.pemasok_id} lebar={6}>
              {ubahMode ? (
                <Masukan readOnly value={bkk.penerima_nama} />
              ) : (
                <Pilihan
                  pilihan={(daftarPemasok.data || []).map((p) => [p.id, `${p.nama}: ${p.jumlah_faktur} faktur, sisa ${rupiah(p.sisa)}`])}
                  kosong={daftarPemasok.isPending ? 'Memuat...' : 'Pilih pemasok yang memiliki faktur terbuka'}
                  value={v.pemasok_id}
                  onChange={(e) => {
                    f.atur('pemasok_id', e.target.value);
                    setFaktur({});
                  }}
                  salah={!!g.pemasok_id}
                />
              )}
            </Kolom>
          )}
          {ubahMode && v.jenis !== 'PEMBAYARAN_FAKTUR' && (
            <Kolom label="Dokumen sumber" lebar={6}>
              <Masukan readOnly value={`${bkk.sumber_nomor} (${bkk.penerima_nama})`} />
            </Kolom>
          )}
        </div>
        {!ubahMode && v.jenis && v.jenis !== 'PEMBAYARAN_FAKTUR' && (
          <div style={{ marginTop: 12 }}>
            <PilihSumber
              jenis={v.jenis}
              value={v.sumber_id}
              galat={g.sumber_id}
              onChange={(d) => {
                f.atur('sumber_id', d.id);
                setSumberDipilih(d);
                setUbahBaris({});
                setPotongan([]);
              }}
            />
          </div>
        )}
      </Kartu>

      {v.jenis === 'PEMBAYARAN_FAKTUR' && v.pemasok_id && (
        <Kartu judul="Faktur yang dibayar" rapat>
          {g.faktur && (
            <div style={{ padding: '12px 16px 0' }}>
              <Pesan jenis="galat">{g.faktur}</Pesan>
            </div>
          )}
          {pemasok && v.metode_bayar === 'TRANSFER' && !pemasok.rekening_terverifikasi && (
            <div style={{ padding: '12px 16px 0' }}>
              <Pesan jenis="peringatan">Rekening bank {pemasok.nama} belum diverifikasi Kepala Bagian Akuntansi. BKK dapat disimpan, tetapi baru dapat diajukan setelah rekening diverifikasi.</Pesan>
            </div>
          )}
          <div className="tabel-bungkus">
            <table className="tabel">
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>Faktur</th>
                  <th>Jatuh tempo</th>
                  <th className="angka">Sisa yang dapat dibayar</th>
                  <th className="angka" style={{ width: 170 }}>
                    Dibayar sekarang
                  </th>
                </tr>
              </thead>
              <tbody>
                {daftarFaktur.isPending && (
                  <tr>
                    <td colSpan={5} className="memuat">
                      Memuat faktur...
                    </td>
                  </tr>
                )}
                {!daftarFaktur.isPending && fakturBaris.length === 0 && <BarisKosong kolom={5} judul="Tidak ada faktur terbuka yang belum diproses" />}
                {fakturBaris.map((x) => {
                  const isi = faktur[x.id] || { pilih: false, jumlah: x.maks };
                  const lewat = x.tanggal_jatuh_tempo < hariIni();
                  return (
                    <tr key={x.id} className={isi.pilih ? 'dipilih' : ''}>
                      <td>
                        <input type="checkbox" checked={!!isi.pilih} onChange={(e) => setFaktur({ ...faktur, [x.id]: { ...isi, pilih: e.target.checked } })} aria-label={`Bayar faktur ${x.nomor_faktur}`} />
                      </td>
                      <td>
                        <div className="tebal">{x.nomor_faktur}</div>
                        <div className="kecil sangat-lemah">{x.nomor}</div>
                        {galatFaktur(x.id, 'faktur_id') && <div className="kecil teks-bahaya">{galatFaktur(x.id, 'faktur_id')}</div>}
                      </td>
                      <td className={`nowrap ${lewat ? 'teks-bahaya' : ''}`}>{tanggal(x.tanggal_jatuh_tempo)}</td>
                      <td className="angka">{rupiah(x.maks)}</td>
                      <td>
                        <InputUang
                          value={isi.jumlah}
                          disabled={!isi.pilih}
                          salah={!!galatFaktur(x.id, 'jumlah')}
                          onChange={(n) => setFaktur({ ...faktur, [x.id]: { ...isi, jumlah: n } })}
                          aria-label={`Jumlah dibayar ${x.nomor_faktur}`}
                        />
                        {galatFaktur(x.id, 'jumlah') && <div className="kecil teks-bahaya">{galatFaktur(x.id, 'jumlah')}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Kartu>
      )}

      {v.jenis === 'PERMINTAAN_PEMBAYARAN' && v.sumber_id && (
        <Muat kueri={pp}>
          {(d) => (
            <Kartu judul={`Rincian ${d.nomor}: ${d.keterangan}`} rapat>
              <div className="tabel-bungkus">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Uraian</th>
                      <th style={{ width: '32%' }}>Akun pembebanan</th>
                      <th style={{ width: 180 }}>Departemen</th>
                      <th className="angka">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.baris.map((b, i) => {
                      const u = ubahBaris[b.baris] || { akun_id: b.akun_id, departemen_id: d.departemen_id };
                      const atur = (k, x) => setUbahBaris({ ...ubahBaris, [b.baris]: { ...u, [k]: x } });
                      return (
                        <tr key={b.id}>
                          <td>{b.baris}</td>
                          <td>{b.uraian}</td>
                          <td>
                            <Kombo pilihan={akunBeban} value={u.akun_id} onChange={(x) => atur('akun_id', x)} salah={!!g[`baris.${i}.akun_id`]} />
                            {g[`baris.${i}.akun_id`] && <div className="kecil teks-bahaya">{g[`baris.${i}.akun_id`]}</div>}
                          </td>
                          <td>
                            <Pilihan pilihan={(dept.data || []).map((x) => [x.id, x.nama])} value={u.departemen_id || ''} onChange={(e) => atur('departemen_id', e.target.value)} aria-label="Departemen" />
                          </td>
                          <td className="angka">{rupiah(b.jumlah)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <p className="kecil lemah" style={{ marginTop: 0 }}>
                  Akuntansi boleh mengoreksi akun dan departemen dari usulan pemohon. Jumlah tidak dapat diubah di sini.
                </p>
                <div className="bagian-judul" style={{ marginBottom: 8 }}>
                  Potongan pajak (PPh)
                </div>
                {potongan.map((p, i) => (
                  <div key={i} className="formulir" style={{ marginBottom: 8, alignItems: 'end' }}>
                    <Kolom label="Kode pajak" lebar={5}>
                      <Pilihan
                        pilihan={(pajak.data || []).filter((x) => x.jenis === 'PPH' && x.aktif).map((x) => [x.id, x.nama])}
                        kosong="Pilih PPh"
                        value={p.pajak_id}
                        onChange={(e) => setPotongan(potongan.map((y, j) => (j === i ? { ...y, pajak_id: e.target.value } : y)))}
                      />
                    </Kolom>
                    <Kolom label="Dasar pemotongan (Rp)" galat={g[`potongan.${i}.dasar`]} lebar={4}>
                      <InputUang value={p.dasar} onChange={(x) => setPotongan(potongan.map((y, j) => (j === i ? { ...y, dasar: x } : y)))} salah={!!g[`potongan.${i}.dasar`]} />
                    </Kolom>
                    <Kolom label="PPh" lebar={2}>
                      <Masukan readOnly className="angka" value={rupiah(nilaiPotongan[i]?.jumlah || 0)} />
                    </Kolom>
                    <div className="kolom l1" style={{ gridColumn: 'span 1' }}>
                      <button type="button" className="tombol-ikon" aria-label="Hapus potongan" onClick={() => setPotongan(potongan.filter((_, j) => j !== i))} style={{ height: 34 }}>
                        <Ikon nama="silang" width={16} height={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Tombol kecil ikon="tambah" onClick={() => setPotongan([...potongan, { pajak_id: '', dasar: Number(d.total) }])}>
                    Tambah potongan PPh
                  </Tombol>
                  {!d.pemasok_id && (
                    <Centang label="Penerima tidak memiliki NPWP (tarif PPh 23 dua kali lipat)" checked={v.penerima_tanpa_npwp} onChange={(x) => f.atur('penerima_tanpa_npwp', x)} />
                  )}
                  {d.pemasok_id && pemasok && !pemasok.npwp && <span className="kecil teks-peringatan">Pemasok tanpa NPWP: tarif PPh 23 dikenakan dua kali lipat.</span>}
                </div>
              </div>
            </Kartu>
          )}
        </Muat>
      )}

      {v.jenis === 'PEMBENTUKAN_KAS_KECIL' && (v.sumber_id || ubahMode) && (
        <Kartu judul="Jumlah pembentukan atau penambahan dana">
          <div className="formulir">
            <Kolom label="Jumlah (Rp)" galat={g.jumlah} bantuan={sumber ? `Usulan: selisih dana tetap ${rupiah(sumber.dana_diusulkan)} dengan dana terbentuk ${rupiah(sumber.jumlah_dana)}.` : undefined} lebar={4}>
              <InputUang value={v.jumlah} placeholder={sumber ? rupiah(sumber.jumlah) : ''} onChange={(x) => f.atur('jumlah', x)} salah={!!g.jumlah} />
            </Kolom>
          </div>
        </Kartu>
      )}

      {v.jenis && (
        <Kartu judul="Rencana pembayaran">
          <div className="formulir">
            <Kolom label="Tanggal BKK" galat={g.tanggal} lebar={3}>
              <Masukan type="date" {...f.ikat('tanggal')} salah={!!g.tanggal} />
            </Kolom>
            <Kolom label="Rekening sumber" galat={g.rekening_kas_id} lebar={3}>
              <Pilihan pilihan={(rekening.data || []).filter((r) => r.aktif).map((r) => [r.id, `${r.nama}`])} kosong="Pilih rekening" {...f.ikat('rekening_kas_id')} salah={!!g.rekening_kas_id} />
            </Kolom>
            <Kolom label="Metode bayar" galat={g.metode_bayar} lebar={3}>
              <Pilihan pilihan={Object.entries(METODE)} {...f.ikat('metode_bayar')} />
            </Kolom>
            <Kolom label="Rencana tanggal bayar" galat={g.tanggal_rencana_bayar} lebar={3}>
              <Masukan type="date" {...f.ikat('tanggal_rencana_bayar')} salah={!!g.tanggal_rencana_bayar} />
            </Kolom>
            {JENIS_KARYAWAN.includes(v.jenis) && (
              <>
                <Kolom label="Bank penerima" opsional={v.metode_bayar !== 'TRANSFER'} lebar={4}>
                  <Masukan {...f.ikat('penerima_bank_nama')} maxLength={60} />
                </Kolom>
                <Kolom label="Nomor rekening penerima" opsional={v.metode_bayar !== 'TRANSFER'} galat={g.penerima_bank_rekening} lebar={4}>
                  <Masukan {...f.ikat('penerima_bank_rekening')} salah={!!g.penerima_bank_rekening} inputMode="numeric" maxLength={40} />
                </Kolom>
                <Kolom label="Atas nama" opsional={v.metode_bayar !== 'TRANSFER'} lebar={4}>
                  <Masukan {...f.ikat('penerima_bank_atas_nama')} maxLength={150} />
                </Kolom>
              </>
            )}
            {!JENIS_KARYAWAN.includes(v.jenis) && g.penerima_bank_rekening && (
              <div className="kolom l12">
                <Pesan jenis="galat">{g.penerima_bank_rekening}</Pesan>
              </div>
            )}
            <Kolom label="Keterangan" opsional bantuan="Kosongkan untuk memakai keterangan dokumen sumber." lebar={12}>
              <AreaTeks {...f.ikat('keterangan')} rows={2} maxLength={500} />
            </Kolom>
          </div>
        </Kartu>
      )}

      {v.jenis && (
        <Kartu rapat>
          <TotalRingkas baris={[['Jumlah bruto', bruto], totalPotongan > 0 && ['Potongan PPh', -totalPotongan], ['Jumlah dibayar', dibayar, true]]} nilaiTerbilang={dibayar > 0 ? dibayar : undefined} />
        </Kartu>
      )}
      <div className="baris-aksi">
        <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
        <Tombol type="submit" varian="utama" sibuk={sibuk} disabled={!v.jenis}>
          {ubahMode ? 'Simpan perubahan' : 'Simpan sebagai draf'}
        </Tombol>
      </div>
    </form>
  );
}

export function HalamanFormBKK() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const q = useApi(id ? `/bkk/${id}` : null);
  return (
    <>
      <Kepala
        judul={id ? 'Ubah bukti kas keluar' : 'Bukti kas keluar baru'}
        remah={[{ label: 'Bukti kas keluar', ke: '/bkk' }]}
        sub="BKK hanya dapat dibuat dari dokumen sumber yang sudah disetujui atau faktur yang sudah terverifikasi."
      />
      {id ? (
        <Muat kueri={q}>{(bkk) => <FormBKK bkk={bkk} />}</Muat>
      ) : (
        <FormBKK awal={{ jenis: params.get('jenis') || '', sumber_id: params.get('sumber_id') || '', pemasok_id: params.get('pemasok_id') || '' }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- detail BKK

export function DetailBKK() {
  const { id } = useParams();
  const q = useApi(`/bkk/${id}`);
  return <Muat kueri={q}>{(bkk) => <IsiDetailBKK bkk={bkk} />}</Muat>;
}

function LampiranDasar({ bkk }) {
  const daftar = [];
  if (SUMBER[bkk.jenis] && bkk.sumber_id) daftar.push({ jenis: SUMBER[bkk.jenis], id: bkk.sumber_id, judul: `Lampiran ${bkk.sumber_nomor}` });
  for (const b of bkk.baris) if (b.faktur_id) daftar.push({ jenis: 'FB', id: b.faktur_id, judul: `Lampiran faktur ${b.nomor_faktur}` });
  return daftar.map((d) => <PanelLampiran key={`${d.jenis}${d.id}`} jenis={d.jenis} id={d.id} judul={d.judul} />);
}

function IsiDetailBKK({ bkk }) {
  const { pengguna, punya } = useAuth();
  const aksi = useAksiDokumen('/bkk', bkk.id, 'BKK');
  const pembuat = bkk.dibuat_oleh === pengguna.id;
  const bisaUbah = pembuat && ['DRAFT', 'DITOLAK'].includes(bkk.status);
  const bisaBatal = (pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(bkk.status)) || (punya('MANAJER_KEUANGAN') && ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'].includes(bkk.status));
  const rekeningTujuan = bkk.penerima_bank_rekening ? `${bkk.penerima_bank_nama} ${bkk.penerima_bank_rekening} a.n. ${bkk.penerima_bank_atas_nama}` : 'Tidak ada (cek atau bilyet giro)';
  const bayarBerlaku = bkk.pembayaran.find((p) => p.status === 'DIBAYAR');
  return (
    <>
      <Kepala
        judul={bkk.nomor}
        status={<Status kode={bkk.status} />}
        remah={[{ label: 'Bukti kas keluar', ke: '/bkk' }]}
        sub={`${bkk.jenis_label} · ${bkk.penerima_nama}`}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/bkk/${bkk.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {bisaBatal && (
              <Tombol varian="bahaya" onClick={() => aksi.batal({ pesan: 'Dokumen sumber kembali ke status siap diproses dan dapat dibuatkan BKK baru.' })} disabled={aksi.sibuk}>
                Batalkan
              </Tombol>
            )}
            <TombolCetak jenis="BKK" id={bkk.id} />
            {punya('KASIR') && bkk.status === 'DISETUJUI' && (
              <TautanTombol ke={`/pembayaran/baru?bkk_id=${bkk.id}`} varian="sukses" ikon="bayar">Bayar BKK</TautanTombol>
            )}
            {bisaUbah && (
              <Tombol varian="utama" ikon="kirim" onClick={aksi.ajukan} sibuk={aksi.sibuk}>
                Ajukan BKK
              </Tombol>
            )}
          </>
        }
      />
      <PesanDokumen doc={bkk} labelDok="BKK" perluLampiran={false} />
      {bkk.metode_bayar === 'TRANSFER' && bkk.pemasok_id && !bkk.rekening_terverifikasi && ['DRAFT', 'DITOLAK', 'DIAJUKAN', 'DISETUJUI'].includes(bkk.status) && (
        <Pesan jenis="peringatan" judul="Rekening pemasok belum terverifikasi">
          Transfer tidak dapat diajukan atau dibayar sebelum Kepala Bagian Akuntansi memverifikasi rekening pemasok.
        </Pesan>
      )}
      <div className="grid-2-1">
        <div>
          <Kartu judul="Perintah bayar">
            <Info
              butir={[
                ['Tanggal BKK', tanggal(bkk.tanggal, true)],
                ['Jenis', bkk.jenis_label],
                ['Dokumen sumber', SUMBER[bkk.jenis] ? <TautanDok jenis={SUMBER[bkk.jenis]} id={bkk.sumber_id}>{bkk.sumber_nomor}</TautanDok> : bkk.sumber_nomor || 'Faktur pemasok (lihat rincian)'],
                ['Penerima', bkk.penerima_nama],
                ['Rekening tujuan', rekeningTujuan],
                ['Rekening sumber', `${bkk.rekening_nama} (${bkk.rekening_nomor})`],
                ['Metode bayar', METODE[bkk.metode_bayar]],
                ['Rencana tanggal bayar', tanggal(bkk.tanggal_rencana_bayar, true)],
                ['Dibuat oleh', bkk.dibuat_nama],
                bayarBerlaku && ['Dibayar', <Link to={`/pembayaran/${bayarBerlaku.id}`}>{`${bayarBerlaku.nomor}, ${tanggal(bayarBerlaku.tanggal, true)} (${bayarBerlaku.nomor_warkat || bayarBerlaku.nomor_referensi})`}</Link>],
                ['Keterangan', bkk.keterangan],
              ]}
            />
          </Kartu>
          <Kartu judul="Rincian dan distribusi akun" rapat>
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Uraian</th>
                    <th>Akun</th>
                    <th>Departemen</th>
                    <th className="angka">Debit</th>
                    <th className="angka">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {bkk.baris.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {b.faktur_id ? <TautanDok jenis="FB" id={b.faktur_id}>{b.uraian}</TautanDok> : b.uraian}
                        {b.tanggal_jatuh_tempo && <div className="kecil sangat-lemah">Jatuh tempo {tanggal(b.tanggal_jatuh_tempo)}</div>}
                      </td>
                      <td>
                        {b.akun_kode} {b.akun_nama}
                      </td>
                      <td>{b.departemen_nama || '-'}</td>
                      <td className="angka">{rupiah(b.jumlah)}</td>
                      <td />
                    </tr>
                  ))}
                  {bkk.potongan.map((p) => (
                    <tr key={`p${p.id}`}>
                      <td>
                        {p.uraian}
                        <div className="kecil sangat-lemah">
                          {Number(p.tarif).toLocaleString('id-ID')}% x {rupiah(p.dasar)}
                        </div>
                      </td>
                      <td>
                        {p.akun_kode} {p.akun_nama}
                      </td>
                      <td />
                      <td />
                      <td className="angka">{rupiah(p.jumlah)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Pembayaran dari {bkk.rekening_nama}</td>
                    <td>
                      {bkk.rekening_akun?.kode} {bkk.rekening_akun?.nama}
                    </td>
                    <td />
                    <td />
                    <td className="angka">{rupiah(bkk.jumlah_bayar)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Jumlah</td>
                    <td className="angka">{rupiah(bkk.jumlah_bruto)}</td>
                    <td className="angka">{rupiah(Number(bkk.jumlah_potongan) + Number(bkk.jumlah_bayar))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <TotalRingkas baris={[['Jumlah bruto', bkk.jumlah_bruto], Number(bkk.jumlah_potongan) > 0 && ['Potongan pajak', -bkk.jumlah_potongan], ['Jumlah dibayar', bkk.jumlah_bayar, true]]} nilaiTerbilang={bkk.jumlah_bayar} />
          </Kartu>
          {bkk.pembayaran.length > 0 && (
            <Kartu judul="Riwayat pembayaran" rapat>
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Tanggal</th>
                    <th>Metode</th>
                    <th>Cek, BG, atau referensi</th>
                    <th>Dibayar oleh</th>
                    <th className="angka">Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bkk.pembayaran.map((p) => (
                    <tr key={p.id} className={p.status === 'BATAL' ? 'redup' : ''}>
                      <td>
                        <Link to={`/pembayaran/${p.id}`}>{p.nomor}</Link>
                      </td>
                      <td>{tanggal(p.tanggal)}</td>
                      <td>{METODE[p.metode]}</td>
                      <td>
                        {p.nomor_warkat || p.nomor_referensi}
                        {p.alasan_batal && <div className="kecil teks-bahaya">Batal: {p.alasan_batal}</div>}
                      </td>
                      <td>{p.dibayar_nama}</td>
                      <td className="angka">{rupiah(p.jumlah)}</td>
                      <td>
                        <Status kode={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Kartu>
          )}
        </div>
        <div>
          <PanelPersetujuan jenis="BKK" id={bkk.id} riwayat={bkk.persetujuan} boleh={bkk.boleh_memutuskan} />
          <PanelLampiran jenis="BKK" id={bkk.id} bolehUnggah={bkk.status !== 'BATAL' && punya('AKUNTANSI', 'SPV_AKUNTANSI', 'KASIR')} bolehHapus={bisaUbah} judul="Lampiran BKK" />
          <LampiranDasar bkk={bkk} />
        </div>
      </div>
    </>
  );
}
