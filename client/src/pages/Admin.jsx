// Administrasi: pengguna dan peran, aturan persetujuan, konflik peran, pengaturan, log audit, dan sesi aktif.
import { Fragment, useState } from 'react';
import { api, qs } from '../api.js';
import { useAuth } from '../auth.jsx';
import { JENIS_DOKUMEN } from '../konstanta.js';
import { angka, rupiah, waktu } from '../format.js';
import { useAksi, useApi, useDepartemen } from '../components/data.js';
import { useSaring } from '../components/Dokumen.jsx';
import { BarisKosong, Centang, Kartu, Kepala, Kolom, Masukan, Modal, Muat, Pesan, Pilihan, Status, Tombol, useFormulir, useKonfirmasi } from '../components/ui.jsx';
import { FormDialog } from './Master.jsx';

// ---------------------------------------------------------------- pengguna

function FormPengguna({ awal, onTutup }) {
  const baru = !awal.id;
  const f = useFormulir(awal);
  const { jalankan, sibuk } = useAksi();
  const dept = useDepartemen();
  const peran = useApi('/peran');
  const konflik = useApi('/konflik-peran');
  const v = f.nilai;
  const bentrok = (konflik.data || []).filter((k) => v.peran.includes(k.peran_a) && v.peran.includes(k.peran_b));
  const aturPeran = (kode, ada) => f.atur('peran', ada ? [...v.peran, kode] : v.peran.filter((p) => p !== kode));
  const simpan = async () => {
    const data = { ...v };
    if (!baru) {
      delete data.username;
      delete data.password_awal;
    }
    const r = await jalankan(() => (baru ? api.post('/pengguna', data) : api.put(`/pengguna/${awal.id}`, data)), {
      setGalat: f.setGalat,
      sukses: baru ? `Akun ${v.username} dibuat. Pengguna wajib mengganti kata sandi saat pertama masuk.` : 'Data pengguna tersimpan.',
    });
    if (r.ok) onTutup();
  };
  return (
    <Modal
      judul={baru ? 'Tambah pengguna' : `Ubah ${awal.username}`}
      lebar
      onTutup={onTutup}
      kaki={
        <>
          <Tombol onClick={onTutup}>Batal</Tombol>
          <Tombol varian="utama" onClick={simpan} sibuk={sibuk} disabled={bentrok.length > 0}>
            Simpan pengguna
          </Tombol>
        </>
      }
    >
      <div className="formulir">
        <Kolom label="Nama pengguna" galat={f.galat.username} bantuan="Dipakai untuk masuk. Tidak dapat diubah." lebar={4}>
          <Masukan {...f.ikat('username')} salah={!!f.galat.username} disabled={!baru} autoComplete="off" />
        </Kolom>
        <Kolom label="Nama lengkap" galat={f.galat.nama_lengkap} lebar={4}>
          <Masukan {...f.ikat('nama_lengkap')} salah={!!f.galat.nama_lengkap} />
        </Kolom>
        <Kolom label="Jabatan" opsional bantuan="Dicetak di bawah tanda tangan, misalnya Wakil Dekan Bidang Riset dan Kerja Sama." lebar={4}>
          <Masukan {...f.ikat('jabatan')} />
        </Kolom>
        <Kolom label="Nomor pegawai (NIPY)" opsional galat={f.galat.nomor_pegawai} lebar={4}>
          <Masukan {...f.ikat('nomor_pegawai')} salah={!!f.galat.nomor_pegawai} />
        </Kolom>
        <Kolom label="Email" opsional galat={f.galat.email} lebar={4}>
          <Masukan type="email" {...f.ikat('email')} salah={!!f.galat.email} />
        </Kolom>
        <Kolom label="Unit kerja" galat={f.galat.departemen_id} lebar={4}>
          <Pilihan pilihan={(dept.data || []).map((d) => [d.id, d.nama])} kosong="Pilih unit kerja" {...f.ikat('departemen_id')} salah={!!f.galat.departemen_id} />
        </Kolom>
        {baru ? (
          <Kolom label="Kata sandi awal" galat={f.galat.password_awal} bantuan="Serahkan secara langsung; pengguna wajib menggantinya." lebar={4}>
            <Masukan type="password" {...f.ikat('password_awal')} salah={!!f.galat.password_awal} autoComplete="new-password" />
          </Kolom>
        ) : (
          <Kolom label="Status" lebar={4}>
            <Centang label="Akun aktif" checked={v.aktif} onChange={(x) => f.atur('aktif', x)} />
          </Kolom>
        )}
        <div className="bagian-judul">Peran</div>
        {(peran.data || []).map((p) => (
          <div className="kolom l4" key={p.kode}>
            <Centang label={<span><strong>{p.nama}</strong><span className="kecil sangat-lemah" style={{ display: 'block' }}>{p.deskripsi}</span></span>} checked={v.peran.includes(p.kode)} onChange={(x) => aturPeran(p.kode, x)} />
          </div>
        ))}
      </div>
      {f.galat.peran && <Pesan jenis="galat">{f.galat.peran}</Pesan>}
      {bentrok.map((k) => (
        <Pesan key={`${k.peran_a}${k.peran_b}`} jenis="galat" judul={`${k.nama_a} dan ${k.nama_b} tidak boleh dipegang satu akun`}>
          {k.alasan}.
        </Pesan>
      ))}
    </Modal>
  );
}

function FormResetSandi({ u, onTutup }) {
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState('');
  const { jalankan, sibuk } = useAksi();
  const simpan = async () => {
    const r = await jalankan(() => api.post(`/pengguna/${u.id}/reset-sandi`, { password_baru: sandi }), {
      setGalat: (g) => setGalat(g.password_baru || ''),
      sukses: `Kata sandi ${u.username} diatur ulang. Semua sesinya diakhiri.`,
    });
    if (r.ok) onTutup();
  };
  return (
    <Modal
      judul={`Atur ulang kata sandi ${u.username}`}
      onTutup={onTutup}
      kaki={
        <>
          <Tombol onClick={onTutup}>Batal</Tombol>
          <Tombol varian="utama" onClick={simpan} sibuk={sibuk}>
            Atur ulang kata sandi
          </Tombol>
        </>
      }
    >
      <p>Pastikan permintaan datang dari pengguna yang bersangkutan. Serahkan kata sandi sementara secara langsung; pengguna wajib menggantinya saat masuk.</p>
      <Kolom label="Kata sandi sementara" galat={galat} lebar={12}>
        <Masukan type="password" value={sandi} onChange={(e) => setSandi(e.target.value)} salah={!!galat} autoFocus autoComplete="new-password" />
      </Kolom>
    </Modal>
  );
}

export function HalamanPengguna() {
  const { punya, pengguna } = useAuth();
  const q = useApi('/pengguna');
  const peran = useApi('/peran');
  const [form, setForm] = useState(null);
  const [reset, setReset] = useState(null);
  const [cari, setCari] = useState('');
  const { jalankan } = useAksi();
  const admin = punya('ADMIN');
  const nama = (kode) => peran.data?.find((p) => p.kode === kode)?.nama || kode;
  return (
    <>
      <Kepala
        judul="Pengguna"
        sub="Setiap akun milik satu orang. Kombinasi peran yang bertentangan ditolak sistem."
        aksi={admin && <Tombol varian="utama" ikon="tambah" onClick={() => setForm({ username: '', nama_lengkap: '', jabatan: '', nomor_pegawai: '', email: '', departemen_id: '', peran: [], aktif: true, password_awal: '' })}>Tambah pengguna</Tombol>}
      />
      <Kartu rapat>
        <div className="saring">
          <Kolom label="Cari" className="lebar">
            <Masukan type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Nama, nama pengguna, atau unit kerja" />
          </Kolom>
        </div>
        <Muat kueri={q}>
          {(data) => (
            <div className="tabel-bungkus">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Nama pengguna</th>
                    <th>Unit kerja</th>
                    <th>Peran</th>
                    <th>Terakhir masuk</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data
                    .filter((u) => !cari || `${u.nama_lengkap} ${u.username} ${u.departemen_nama}`.toLowerCase().includes(cari.toLowerCase()))
                    .map((u) => (
                      <tr key={u.id} className={u.aktif ? '' : 'redup'}>
                        <td>
                          <div className="tebal">{u.nama_lengkap}</div>
                          <div className="kecil sangat-lemah">{u.jabatan}</div>
                        </td>
                        <td>{u.username}</td>
                        <td>{u.departemen_nama}</td>
                        <td>
                          {u.peran.map((p) => (
                            <span className="chip" key={p}>
                              {nama(p)}
                            </span>
                          ))}
                        </td>
                        <td className="nowrap">{waktu(u.terakhir_login)}</td>
                        <td>
                          {u.terkunci ? <Status kode="DITOLAK" label="Terkunci" /> : u.aktif ? <Status kode="AKTIF" /> : <Status kode="TUTUP" label="Nonaktif" />}
                          {u.harus_ganti_password && <div className="kecil sangat-lemah">Wajib ganti kata sandi</div>}
                        </td>
                        <td className="aksi-baris">
                          {admin && (
                            <>
                              {u.terkunci && (
                                <Tombol kecil varian="hantu" onClick={() => jalankan(() => api.post(`/pengguna/${u.id}/buka-kunci`), { sukses: `Kunci akun ${u.username} dibuka.` })}>
                                  Buka kunci
                                </Tombol>
                              )}
                              {u.id !== pengguna.id && (
                                <Tombol kecil varian="hantu" onClick={() => setReset(u)}>
                                  Atur ulang sandi
                                </Tombol>
                              )}
                              <Tombol kecil varian="hantu" onClick={() => setForm({ ...u, jabatan: u.jabatan || '', nomor_pegawai: u.nomor_pegawai || '', email: u.email || '' })}>
                                Ubah
                              </Tombol>
                            </>
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
      {form && <FormPengguna awal={form} onTutup={() => setForm(null)} />}
      {reset && <FormResetSandi u={reset} onTutup={() => setReset(null)} />}
    </>
  );
}

// ---------------------------------------------------------------- aturan persetujuan

const JENIS_ATURAN = ['PO', 'FB', 'PP', 'PUM', 'PJUM', 'PKK', 'BKK', 'JM'];

export function HalamanAturan() {
  const { punya } = useAuth();
  const q = useApi('/aturan-persetujuan');
  const peran = useApi('/peran');
  const [form, setForm] = useState(null);
  const pilihanPeran = (peran.data || []).map((p) => [p.kode, p.nama]);
  const kolom = [
    { kunci: 'jenis_dokumen', label: 'Jenis dokumen', jenis: 'pilihan', pilihan: JENIS_ATURAN.map((j) => [j, JENIS_DOKUMEN[j]]), lebar: 6 },
    { kunci: 'urutan', label: 'Urutan langkah', jenis: 'angka', lebar: 3 },
    { kunci: 'batas_bawah', label: 'Berlaku bila nilai di atas (Rp)', jenis: 'uang', lebar: 3 },
    { kunci: 'nama_langkah', label: 'Nama langkah', lebar: 6 },
    { kunci: 'peran_kode', label: 'Peran penyetuju', jenis: 'pilihan', pilihan: pilihanPeran, lebar: 6 },
    { kunci: 'lingkup', label: 'Lingkup', jenis: 'pilihan', pilihan: [['DEPARTEMEN', 'Unit kerja pembuat'], ['GLOBAL', 'Seluruh fakultas']], lebar: 6 },
    { kunci: 'peran_pengganti_kode', label: 'Peran pengganti', jenis: 'pilihan', kosong: 'Tidak ada', pilihan: pilihanPeran, lebar: 6, bantuan: 'Dipakai bila pembuat dokumen sendiri memegang peran penyetuju di departemennya.' },
    { kunci: 'aktif', label: '', jenis: 'centang', labelCentang: 'Langkah aktif', lebar: 12 },
  ];
  return (
    <>
      <Kepala
        judul="Aturan persetujuan"
        sub="Langkah berjalan berurutan. Satu orang hanya menyetujui satu langkah, dan pembuat dokumen tidak pernah menyetujui dokumennya sendiri."
        aksi={punya('ADMIN') && <Tombol varian="utama" ikon="tambah" onClick={() => setForm({ jenis_dokumen: 'BKK', urutan: '', nama_langkah: '', peran_kode: '', lingkup: 'GLOBAL', batas_bawah: 0, peran_pengganti_kode: '', aktif: true })}>Tambah langkah</Tombol>}
      />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Urutan</th>
                  <th>Langkah</th>
                  <th>Peran penyetuju</th>
                  <th>Lingkup</th>
                  <th>Berlaku bila nilai</th>
                  <th>Peran pengganti</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {JENIS_ATURAN.map((j) => {
                  const baris = data.filter((a) => a.jenis_dokumen === j);
                  return (
                    <Fragment key={j}>
                      <tr>
                        <td colSpan={8} className="tebal" style={{ background: 'var(--utama-muda)' }}>
                          {JENIS_DOKUMEN[j]} ({j})
                        </td>
                      </tr>
                      {baris.length === 0 && (
                        <tr>
                          <td colSpan={8} className="lemah">
                            Tanpa langkah persetujuan: dokumen langsung disetujui saat diajukan.
                          </td>
                        </tr>
                      )}
                      {baris.map((a) => (
                        <tr key={a.id} className={a.aktif ? '' : 'redup'}>
                          <td>{a.urutan}</td>
                          <td>{a.nama_langkah}</td>
                          <td>{a.peran_nama}</td>
                          <td>{a.lingkup === 'DEPARTEMEN' ? 'Unit kerja pembuat' : 'Seluruh fakultas'}</td>
                          <td>{Number(a.batas_bawah) > 0 ? `Di atas ${rupiah(a.batas_bawah)}` : 'Semua nilai'}</td>
                          <td>{a.peran_pengganti_nama || '-'}</td>
                          <td>{a.aktif ? 'Aktif' : 'Nonaktif'}</td>
                          <td className="aksi-baris">
                            {punya('ADMIN') && (
                              <Tombol kecil varian="hantu" onClick={() => setForm({ ...a, batas_bawah: Number(a.batas_bawah), peran_pengganti_kode: a.peran_pengganti_kode || '', aktif: !!a.aktif })}>
                                Ubah
                              </Tombol>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Kartu>
        )}
      </Muat>
      {form && (
        <FormDialog
          judul={form.id ? 'Ubah langkah persetujuan' : 'Tambah langkah persetujuan'}
          awal={form}
          kolom={kolom}
          catatan={<Pesan jenis="peringatan">Perubahan aturan berlaku untuk pengajuan berikutnya dan tercatat di laporan pengecualian.</Pesan>}
          simpan={(v) => (form.id ? api.put(`/aturan-persetujuan/${form.id}`, v) : api.post('/aturan-persetujuan', v))}
          onTutup={() => setForm(null)}
          labelSimpan="Simpan aturan"
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- konflik peran

export function HalamanKonflik() {
  const q = useApi('/konflik-peran');
  return (
    <>
      <Kepala judul="Konflik peran" sub="Pasangan peran yang tidak boleh dipegang satu akun, sesuai matriks pemisahan tugas." />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Peran</th>
                  <th>Tidak boleh digabung dengan</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {data.map((k) => (
                  <tr key={`${k.peran_a}${k.peran_b}`}>
                    <td className="tebal">{k.nama_a}</td>
                    <td className="tebal">{k.nama_b}</td>
                    <td>{k.alasan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kartu>
        )}
      </Muat>
    </>
  );
}

// ---------------------------------------------------------------- pengaturan

const KELOMPOK_PENGATURAN = [
  ['Identitas institusi (kop formulir)', (k) => k.startsWith('institusi_')],
  ['Pengendalian transaksi', (k) => ['toleransi_harga_persen', 'toleransi_qty_persen', 'hari_batas_pj_uang_muka', 'wajib_lampiran', 'batas_lampiran_mb', 'ambang_kas_kecil_persen'].includes(k)],
  ['Keamanan akun dan sesi', (k) => k.startsWith('sesi_') || ['maks_gagal_login', 'durasi_kunci_menit', 'min_panjang_password'].includes(k)],
  ['Akun dan pajak sistem', (k) => k.startsWith('akun_') || k.startsWith('pajak_')],
];

function IsiPengaturan({ data }) {
  const { punya } = useAuth();
  const [nilai, setNilai] = useState(Object.fromEntries(data.map((p) => [p.kunci, p.nilai])));
  const [galat, setGalat] = useState({});
  const { jalankan, sibuk } = useAksi();
  const ubah = Object.fromEntries(Object.entries(nilai).filter(([k, v]) => v !== data.find((p) => p.kunci === k)?.nilai));
  const simpan = () => jalankan(() => api.put('/pengaturan', ubah), { setGalat, sukses: `${Object.keys(ubah).length} pengaturan diperbarui.` });
  const admin = punya('ADMIN');
  const terpakai = new Set();
  return (
    <>
      {KELOMPOK_PENGATURAN.map(([judul, cocok]) => {
        const isi = data.filter((p) => cocok(p.kunci));
        isi.forEach((p) => terpakai.add(p.kunci));
        return (
          <Kartu judul={judul} key={judul}>
            <div className="formulir">
              {isi.map((p) => (
                <Kolom key={p.kunci} label={p.keterangan || p.kunci} galat={galat[p.kunci]} bantuan={`${p.kunci} · diubah ${waktu(p.diubah_pada)}`} lebar={6}>
                  <Masukan value={nilai[p.kunci] ?? ''} onChange={(e) => setNilai({ ...nilai, [p.kunci]: e.target.value })} salah={!!galat[p.kunci]} disabled={!admin} />
                </Kolom>
              ))}
            </div>
          </Kartu>
        );
      })}
      {data.some((p) => !terpakai.has(p.kunci)) && (
        <Kartu judul="Lainnya">
          <div className="formulir">
            {data
              .filter((p) => !terpakai.has(p.kunci))
              .map((p) => (
                <Kolom key={p.kunci} label={p.keterangan || p.kunci} galat={galat[p.kunci]} bantuan={p.kunci} lebar={6}>
                  <Masukan value={nilai[p.kunci] ?? ''} onChange={(e) => setNilai({ ...nilai, [p.kunci]: e.target.value })} disabled={!admin} />
                </Kolom>
              ))}
          </div>
        </Kartu>
      )}
      {admin && (
        <div className="baris-aksi">
          <span className="kecil lemah" style={{ alignSelf: 'center' }}>
            {Object.keys(ubah).length} perubahan belum disimpan
          </span>
          <Tombol varian="utama" onClick={simpan} sibuk={sibuk} disabled={!Object.keys(ubah).length}>
            Simpan pengaturan
          </Tombol>
        </div>
      )}
    </>
  );
}

export function HalamanPengaturan() {
  const q = useApi('/pengaturan');
  return (
    <>
      <Kepala judul="Pengaturan" sub="Setiap perubahan tercatat di log audit dan laporan pengecualian." />
      <Muat kueri={q}>{(data) => <IsiPengaturan data={data} />}</Muat>
    </>
  );
}

// ---------------------------------------------------------------- log audit

const AKSI_AUDIT = [
  'MASUK', 'GAGAL_MASUK', 'KELUAR', 'KUNCI_AKUN', 'BUKA_KUNCI', 'GANTI_SANDI', 'RESET_SANDI', 'CABUT_SESI', 'BUAT', 'UBAH', 'AJUKAN', 'SETUJUI', 'TOLAK', 'BATAL',
  'VERIFIKASI', 'BAYAR', 'KLIRING', 'FINAL', 'TUTUP', 'CETAK', 'UNGGAH', 'HAPUS_LAMPIRAN', 'EKSPOR', 'UBAH_REKENING', 'VERIFIKASI_REKENING', 'TUTUP_PERIODE', 'BUKA_PERIODE',
];

function JsonRapi({ nilai }) {
  if (!nilai) return <span className="sangat-lemah">-</span>;
  const obj = typeof nilai === 'string' ? JSON.parse(nilai) : nilai;
  return <pre style={{ margin: 0, fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>{JSON.stringify(obj, null, 2)}</pre>;
}

export function HalamanAudit() {
  const saring = useSaring(['dari', 'sampai', 'aksi', 'entitas', 'entitas_id', 'cari', 'halaman']);
  const n = saring.nilai;
  const halaman = Number(n.halaman || 1);
  const q = useApi(`/audit${qs({ ...n, halaman, per_halaman: 50 })}`);
  const [buka, setBuka] = useState(null);
  const atur = saring.atur;
  return (
    <>
      <Kepala judul="Log audit" sub="Catatan permanen setiap aksi: siapa, kapan, dari komputer mana, dan data sebelum serta sesudahnya. Log tidak dapat diubah dari aplikasi." />
      <Kartu rapat>
        <div className="saring">
          <Kolom label="Cari" className="lebar">
            <Masukan type="search" defaultValue={n.cari} onKeyDown={(e) => e.key === 'Enter' && atur('cari', e.currentTarget.value)} onBlur={(e) => atur('cari', e.target.value)} placeholder="Ringkasan atau nama pengguna, tekan Enter" />
          </Kolom>
          <Kolom label="Aksi">
            <Pilihan pilihan={AKSI_AUDIT.map((a) => [a, a.replace(/_/g, ' ').toLowerCase()])} kosong="Semua aksi" value={n.aksi} onChange={(e) => atur('aksi', e.target.value)} />
          </Kolom>
          <Kolom label="Entitas">
            <Masukan value={n.entitas} onChange={(e) => atur('entitas', e.target.value)} placeholder="misalnya pemasok" />
          </Kolom>
          <Kolom label="Dari tanggal">
            <Masukan type="date" value={n.dari} onChange={(e) => atur('dari', e.target.value)} />
          </Kolom>
          <Kolom label="Sampai tanggal">
            <Masukan type="date" value={n.sampai} onChange={(e) => atur('sampai', e.target.value)} />
          </Kolom>
        </div>
        <Muat kueri={q}>
          {(r) => (
            <>
              <div className="tabel-bungkus">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Pengguna</th>
                      <th>Alamat IP</th>
                      <th>Aksi</th>
                      <th>Entitas</th>
                      <th>Ringkasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.data.length === 0 && <BarisKosong kolom={6} judul="Tidak ada catatan yang cocok" />}
                    {r.data.map((l) => (
                      <Fragment key={l.id}>
                        <tr className="klik" onClick={() => setBuka(buka === l.id ? null : l.id)}>
                          <td className="nowrap">{waktu(l.waktu)}</td>
                          <td>{l.username}</td>
                          <td>{l.ip}</td>
                          <td className="nowrap">{l.aksi}</td>
                          <td>
                            {l.entitas}
                            {l.entitas_id && <span className="sangat-lemah"> #{l.entitas_id}</span>}
                          </td>
                          <td>{l.ringkasan}</td>
                        </tr>
                        {buka === l.id && (
                          <tr>
                            <td colSpan={6} style={{ background: '#fff' }}>
                              <div className="grid-2">
                                <div>
                                  <div className="kecil tebal lemah">Data sebelum</div>
                                  <JsonRapi nilai={l.data_sebelum} />
                                </div>
                                <div>
                                  <div className="kecil tebal lemah">Data sesudah</div>
                                  <JsonRapi nilai={l.data_sesudah} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="baris-aksi" style={{ padding: '8px 16px', marginTop: 0, alignItems: 'center' }}>
                <span className="kecil lemah">
                  {angka(r.total)} catatan · halaman {halaman} dari {Math.max(1, Math.ceil(r.total / r.per_halaman))}
                </span>
                <Tombol kecil disabled={halaman <= 1} onClick={() => saring.atur('halaman', halaman - 1)}>
                  Sebelumnya
                </Tombol>
                <Tombol kecil disabled={halaman * r.per_halaman >= r.total} onClick={() => saring.atur('halaman', halaman + 1)}>
                  Berikutnya
                </Tombol>
              </div>
            </>
          )}
        </Muat>
      </Kartu>
    </>
  );
}

// ---------------------------------------------------------------- sesi aktif

export function HalamanSesi() {
  const q = useApi('/sesi', { refetchInterval: 30_000 });
  const { jalankan } = useAksi();
  const konfirmasi = useKonfirmasi();
  const cabut = async (s) => {
    const r = await konfirmasi({ judul: `Akhiri sesi ${s.username}`, pesan: 'Pengguna akan keluar dari aplikasi pada permintaan berikutnya.', label: 'Akhiri sesi', bahaya: true });
    if (r) await jalankan(() => api.post(`/sesi/${s.id}/cabut`), { sukses: `Sesi ${s.username} diakhiri.` });
  };
  return (
    <>
      <Kepala judul="Sesi aktif" sub="Sesi berakhir otomatis setelah tidak ada aktivitas sesuai pengaturan batas waktu." />
      <Muat kueri={q}>
        {(data) => (
          <Kartu rapat>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Mulai</th>
                  <th>Aktivitas terakhir</th>
                  <th>Alamat IP</th>
                  <th>Aplikasi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && <BarisKosong kolom={6} judul="Tidak ada sesi aktif" />}
                {data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.nama_lengkap}
                      <div className="kecil sangat-lemah">{s.username}</div>
                    </td>
                    <td className="nowrap">{waktu(s.dibuat_pada)}</td>
                    <td className="nowrap">{waktu(s.aktivitas_terakhir)}</td>
                    <td>{s.ip}</td>
                    <td className="kecil" style={{ maxWidth: 320 }}>
                      {s.user_agent}
                    </td>
                    <td className="aksi-baris">
                      <Tombol kecil varian="bahaya" onClick={() => cabut(s)}>
                        Akhiri sesi
                      </Tombol>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kartu>
        )}
      </Muat>
    </>
  );
}
