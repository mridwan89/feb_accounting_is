// Rekonsiliasi bank bulanan: saldo rekening koran vs saldo buku, warkat beredar otomatis, pos penyesuaian, dan finalisasi.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { METODE } from '../konstanta.js';
import { hariIni, namaBulan, rupiah, tanggal, waktu } from '../format.js';
import { useAksi, useApi, usePilihanAkun, useRekening } from '../components/data.js';
import { TombolCetak } from '../components/Dokumen.jsx';
import { PanelLampiran } from '../components/Lampiran.jsx';
import { BarisKosong, InputUang, Kartu, Kepala, Kolom, Kombo, Masukan, Modal, Muat, Pesan, Pilihan, Status, Tombol, useFormulir, useKonfirmasi } from '../components/ui.jsx';

export const JENIS_POS = {
  SETORAN_DALAM_PERJALANAN: { sisi: 'BANK', arah: 1, label: 'Setoran dalam perjalanan' },
  KOREKSI_BANK_TAMBAH: { sisi: 'BANK', arah: 1, label: 'Koreksi bank (menambah)' },
  KOREKSI_BANK_KURANG: { sisi: 'BANK', arah: -1, label: 'Koreksi bank (mengurangi)' },
  BIAYA_BANK: { sisi: 'BUKU', arah: -1, label: 'Biaya administrasi bank', otomatis: true },
  JASA_GIRO: { sisi: 'BUKU', arah: 1, label: 'Jasa giro', otomatis: true },
  PAJAK_JASA_GIRO: { sisi: 'BUKU', arah: -1, label: 'Pajak atas jasa giro', otomatis: true },
  KOREKSI_BUKU_TAMBAH: { sisi: 'BUKU', arah: 1, label: 'Koreksi buku (menambah)' },
  KOREKSI_BUKU_KURANG: { sisi: 'BUKU', arah: -1, label: 'Koreksi buku (mengurangi)' },
};

const periodeLalu = () => {
  const [t, b] = hariIni().split('-').map(Number);
  return b === 1 ? { tahun: t - 1, bulan: 12 } : { tahun: t, bulan: b - 1 };
};

function FormRekonsiliasi({ onTutup }) {
  const navigate = useNavigate();
  const rekening = useRekening();
  const lalu = periodeLalu();
  const f = useFormulir({ rekening_kas_id: '', tahun: lalu.tahun, bulan: lalu.bulan, saldo_rekening_koran: '' });
  const { jalankan, sibuk } = useAksi();
  const simpan = async () => {
    const r = await jalankan(() => api.post('/rekonsiliasi', f.nilai), { setGalat: f.setGalat, sukses: (h) => `Rekonsiliasi ${h.nomor} dibuat.` });
    if (r.ok) navigate(`/rekonsiliasi/${r.hasil.id}`);
  };
  return (
    <Modal
      judul="Buat rekonsiliasi bank"
      onTutup={onTutup}
      kaki={
        <>
          <Tombol onClick={onTutup}>Batal</Tombol>
          <Tombol varian="utama" onClick={simpan} sibuk={sibuk}>
            Buat rekonsiliasi
          </Tombol>
        </>
      }
    >
      <div className="formulir">
        <Kolom label="Rekening" galat={f.galat.rekening_kas_id} lebar={12}>
          <Pilihan pilihan={(rekening.data || []).filter((r) => r.aktif).map((r) => [r.id, `${r.nama} (${r.nomor_rekening})`])} kosong="Pilih rekening" {...f.ikat('rekening_kas_id')} salah={!!f.galat.rekening_kas_id} />
        </Kolom>
        <Kolom label="Bulan" lebar={6}>
          <Pilihan pilihan={Array.from({ length: 12 }, (_, i) => [i + 1, namaBulan(i + 1)])} {...f.ikat('bulan')} />
        </Kolom>
        <Kolom label="Tahun" lebar={6}>
          <Masukan type="number" {...f.ikat('tahun')} />
        </Kolom>
        <Kolom label="Saldo akhir menurut rekening koran (Rp)" galat={f.galat.saldo_rekening_koran} lebar={12}>
          <InputUang value={f.nilai.saldo_rekening_koran} onChange={(x) => f.atur('saldo_rekening_koran', x)} salah={!!f.galat.saldo_rekening_koran} />
        </Kolom>
      </div>
    </Modal>
  );
}

export function DaftarRekonsiliasi() {
  const { punya } = useAuth();
  const navigate = useNavigate();
  const q = useApi('/rekonsiliasi');
  const [form, setForm] = useState(false);
  return (
    <>
      <Kepala
        judul="Rekonsiliasi bank"
        sub="Disusun Kepala Subbagian Keuangan, bukan Kasir, sehingga pencatat pembayaran tidak mencocokkan pekerjaannya sendiri."
        aksi={punya('KASUBAG_KEUANGAN') && <Tombol varian="utama" ikon="tambah" onClick={() => setForm(true)}>Buat rekonsiliasi</Tombol>}
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Periode</th>
                    <th>Rekening</th>
                    <th className="angka">Saldo rekening koran</th>
                    <th className="angka">Saldo disesuaikan</th>
                    <th>Disusun oleh</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && <BarisKosong kolom={7} judul="Belum ada rekonsiliasi" />}
                  {data.map((r) => (
                    <tr key={r.id} className="klik" onClick={() => navigate(`/rekonsiliasi/${r.id}`)}>
                      <td className="nomor">{r.nomor}</td>
                      <td>
                        {namaBulan(r.bulan)} {r.tahun}
                      </td>
                      <td>{r.rekening_nama}</td>
                      <td className="angka">{rupiah(r.saldo_rekening_koran)}</td>
                      <td className="angka">{r.status === 'FINAL' ? rupiah(r.saldo_bank_disesuaikan) : '-'}</td>
                      <td>
                        {r.dibuat_nama}
                        {r.difinalkan_nama && <div className="kecil sangat-lemah">Final oleh {r.difinalkan_nama}</div>}
                      </td>
                      <td>
                        <Status kode={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kartu>
        )}
      </Muat>
      {form && <FormRekonsiliasi onTutup={() => setForm(false)} />}
    </>
  );
}

export function Pernyataan({ r }) {
  const pos = (sisi, arah) => (r.item || []).filter((i) => i.sisi === sisi && (JENIS_POS[i.jenis]?.arah ?? i.arah) === arah);
  const Baris = ({ label, nilai, tebal, kurang }) => (
    <tr className={tebal ? 'tebal' : ''}>
      <td style={{ paddingLeft: tebal ? 10 : 24 }}>{label}</td>
      <td className="angka">{kurang ? `(${rupiah(nilai)})` : rupiah(nilai)}</td>
    </tr>
  );
  const selisih = Number(r.selisih);
  return (
    <div className="grid-2">
      <Kartu judul="Sisi bank" rapat>
        <table className="tabel">
          <tbody>
            <Baris label="Saldo menurut rekening koran" nilai={r.saldo_rekening_koran} tebal />
            {pos('BANK', 1).map((i) => (
              <Baris key={i.id} label={`Ditambah: ${i.jenis_label}, ${i.keterangan}`} nilai={i.jumlah} />
            ))}
            {(r.beredar || []).map((b) => (
              <Baris key={`b${b.pembayaran_id}`} label={`Dikurangi: ${METODE[b.metode]} ${b.nomor_warkat} beredar (${b.penerima_nama})`} nilai={b.jumlah} kurang />
            ))}
            {pos('BANK', -1).map((i) => (
              <Baris key={i.id} label={`Dikurangi: ${i.jenis_label}, ${i.keterangan}`} nilai={i.jumlah} kurang />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Saldo bank disesuaikan</td>
              <td className="angka">{rupiah(r.saldo_bank_disesuaikan)}</td>
            </tr>
          </tfoot>
        </table>
      </Kartu>
      <Kartu judul="Sisi buku" rapat>
        <table className="tabel">
          <tbody>
            <Baris label="Saldo menurut buku besar" nilai={r.saldo_buku} tebal />
            {pos('BUKU', 1).map((i) => (
              <Baris key={i.id} label={`Ditambah: ${i.jenis_label}, ${i.keterangan}`} nilai={i.jumlah} />
            ))}
            {pos('BUKU', -1).map((i) => (
              <Baris key={i.id} label={`Dikurangi: ${i.jenis_label}, ${i.keterangan}`} nilai={i.jumlah} kurang />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Saldo buku disesuaikan</td>
              <td className="angka">{rupiah(r.saldo_buku_disesuaikan)}</td>
            </tr>
            <tr>
              <td>Selisih</td>
              <td className={`angka ${selisih === 0 ? 'teks-sukses' : 'teks-bahaya'}`}>{selisih === 0 ? 'Seimbang' : rupiah(selisih)}</td>
            </tr>
          </tfoot>
        </table>
      </Kartu>
    </div>
  );
}

function TabelKliring({ r, boleh }) {
  const { jalankan } = useAksi();
  const awal = `${r.tahun}-${String(r.bulan).padStart(2, '0')}-01`;
  const simpan = (p, tgl) => jalankan(() => api.post(`/pembayaran/${p.id}/kliring`, { tanggal_kliring: tgl || null }), { sukses: tgl ? `${p.nomor_warkat} ditandai kliring ${tanggal(tgl)}.` : `Tanda kliring ${p.nomor_warkat} dihapus.` });
  return (
    <Kartu judul="Pembayaran dan tanggal kliringnya" rapat>
      <p className="kecil lemah" style={{ padding: '10px 16px 0', margin: 0 }}>
        Cocokkan dengan rekening koran. Isi tanggal kliring untuk setiap pembayaran yang sudah tercantum; yang kosong atau kliring setelah {tanggal(r.tanggal_akhir, true)} dihitung beredar.
      </p>
      <div className="tabel-bungkus">
        <table className="tabel">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Nomor</th>
              <th>Metode</th>
              <th>Cek, BG, atau referensi</th>
              <th>Penerima</th>
              <th className="angka">Jumlah</th>
              <th style={{ width: 170 }}>Tanggal kliring</th>
            </tr>
          </thead>
          <tbody>
            {(r.pembayaran || []).length === 0 && <BarisKosong kolom={7} judul="Tidak ada pembayaran pada periode ini" />}
            {(r.pembayaran || []).map((p) => (
              <tr key={p.id} className={p.tanggal_kliring && p.tanggal_kliring <= r.tanggal_akhir ? '' : 'selisih'}>
                <td className="nowrap">{tanggal(p.tanggal)}</td>
                <td>
                  <Link to={`/pembayaran/${p.id}`}>{p.nomor}</Link>
                </td>
                <td>{METODE[p.metode]}</td>
                <td>{p.nomor_warkat}</td>
                <td>{p.penerima_nama}</td>
                <td className="angka">{rupiah(p.jumlah)}</td>
                <td>
                  {boleh ? (
                    <Masukan key={`${p.id}-${p.tanggal_kliring}`} type="date" min={p.tanggal} defaultValue={p.tanggal_kliring || ''} onBlur={(e) => e.target.value !== (p.tanggal_kliring || '') && simpan(p, e.target.value)} aria-label={`Tanggal kliring ${p.nomor_warkat}`} />
                  ) : (
                    tanggal(p.tanggal_kliring)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="kecil sangat-lemah" style={{ padding: '6px 16px 10px', margin: 0 }}>
        Daftar memuat pembayaran sampai akhir periode yang belum kliring sebelum {tanggal(awal, true)}.
      </p>
    </Kartu>
  );
}

function FormPos({ r }) {
  const f = useFormulir({ jenis: 'BIAYA_BANK', tanggal: r.tanggal_akhir, keterangan: '', jumlah: '', akun_id: '' });
  const { jalankan, sibuk } = useAksi();
  const akun = usePilihanAkun({});
  const j = JENIS_POS[f.nilai.jenis];
  const tambah = async () => {
    const res = await jalankan(() => api.post(`/rekonsiliasi/${r.id}/item`, f.nilai), { setGalat: f.setGalat, sukses: 'Pos rekonsiliasi ditambahkan.' });
    if (res.ok) f.setNilai((n) => ({ ...n, keterangan: '', jumlah: '', akun_id: '' }));
  };
  return (
    <div className="formulir" style={{ alignItems: 'end' }}>
      <Kolom label="Jenis pos" lebar={3}>
        <Pilihan pilihan={Object.entries(JENIS_POS).map(([k, x]) => [k, `${x.sisi === 'BANK' ? 'Bank' : 'Buku'}: ${x.label}`])} {...f.ikat('jenis')} />
      </Kolom>
      <Kolom label="Tanggal" lebar={2}>
        <Masukan type="date" {...f.ikat('tanggal')} />
      </Kolom>
      <Kolom label="Keterangan" galat={f.galat.keterangan} lebar={3}>
        <Masukan {...f.ikat('keterangan')} salah={!!f.galat.keterangan} maxLength={255} placeholder="Sesuai rekening koran" />
      </Kolom>
      <Kolom label="Jumlah (Rp)" galat={f.galat.jumlah} lebar={2}>
        <InputUang value={f.nilai.jumlah} onChange={(x) => f.atur('jumlah', x)} salah={!!f.galat.jumlah} />
      </Kolom>
      <div className="kolom l2">
        <Tombol varian="utama" onClick={tambah} sibuk={sibuk}>
          Tambah pos
        </Tombol>
      </div>
      {j.sisi === 'BUKU' && (
        <Kolom label="Akun lawan" opsional={j.otomatis} galat={f.galat.akun_id} bantuan={j.otomatis ? 'Kosongkan untuk memakai akun bawaan di Pengaturan.' : 'Wajib untuk koreksi buku.'} lebar={6}>
          <Kombo pilihan={akun} value={f.nilai.akun_id} onChange={(x) => f.atur('akun_id', x)} salah={!!f.galat.akun_id} />
        </Kolom>
      )}
    </div>
  );
}

export function DetailRekonsiliasi() {
  const { id } = useParams();
  const { punya } = useAuth();
  const q = useApi(`/rekonsiliasi/${id}`);
  const { jalankan, sibuk } = useAksi();
  const konfirmasi = useKonfirmasi();
  const [saldo, setSaldo] = useState(null);
  return (
    <Muat kueri={q}>
      {(r) => {
        const boleh = punya('KASUBAG_KEUANGAN') && !punya('KASIR') && r.status === 'DRAFT';
        const selisih = Number(r.selisih);
        const finalkan = async () => {
          const ok = await konfirmasi({
            judul: `Finalkan ${r.nomor}`,
            pesan: 'Pos di sisi buku akan dijurnal sebagai penyesuaian bertanggal akhir bulan. Setelah final, rekonsiliasi dan tanggal kliring pada periode ini terkunci.',
            label: 'Finalkan rekonsiliasi',
          });
          if (ok) await jalankan(() => api.post(`/rekonsiliasi/${r.id}/final`), { sukses: 'Rekonsiliasi difinalkan.' });
        };
        const hapusPos = async (i) => {
          const ok = await konfirmasi({ judul: 'Hapus pos', pesan: `${i.jenis_label} ${rupiah(i.jumlah)} akan dihapus.`, label: 'Hapus pos', bahaya: true });
          if (ok) await jalankan(() => api.hapus(`/rekonsiliasi/${r.id}/item/${i.id}`), { sukses: 'Pos dihapus.' });
        };
        const simpanSaldo = () => jalankan(() => api.put(`/rekonsiliasi/${r.id}`, { saldo_rekening_koran: saldo }), { sukses: 'Saldo rekening koran diperbarui.' }).then(() => setSaldo(null));
        return (
          <>
            <Kepala
              judul={r.nomor}
              status={<Status kode={r.status} />}
              remah={[{ label: 'Rekonsiliasi bank', ke: '/rekonsiliasi' }]}
              sub={`${r.rekening_nama} · ${namaBulan(r.bulan)} ${r.tahun} · per ${tanggal(r.tanggal_akhir, true)}`}
              aksi={
                <>
                  <TombolCetak jenis="RB" id={r.id} />
                  {boleh && (
                    <Tombol varian="utama" onClick={finalkan} sibuk={sibuk} disabled={selisih !== 0}>
                      Finalkan rekonsiliasi
                    </Tombol>
                  )}
                </>
              }
            />
            {r.status === 'FINAL' ? (
              <Pesan jenis="sukses" judul={`Final oleh ${r.difinalkan_nama} pada ${waktu(r.difinalkan_pada)}`}>
                {r.jurnal_nomor ? (
                  <>
                    Penyesuaian buku dijurnal dengan <Link to={`/jurnal/${r.jurnal_id}`}>{r.jurnal_nomor}</Link>.
                  </>
                ) : (
                  'Tidak ada penyesuaian sisi buku.'
                )}
              </Pesan>
            ) : selisih !== 0 ? (
              <Pesan jenis="peringatan" judul={`Masih ada selisih ${rupiah(selisih)}`}>
                Periksa tanggal kliring, setoran dalam perjalanan, dan pos bank yang belum dicatat, misalnya biaya administrasi dan jasa giro.
              </Pesan>
            ) : (
              <Pesan jenis="sukses">Saldo bank dan saldo buku sudah seimbang. Rekonsiliasi siap difinalkan.</Pesan>
            )}
            {boleh && (
              <Kartu judul="Saldo rekening koran">
                <div className="formulir" style={{ alignItems: 'end' }}>
                  <Kolom label={`Saldo akhir ${tanggal(r.tanggal_akhir, true)} menurut bank (Rp)`} lebar={4}>
                    <InputUang value={saldo ?? Number(r.saldo_rekening_koran)} onChange={setSaldo} />
                  </Kolom>
                  <div className="kolom l3">
                    <Tombol onClick={simpanSaldo} disabled={saldo === null || sibuk}>
                      Simpan saldo
                    </Tombol>
                  </div>
                </div>
              </Kartu>
            )}
            <Pernyataan r={r} />
            {boleh && <TabelKliring r={r} boleh={boleh} />}
            <Kartu judul="Pos rekonsiliasi" rapat>
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Sisi</th>
                    <th>Jenis</th>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Akun lawan</th>
                    <th className="angka">Jumlah</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(r.item || []).length === 0 && <BarisKosong kolom={7} judul="Belum ada pos penyesuaian" />}
                  {(r.item || []).map((i) => (
                    <tr key={i.id}>
                      <td>{i.sisi === 'BANK' ? 'Bank' : 'Buku'}</td>
                      <td>{i.jenis_label}</td>
                      <td>{tanggal(i.tanggal)}</td>
                      <td>{i.keterangan}</td>
                      <td>{i.akun_kode ? `${i.akun_kode} ${i.akun_nama}` : '-'}</td>
                      <td className="angka">{rupiah(i.jumlah)}</td>
                      <td className="aksi-baris">
                        {boleh && (
                          <Tombol kecil varian="bahaya" onClick={() => hapusPos(i)}>
                            Hapus
                          </Tombol>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {boleh && (
                <div style={{ padding: 16, borderTop: '1px solid var(--garis)' }}>
                  <FormPos r={r} />
                </div>
              )}
            </Kartu>
            <PanelLampiran jenis="RB" id={r.id} bolehUnggah={punya('KASUBAG_KEUANGAN') && r.status === 'DRAFT'} bolehHapus={r.status === 'DRAFT'} judul="Rekening koran" />
          </>
        );
      }}
    </Muat>
  );
}
