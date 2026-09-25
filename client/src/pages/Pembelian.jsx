// Pesanan pembelian (PO) dan penerimaan barang atau jasa (LPB/BAST).
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { angka, hariIni, hitungPajak, jumlahkan, kali, rupiah, tanggal } from '../format.js';
import { useAksi, useApi, useDepartemen, usePajak, usePilihanAkun, usePilihanPemasok } from '../components/data.js';
import { EditorBaris, SaringDaftar, TombolCetak, useAksiDokumen, useSaring } from '../components/Dokumen.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import { PanelPersetujuan } from '../components/Persetujuan.jsx';
import {
  AreaTeks, BarisKosong, Centang, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Muat, Pesan, Pilihan, Status, TautanDok, TautanTombol, Tombol,
  TotalRingkas, useFormulir,
} from '../components/ui.jsx';
import { PesanDokumen } from './Permintaan.jsx';

const STATUS_PO = [
  ['DRAFT', 'Draf'], ['DIAJUKAN', 'Diajukan'], ['DISETUJUI', 'Disetujui'], ['DITOLAK', 'Ditolak'], ['DITERIMA_SEBAGIAN', 'Diterima sebagian'],
  ['DITERIMA_PENUH', 'Diterima penuh'], ['DITUTUP', 'Ditutup'], ['BATAL', 'Batal'],
];

function useTarifPpn() {
  const pajak = usePajak();
  const atur = useApi('/pengaturan', { staleTime: 300_000 });
  const kode = atur.data?.find((p) => p.kunci === 'pajak_ppn_bawaan')?.nilai;
  return Number(pajak.data?.find((p) => p.kode === kode)?.tarif ?? 11);
}

// ---------------------------------------------------------------- PO

export function DaftarPO() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring();
  const q = useApi(`/po${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Pesanan pembelian"
        sub="PO menjadi dasar penerimaan barang dan pencocokan faktur pemasok."
        aksi={punya('PEMBELIAN') && <TautanTombol ke="/po/baru" varian="utama" ikon="tambah">Buat PO</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={STATUS_PO} placeholder="Nomor PO, pemasok, atau keterangan" />
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Tanggal</th>
                    <th>Pemasok</th>
                    <th>Unit kerja</th>
                    <th>Keterangan</th>
                    <th className="angka">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={7} judul="Tidak ada PO yang cocok dengan penyaring" />}
                  {data.map((d) => (
                    <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/po/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td className="nowrap">{tanggal(d.tanggal)}</td>
                      <td>{d.pemasok_nama}</td>
                      <td>{d.departemen_nama}</td>
                      <td>{d.keterangan}</td>
                      <td className="angka">{rupiah(d.total)}</td>
                      <td>
                        <Status kode={d.status} />
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

function FormPO({ awal, id }) {
  const navigate = useNavigate();
  const f = useFormulir(awal);
  const [baris, setBaris] = useState(awal.baris);
  const { jalankan, sibuk } = useAksi();
  const pemasok = usePilihanPemasok();
  const dept = useDepartemen();
  const akun = usePilihanAkun({ kategori: ['ASET', 'BEBAN'] });
  const tarifPpn = useTarifPpn();
  const v = f.nilai;
  const p = pemasok.find((x) => String(x.nilai) === String(v.pemasok_id))?.data;
  const subtotal = jumlahkan(baris, (b) => kali(b.qty, b.harga));
  const ppn = v.ppn && p?.pkp ? hitungPajak(subtotal, tarifPpn) : 0;

  const pilihPemasok = (x) => {
    f.atur('pemasok_id', x);
    const baru = pemasok.find((y) => String(y.nilai) === String(x))?.data;
    if (baru) {
      f.atur('termin_hari', baru.termin_hari);
      f.atur('ppn', !!baru.pkp);
    }
  };

  const kirim = async (e) => {
    e.preventDefault();
    const data = {
      tanggal: v.tanggal,
      pemasok_id: v.pemasok_id,
      departemen_id: v.departemen_id,
      tanggal_kirim: v.tanggal_kirim,
      termin_hari: v.termin_hari === '' ? undefined : v.termin_hari,
      ppn: !!v.ppn,
      keterangan: v.keterangan,
      baris: baris.map(({ uraian, jenis, qty, satuan, harga, akun_id }) => ({ uraian, jenis, qty, satuan, harga, akun_id })),
    };
    const r = await jalankan(() => (id ? api.put(`/po/${id}`, data) : api.post('/po', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (id ? 'Perubahan PO tersimpan.' : `PO ${h.nomor} tersimpan sebagai draf.`),
    });
    if (r.ok) navigate(`/po/${id || r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul="Data pesanan">
        <div className="formulir">
          <Kolom label="Tanggal PO" galat={f.galat.tanggal} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
          </Kolom>
          <Kolom label="Pemasok" galat={f.galat.pemasok_id} lebar={5}>
            <Kombo pilihan={pemasok} value={v.pemasok_id} onChange={pilihPemasok} salah={!!f.galat.pemasok_id} placeholder="Ketik nama pemasok" />
          </Kolom>
          <Kolom label="Unit peminta" galat={f.galat.departemen_id} lebar={4}>
            <Pilihan pilihan={(dept.data || []).filter((d) => d.aktif).map((d) => [d.id, d.nama])} kosong="Pilih unit kerja" {...f.ikat('departemen_id')} salah={!!f.galat.departemen_id} />
          </Kolom>
          <Kolom label="Tanggal kirim" opsional galat={f.galat.tanggal_kirim} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal_kirim')} salah={!!f.galat.tanggal_kirim} />
          </Kolom>
          <Kolom label="Termin pembayaran (hari)" galat={f.galat.termin_hari} lebar={3}>
            <Masukan type="number" min="0" max="365" {...f.ikat('termin_hari')} salah={!!f.galat.termin_hari} />
          </Kolom>
          <Kolom label="PPN" galat={f.galat.ppn} bantuan={p && !p.pkp ? 'Pemasok bukan PKP sehingga tidak memungut PPN.' : `PPN ${angka(tarifPpn)}% dari subtotal.`} lebar={6}>
            <Centang label="Pemasok memungut PPN" checked={v.ppn} onChange={(x) => f.atur('ppn', x)} disabled={!p?.pkp} />
          </Kolom>
          <Kolom label="Keterangan" opsional lebar={12}>
            <AreaTeks {...f.ikat('keterangan')} rows={2} maxLength={500} />
          </Kolom>
        </div>
        {p && (
          <p className="kecil lemah" style={{ marginTop: 10 }}>
            {p.nama}: {p.pkp ? 'PKP' : 'bukan PKP'}, {p.npwp ? `NPWP ${p.npwp}` : 'tanpa NPWP (tarif PPh jasa dua kali lipat)'}, termin bawaan {p.termin_hari} hari.
          </p>
        )}
      </Kartu>
      <Kartu judul="Barang dan jasa yang dipesan">
        <EditorBaris
          baris={baris}
          setBaris={setBaris}
          galat={f.galat}
          barisBaru={() => ({ uraian: '', jenis: 'BARANG', qty: '', satuan: '', harga: '', akun_id: '' })}
          kolom={[
            { kunci: 'uraian', label: 'Uraian', isi: (b, ubah, g) => <Masukan value={b.uraian} onChange={(e) => ubah('uraian', e.target.value)} salah={!!g} maxLength={255} aria-label="Uraian" /> },
            {
              kunci: 'jenis',
              label: 'Jenis',
              lebar: 100,
              isi: (b, ubah) => <Pilihan pilihan={[['BARANG', 'Barang'], ['JASA', 'Jasa']]} value={b.jenis} onChange={(e) => ubah('jenis', e.target.value)} aria-label="Jenis" />,
            },
            { kunci: 'qty', label: 'Kuantitas', angka: true, lebar: 90, isi: (b, ubah, g) => <InputUang value={b.qty} onChange={(x) => ubah('qty', x)} salah={!!g} aria-label="Kuantitas" /> },
            { kunci: 'satuan', label: 'Satuan', lebar: 80, isi: (b, ubah, g) => <Masukan value={b.satuan} onChange={(e) => ubah('satuan', e.target.value)} salah={!!g} maxLength={20} aria-label="Satuan" /> },
            { kunci: 'harga', label: 'Harga satuan', angka: true, lebar: 130, isi: (b, ubah, g) => <InputUang value={b.harga} onChange={(x) => ubah('harga', x)} salah={!!g} aria-label="Harga satuan" /> },
            { kunci: 'akun_id', label: 'Akun', lebar: '22%', isi: (b, ubah, g) => <Kombo pilihan={akun} value={b.akun_id} onChange={(x) => ubah('akun_id', x)} salah={!!g} placeholder="Persediaan atau beban" /> },
            { kunci: 'jumlah', label: 'Jumlah', angka: true, lebar: 120, isi: (b) => <div className="angka kanan" style={{ paddingTop: 6 }}>{rupiah(kali(b.qty, b.harga))}</div> },
          ]}
        />
        <TotalRingkas baris={[['Subtotal (DPP)', subtotal], v.ppn && p?.pkp && [`PPN ${angka(tarifPpn)}%`, ppn], ['Total PO', subtotal + ppn, true]]} />
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

export function HalamanFormPO() {
  const { id } = useParams();
  const { pengguna } = useAuth();
  const q = useApi(id ? `/po/${id}` : null);
  const barisBaru = { uraian: '', jenis: 'BARANG', qty: '', satuan: '', harga: '', akun_id: '' };
  return (
    <>
      <Kepala judul={id ? 'Ubah pesanan pembelian' : 'Pesanan pembelian baru'} remah={[{ label: 'Pesanan pembelian', ke: '/po' }]} />
      {id ? (
        <Muat kueri={q}>
          {(po) => (
            <FormPO
              id={id}
              awal={{
                tanggal: po.tanggal,
                pemasok_id: po.pemasok_id,
                departemen_id: po.departemen_id,
                tanggal_kirim: po.tanggal_kirim || '',
                termin_hari: po.termin_hari,
                ppn: !!po.pajak_ppn_id,
                keterangan: po.keterangan || '',
                baris: po.baris.map((b) => ({ uraian: b.uraian, jenis: b.jenis, qty: Number(b.qty), satuan: b.satuan, harga: Number(b.harga), akun_id: b.akun_id, _kunci: b.id })),
              }}
            />
          )}
        </Muat>
      ) : (
        <FormPO awal={{ tanggal: hariIni(), pemasok_id: '', departemen_id: pengguna.departemen_id, tanggal_kirim: '', termin_hari: '', ppn: false, keterangan: '', baris: [barisBaru] }} />
      )}
    </>
  );
}

export function DetailPO() {
  const { id } = useParams();
  const q = useApi(`/po/${id}`);
  return <Muat kueri={q}>{(po) => <IsiDetailPO po={po} />}</Muat>;
}

function IsiDetailPO({ po }) {
  const { pengguna, punya } = useAuth();
  const aksi = useAksiDokumen('/po', po.id, 'PO');
  const pembuat = po.dibuat_oleh === pengguna.id;
  const bisaUbah = pembuat && ['DRAFT', 'DITOLAK'].includes(po.status);
  const adaTerima = po.baris.some((b) => Number(b.qty_diterima) > 0);
  const bisaDitagih = ['DISETUJUI', 'DITERIMA_SEBAGIAN', 'DITERIMA_PENUH', 'DITUTUP'].includes(po.status) && po.baris.some((b) => Number(b.qty_diterima) > Number(b.qty_ditagih));
  const tutup = () =>
    aksi.batal({
      url: `/po/${po.id}/tutup`,
      judul: `Tutup ${po.nomor}`,
      pesan: 'Sisa pesanan yang belum diterima tidak akan dikirim lagi. Faktur atas barang yang sudah diterima tetap dapat dicatat.',
      labelTombol: 'Tutup PO',
      sukses: 'PO ditutup.',
    });
  return (
    <>
      <Kepala
        judul={po.nomor}
        status={<Status kode={po.status} />}
        remah={[{ label: 'Pesanan pembelian', ke: '/po' }]}
        sub={`${po.pemasok_nama} · ${po.departemen_nama}`}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/po/${po.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {((pembuat && ['DRAFT', 'DITOLAK', 'DIAJUKAN'].includes(po.status)) || (punya('PEMBELIAN') && po.status === 'DISETUJUI' && !adaTerima)) && (
              <Tombol varian="bahaya" onClick={() => aksi.batal()} disabled={aksi.sibuk}>
                Batalkan
              </Tombol>
            )}
            {punya('PEMBELIAN') && po.status === 'DITERIMA_SEBAGIAN' && (
              <Tombol varian="bahaya" onClick={tutup} disabled={aksi.sibuk}>
                Tutup PO
              </Tombol>
            )}
            <TautanTombol ke={`/cetak/PO/${po.id}?tanpa_harga=1`} ikon="cetak">Cetak tanpa harga</TautanTombol>
            <TombolCetak jenis="PO" id={po.id} />
            {punya('GUDANG') && ['DISETUJUI', 'DITERIMA_SEBAGIAN'].includes(po.status) && (
              <TautanTombol ke={`/penerimaan/baru?po_id=${po.id}`} varian="utama" ikon="kotak">Catat penerimaan</TautanTombol>
            )}
            {punya('STAF_KEUANGAN') && bisaDitagih && (
              <TautanTombol ke={`/faktur/baru?po_id=${po.id}`} varian="utama" ikon="faktur">Catat faktur</TautanTombol>
            )}
            {bisaUbah && (
              <Tombol varian="utama" ikon="kirim" onClick={aksi.ajukan} sibuk={aksi.sibuk}>
                Ajukan PO
              </Tombol>
            )}
          </>
        }
      />
      <PesanDokumen doc={po} labelDok="PO" perluLampiran={false} />
      <div className="grid-2-1">
        <div>
          <Kartu judul="Data pesanan">
            <Info
              butir={[
                ['Tanggal PO', tanggal(po.tanggal, true)],
                ['Pemasok', po.pemasok.nama],
                ['Alamat pemasok', [po.pemasok.alamat, po.pemasok.kota].filter(Boolean).join(', ')],
                ['NPWP', po.pemasok.npwp || 'Tidak ada'],
                ['Unit peminta', po.departemen_nama],
                ['Tanggal kirim', tanggal(po.tanggal_kirim, true)],
                ['Termin pembayaran', `${po.termin_hari} hari`],
                ['Dibuat oleh', po.dibuat_nama],
                po.keterangan && ['Keterangan', po.keterangan],
              ]}
            />
          </Kartu>
          <Kartu judul="Barang dan jasa" rapat>
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Uraian</th>
                    <th>Jenis</th>
                    <th className="angka">Dipesan</th>
                    <th className="angka">Diterima</th>
                    <th className="angka">Ditagih</th>
                    <th className="angka">Harga</th>
                    <th className="angka">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {po.baris.map((b) => (
                    <tr key={b.id}>
                      <td>{b.baris}</td>
                      <td>
                        {b.uraian}
                        <div className="kecil sangat-lemah">
                          {b.akun_kode} {b.akun_nama}
                        </div>
                      </td>
                      <td>{b.jenis === 'JASA' ? 'Jasa' : 'Barang'}</td>
                      <td className="angka">
                        {angka(b.qty)} {b.satuan}
                      </td>
                      <td className="angka">{angka(b.qty_diterima)}</td>
                      <td className="angka">{angka(b.qty_ditagih)}</td>
                      <td className="angka">{rupiah(b.harga)}</td>
                      <td className="angka">{rupiah(b.jumlah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TotalRingkas baris={[['Subtotal (DPP)', po.subtotal], Number(po.ppn) > 0 && ['PPN', po.ppn], ['Total PO', po.total, true]]} nilaiTerbilang={po.total} />
          </Kartu>
          {(po.penerimaan.length > 0 || po.faktur.length > 0) && (
            <Kartu judul="Dokumen terkait" rapat>
              <table className="tabel">
                <tbody>
                  {po.penerimaan.map((l) => (
                    <tr key={`l${l.id}`} className={l.status === 'BATAL' ? 'redup' : ''}>
                      <td>{l.jenis === 'LPB' ? 'Penerimaan barang' : 'Serah terima jasa'}</td>
                      <td>
                        <TautanDok jenis={l.jenis} id={l.id}>{l.nomor}</TautanDok>
                      </td>
                      <td>{tanggal(l.tanggal)}</td>
                      <td />
                      <td>
                        <Status kode={l.status} />
                      </td>
                    </tr>
                  ))}
                  {po.faktur.map((x) => (
                    <tr key={`f${x.id}`} className={x.status === 'BATAL' ? 'redup' : ''}>
                      <td>Faktur {x.nomor_faktur}</td>
                      <td>{punya('STAF_KEUANGAN', 'KASUBAG_KEUANGAN', 'WAKIL_DEKAN_2', 'DEKAN', 'AUDITOR', 'KASIR') ? <TautanDok jenis="FB" id={x.id}>{x.nomor}</TautanDok> : x.nomor}</td>
                      <td>{tanggal(x.tanggal_faktur)}</td>
                      <td className="angka">{rupiah(x.total_tagihan)}</td>
                      <td>
                        <Status kode={x.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Kartu>
          )}
        </div>
        <div>
          <PanelPersetujuan jenis="PO" id={po.id} riwayat={po.persetujuan} boleh={po.boleh_memutuskan} />
          <PanelLampiran jenis="PO" id={po.id} bolehUnggah={po.status !== 'BATAL' && punya('PEMBELIAN')} bolehHapus={bisaUbah} judul="Lampiran (penawaran, spesifikasi)" />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- penerimaan (LPB/BAST)

export function DaftarPenerimaan() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring();
  const q = useApi(`/penerimaan${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Penerimaan barang dan jasa"
        sub="LPB untuk barang dan BAST untuk jasa; kuantitasnya menjadi dasar pencocokan faktur."
        aksi={punya('GUDANG') && <TautanTombol ke="/penerimaan/baru" varian="utama" ikon="tambah">Catat penerimaan</TautanTombol>}
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={[['DICATAT', 'Dicatat'], ['BATAL', 'Batal']]} placeholder="Nomor, nomor PO, atau pemasok" />
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Jenis</th>
                    <th>Tanggal</th>
                    <th>PO</th>
                    <th>Pemasok</th>
                    <th>Surat jalan</th>
                    <th>Dicatat oleh</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Tidak ada penerimaan yang cocok dengan penyaring" />}
                  {data.map((d) => (
                    <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/penerimaan/${d.id}`)}>
                      <td className="nomor">{d.nomor}</td>
                      <td>{d.jenis}</td>
                      <td className="nowrap">{tanggal(d.tanggal)}</td>
                      <td>{d.po_nomor}</td>
                      <td>{d.pemasok_nama}</td>
                      <td>{d.nomor_surat_jalan || '-'}</td>
                      <td>{d.dibuat_nama}</td>
                      <td>
                        <Status kode={d.status} />
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

function FormPenerimaan({ po }) {
  const navigate = useNavigate();
  const adaBarang = po.baris.some((b) => b.jenis === 'BARANG' && Number(b.qty) > Number(b.qty_diterima));
  const f = useFormulir({ jenis: adaBarang ? 'LPB' : 'BAST', tanggal: hariIni(), nomor_surat_jalan: '', keterangan: '' });
  const [qty, setQty] = useState(() => Object.fromEntries(po.baris.map((b) => [b.id, Math.max(0, Number(b.qty) - Number(b.qty_diterima))])));
  const [catatan, setCatatan] = useState({});
  const { jalankan, sibuk } = useAksi();
  const jenisBaris = f.nilai.jenis === 'LPB' ? 'BARANG' : 'JASA';
  const baris = po.baris.filter((b) => b.jenis === jenisBaris);

  const kirim = async (e) => {
    e.preventDefault();
    const pilih = baris.filter((b) => Number(qty[b.id]) > 0);
    const data = { ...f.nilai, po_id: po.id, baris: pilih.map((b) => ({ po_detail_id: b.id, qty: qty[b.id], catatan: catatan[b.id] || null })) };
    const r = await jalankan(() => api.post('/penerimaan', data), { setGalat: f.setGalat, sukses: (h) => `${f.nilai.jenis} ${h.nomor} tercatat.` });
    if (r.ok) navigate(`/penerimaan/${r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul={`Penerimaan atas ${po.nomor} dari ${po.pemasok_nama}`}>
        <div className="formulir">
          <Kolom label="Jenis penerimaan" lebar={4}>
            <div className="tombol-grup" role="group" aria-label="Jenis penerimaan">
              <button type="button" className={f.nilai.jenis === 'LPB' ? 'aktif' : ''} onClick={() => f.atur('jenis', 'LPB')}>
                LPB (barang)
              </button>
              <button type="button" className={f.nilai.jenis === 'BAST' ? 'aktif' : ''} onClick={() => f.atur('jenis', 'BAST')}>
                BAST (jasa)
              </button>
            </div>
          </Kolom>
          <Kolom label="Tanggal diterima" galat={f.galat.tanggal} lebar={3}>
            <Masukan type="date" {...f.ikat('tanggal')} salah={!!f.galat.tanggal} />
          </Kolom>
          <Kolom label="Nomor surat jalan" opsional lebar={5}>
            <Masukan {...f.ikat('nomor_surat_jalan')} maxLength={50} />
          </Kolom>
          <Kolom label="Keterangan" opsional lebar={12}>
            <AreaTeks {...f.ikat('keterangan')} rows={2} maxLength={500} placeholder="Kondisi umum, nama pengirim, atau catatan lain" />
          </Kolom>
        </div>
      </Kartu>
      <Kartu judul="Kuantitas yang diterima" rapat>
        {Object.entries(f.galat).some(([k]) => k.startsWith('baris')) && (
          <div style={{ padding: '12px 16px 0' }}>
            <Pesan jenis="galat">{Object.entries(f.galat).filter(([k, x]) => k.startsWith('baris') && x).map(([, x]) => x).join(' ')}</Pesan>
          </div>
        )}
        <div className="tabel-bungkus">
          <table className="tabel">
            <thead>
              <tr>
                <th>Uraian</th>
                <th className="angka">Dipesan</th>
                <th className="angka">Sudah diterima</th>
                <th className="angka">Sisa</th>
                <th className="angka" style={{ width: 130 }}>
                  Diterima sekarang
                </th>
                <th>Catatan kondisi</th>
              </tr>
            </thead>
            <tbody>
              {baris.length === 0 && <BarisKosong kolom={6} judul={`PO ini tidak memuat baris ${jenisBaris === 'BARANG' ? 'barang' : 'jasa'}`} />}
              {baris.map((b) => {
                const sisa = Number(b.qty) - Number(b.qty_diterima);
                return (
                  <tr key={b.id} className={sisa <= 0 ? 'redup' : ''}>
                    <td>{b.uraian}</td>
                    <td className="angka">
                      {angka(b.qty)} {b.satuan}
                    </td>
                    <td className="angka">{angka(b.qty_diterima)}</td>
                    <td className="angka">{angka(sisa)}</td>
                    <td>
                      <InputUang value={qty[b.id]} onChange={(x) => setQty({ ...qty, [b.id]: x })} disabled={sisa <= 0} aria-label={`Diterima sekarang ${b.uraian}`} />
                    </td>
                    <td>
                      <Masukan value={catatan[b.id] || ''} onChange={(e) => setCatatan({ ...catatan, [b.id]: e.target.value })} maxLength={255} placeholder="Baik" aria-label={`Catatan ${b.uraian}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="kecil lemah" style={{ padding: '8px 16px' }}>
          Isi 0 untuk baris yang belum datang. Kuantitas tidak boleh melebihi sisa pesanan.
        </p>
      </Kartu>
      <div className="baris-aksi">
        <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
        <Tombol type="submit" varian="utama" sibuk={sibuk}>
          Simpan penerimaan
        </Tombol>
      </div>
    </form>
  );
}

export function HalamanFormPenerimaan() {
  const [params, setParams] = useSearchParams();
  const poId = params.get('po_id');
  const daftar = useApi('/po?bisa_diterima=1');
  const po = useApi(poId ? `/po/${poId}` : null);
  return (
    <>
      <Kepala judul="Catat penerimaan" remah={[{ label: 'Penerimaan', ke: '/penerimaan' }]} sub="Hitung barang atau periksa hasil pekerjaan sebelum mencatat kuantitasnya." />
      <Kartu>
        <div className="formulir">
          <Kolom label="Pesanan pembelian" lebar={8}>
            <Pilihan
              pilihan={(daftar.data || []).map((p) => [p.id, `${p.nomor}: ${p.pemasok_nama} (${tanggal(p.tanggal)})`])}
              kosong={daftar.isPending ? 'Memuat...' : 'Pilih PO yang sudah disetujui'}
              value={poId || ''}
              onChange={(e) => setParams(e.target.value ? { po_id: e.target.value } : {}, { replace: true })}
            />
          </Kolom>
        </div>
      </Kartu>
      {poId && <Muat kueri={po}>{(d) => <FormPenerimaan key={d.id} po={d} />}</Muat>}
    </>
  );
}

export function DetailPenerimaan() {
  const { id } = useParams();
  const { punya } = useAuth();
  const q = useApi(`/penerimaan/${id}`);
  const aksi = useAksiDokumen('/penerimaan', id, 'Penerimaan');
  return (
    <Muat kueri={q}>
      {(l) => (
        <>
          <Kepala
            judul={l.nomor}
            status={<Status kode={l.status} />}
            remah={[{ label: 'Penerimaan', ke: '/penerimaan' }]}
            sub={`${l.jenis === 'LPB' ? 'Laporan penerimaan barang' : 'Berita acara serah terima jasa'} · ${l.pemasok_nama}`}
            aksi={
              <>
                {punya('GUDANG') && l.status === 'DICATAT' && (
                  <Tombol varian="bahaya" onClick={() => aksi.batal({ pesan: 'Kuantitas diterima pada PO akan dikurangi kembali.' })} disabled={aksi.sibuk}>
                    Batalkan
                  </Tombol>
                )}
                <TombolCetak jenis={l.jenis} id={l.id} />
              </>
            }
          />
          {l.status === 'BATAL' && l.alasan_batal && <Pesan jenis="peringatan" judul="Penerimaan dibatalkan">{l.alasan_batal}</Pesan>}
          <div className="grid-2-1">
            <Kartu judul="Barang atau jasa yang diterima" rapat>
              <table className="tabel">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Uraian</th>
                    <th className="angka">Dipesan</th>
                    <th className="angka">Diterima sebelumnya</th>
                    <th className="angka">Diterima di dokumen ini</th>
                    <th className="angka">Total diterima saat ini</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {l.baris.map((b) => (
                    <tr key={b.id}>
                      <td>{b.baris}</td>
                      <td>{b.uraian}</td>
                      <td className="angka">
                        {angka(b.qty_po)} {b.satuan}
                      </td>
                      <td className="angka">{angka(b.qty_sebelumnya)}</td>
                      <td className="angka tebal">{angka(b.qty)}</td>
                      <td className="angka">{angka(b.qty_diterima_total)}</td>
                      <td>{b.catatan || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Kartu>
            <div>
              <Kartu judul="Data penerimaan">
                <Info
                  butir={[
                    ['Tanggal diterima', tanggal(l.tanggal, true)],
                    ['Pesanan pembelian', <Link to={`/po/${l.po_id}`}>{l.po_nomor}</Link>],
                    ['Pemasok', l.pemasok_nama],
                    ['Nomor surat jalan', l.nomor_surat_jalan],
                    ['Dicatat oleh', l.dibuat_nama],
                    l.keterangan && ['Keterangan', l.keterangan],
                  ]}
                />
              </Kartu>
              <PanelLampiran jenis={l.jenis} id={l.id} bolehUnggah={l.status !== 'BATAL' && punya('GUDANG')} judul="Surat jalan dan foto" />
            </div>
          </div>
        </>
      )}
    </Muat>
  );
}
