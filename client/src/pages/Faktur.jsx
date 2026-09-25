// Faktur pemasok: pencatatan dari PO, pencocokan tiga arah (PO, LPB/BAST, faktur), dan faktur saldo awal.
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { angka, hariIni, hitungPajak, jumlahkan, kali, rupiah, tambahHari, tanggal, tarifEfektif } from '../format.js';
import { useAksi, useApi, usePajak, usePilihanPemasok } from '../components/data.js';
import { SaringDaftar, useAksiDokumen, useSaring } from '../components/Dokumen.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import { PanelPersetujuan } from '../components/Persetujuan.jsx';
import {
  AreaTeks, BarisKosong, InputUang, Info, Kartu, Kepala, Kolom, Kombo, Masukan, Muat, Pesan, Pilihan, Status, TautanDok, TautanTombol, Tombol, TotalRingkas,
  useFormulir,
} from '../components/ui.jsx';

const STATUS_FB = [
  ['DRAFT', 'Draf'], ['MENUNGGU_PERSETUJUAN', 'Menunggu persetujuan'], ['DITOLAK', 'Ditolak'], ['TERVERIFIKASI', 'Terverifikasi'],
  ['DIBAYAR_SEBAGIAN', 'Dibayar sebagian'], ['LUNAS', 'Lunas'], ['BATAL', 'Batal'],
];

function useToleransi() {
  const q = useApi('/pengaturan', { staleTime: 300_000 });
  const ambil = (k) => Number(q.data?.find((p) => p.kunci === k)?.nilai || 0);
  return { harga: ambil('toleransi_harga_persen'), qty: ambil('toleransi_qty_persen') };
}

export function DaftarFaktur() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const saring = useSaring(['status', 'cari', 'dari', 'sampai', 'belum_lunas']);
  const q = useApi(`/faktur${saring.qs}`);
  return (
    <>
      <Kepala
        judul="Faktur pemasok"
        sub="Register utang usaha: setiap faktur dicocokkan dengan PO dan penerimaan sebelum diposting."
        aksi={
          <>
            {punya('KASUBAG_KEUANGAN') && <TautanTombol ke="/faktur/saldo-awal">Faktur saldo awal</TautanTombol>}
            {punya('STAF_KEUANGAN') && <TautanTombol ke="/faktur/baru" varian="utama" ikon="tambah">Catat faktur</TautanTombol>}
          </>
        }
      />
      <Kartu rapat>
        <SaringDaftar saring={saring} status={STATUS_FB} placeholder="Nomor register, nomor faktur, atau pemasok">
          <Kolom label="Posisi">
            <Pilihan pilihan={[['1', 'Belum lunas']]} kosong="Semua" value={saring.nilai.belum_lunas} onChange={(e) => saring.atur('belum_lunas', e.target.value)} />
          </Kolom>
        </SaringDaftar>
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Register</th>
                    <th>Nomor faktur</th>
                    <th>Pemasok</th>
                    <th>Tanggal faktur</th>
                    <th>Jatuh tempo</th>
                    <th className="angka">Total utang</th>
                    <th className="angka">Sisa</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={8} judul="Tidak ada faktur yang cocok dengan penyaring" />}
                  {data.map((d) => {
                    const terbuka = ['TERVERIFIKASI', 'DIBAYAR_SEBAGIAN'].includes(d.status);
                    return (
                      <tr key={d.id} className={`klik ${d.status === 'BATAL' ? 'redup' : ''}`} onClick={() => navigate(`/faktur/${d.id}`)}>
                        <td className="nomor">{d.nomor}</td>
                        <td>
                          {d.nomor_faktur}
                          <div className="kecil sangat-lemah">{d.jenis === 'SALDO_AWAL' ? 'Saldo awal' : d.po_nomor}</div>
                        </td>
                        <td>{d.pemasok_nama}</td>
                        <td className="nowrap">{tanggal(d.tanggal_faktur)}</td>
                        <td className="nowrap">
                          {tanggal(d.tanggal_jatuh_tempo)}
                          {terbuka && d.hari_lewat_jatuh_tempo > 0 && <div className="kecil teks-bahaya">Lewat {d.hari_lewat_jatuh_tempo} hari</div>}
                        </td>
                        <td className="angka">{rupiah(d.total_utang)}</td>
                        <td className="angka">{terbuka ? rupiah(d.sisa) : '-'}</td>
                        <td>
                          <Status kode={d.status} />
                          {d.hasil_cocok === 'SELISIH' && <div className="kecil teks-peringatan">Ada selisih pencocokan</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Muat>
      </Kartu>
    </>
  );
}

function FormFaktur({ po, awal, id }) {
  const navigate = useNavigate();
  const f = useFormulir(awal);
  const { jalankan, sibuk } = useAksi();
  const pajak = usePajak();
  const tol = useToleransi();
  const tarifPpn = Number(pajak.data?.find((p) => p.id === po.pajak_ppn_id)?.tarif || 0);
  const kenaPpn = !!po.pajak_ppn_id && !!po.pemasok.pkp;
  const [baris, setBaris] = useState(() =>
    Object.fromEntries(
      po.baris.map((b) => {
        const ada = awal.baris?.find((x) => x.po_detail_id === b.id);
        const tersedia = Number(b.qty_diterima) - Number(b.qty_ditagih);
        return [b.id, ada ? { pilih: true, qty: Number(ada.qty), harga: Number(ada.harga) } : { pilih: !awal.baris && tersedia > 0, qty: Math.max(tersedia, 0), harga: Number(b.harga) }];
      }),
    ),
  );
  const v = f.nilai;
  const terpilih = po.baris.filter((b) => baris[b.id].pilih);
  const dpp = jumlahkan(terpilih, (b) => kali(baris[b.id].qty, baris[b.id].harga));
  const dasarPph = jumlahkan(terpilih.filter((b) => b.jenis === 'JASA'), (b) => kali(baris[b.id].qty, baris[b.id].harga));
  const ppn = kenaPpn ? (v.ppn === '' ? hitungPajak(dpp, tarifPpn) : Number(v.ppn)) : 0;
  const kodePph = (pajak.data || []).find((p) => String(p.id) === String(v.pajak_pph_id));
  const tarifPph = kodePph ? tarifEfektif(kodePph, !po.pemasok.npwp) : 0;
  const pph = kodePph ? hitungPajak(dasarPph, tarifPph) : 0;
  const tagihan = dpp + ppn;

  const status = (b) => {
    const x = baris[b.id];
    const tersedia = Number(b.qty_diterima) - Number(b.qty_ditagih);
    const qtyOk = Number(x.qty) <= tersedia + (Number(b.qty) * tol.qty) / 100 + 1e-9;
    const hargaOk = Number(x.harga) <= Number(b.harga) * (1 + tol.harga / 100) + 1e-9;
    return qtyOk && hargaOk ? 'COCOK' : !qtyOk && !hargaOk ? 'SELISIH_QTY_HARGA' : !qtyOk ? 'SELISIH_QTY' : 'SELISIH_HARGA';
  };
  const adaSelisih = terpilih.some((b) => status(b) !== 'COCOK');

  const kirim = async (e) => {
    e.preventDefault();
    const data = {
      po_id: po.id,
      nomor_faktur: v.nomor_faktur,
      nomor_faktur_pajak: v.nomor_faktur_pajak,
      tanggal_faktur: v.tanggal_faktur,
      tanggal_terima: v.tanggal_terima,
      tanggal_jatuh_tempo: v.tanggal_jatuh_tempo,
      ppn: kenaPpn ? v.ppn : 0,
      pajak_pph_id: v.pajak_pph_id,
      keterangan: v.keterangan,
      baris: terpilih.map((b) => ({ po_detail_id: b.id, qty: baris[b.id].qty, harga: baris[b.id].harga })),
    };
    const r = await jalankan(() => (id ? api.put(`/faktur/${id}`, data) : api.post('/faktur', data)), {
      setGalat: f.setGalat,
      sukses: (h) => (id ? 'Perubahan faktur tersimpan.' : `Faktur dicatat dengan nomor register ${h.nomor}. Unggah pindaian faktur, lalu jalankan verifikasi.`),
    });
    if (r.ok) navigate(`/faktur/${id || r.hasil.id}`);
  };

  return (
    <form onSubmit={kirim} noValidate>
      <Kartu judul={`Faktur ${po.pemasok.nama} atas ${po.nomor}`}>
        <div className="formulir">
          <Kolom label="Nomor faktur pemasok" galat={f.galat.nomor_faktur} lebar={4}>
            <Masukan {...f.ikat('nomor_faktur')} salah={!!f.galat.nomor_faktur} maxLength={50} />
          </Kolom>
          <Kolom label="Nomor faktur pajak" opsional={!kenaPpn} lebar={4}>
            <Masukan {...f.ikat('nomor_faktur_pajak')} maxLength={50} disabled={!kenaPpn} placeholder={kenaPpn ? '' : 'Pemasok tidak memungut PPN'} />
          </Kolom>
          <Kolom label="Tanggal faktur" galat={f.galat.tanggal_faktur} lebar={2}>
            <Masukan type="date" {...f.ikat('tanggal_faktur')} salah={!!f.galat.tanggal_faktur} />
          </Kolom>
          <Kolom label="Tanggal diterima" galat={f.galat.tanggal_terima} lebar={2}>
            <Masukan type="date" {...f.ikat('tanggal_terima')} salah={!!f.galat.tanggal_terima} />
          </Kolom>
          <Kolom label="Jatuh tempo" opsional bantuan={v.tanggal_faktur ? `Kosongkan untuk memakai termin PO: ${tanggal(tambahHari(v.tanggal_faktur, po.termin_hari), true)}.` : `Termin PO ${po.termin_hari} hari.`} lebar={4}>
            <Masukan type="date" {...f.ikat('tanggal_jatuh_tempo')} />
          </Kolom>
          <Kolom label="PPh yang dipotong" opsional galat={f.galat.pajak_pph_id} bantuan={!po.pemasok.npwp ? 'Pemasok tanpa NPWP: tarif PPh 23 dikenakan dua kali lipat.' : 'Hanya atas baris jasa.'} lebar={4}>
            <Pilihan
              pilihan={(pajak.data || []).filter((p) => p.jenis === 'PPH' && p.aktif).map((p) => [p.id, `${p.nama}`])}
              kosong="Tidak ada potongan"
              {...f.ikat('pajak_pph_id')}
              salah={!!f.galat.pajak_pph_id}
            />
          </Kolom>
          <Kolom label="PPN (Rp)" galat={f.galat.ppn} bantuan={kenaPpn ? `Kosongkan untuk dihitung ${angka(tarifPpn)}% dari DPP.` : 'PO tidak dikenai PPN.'} lebar={4}>
            <InputUang value={kenaPpn ? v.ppn : 0} onChange={(x) => f.atur('ppn', x)} disabled={!kenaPpn} placeholder={kenaPpn ? rupiah(hitungPajak(dpp, tarifPpn)) : ''} salah={!!f.galat.ppn} />
          </Kolom>
          <Kolom label="Keterangan" opsional lebar={12}>
            <AreaTeks {...f.ikat('keterangan')} rows={2} maxLength={500} />
          </Kolom>
        </div>
      </Kartu>
      <Kartu judul="Baris yang ditagih" rapat>
        {Object.entries(f.galat).some(([k, x]) => k.startsWith('baris') && x) && (
          <div style={{ padding: '12px 16px 0' }}>
            <Pesan jenis="galat">{Object.entries(f.galat).filter(([k, x]) => k.startsWith('baris') && x).map(([, x]) => x).join(' ')}</Pesan>
          </div>
        )}
        <div className="tabel-bungkus">
          <table className="tabel">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Uraian</th>
                <th className="angka">Diterima belum ditagih</th>
                <th className="angka">Harga PO</th>
                <th className="angka" style={{ width: 110 }}>
                  Kuantitas ditagih
                </th>
                <th className="angka" style={{ width: 140 }}>
                  Harga faktur
                </th>
                <th className="angka">Jumlah</th>
                <th>Pencocokan</th>
              </tr>
            </thead>
            <tbody>
              {po.baris.map((b) => {
                const x = baris[b.id];
                const tersedia = Number(b.qty_diterima) - Number(b.qty_ditagih);
                const ubah = (k, nilai) => setBaris({ ...baris, [b.id]: { ...x, [k]: nilai } });
                return (
                  <tr key={b.id} className={x.pilih ? (status(b) !== 'COCOK' ? 'selisih' : 'dipilih') : ''}>
                    <td>
                      <input type="checkbox" checked={x.pilih} onChange={(e) => ubah('pilih', e.target.checked)} aria-label={`Tagih ${b.uraian}`} />
                    </td>
                    <td>
                      {b.uraian}
                      <div className="kecil sangat-lemah">
                        {b.jenis === 'JASA' ? 'Jasa' : 'Barang'} · dipesan {angka(b.qty)} {b.satuan}
                      </div>
                    </td>
                    <td className="angka">
                      {angka(tersedia)} {b.satuan}
                    </td>
                    <td className="angka">{rupiah(b.harga)}</td>
                    <td>
                      <InputUang value={x.qty} onChange={(n) => ubah('qty', n)} disabled={!x.pilih} aria-label={`Kuantitas ditagih ${b.uraian}`} />
                    </td>
                    <td>
                      <InputUang value={x.harga} onChange={(n) => ubah('harga', n)} disabled={!x.pilih} aria-label={`Harga faktur ${b.uraian}`} />
                    </td>
                    <td className="angka">{x.pilih ? rupiah(kali(x.qty, x.harga)) : '-'}</td>
                    <td>{x.pilih && <Status kode={status(b)} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {adaSelisih && (
          <div style={{ padding: '12px 16px 0' }}>
            <Pesan jenis="peringatan">
              Ada baris yang tidak cocok dengan PO atau penerimaan. Faktur tetap dapat dicatat, tetapi setelah verifikasi harus disetujui Wakil Dekan II sebelum menjadi utang.
            </Pesan>
          </div>
        )}
        <TotalRingkas
          baris={[
            ['DPP', dpp],
            kenaPpn && ['PPN', ppn],
            ['Total tagihan', tagihan, true],
            kodePph && [`${kodePph.nama}${tarifPph !== Number(kodePph.tarif) ? ' (tanpa NPWP)' : ''} dipotong`, -pph],
            kodePph && ['Utang kepada pemasok', tagihan - pph, true],
          ]}
        />
      </Kartu>
      <div className="baris-aksi">
        <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
        <Tombol type="submit" varian="utama" sibuk={sibuk}>
          {id ? 'Simpan perubahan' : 'Simpan faktur'}
        </Tombol>
      </div>
    </form>
  );
}

export function HalamanFormFaktur() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const fq = useApi(id ? `/faktur/${id}` : null);
  const poId = id ? fq.data?.po_id : params.get('po_id');
  const daftar = useApi(id ? null : '/po?bisa_ditagih=1');
  const po = useApi(poId ? `/po/${poId}` : null);
  const awalBaru = { nomor_faktur: '', nomor_faktur_pajak: '', tanggal_faktur: hariIni(), tanggal_terima: hariIni(), tanggal_jatuh_tempo: '', ppn: '', pajak_pph_id: '', keterangan: '' };
  return (
    <>
      <Kepala judul={id ? 'Ubah faktur pemasok' : 'Catat faktur pemasok'} remah={[{ label: 'Faktur pemasok', ke: '/faktur' }]} sub="Salin angka persis seperti tertulis di faktur; sistem yang mencocokkannya dengan PO dan penerimaan." />
      {!id && (
        <Kartu>
          <div className="formulir">
            <Kolom label="Pesanan pembelian" lebar={8} bantuan="Hanya PO yang memiliki barang atau jasa diterima tetapi belum ditagih.">
              <Pilihan
                pilihan={(daftar.data || []).map((p) => [p.id, `${p.nomor}: ${p.pemasok_nama} (${rupiah(p.total)})`])}
                kosong={daftar.isPending ? 'Memuat...' : 'Pilih PO'}
                value={poId || ''}
                onChange={(e) => setParams(e.target.value ? { po_id: e.target.value } : {}, { replace: true })}
              />
            </Kolom>
          </div>
        </Kartu>
      )}
      {poId && (
        <Muat kueri={po}>
          {(p) =>
            id ? (
              <FormFaktur
                key={p.id}
                po={p}
                id={id}
                awal={{
                  nomor_faktur: fq.data.nomor_faktur,
                  nomor_faktur_pajak: fq.data.nomor_faktur_pajak || '',
                  tanggal_faktur: fq.data.tanggal_faktur,
                  tanggal_terima: fq.data.tanggal_terima,
                  tanggal_jatuh_tempo: fq.data.tanggal_jatuh_tempo || '',
                  ppn: Number(fq.data.ppn),
                  pajak_pph_id: fq.data.pajak_pph_id || '',
                  keterangan: fq.data.keterangan || '',
                  baris: fq.data.baris.map((b) => ({ po_detail_id: b.po_detail_id, qty: b.qty, harga: b.harga })),
                }}
              />
            ) : (
              <FormFaktur key={p.id} po={p} awal={awalBaru} />
            )
          }
        </Muat>
      )}
    </>
  );
}

export function HalamanSaldoAwalFaktur() {
  const navigate = useNavigate();
  const pemasok = usePilihanPemasok({ aktif: false });
  const f = useFormulir({ pemasok_id: '', nomor_faktur: '', tanggal_faktur: '', tanggal_jatuh_tempo: '', total_utang: '', keterangan: '' });
  const { jalankan, sibuk } = useAksi();
  const kirim = async (e) => {
    e.preventDefault();
    const r = await jalankan(() => api.post('/faktur/saldo-awal', f.nilai), { setGalat: f.setGalat, sukses: (h) => `Faktur saldo awal tercatat sebagai ${h.nomor}.` });
    if (r.ok) navigate(`/faktur/${r.hasil.id}`);
  };
  return (
    <>
      <Kepala judul="Faktur saldo awal" remah={[{ label: 'Faktur pemasok', ke: '/faktur' }]} sub="Utang yang belum lunas pada saat sistem mulai dipakai. Tidak membuat jurnal karena saldonya sudah masuk jurnal saldo awal." />
      <form onSubmit={kirim} noValidate>
        <Kartu className="halaman-kecil">
          <div className="formulir">
            <Kolom label="Pemasok" galat={f.galat.pemasok_id} lebar={12}>
              <Kombo pilihan={pemasok} value={f.nilai.pemasok_id} onChange={(x) => f.atur('pemasok_id', x)} salah={!!f.galat.pemasok_id} />
            </Kolom>
            <Kolom label="Nomor faktur" galat={f.galat.nomor_faktur} lebar={6}>
              <Masukan {...f.ikat('nomor_faktur')} salah={!!f.galat.nomor_faktur} maxLength={50} />
            </Kolom>
            <Kolom label="Sisa utang (Rp)" galat={f.galat.total_utang} lebar={6}>
              <InputUang value={f.nilai.total_utang} onChange={(x) => f.atur('total_utang', x)} salah={!!f.galat.total_utang} />
            </Kolom>
            <Kolom label="Tanggal faktur" galat={f.galat.tanggal_faktur} lebar={6}>
              <Masukan type="date" {...f.ikat('tanggal_faktur')} salah={!!f.galat.tanggal_faktur} />
            </Kolom>
            <Kolom label="Jatuh tempo" galat={f.galat.tanggal_jatuh_tempo} lebar={6}>
              <Masukan type="date" {...f.ikat('tanggal_jatuh_tempo')} salah={!!f.galat.tanggal_jatuh_tempo} />
            </Kolom>
            <Kolom label="Keterangan" opsional lebar={12}>
              <AreaTeks {...f.ikat('keterangan')} rows={2} maxLength={500} />
            </Kolom>
          </div>
          <div className="baris-aksi">
            <Tombol onClick={() => navigate(-1)}>Batal</Tombol>
            <Tombol type="submit" varian="utama" sibuk={sibuk}>
              Simpan faktur saldo awal
            </Tombol>
          </div>
        </Kartu>
      </form>
    </>
  );
}

export function DetailFaktur() {
  const { id } = useParams();
  const q = useApi(`/faktur/${id}`);
  return <Muat kueri={q}>{(fb) => <IsiDetailFaktur fb={fb} />}</Muat>;
}

function IsiDetailFaktur({ fb }) {
  const { punya } = useAuth();
  const aksi = useAksiDokumen('/faktur', fb.id, 'Faktur');
  const bisaUbah = punya('STAF_KEUANGAN') && ['DRAFT', 'DITOLAK'].includes(fb.status) && fb.jenis === 'PO';
  const bisaBatal =
    (['DRAFT', 'DITOLAK', 'MENUNGGU_PERSETUJUAN'].includes(fb.status) && punya('STAF_KEUANGAN', 'KASUBAG_KEUANGAN')) ||
    (fb.status === 'TERVERIFIKASI' && punya('KASUBAG_KEUANGAN') && Number(fb.terbayar) === 0);
  const terbuka = ['TERVERIFIKASI', 'DIBAYAR_SEBAGIAN'].includes(fb.status);
  const verifikasi = () =>
    aksi.jalankan(() => api.post(`/faktur/${fb.id}/verifikasi`), {
      sukses: (h) =>
        h.hasil_cocok === 'COCOK'
          ? `Faktur cocok dengan PO dan penerimaan, lalu diposting ke jurnal ${h.jurnal}.`
          : 'Ditemukan selisih pencocokan. Faktur menunggu persetujuan Wakil Dekan II.',
    });
  return (
    <>
      <Kepala
        judul={`${fb.nomor} · ${fb.nomor_faktur}`}
        status={<Status kode={fb.status} />}
        remah={[{ label: 'Faktur pemasok', ke: '/faktur' }]}
        sub={`${fb.pemasok_nama}${fb.po_nomor ? ` · ${fb.po_nomor}` : ' · saldo awal'}`}
        aksi={
          <>
            {bisaUbah && <TautanTombol ke={`/faktur/${fb.id}/ubah`} ikon="pena">Ubah</TautanTombol>}
            {bisaBatal && (
              <Tombol
                varian="bahaya"
                onClick={() => aksi.batal({ pesan: fb.status === 'TERVERIFIKASI' ? 'Jurnal pembelian akan dibalik dengan jurnal pembalik bertanggal hari ini.' : undefined })}
                disabled={aksi.sibuk}
              >
                Batalkan
              </Tombol>
            )}
            {punya('STAF_KEUANGAN') && terbuka && (
              <TautanTombol ke={`/bkk/baru?jenis=PEMBAYARAN_FAKTUR&pemasok_id=${fb.pemasok_id}`} varian="utama" ikon="keluar">Buat BKK pembayaran</TautanTombol>
            )}
            {punya('STAF_KEUANGAN') && ['DRAFT', 'DITOLAK'].includes(fb.status) && (
              <Tombol varian="utama" ikon="timbang" onClick={verifikasi} sibuk={aksi.sibuk}>
                Verifikasi dan cocokkan
              </Tombol>
            )}
          </>
        }
      />
      {fb.status === 'BATAL' && fb.alasan_batal && <Pesan jenis="peringatan" judul="Faktur dibatalkan">{fb.alasan_batal}</Pesan>}
      {fb.hasil_cocok === 'SELISIH' && fb.catatan_selisih && (
        <Pesan jenis="peringatan" judul="Selisih pencocokan tiga arah">
          {fb.catatan_selisih}
        </Pesan>
      )}
      {['DRAFT', 'DITOLAK'].includes(fb.status) && (
        <Pesan jenis="info">
          Faktur belum menjadi utang. Tekan Verifikasi dan cocokkan: bila cocok, faktur langsung diposting; bila berselisih, faktur diteruskan ke Wakil Dekan II.
        </Pesan>
      )}
      {terbuka && fb.hari_lewat_jatuh_tempo > 0 && <Pesan jenis="galat">Faktur ini sudah lewat jatuh tempo {fb.hari_lewat_jatuh_tempo} hari.</Pesan>}
      <div className="grid-2-1">
        <div>
          <Kartu judul="Data faktur">
            <Info
              butir={[
                ['Pemasok', fb.pemasok_nama],
                ['Nomor faktur', fb.nomor_faktur],
                ['Nomor faktur pajak', fb.nomor_faktur_pajak],
                ['Tanggal faktur', tanggal(fb.tanggal_faktur, true)],
                ['Tanggal diterima', tanggal(fb.tanggal_terima, true)],
                ['Jatuh tempo', tanggal(fb.tanggal_jatuh_tempo, true)],
                ['Pesanan pembelian', fb.po_id ? <Link to={`/po/${fb.po_id}`}>{fb.po_nomor}</Link> : 'Saldo awal'],
                fb.jurnal && ['Jurnal pembelian', <Link to={`/jurnal/${fb.jurnal.id}`}>{fb.jurnal.nomor}{fb.jurnal.dibalik_oleh_id ? ' (dibalik)' : ''}</Link>],
                ['Dicatat oleh', fb.dibuat_nama],
                fb.keterangan && ['Keterangan', fb.keterangan],
              ]}
            />
          </Kartu>
          {fb.baris.length > 0 && (
            <Kartu judul="Baris faktur dan hasil pencocokan" rapat>
              <div className="tabel-bungkus">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Uraian</th>
                      <th className="angka">Ditagih</th>
                      <th className="angka">Harga faktur</th>
                      <th className="angka">Harga PO</th>
                      <th className="angka">Jumlah</th>
                      <th>Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fb.baris.map((b) => (
                      <tr key={b.id} className={b.status_cocok && b.status_cocok !== 'COCOK' ? 'selisih' : ''}>
                        <td>{b.baris}</td>
                        <td>
                          {b.uraian}
                          <div className="kecil sangat-lemah">
                            {b.akun_kode} {b.akun_nama}
                          </div>
                          {b.catatan_cocok && <div className="kecil teks-peringatan">{b.catatan_cocok}</div>}
                        </td>
                        <td className="angka">
                          {angka(b.qty)} {b.satuan}
                          {b.qty_tersedia !== null && b.qty_tersedia !== undefined && <div className="kecil sangat-lemah">tersedia {angka(b.qty_tersedia)}</div>}
                        </td>
                        <td className="angka">{rupiah(b.harga)}</td>
                        <td className="angka">{b.harga_po !== null && b.harga_po !== undefined ? rupiah(b.harga_po) : '-'}</td>
                        <td className="angka">{rupiah(b.jumlah)}</td>
                        <td>{b.status_cocok ? <Status kode={b.status_cocok} /> : <span className="kecil sangat-lemah">Belum diverifikasi</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Kartu>
          )}
          <Kartu judul="Nilai faktur" rapat>
            <TotalRingkas
              baris={[
                ['DPP', fb.dpp],
                Number(fb.ppn) > 0 && ['PPN', fb.ppn],
                ['Total tagihan', fb.total_tagihan, true],
                Number(fb.pph) > 0 && [`${fb.pajak_pph?.nama || 'PPh'} ${angka(fb.tarif_pph)}% dipotong`, -fb.pph],
                ['Total utang', fb.total_utang, true],
                ['Sudah dibayar', fb.terbayar],
                ['Sisa utang', fb.sisa, true],
              ]}
            />
          </Kartu>
          {fb.pembayaran.length > 0 && (
            <Kartu judul="Riwayat pembayaran" rapat>
              <table className="tabel">
                <thead>
                  <tr>
                    <th>BKK</th>
                    <th>Pembayaran</th>
                    <th>Tanggal bayar</th>
                    <th>Cek, BG, atau referensi</th>
                    <th className="angka">Jumlah</th>
                    <th>Status BKK</th>
                  </tr>
                </thead>
                <tbody>
                  {fb.pembayaran.map((p) => (
                    <tr key={`${p.bkk_id}-${p.pembayaran_nomor}`} className={p.bkk_status === 'BATAL' ? 'redup' : ''}>
                      <td>
                        <TautanDok jenis="BKK" id={p.bkk_id}>{p.bkk_nomor}</TautanDok>
                      </td>
                      <td>{p.pembayaran_nomor || '-'}</td>
                      <td>{tanggal(p.tanggal_bayar)}</td>
                      <td>{p.nomor_warkat || p.nomor_referensi || '-'}</td>
                      <td className="angka">{rupiah(p.jumlah)}</td>
                      <td>
                        <Status kode={p.bkk_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Kartu>
          )}
        </div>
        <div>
          {(fb.persetujuan.length > 0 || fb.boleh_memutuskan) && <PanelPersetujuan jenis="FB" id={fb.id} riwayat={fb.persetujuan} boleh={fb.boleh_memutuskan} />}
          <PanelLampiran jenis="FB" id={fb.id} bolehUnggah={fb.status !== 'BATAL' && punya('STAF_KEUANGAN', 'KASUBAG_KEUANGAN')} bolehHapus={['DRAFT', 'DITOLAK'].includes(fb.status)} judul="Pindaian faktur dan faktur pajak" />
        </div>
      </div>
    </>
  );
}
