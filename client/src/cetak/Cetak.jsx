// Formulir cetak A4 untuk setiap dokumen. Pratinjau bertanda PRATINJAU; saat dicetak, server mencatat cetakan
// dan formulir bertanda ASLI (cetakan pertama) atau SALINAN KE-n, beserta tanda DRAF, BATAL, atau LUNAS.
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { JENIS_BKK, METODE } from '../konstanta.js';
import { angka, jumlahkan, namaBulan, rupiah, tanggal, terbilang, waktu } from '../format.js';
import { useApi } from '../components/data.js';
import { Muat, Pesan, Tombol, useToast } from '../components/ui.jsx';
import { JENIS_POS } from '../pages/Rekonsiliasi.jsx';
import '../styles/cetak.css';

const SUMBER_DATA = {
  PO: (id) => `/po/${id}`,
  LPB: (id) => `/penerimaan/${id}`,
  BAST: (id) => `/penerimaan/${id}`,
  PP: (id) => `/pp/${id}`,
  PUM: (id) => `/uang-muka/${id}`,
  PJUM: (id) => `/pjum/${id}`,
  PKK: (id) => `/pkk/${id}`,
  PDK: (id) => `/pdk/${id}`,
  OPN: (id) => `/opname/${id}`,
  BKK: (id) => `/bkk/${id}`,
  BYR: (id) => `/pembayaran/${id}`,
  BKM: (id) => `/bkm/${id}`,
  JM: (id) => `/jurnal-manual/${id}`,
  RB: (id) => `/rekonsiliasi/${id}`,
};

const STATUS_DRAF = ['DRAFT', 'DIAJUKAN', 'DITOLAK', 'MENUNGGU_PERSETUJUAN'];
const LUNAS = { BKK: ['DIBAYAR'], PP: ['DIBAYAR'], PUM: ['DIBAYAR', 'SELESAI'], PDK: ['DIBAYAR'] };

// ---------------------------------------------------------------- bagian formulir

export function Kop({ tanda, subTanda, pratinjau }) {
  const { perusahaan: p } = useAuth();
  return (
    <div className="kop">
      <div>
        <div className="nama">{p.perusahaan_nama}</div>
        <div className="alamat">
          {[p.perusahaan_alamat, p.perusahaan_kota].filter(Boolean).join(', ')}
          {p.perusahaan_telepon ? ` · Telp. ${p.perusahaan_telepon}` : ''}
        </div>
        {p.perusahaan_npwp && <div className="alamat">NPWP {p.perusahaan_npwp}</div>}
      </div>
      {tanda && (
        <div className={`tanda-cetak ${pratinjau ? 'pratinjau' : ''}`}>
          {tanda}
          {subTanda && <small>{subTanda}</small>}
        </div>
      )}
    </div>
  );
}

function Judul({ judul, nomor, sub }) {
  return (
    <div className="judul-form">
      <h1>{judul}</h1>
      {nomor && <div className="nomor">Nomor: {nomor}</div>}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function InfoCetak({ butir, satu }) {
  return (
    <div className={`cetak-info ${satu ? 'satu' : ''}`}>
      {butir.filter(Boolean).map(([l, n], i) => (
        <div className="b" key={i}>
          <span className="l">{l}</span>
          <span>:</span>
          <span className="n">{n === null || n === undefined || n === '' ? '-' : n}</span>
        </div>
      ))}
    </div>
  );
}

function Terbilang({ nilai }) {
  return (
    <div className="cetak-terbilang">
      <b>Terbilang:</b> {terbilang(nilai)}
    </div>
  );
}

function Persetujuan({ riwayat }) {
  if (!riwayat?.length) return null;
  const putaran = Math.max(...riwayat.map((r) => r.putaran));
  const baris = riwayat.filter((r) => r.putaran === putaran);
  return (
    <>
      <div className="cetak-bagian">Persetujuan elektronik</div>
      <table className="cetak-tabel cetak-persetujuan">
        <thead>
          <tr>
            <th>Langkah</th>
            <th>Nama dan jabatan</th>
            <th>Keputusan</th>
            <th>Waktu</th>
            <th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((r) => (
            <tr key={r.id}>
              <td>{r.nama_langkah}</td>
              <td>{r.diputuskan_nama ? `${r.diputuskan_nama}${r.diputuskan_jabatan ? `, ${r.diputuskan_jabatan}` : ''}` : `(${r.peran_nama})`}</td>
              <td>{{ DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak', MENUNGGU: 'Menunggu', DIBATALKAN: 'Dibatalkan' }[r.status] || r.status}</td>
              <td className="nowrap">{r.diputuskan_pada ? waktu(r.diputuskan_pada) : '-'}</td>
              <td>{r.catatan || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Kolom tanda tangan basah. kolom: [[peran, nama?]] */
export function TandaTangan({ kolom, kota, tgl }) {
  return (
    <>
      {kota && (
        <div style={{ textAlign: 'right', marginTop: 10, fontSize: '9pt' }}>
          {kota}, {tgl ? tanggal(tgl, true) : '....................'}
        </div>
      )}
      <div className="cetak-ttd" style={{ '--kolom': kolom.length }}>
        {kolom.map(([peran, nama], i) => (
          <div key={i}>
            <div className="peran">{peran}</div>
            <div className="nama">{nama || '(....................)'}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function TabelUang({ kolom, baris, kaki }) {
  return (
    <table className="cetak-tabel">
      <thead>
        <tr>
          {kolom.map(([label, kelas], i) => (
            <th key={i} className={kelas || ''}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{baris}</tbody>
      {kaki && <tfoot>{kaki}</tfoot>}
    </table>
  );
}

// ---------------------------------------------------------------- templat per jenis dokumen

function CetakPO({ d, opsi }) {
  const harga = !opsi.tanpaHarga;
  return (
    <>
      <Judul judul={harga ? 'Pesanan pembelian' : 'Pesanan pembelian (salinan gudang, tanpa harga)'} nomor={d.nomor} />
      <div className="cetak-info">
        <div>
          <div className="cetak-bagian" style={{ marginTop: 0 }}>
            Kepada
          </div>
          <div className="tebal">{d.pemasok.nama}</div>
          <div>{[d.pemasok.alamat, d.pemasok.kota].filter(Boolean).join(', ')}</div>
          <div>NPWP: {d.pemasok.npwp || '-'}</div>
          {d.pemasok.kontak && <div>U.p. {d.pemasok.kontak}{d.pemasok.telepon ? `, ${d.pemasok.telepon}` : ''}</div>}
        </div>
        <InfoCetak
          satu
          butir={[
            ['Tanggal PO', tanggal(d.tanggal, true)],
            ['Departemen peminta', d.departemen_nama],
            ['Tanggal kirim', tanggal(d.tanggal_kirim, true)],
            ['Termin pembayaran', `${d.termin_hari} hari setelah faktur`],
          ]}
        />
      </div>
      <TabelUang
        kolom={[['No', 'tengah'], ['Uraian'], ['Jenis'], ['Kuantitas', 'angka'], ['Satuan'], ...(harga ? [['Harga satuan', 'angka'], ['Jumlah', 'angka']] : [])]}
        baris={d.baris.map((b) => (
          <tr key={b.id}>
            <td className="tengah">{b.baris}</td>
            <td>{b.uraian}</td>
            <td>{b.jenis === 'JASA' ? 'Jasa' : 'Barang'}</td>
            <td className="angka">{angka(b.qty)}</td>
            <td>{b.satuan}</td>
            {harga && <td className="angka">{rupiah(b.harga)}</td>}
            {harga && <td className="angka">{rupiah(b.jumlah)}</td>}
          </tr>
        ))}
        kaki={
          harga && (
            <>
              <tr>
                <td colSpan={6}>Subtotal (DPP)</td>
                <td className="angka">{rupiah(d.subtotal)}</td>
              </tr>
              {Number(d.ppn) > 0 && (
                <tr>
                  <td colSpan={6}>PPN</td>
                  <td className="angka">{rupiah(d.ppn)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={6}>Total</td>
                <td className="angka">{rupiah(d.total)}</td>
              </tr>
            </>
          )
        }
      />
      {harga && <Terbilang nilai={d.total} />}
      {d.keterangan && <div className="cetak-catatan">Keterangan: {d.keterangan}</div>}
      <div className="cetak-catatan">
        Faktur wajib mencantumkan nomor PO ini dan dikirim ke Bagian Akuntansi. Barang atau jasa yang tidak sesuai pesanan dapat ditolak. Pembayaran dilakukan sesuai termin setelah penerimaan dan faktur lengkap.
      </div>
      <Persetujuan riwayat={d.persetujuan} />
      <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Dibuat, Staf Pembelian', d.dibuat_nama], ['Disetujui, Kepala Departemen'], ['Disetujui, Direktur (bila perlu)'], ['Diterima, pemasok']]} />
    </>
  );
}

function CetakPenerimaan({ d, opsi }) {
  const lpb = d.jenis === 'LPB';
  return (
    <>
      <Judul judul={lpb ? 'Laporan penerimaan barang' : 'Berita acara serah terima jasa'} nomor={d.nomor} />
      <InfoCetak
        butir={[
          ['Tanggal diterima', tanggal(d.tanggal, true)],
          ['Nomor PO', d.po_nomor],
          ['Pemasok', d.pemasok_nama],
          ['Nomor surat jalan', d.nomor_surat_jalan],
          ['Dicatat oleh', d.dibuat_nama],
          ['Keterangan', d.keterangan],
        ]}
      />
      <TabelUang
        kolom={[['No', 'tengah'], ['Uraian'], ['Dipesan', 'angka'], ['Diterima sebelumnya', 'angka'], ['Diterima sekarang', 'angka'], ['Satuan'], ['Catatan kondisi']]}
        baris={d.baris.map((b) => (
          <tr key={b.id}>
            <td className="tengah">{b.baris}</td>
            <td>{b.uraian}</td>
            <td className="angka">{angka(b.qty_po)}</td>
            <td className="angka">{angka(b.qty_sebelumnya)}</td>
            <td className="angka tebal">{angka(b.qty)}</td>
            <td>{b.satuan}</td>
            <td>{b.catatan || ''}</td>
          </tr>
        ))}
      />
      <div className="cetak-catatan">
        {lpb
          ? 'Barang di atas telah dihitung dan diperiksa kondisinya pada saat diterima. Kuantitas ini menjadi dasar pencocokan faktur pemasok.'
          : 'Pekerjaan di atas telah diperiksa dan diterima oleh pengguna jasa. Berita acara ini menjadi dasar pencocokan faktur pemasok.'}
      </div>
      <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Diserahkan, wakil pemasok'], [lpb ? 'Diterima, Staf Gudang' : 'Dicatat, Staf Gudang', d.dibuat_nama], [lpb ? 'Diketahui, Kepala Gudang' : 'Diterima, pengguna jasa']]} />
    </>
  );
}

function CetakPP({ d, opsi }) {
  return (
    <>
      <Judul judul="Permintaan pembayaran" nomor={d.nomor} />
      <InfoCetak
        butir={[
          ['Tanggal', tanggal(d.tanggal, true)],
          ['Tanggal dibutuhkan', tanggal(d.tanggal_dibutuhkan, true)],
          ['Pemohon', d.dibuat_nama],
          ['Departemen', d.departemen_nama],
          ['Dibayarkan kepada', d.penerima_nama],
          ['Rekening penerima', d.penerima_bank_rekening ? `${d.penerima_bank_nama} ${d.penerima_bank_rekening} a.n. ${d.penerima_bank_atas_nama}` : '-'],
          ['Dokumen pendukung', d.dokumen_pendukung],
          ['Keterangan', d.keterangan],
        ]}
      />
      <TabelUang
        kolom={[['No', 'tengah'], ['Uraian'], ['Akun'], ['Jumlah', 'angka']]}
        baris={d.baris.map((b) => (
          <tr key={b.id}>
            <td className="tengah">{b.baris}</td>
            <td>{b.uraian}</td>
            <td>
              {b.akun_kode} {b.akun_nama}
            </td>
            <td className="angka">{rupiah(b.jumlah)}</td>
          </tr>
        ))}
        kaki={
          <tr>
            <td colSpan={3}>Total</td>
            <td className="angka">{rupiah(d.total)}</td>
          </tr>
        }
      />
      <Terbilang nilai={d.total} />
      {d.bkk_nomor && <div className="cetak-catatan">Diproses melalui {d.bkk_nomor}{d.tanggal_bayar ? `, dibayar ${tanggal(d.tanggal_bayar, true)}` : ''}.</div>}
      <Persetujuan riwayat={d.persetujuan} />
      <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Pemohon', d.dibuat_nama], ['Disetujui, atasan'], ['Diterima, Akuntansi']]} />
    </>
  );
}

function CetakPUM({ d, opsi }) {
  return (
    <>
      <Judul judul="Permintaan uang muka kerja" nomor={d.nomor} />
      <InfoCetak
        butir={[
          ['Tanggal', tanggal(d.tanggal, true)],
          ['Pemohon', d.dibuat_nama],
          ['Departemen', d.departemen_nama],
          ['Kegiatan selesai', tanggal(d.tanggal_selesai_kegiatan, true)],
          ['Tenggat pertanggungjawaban', tanggal(d.tanggal_batas_pj, true)],
          ['Bukti kas keluar', d.bkk_nomor],
        ]}
      />
      <InfoCetak satu butir={[['Keperluan', d.keperluan]]} />
      <TabelUang kolom={[['Uraian'], ['Jumlah', 'angka']]} baris={<tr><td>Uang muka kerja</td><td className="angka tebal">{rupiah(d.jumlah)}</td></tr>} />
      <Terbilang nilai={d.jumlah} />
      <div className="cetak-catatan">
        Saya bersedia mempertanggungjawabkan uang muka ini dengan bukti yang sah paling lambat {tanggal(d.tanggal_batas_pj, true)}. Selama pertanggungjawaban lewat tenggat, saya tidak dapat mengajukan uang muka baru, dan sisa yang tidak dapat dipertanggungjawabkan diselesaikan sesuai kebijakan perusahaan.
      </div>
      <Persetujuan riwayat={d.persetujuan} />
      <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Pemohon', d.dibuat_nama], ['Disetujui, atasan'], ['Diterima, penerima uang', d.dibuat_nama]]} />
    </>
  );
}

function CetakPJUM({ d, opsi }) {
  const selisih = Number(d.selisih);
  return (
    <>
      <Judul judul="Pertanggungjawaban uang muka kerja" nomor={d.nomor} />
      <InfoCetak
        butir={[
          ['Tanggal', tanggal(d.tanggal, true)],
          ['Nomor uang muka', d.uang_muka_nomor],
          ['Pemohon', d.dibuat_nama],
          ['Departemen', d.departemen_nama],
          ['Keperluan', d.keperluan],
          ['Jumlah uang muka', rupiah(d.jumlah_uang_muka)],
        ]}
      />
      <TabelUang
        kolom={[['No', 'tengah'], ['Tanggal'], ['Uraian'], ['Akun'], ['No. bukti'], ['Jumlah', 'angka']]}
        baris={d.baris.map((b) => (
          <tr key={b.id}>
            <td className="tengah">{b.baris}</td>
            <td className="nowrap">{tanggal(b.tanggal)}</td>
            <td>{b.uraian}</td>
            <td>
              {b.akun_kode} {b.akun_nama}
            </td>
            <td>{b.nomor_bukti || ''}</td>
            <td className="angka">{rupiah(b.jumlah)}</td>
          </tr>
        ))}
        kaki={
          <>
            <tr>
              <td colSpan={5}>Total realisasi</td>
              <td className="angka">{rupiah(d.total_realisasi)}</td>
            </tr>
            <tr>
              <td colSpan={5}>Uang muka diterima</td>
              <td className="angka">{rupiah(d.jumlah_uang_muka)}</td>
            </tr>
            <tr>
              <td colSpan={5}>{selisih > 0 ? 'Sisa yang dikembalikan ke kas perusahaan' : selisih < 0 ? 'Kekurangan yang dibayar perusahaan' : 'Selisih'}</td>
              <td className="angka">{rupiah(Math.abs(selisih))}</td>
            </tr>
          </>
        }
      />
      <Terbilang nilai={d.total_realisasi} />
      {d.bkm_nomor && <div className="cetak-catatan">Sisa disetor melalui {d.bkm_nomor}.</div>}
      {d.bkk_nomor && <div className="cetak-catatan">Kekurangan dibayar melalui {d.bkk_nomor}.</div>}
      <Persetujuan riwayat={d.persetujuan} />
      <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Pemohon', d.dibuat_nama], ['Disetujui, atasan'], ['Diverifikasi, Akuntansi']]} />
    </>
  );
}

function CetakPKK({ d, opsi }) {
  const bukti = opsi.versi === 'bukti';
  return (
    <>
      <Judul judul={bukti ? 'Bukti pengeluaran kas kecil' : 'Permintaan pengeluaran kas kecil'} nomor={d.nomor} />
      <InfoCetak
        butir={[
          ['Tanggal', tanggal(d.tanggal, true)],
          ['Dana kas kecil', d.dana_nama],
          ['Pemohon', d.dibuat_nama],
          ['Departemen', d.departemen_nama],
          ['Akun', `${d.akun_kode} ${d.akun_nama}`],
          ['Pemegang dana', d.pemegang_nama],
        ]}
      />
      <InfoCetak satu butir={[['Keperluan', d.keperluan]]} />
      <TabelUang kolom={[['Uraian'], ['Jumlah', 'angka']]} baris={<tr><td>{d.keperluan}</td><td className="angka tebal">{rupiah(d.jumlah)}</td></tr>} />
      <Terbilang nilai={d.jumlah} />
      {bukti && (
        <InfoCetak
          butir={[
            ['Tanggal dibayar', tanggal(d.tanggal_bayar, true)],
            ['Nomor nota atau kuitansi', d.nomor_bukti],
            ['Diganti melalui', d.pengisian_nomor],
          ]}
        />
      )}
      <Persetujuan riwayat={d.persetujuan} />
      <TandaTangan
        kota={opsi.kota}
        tgl={bukti ? d.tanggal_bayar : d.tanggal}
        kolom={bukti ? [['Dibayar, pemegang kas kecil', d.pemegang_nama], ['Diterima, penerima uang', d.dibuat_nama]] : [['Pemohon', d.dibuat_nama], ['Disetujui, atasan']]}
      />
    </>
  );
}

function CetakPDK({ d, opsi }) {
  return (
    <>
      <Judul judul="Permintaan pengisian kembali kas kecil" nomor={d.nomor} />
      <InfoCetak
        butir={[
          ['Tanggal', tanggal(d.tanggal, true)],
          ['Dana kas kecil', d.dana_nama],
          ['Pemegang dana', d.dibuat_nama],
          ['Dana tetap', rupiah(d.jumlah_dana)],
          ['Bukti kas keluar', d.bkk_nomor],
          ['Keterangan', d.keterangan],
        ]}
      />
      <TabelUang
        kolom={[['No', 'tengah'], ['Nomor'], ['Dibayar'], ['Keperluan'], ['Akun'], ['Nota'], ['Jumlah', 'angka']]}
        baris={d.bukti.map((b, i) => (
          <tr key={b.id}>
            <td className="tengah">{i + 1}</td>
            <td className="nowrap">{b.nomor}</td>
            <td className="nowrap">{tanggal(b.tanggal_bayar)}</td>
            <td>{b.keperluan}</td>
            <td>{b.akun_kode}</td>
            <td>{b.nomor_bukti}</td>
            <td className="angka">{rupiah(b.jumlah)}</td>
          </tr>
        ))}
        kaki={
          <tr>
            <td colSpan={6}>Total pengisian</td>
            <td className="angka">{rupiah(d.total)}</td>
          </tr>
        }
      />
      <div className="cetak-bagian">Rekap per akun</div>
      <TabelUang
        kolom={[['Akun'], ['Departemen'], ['Bukti', 'angka'], ['Jumlah', 'angka']]}
        baris={d.rekap.map((r) => (
          <tr key={`${r.akun_id}-${r.departemen_id}`}>
            <td>
              {r.akun_kode} {r.akun_nama}
            </td>
            <td>{r.departemen_nama}</td>
            <td className="angka">{r.jumlah_bukti}</td>
            <td className="angka">{rupiah(r.jumlah)}</td>
          </tr>
        ))}
      />
      <Terbilang nilai={d.total} />
      <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Diajukan, pemegang kas kecil', d.dibuat_nama], ['Diperiksa, Akuntansi']]} />
    </>
  );
}

function CetakOpname({ d, opsi }) {
  const baris = d.rincian?.baris || [];
  const selisih = Number(d.selisih);
  return (
    <>
      <Judul judul="Berita acara opname kas kecil" nomor={d.nomor} />
      <p style={{ fontSize: '9.5pt' }}>
        Pada {waktu(d.waktu_opname)} telah dilakukan penghitungan fisik uang tunai {d.dana_nama} yang dipegang oleh {d.pemegang_nama}, disaksikan kedua pihak yang bertanda tangan di bawah ini, dengan hasil sebagai berikut.
      </p>
      <TabelUang
        kolom={[['Pecahan'], ['Lembar/keping', 'angka'], ['Nilai', 'angka']]}
        baris={baris.map((b) => (
          <tr key={`${b.jenis}${b.nilai}`}>
            <td>
              {b.jenis === 'kertas' ? 'Uang kertas' : 'Uang logam'} {rupiah(b.nilai)}
            </td>
            <td className="angka">{angka(b.lembar)}</td>
            <td className="angka">{rupiah(b.jumlah)}</td>
          </tr>
        ))}
        kaki={
          <tr>
            <td colSpan={2}>Jumlah uang tunai fisik</td>
            <td className="angka">{rupiah(d.total_fisik)}</td>
          </tr>
        }
      />
      <div className="cetak-bagian">Perhitungan</div>
      <table className="cetak-tabel">
        <tbody>
          <tr>
            <td>Dana tetap</td>
            <td className="angka">{rupiah(d.jumlah_dana)}</td>
          </tr>
          <tr>
            <td>Dikurangi bukti pengeluaran yang belum diganti</td>
            <td className="angka">({rupiah(d.bukti_belum_diganti)})</td>
          </tr>
          <tr>
            <td className="tebal">Saldo tunai seharusnya</td>
            <td className="angka tebal">{rupiah(d.saldo_seharusnya)}</td>
          </tr>
          <tr>
            <td>Uang tunai fisik</td>
            <td className="angka">{rupiah(d.total_fisik)}</td>
          </tr>
          <tr>
            <td className="tebal">{selisih < 0 ? 'Selisih kurang' : selisih > 0 ? 'Selisih lebih' : 'Selisih'}</td>
            <td className="angka tebal">{rupiah(selisih)}</td>
          </tr>
        </tbody>
      </table>
      {d.keterangan && <div className="cetak-catatan">Keterangan: {d.keterangan}</div>}
      <TandaTangan kota={opsi.kota} tgl={String(d.waktu_opname).slice(0, 10)} kolom={[[`Pemeriksa${d.dibuat_jabatan ? `, ${d.dibuat_jabatan}` : ''}`, d.dibuat_nama], ['Pemegang kas kecil', d.pemegang_nama]]} />
    </>
  );
}

function CetakBKK({ d }) {
  const bayar = d.pembayaran.find((p) => p.status === 'DIBAYAR');
  const putaran = Math.max(0, ...(d.persetujuan || []).map((p) => p.putaran));
  const langkah = (d.persetujuan || []).filter((p) => p.putaran === putaran);
  const nama = (peran) => langkah.find((p) => p.peran_kode === peran && p.status === 'DISETUJUI')?.diputuskan_nama;
  const perluDirektur = langkah.some((p) => p.peran_kode === 'DIREKTUR');
  return (
    <>
      <Judul judul="Bukti kas keluar" nomor={d.nomor} sub={JENIS_BKK[d.jenis]} />
      <InfoCetak
        butir={[
          ['Tanggal', tanggal(d.tanggal, true)],
          ['Dokumen sumber', d.sumber_nomor || 'Faktur pemasok (rincian di bawah)'],
          ['Dibayarkan kepada', d.penerima_nama],
          ['Rekening penerima', d.penerima_bank_rekening ? `${d.penerima_bank_nama} ${d.penerima_bank_rekening} a.n. ${d.penerima_bank_atas_nama}` : '-'],
          ['Rekening sumber', `${d.rekening_nama} (${d.rekening_nomor})`],
          ['Metode bayar', METODE[d.metode_bayar]],
          ['Rencana tanggal bayar', tanggal(d.tanggal_rencana_bayar, true)],
          ['Keterangan', d.keterangan],
        ]}
      />
      <div className="cetak-bagian">Rincian dan distribusi akun</div>
      <TabelUang
        kolom={[['Uraian'], ['Akun'], ['Dept'], ['Debit', 'angka'], ['Kredit', 'angka']]}
        baris={
          <>
            {d.baris.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.uraian}
                  {b.tanggal_jatuh_tempo ? ` (jatuh tempo ${tanggal(b.tanggal_jatuh_tempo)})` : ''}
                </td>
                <td>
                  {b.akun_kode} {b.akun_nama}
                </td>
                <td>{b.departemen_nama || ''}</td>
                <td className="angka">{rupiah(b.jumlah)}</td>
                <td />
              </tr>
            ))}
            {d.potongan.map((p) => (
              <tr key={`p${p.id}`}>
                <td>
                  {p.uraian} ({angka(p.tarif)}% x {rupiah(p.dasar)})
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
              <td>Pembayaran</td>
              <td>
                {d.rekening_akun?.kode} {d.rekening_akun?.nama}
              </td>
              <td />
              <td />
              <td className="angka">{rupiah(d.jumlah_bayar)}</td>
            </tr>
          </>
        }
        kaki={
          <tr>
            <td colSpan={3}>Jumlah</td>
            <td className="angka">{rupiah(d.jumlah_bruto)}</td>
            <td className="angka">{rupiah(Number(d.jumlah_potongan) + Number(d.jumlah_bayar))}</td>
          </tr>
        }
      />
      <table className="cetak-tabel tanpa-garis" style={{ width: '55%', marginLeft: 'auto' }}>
        <tbody>
          <tr>
            <td>Jumlah bruto</td>
            <td className="angka">{rupiah(d.jumlah_bruto)}</td>
          </tr>
          <tr>
            <td>Potongan pajak</td>
            <td className="angka">({rupiah(d.jumlah_potongan)})</td>
          </tr>
          <tr>
            <td className="tebal">Jumlah dibayar</td>
            <td className="angka tebal">{rupiah(d.jumlah_bayar)}</td>
          </tr>
        </tbody>
      </table>
      <Terbilang nilai={d.jumlah_bayar} />
      <InfoCetak
        butir={[
          ['Tanggal dibayar', bayar ? tanggal(bayar.tanggal, true) : ''],
          ['Nomor cek, BG, atau referensi', bayar ? bayar.nomor_warkat || bayar.nomor_referensi : ''],
        ]}
      />
      <Persetujuan riwayat={d.persetujuan} />
      <TandaTangan
        kolom={[
          ['Dibuat, Akuntansi', d.dibuat_nama],
          ['Diperiksa, Ka. Bag. Akuntansi', nama('SPV_AKUNTANSI')],
          ['Disetujui, Manajer Keuangan', nama('MANAJER_KEUANGAN')],
          ['Disetujui, Direktur', nama('DIREKTUR') || (perluDirektur ? '' : 'Tidak diperlukan')],
          ['Dibayar, Kasir', bayar?.dibayar_nama],
          ['Diterima, penerima'],
        ]}
      />
    </>
  );
}

function CetakBYR({ d, opsi }) {
  const transfer = d.metode === 'TRANSFER';
  const judul = transfer ? 'Instruksi transfer' : d.metode === 'CEK' ? 'Tanda terima cek' : 'Tanda terima bilyet giro';
  return (
    <>
      <Judul judul={judul} nomor={d.nomor} />
      {transfer ? (
        <>
          <InfoCetak
            butir={[
              ['Tanggal', tanggal(d.tanggal, true)],
              ['Bukti kas keluar', d.bkk_nomor],
              ['Dari rekening', `${d.rekening_nama}, ${d.rekening_bank} ${d.rekening_nomor}`],
              ['Nomor referensi', d.nomor_referensi],
            ]}
          />
          <div className="cetak-bagian">Rekening tujuan</div>
          <InfoCetak
            butir={[
              ['Bank', d.penerima_bank_nama],
              ['Nomor rekening', d.penerima_bank_rekening],
              ['Atas nama', d.penerima_bank_atas_nama],
              ['Penerima', d.penerima_nama],
            ]}
          />
          <TabelUang kolom={[['Untuk pembayaran'], ['Jumlah', 'angka']]} baris={<tr><td>{d.bkk_keterangan}</td><td className="angka tebal">{rupiah(d.jumlah)}</td></tr>} />
          <Terbilang nilai={d.jumlah} />
          <div className="cetak-catatan">Rekening tujuan wajib sama persis dengan rekening pemasok yang sudah diverifikasi di SIAPKas. Lampirkan bukti transaksi internet banking pada dokumen ini.</div>
          <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Disiapkan, Kasir', d.dibayar_nama], ['Dieksekusi, pemegang otorisasi bank'], ['Diperiksa, Ka. Bag. Akuntansi']]} />
        </>
      ) : (
        <>
          <p style={{ fontSize: '10pt' }}>Telah terima dari {opsi.perusahaan}:</p>
          <InfoCetak
            butir={[
              ['Jenis warkat', METODE[d.metode]],
              ['Nomor', d.nomor_warkat],
              ['Bank dan rekening', `${d.rekening_bank} ${d.rekening_nomor}`],
              ['Tanggal', tanggal(d.tanggal, true)],
              d.metode === 'BG' && ['Tanggal efektif', tanggal(d.tanggal_jatuh_tempo_bg, true)],
              ['Bukti kas keluar', d.bkk_nomor],
            ]}
          />
          <TabelUang kolom={[['Untuk pembayaran'], ['Jumlah', 'angka']]} baris={<tr><td>{d.bkk_keterangan}</td><td className="angka tebal">{rupiah(d.jumlah)}</td></tr>} />
          <Terbilang nilai={d.jumlah} />
          <div className="cetak-catatan">Penerima wajib menunjukkan identitas dan surat kuasa bila mewakili perusahaan pemasok. Warkat yang hilang harus segera dilaporkan agar dapat diblokir.</div>
          <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Diserahkan, Kasir', d.dibayar_nama], [`Diterima, ${d.penerima_nama}`, 'Nama dan nomor identitas']]} />
        </>
      )}
    </>
  );
}

const SUMBER_BKM = { PENGEMBALIAN_UANG_MUKA: 'Pengembalian sisa uang muka', PENGEMBALIAN_KAS_KECIL: 'Pengembalian dana kas kecil', LAINNYA: 'Penerimaan lain' };

function CetakBKM({ d, opsi }) {
  return (
    <>
      <Judul judul="Bukti kas masuk" nomor={d.nomor} />
      <InfoCetak
        butir={[
          ['Tanggal', tanggal(d.tanggal, true)],
          ['Rekening penerima', d.rekening_nama],
          ['Sumber', SUMBER_BKM[d.sumber]],
          ['Diterima dari', d.diterima_dari],
          ['Akun lawan', `${d.akun_lawan_kode} ${d.akun_lawan_nama}`],
          ['Jurnal', d.jurnal_nomor],
        ]}
      />
      <TabelUang kolom={[['Keterangan'], ['Jumlah', 'angka']]} baris={<tr><td>{d.keterangan}</td><td className="angka tebal">{rupiah(d.jumlah)}</td></tr>} />
      <Terbilang nilai={d.jumlah} />
      <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Diterima, Kasir', d.dibuat_nama], ['Disetor oleh', d.diterima_dari]]} />
    </>
  );
}

function CetakJM({ d, opsi }) {
  const debit = jumlahkan(d.baris, (b) => b.debit);
  const kredit = jumlahkan(d.baris, (b) => b.kredit);
  return (
    <>
      <Judul judul="Bukti memorial" nomor={d.nomor} sub={{ UMUM: 'Jurnal umum', PENYESUAIAN: 'Jurnal penyesuaian', SALDO_AWAL: 'Jurnal saldo awal' }[d.jenis]} />
      <InfoCetak butir={[['Tanggal', tanggal(d.tanggal, true)], ['Jurnal', d.jurnal_nomor], ['Keterangan', d.keterangan]]} />
      <TabelUang
        kolom={[['Akun'], ['Dept'], ['Pemasok'], ['Keterangan'], ['Debit', 'angka'], ['Kredit', 'angka']]}
        baris={d.baris.map((b) => (
          <tr key={b.id}>
            <td>
              {b.akun_kode} {b.akun_nama}
            </td>
            <td>{b.departemen_nama || ''}</td>
            <td>{b.pemasok_nama || ''}</td>
            <td>{b.keterangan || ''}</td>
            <td className="angka">{Number(b.debit) ? rupiah(b.debit) : ''}</td>
            <td className="angka">{Number(b.kredit) ? rupiah(b.kredit) : ''}</td>
          </tr>
        ))}
        kaki={
          <tr>
            <td colSpan={4}>Jumlah</td>
            <td className="angka">{rupiah(debit)}</td>
            <td className="angka">{rupiah(kredit)}</td>
          </tr>
        }
      />
      <Terbilang nilai={debit} />
      <Persetujuan riwayat={d.persetujuan} />
      <TandaTangan kota={opsi.kota} tgl={d.tanggal} kolom={[['Dibuat', d.dibuat_nama], ['Disetujui, Manajer Keuangan', (d.persetujuan || []).find((p) => p.status === 'DISETUJUI')?.diputuskan_nama]]} />
    </>
  );
}

function CetakRB({ d, opsi }) {
  const pos = (sisi, arah) => (d.item || []).filter((i) => i.sisi === sisi && JENIS_POS[i.jenis].arah === arah);
  const Baris = ({ label, nilai, kurang, tebal }) => (
    <tr className={tebal ? 'tebal' : ''}>
      <td style={{ paddingLeft: tebal ? 5 : 16 }}>{label}</td>
      <td className="angka">{kurang ? `(${rupiah(nilai)})` : rupiah(nilai)}</td>
    </tr>
  );
  return (
    <>
      <Judul judul="Laporan rekonsiliasi bank" nomor={d.nomor} sub={`${d.rekening_nama} (${d.nomor_rekening}) · ${namaBulan(d.bulan)} ${d.tahun}`} />
      <div className="cetak-bagian">Saldo menurut bank</div>
      <table className="cetak-tabel">
        <tbody>
          <Baris label={`Saldo rekening koran per ${tanggal(d.tanggal_akhir, true)}`} nilai={d.saldo_rekening_koran} tebal />
          {pos('BANK', 1).map((i) => (
            <Baris key={i.id} label={`Ditambah ${i.jenis_label.toLowerCase()}: ${i.keterangan}`} nilai={i.jumlah} />
          ))}
          {(d.beredar || []).map((b) => (
            <Baris key={`b${b.pembayaran_id}`} label={`Dikurangi ${METODE[b.metode].toLowerCase()} beredar ${b.nomor_warkat}, ${tanggal(b.tanggal)}, ${b.penerima_nama}`} nilai={b.jumlah} kurang />
          ))}
          {pos('BANK', -1).map((i) => (
            <Baris key={i.id} label={`Dikurangi ${i.jenis_label.toLowerCase()}: ${i.keterangan}`} nilai={i.jumlah} kurang />
          ))}
          <Baris label="Saldo bank disesuaikan" nilai={d.saldo_bank_disesuaikan} tebal />
        </tbody>
      </table>
      <div className="cetak-bagian">Saldo menurut buku</div>
      <table className="cetak-tabel">
        <tbody>
          <Baris label={`Saldo buku besar per ${tanggal(d.tanggal_akhir, true)}`} nilai={d.saldo_buku} tebal />
          {pos('BUKU', 1).map((i) => (
            <Baris key={i.id} label={`Ditambah ${i.jenis_label.toLowerCase()}: ${i.keterangan}`} nilai={i.jumlah} />
          ))}
          {pos('BUKU', -1).map((i) => (
            <Baris key={i.id} label={`Dikurangi ${i.jenis_label.toLowerCase()}: ${i.keterangan}`} nilai={i.jumlah} kurang />
          ))}
          <Baris label="Saldo buku disesuaikan" nilai={d.saldo_buku_disesuaikan} tebal />
        </tbody>
      </table>
      <InfoCetak
        butir={[
          ['Selisih', Number(d.selisih) === 0 ? 'Nihil (seimbang)' : rupiah(d.selisih)],
          ['Jurnal penyesuaian', d.jurnal_nomor],
          ['Difinalkan', d.difinalkan_pada ? `${d.difinalkan_nama}, ${waktu(d.difinalkan_pada)}` : 'Belum final'],
        ]}
      />
      <TandaTangan kota={opsi.kota} tgl={d.difinalkan_pada ? String(d.difinalkan_pada).slice(0, 10) : null} kolom={[['Dibuat, Ka. Bag. Akuntansi', d.dibuat_nama], ['Diketahui, Manajer Keuangan']]} />
    </>
  );
}

const TEMPLAT = {
  PO: CetakPO,
  LPB: CetakPenerimaan,
  BAST: CetakPenerimaan,
  PP: CetakPP,
  PUM: CetakPUM,
  PJUM: CetakPJUM,
  PKK: CetakPKK,
  PDK: CetakPDK,
  OPN: CetakOpname,
  BKK: CetakBKK,
  BYR: CetakBYR,
  BKM: CetakBKM,
  JM: CetakJM,
  RB: CetakRB,
};

// ---------------------------------------------------------------- halaman cetak

function tandaDari(cetakKe) {
  return cetakKe === 1 ? 'ASLI' : `SALINAN KE-${cetakKe - 1}`;
}

export function HalamanCetak() {
  const { jenis, id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { perusahaan, pengguna } = useAuth();
  const url = SUMBER_DATA[jenis]?.(id);
  const q = useApi(url || null);
  const [cetakan, setCetakan] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    document.title = `Cetak ${jenis} | SIAPKas`;
  }, [jenis]);

  if (!url || !TEMPLAT[jenis]) return <Pesan jenis="galat">Jenis dokumen ini tidak memiliki formulir cetak.</Pesan>;

  const cetak = async () => {
    setSibuk(true);
    try {
      const r = await api.post(`/cetak/${jenis}/${id}`);
      flushSync(() => setCetakan(r));
      window.print();
    } catch (e) {
      toast.galat(e.message);
    } finally {
      setCetakan(null);
      setSibuk(false);
      qc.invalidateQueries({ queryKey: [url] });
    }
  };

  return (
    <div className="cetak-latar">
      <Muat kueri={q}>
        {(d) => {
          const Templat = TEMPLAT[jenis];
          const versiPKK = params.get('versi') || (['DIBAYAR', 'DIGANTI'].includes(d.status) ? 'bukti' : 'permintaan');
          const opsi = { tanpaHarga: params.get('tanpa_harga') === '1', versi: versiPKK, kota: perusahaan.perusahaan_kota, perusahaan: perusahaan.perusahaan_nama };
          const draf = STATUS_DRAF.includes(d.status) || (['OPN', 'RB'].includes(jenis) && d.status === 'DRAFT');
          const batal = d.status === 'BATAL';
          const lunas = LUNAS[jenis]?.includes(d.status);
          const berikut = (d.jumlah_cetak || 0) + 1;
          const tanda = cetakan ? tandaDari(cetakan.cetak_ke) : 'PRATINJAU';
          return (
            <>
              <div className="cetak-alat">
                <div className="kiri">
                  <Tombol ikon="kembali" onClick={() => navigate(-1)}>
                    Kembali
                  </Tombol>
                  {jenis === 'PO' && (
                    <Tombol onClick={() => setParams(opsi.tanpaHarga ? {} : { tanpa_harga: '1' }, { replace: true })}>{opsi.tanpaHarga ? 'Tampilkan harga' : 'Sembunyikan harga'}</Tombol>
                  )}
                  {jenis === 'PKK' && (
                    <div className="tombol-grup" role="group" aria-label="Versi formulir">
                      <button type="button" className={versiPKK === 'permintaan' ? 'aktif' : ''} onClick={() => setParams({ versi: 'permintaan' }, { replace: true })}>
                        Permintaan
                      </button>
                      <button type="button" className={versiPKK === 'bukti' ? 'aktif' : ''} onClick={() => setParams({ versi: 'bukti' }, { replace: true })} disabled={!['DIBAYAR', 'DIGANTI'].includes(d.status)}>
                        Bukti pengeluaran
                      </button>
                    </div>
                  )}
                </div>
                <div className="kanan">
                  <span className="catatan">
                    {d.jumlah_cetak ? `Sudah dicetak ${d.jumlah_cetak} kali. ` : 'Belum pernah dicetak. '}
                    Cetakan berikutnya bertanda {tandaDari(berikut)}.
                  </span>
                  <Tombol varian="utama" ikon="cetak" onClick={cetak} sibuk={sibuk}>
                    Cetak formulir
                  </Tombol>
                </div>
              </div>
              <div className="halaman-a4">
                {(draf || batal) && (
                  <div className={`cap-air ${batal ? '' : 'draf'}`} aria-hidden="true">
                    <span>{batal ? 'BATAL' : 'DRAF'}</span>
                  </div>
                )}
                {lunas && !batal && (
                  <div className="cap-lunas-cetak">
                    LUNAS
                    <small>{d.tanggal_bayar ? tanggal(d.tanggal_bayar) : ''}</small>
                  </div>
                )}
                <Kop tanda={tanda} subTanda={cetakan ? `cetakan ke-${cetakan.cetak_ke}` : `berikutnya ${tandaDari(berikut).toLowerCase()}`} pratinjau={!cetakan} />
                <Templat d={d} opsi={opsi} />
                <div className="cetak-kaki">
                  <span>
                    Dicetak oleh {cetakan?.dicetak_oleh || pengguna.nama_lengkap} pada {cetakan ? waktu(cetakan.waktu) : 'pratinjau'} dari SIAPKas.
                  </span>
                  <span>
                    {d.nomor} · {tanda}
                  </span>
                </div>
              </div>
            </>
          );
        }}
      </Muat>
    </div>
  );
}

