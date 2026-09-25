// Data demo SIAPKas untuk pelatihan dan UAT.
// Pemakaian: node db/demo.js [--reset]
//   Mengisi basis data dengan pengguna per peran, data master, dan transaksi dua bulan terakhir
//   yang dijalankan melalui fungsi layanan yang sama dengan API (semua aturan bisnis berlaku).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, tx, jalankan, satu, semua } from '../src/db.js';
import { migrasi } from './migrate.js';
import { aturHariIni, hariIni, pecah, akhirBulan, tambahHari } from '../src/lib/tanggal.js';
import { hapusCachePengaturan } from '../src/lib/pengaturan.js';
import { hashSandi } from '../src/lib/sandi.js';
import { muatPengguna } from '../src/middleware/autentikasi.js';
import { prosesKeputusan } from '../src/lib/alur.js';
import { buatApp } from '../src/app.js';
import { buatPengguna, ubahStatusPeriode } from '../src/modules/admin.js';
import { simpanPemasok, verifikasiRekeningPemasok, buatBukuCek, batalkanWarkatKosong, buatDana } from '../src/modules/master.js';
import { buatPO, ajukanPO, buatPenerimaan } from '../src/modules/pembelian.js';
import { buatFaktur, verifikasiFaktur, buatFakturSaldoAwal } from '../src/modules/faktur.js';
import { buatPP, ajukanPP } from '../src/modules/permintaan.js';
import { buatPUM, ajukanPUM, buatPJUM, ajukanPJUM } from '../src/modules/uangmuka.js';
import { buatPKK, ajukanPKK, bayarPKK, buatPDK, ajukanPDK, buatOpname, ubahOpname } from '../src/modules/kaskecil.js';
import { buatBKK, ajukanBKK } from '../src/modules/bkk.js';
import { bayarBKK, batalPembayaran, tandaiKliring, buatBKM } from '../src/modules/pembayaran.js';
import { buatJM, ajukanJM } from '../src/modules/akuntansi.js';
import { buatRekonsiliasi, tambahPos, finalkanRekonsiliasi, hitungRekonsiliasi, ubahSaldoKoran } from '../src/modules/rekonsiliasi.js';
import { simpanLampiran } from '../src/modules/lampiran.js';

buatApp(); // memastikan seluruh modul (dan registri dokumennya) termuat

export const SANDI_DEMO = 'Demo2026';

// Nama orang di data demo adalah nama samaran. Data dosen dan pejabat yang sebenarnya diisi saat implementasi.
const PENGGUNA_DEMO = [
  ['dekan', 'Prof. Dr. Hadi Suryana, S.E., M.Si.', 'Dekan', 'DKN', ['DEKAN', 'PEMOHON'], '151.101.01'],
  ['wd1', 'Dr. Rina Kartika, S.E., M.M.', 'Wakil Dekan Bidang Pembelajaran, Kemahasiswaan, dan Alumni', 'DKN', ['WAKIL_DEKAN_1', 'PEMOHON'], '151.101.02'],
  ['wd2', 'Dr. Ratna Sari, S.E., M.Si., Ak.', 'Wakil Dekan Bidang Perencanaan, Sumber Daya, Keuangan, dan Sistem Teknologi Informasi', 'KEU', ['WAKIL_DEKAN_2', 'PIMPINAN_UNIT', 'PEMOHON'], '151.101.03'],
  ['wd3', 'Dr. Hendra Gunawan, S.E., M.T.', 'Wakil Dekan Bidang Riset dan Kerja Sama', 'RPM', ['WAKIL_DEKAN_3', 'PIMPINAN_UNIT', 'PEMOHON'], '151.101.04'],
  ['kasubag', 'Dedi Kurniawan, S.E., M.Ak.', 'Kepala Subbagian Keuangan', 'KEU', ['KASUBAG_KEUANGAN', 'PEMOHON'], '151.102.11'],
  ['stafkeu1', 'Nia Kurniasih, S.E.', 'Staf Keuangan', 'KEU', ['STAF_KEUANGAN', 'PEMOHON'], '151.102.12'],
  ['kasir1', 'Budi Santoso, A.Md.', 'Kasir Fakultas', 'KEU', ['KASIR', 'PEMOHON'], '151.102.13'],
  ['kaskecil1', 'Dewi Lestari, A.Md.', 'Pemegang Kas Kecil Dekanat', 'DKN', ['KAS_KECIL', 'PEMOHON'], '151.102.21'],
  ['kaskecil2', 'Asep Saepudin', 'Pemegang Kas Kecil Tata Usaha', 'TU', ['KAS_KECIL', 'PEMOHON'], '151.102.22'],
  ['pengadaan1', 'Yusuf Hidayat, S.E.', 'Staf Pengadaan', 'TU', ['PEMBELIAN', 'PEMOHON'], '151.102.31'],
  ['katu', 'Siti Rahmawati, S.Sos.', 'Kepala Tata Usaha dan Rumah Tangga', 'TU', ['PIMPINAN_UNIT', 'PEMOHON'], '151.102.30'],
  ['rt1', 'Agus Setiawan', 'Staf Rumah Tangga', 'TU', ['GUDANG', 'PEMOHON'], '151.102.32'],
  ['kaprodiakt', 'Dr. Wulan Pratiwi, S.E., M.Ak., Ak.', 'Ketua Program Studi Akuntansi', 'AKT', ['PIMPINAN_UNIT', 'PEMOHON'], '151.103.05'],
  ['dosen1', 'Fajar Nugraha, S.E., M.Ak.', 'Dosen Program Studi Akuntansi', 'AKT', ['PEMOHON'], '151.103.21'],
  ['kaprodimnj', 'Indah Permatasari, S.E., M.M.', 'Ketua Program Studi Manajemen', 'MNJ', ['PIMPINAN_UNIT', 'PEMOHON'], '151.103.06'],
  ['dosen2', 'Rizky Ramadhan, S.E., M.M.', 'Dosen Program Studi Manajemen', 'MNJ', ['PEMOHON'], '151.103.22'],
  ['auditor1', 'Maya Anggraini, S.E., M.Ak.', 'Auditor Internal', 'SPI', ['AUDITOR'], '151.104.01'],
];

const ctxCache = new Map();
async function sebagai(username) {
  if (!ctxCache.has(username)) {
    const u = await satu(pool, 'SELECT id FROM pengguna WHERE username = ?', [username]);
    ctxCache.set(username, { user: await muatPengguna(pool, u.id), ip: '127.0.0.1' });
  }
  return ctxCache.get(username);
}
const lakukan = async (username, fn) => tx(async (conn) => fn(conn, await sebagai(username)));
const idAkun = async (kode) => (await satu(pool, 'SELECT id FROM akun WHERE kode = ?', [kode])).id;
const idDept = async (kode) => (await satu(pool, 'SELECT id FROM departemen WHERE kode = ?', [kode])).id;
const idPemasok = async (kode) => (await satu(pool, 'SELECT id FROM pemasok WHERE kode = ?', [kode])).id;
const idRekening = async (kode) => (await satu(pool, 'SELECT id FROM rekening_kas WHERE kode = ?', [kode])).id;
const idPajak = async (kode) => (await satu(pool, 'SELECT id FROM pajak WHERE kode = ?', [kode])).id;
const idDana = async (kode) => (await satu(pool, 'SELECT id FROM dana_kas_kecil WHERE kode = ?', [kode])).id;

/** Setujui semua langkah yang tersisa oleh pengguna demo yang memenuhi syarat. */
async function setujuiSemua(jenis, dokumenId, catatan = null) {
  for (let i = 0; i < 6; i += 1) {
    const langkah = await satu(
      pool,
      `SELECT * FROM persetujuan WHERE jenis_dokumen = ? AND dokumen_id = ? AND status = 'MENUNGGU'
        ORDER BY putaran DESC, urutan LIMIT 1`,
      [jenis, dokumenId],
    );
    if (!langkah) return;
    const kandidat = await semua(
      pool,
      `SELECT u.username FROM pengguna u JOIN pengguna_peran pp ON pp.pengguna_id = u.id
        WHERE pp.peran_kode = ? AND u.aktif = 1 AND u.id <> ? ${langkah.lingkup === 'DEPARTEMEN' ? 'AND u.departemen_id = ?' : ''}
          AND u.id NOT IN (SELECT COALESCE(diputuskan_oleh, 0) FROM persetujuan WHERE jenis_dokumen = ? AND dokumen_id = ? AND putaran = ? AND status = 'DISETUJUI')
        ORDER BY u.id LIMIT 1`,
      langkah.lingkup === 'DEPARTEMEN'
        ? [langkah.peran_kode, langkah.pembuat_id, langkah.departemen_id, jenis, dokumenId, langkah.putaran]
        : [langkah.peran_kode, langkah.pembuat_id, jenis, dokumenId, langkah.putaran],
    );
    if (!kandidat.length) throw new Error(`Tidak ada penyetuju untuk ${jenis} ${dokumenId} langkah ${langkah.nama_langkah}`);
    await lakukan(kandidat[0].username, (conn, ctx) => prosesKeputusan(conn, ctx, { jenis, dokumenId, keputusan: 'SETUJUI', catatan }));
  }
}

/** Dokumen PDF kecil yang sah untuk lampiran contoh. */
export function pdfContoh(judul, baris = []) {
  const teks = [judul, ...baris].map((t, i) => `BT /F1 ${i === 0 ? 14 : 11} Tf 40 ${250 - i * 20} Td (${String(t).replace(/[()\\]/g, '')}) Tj ET`).join('\n');
  const obj = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(teks)} >>\nstream\n${teks}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let isi = '%PDF-1.4\n';
  const offset = [];
  obj.forEach((o, i) => {
    offset.push(Buffer.byteLength(isi));
    isi += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(isi);
  isi += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${offset.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  isi += `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(isi, 'latin1');
}

async function lampirkan(username, jenis, dokumenId, nama, judul, baris) {
  await lakukan(username, (conn, ctx) => simpanLampiran(conn, ctx, { jenis, dokumenId, namaAsli: nama, buffer: pdfContoh(judul, baris) }));
}

async function warkatBerikut(rekKode, jenis) {
  return (
    await satu(
      pool,
      `SELECT w.id FROM warkat w JOIN buku_cek b ON b.id = w.buku_cek_id JOIN rekening_kas r ON r.id = b.rekening_kas_id
        WHERE r.kode = ? AND b.jenis = ? AND w.status = 'TERSEDIA' ORDER BY b.id, w.urut LIMIT 1`,
      [rekKode, jenis],
    )
  ).id;
}

async function bayar(bkkId, tanggal, { ref, jatuhTempoBg } = {}) {
  const bkk = await satu(pool, 'SELECT b.metode_bayar, r.kode FROM bukti_kas_keluar b JOIN rekening_kas r ON r.id = b.rekening_kas_id WHERE b.id = ?', [bkkId]);
  const input = { bkk_id: bkkId, tanggal };
  if (bkk.metode_bayar === 'TRANSFER') input.nomor_referensi = ref || `IB${tanggal.replace(/-/g, '')}${String(bkkId).padStart(4, '0')}`;
  else input.warkat_id = await warkatBerikut(bkk.kode, bkk.metode_bayar);
  if (bkk.metode_bayar === 'BG') input.tanggal_jatuh_tempo_bg = jatuhTempoBg;
  return lakukan('kasir1', (conn, ctx) => bayarBKK(conn, ctx, input));
}

async function bkkLengkap(input, { bayarPada, ref, jatuhTempoBg } = {}) {
  const bkk = await lakukan('stafkeu1', (conn, ctx) => buatBKK(conn, ctx, input));
  await lakukan('stafkeu1', (conn, ctx) => ajukanBKK(conn, ctx, bkk.id));
  await setujuiSemua('BKK', bkk.id);
  if (bayarPada) await bayar(bkk.id, bayarPada, { ref, jatuhTempoBg });
  return bkk;
}

async function poLengkap(tanggal, input) {
  aturHariIni(tanggal);
  const po = await lakukan('pengadaan1', (conn, ctx) => buatPO(conn, ctx, { tanggal, ...input }));
  await lakukan('pengadaan1', (conn, ctx) => ajukanPO(conn, ctx, po.id));
  await setujuiSemua('PO', po.id);
  return po;
}

async function barisPO(poId) {
  return semua(pool, 'SELECT id, qty, harga FROM pesanan_pembelian_detail WHERE po_id = ? ORDER BY baris', [poId]);
}

async function pkkDibayar(username, tanggal, danaKode, keperluan, akunKode, jumlah, nota, bayarPada = tanggal) {
  aturHariIni(tanggal);
  const k = await lakukan(username, async (conn, ctx) => buatPKK(conn, ctx, { tanggal, dana_id: await idDana(danaKode), keperluan, akun_id: await idAkun(akunKode), jumlah }));
  await lakukan(username, (conn, ctx) => ajukanPKK(conn, ctx, k.id));
  await setujuiSemua('PKK', k.id);
  const pemegang = danaKode === 'KK-DKN' ? 'kaskecil1' : 'kaskecil2';
  if (bayarPada) await lakukan(pemegang, (conn, ctx) => bayarPKK(conn, ctx, k.id, { tanggal_bayar: bayarPada, nomor_bukti: nota }));
  return k;
}

export async function isiDemo({ log = console.log } = {}) {
  const tanggalNyata = hariIni();
  const { tahun, bulan } = pecah(tanggalNyata);
  const geser = (n) => {
    const b = bulan - n;
    return b >= 1 ? { tahun, bulan: b } : { tahun: tahun - 1, bulan: b + 12 };
  };
  const M2 = geser(2);
  const M1 = geser(1);
  const M0 = { tahun, bulan };
  const hariKini = Number(tanggalNyata.slice(8, 10));
  const tgl = (p, hari) => {
    const akhir = Number(akhirBulan(p.tahun, p.bulan).slice(8, 10));
    const h = p === M0 ? Math.min(hari, hariKini) : Math.min(hari, akhir);
    return `${p.tahun}-${String(p.bulan).padStart(2, '0')}-${String(h).padStart(2, '0')}`;
  };

  log('Membuat pengguna demo ...');
  aturHariIni(tgl(M2, 25));
  const admin = { user: await muatPengguna(pool, (await satu(pool, "SELECT id FROM pengguna WHERE username = 'admin'")).id), ip: '127.0.0.1' };
  for (const [username, nama, jabatan, dept, peran, nomorPegawai] of PENGGUNA_DEMO) {
    await tx(async (conn) => buatPengguna(conn, admin, { username, nama_lengkap: nama, jabatan, nomor_pegawai: nomorPegawai, departemen_id: await idDept(dept), peran, password_awal: SANDI_DEMO }));
  }
  // Akun demo tidak diwajibkan mengganti kata sandi agar pelatihan dapat langsung dimulai.
  await jalankan(pool, 'UPDATE pengguna SET harus_ganti_password = 0');
  await jalankan(pool, "UPDATE pengguna SET password_hash = ? WHERE username = 'admin'", [await hashSandi('Admin12345')]);

  log('Mengisi data master ...');
  const pemasok = [
    { kode: 'BKN', nama: 'PT Berkah Kertas Nusantara', alamat: 'Jl. Soekarno-Hatta No. 512', kota: 'Bandung', npwp: '01.345.678.9-431.000', pkp: true, termin_hari: 30, bank_nama: 'BCA', bank_nomor_rekening: '1234500011', bank_atas_nama: 'PT Berkah Kertas Nusantara', kontak: 'Bagian Penjualan', telepon: '022-7520-1122' },
    { kode: 'TPJ', nama: 'PT Teknologi Presentasi Jaya', alamat: 'Jl. Peta No. 21', kota: 'Bandung', npwp: '02.456.789.0-441.000', pkp: true, termin_hari: 30, bank_nama: 'Bank Mandiri', bank_nomor_rekening: '1300098765432', bank_atas_nama: 'PT Teknologi Presentasi Jaya', telepon: '022-779-0033' },
    { kode: 'TMA', nama: 'PT Teknik Mandiri Abadi', alamat: 'Jl. Soekarno-Hatta No. 45', kota: 'Bandung', npwp: '03.567.890.1-424.000', pkp: true, termin_hari: 14, bank_nama: 'BNI', bank_nomor_rekening: '0098877665', bank_atas_nama: 'PT Teknik Mandiri Abadi', telepon: '022-750-4411' },
    { kode: 'SAT', nama: 'CV Sumber Alat Tulis', alamat: 'Jl. Cibadak No. 88', kota: 'Bandung', npwp: '04.678.901.2-423.000', pkp: false, termin_hari: 14, bank_nama: 'BCA', bank_nomor_rekening: '2210033344', bank_atas_nama: 'CV Sumber Alat Tulis', telepon: '022-420-1188' },
    { kode: 'LCP', nama: 'CV Lintas Cetak Priangan', alamat: 'Jl. Terusan Kiaracondong No. 7', kota: 'Bandung', npwp: null, pkp: false, termin_hari: 7, bank_nama: 'BRI', bank_nomor_rekening: '0412010099887', bank_atas_nama: 'CV Lintas Cetak Priangan', telepon: '0812-2000-4455' },
    { kode: 'MPU', nama: 'PT Mitra Penjaminan Utama', alamat: 'Jl. Dago No. 101', kota: 'Bandung', npwp: '05.789.012.3-423.000', pkp: true, termin_hari: 14, bank_nama: 'BCA', bank_nomor_rekening: '3330044455', bank_atas_nama: 'PT Mitra Penjaminan Utama', telepon: '022-250-6677' },
    { kode: 'GPB', nama: 'PT Graha Pertemuan Bandung', alamat: 'Jl. Asia Afrika No. 130', kota: 'Bandung', npwp: '06.890.123.4-424.000', pkp: true, termin_hari: 7, bank_nama: 'Bank Mandiri', bank_nomor_rekening: '1300055566677', bank_atas_nama: 'PT Graha Pertemuan Bandung', telepon: '022-420-9900' },
  ];
  for (const p of pemasok) await lakukan('pengadaan1', (conn, ctx) => simpanPemasok(conn, ctx, null, p));
  for (const kode of ['BKN', 'TPJ', 'TMA', 'SAT', 'MPU', 'GPB']) {
    await lakukan('kasubag', async (conn, ctx) => verifikasiRekeningPemasok(conn, ctx, await idPemasok(kode)));
  }
  for (const [rek, jenis, seri, awal, akhir] of [['BJB-OPS', 'CEK', 'CA', 100001, 100025], ['BJB-OPS', 'BG', 'BG', 200001, 200010], ['BSI-KEG', 'CEK', 'BS', 500001, 500025]]) {
    await lakukan('kasir1', async (conn, ctx) => buatBukuCek(conn, ctx, { rekening_kas_id: await idRekening(rek), jenis, seri, nomor_awal: awal, nomor_akhir: akhir, digit: 6, tanggal_terima: tgl(M2, 25) }));
  }
  await lakukan('wd2', async (conn, ctx) => buatDana(conn, ctx, { kode: 'KK-DKN', nama: 'Kas Kecil Dekanat', pemegang_id: (await sebagai('kaskecil1')).user.id, departemen_id: await idDept('DKN'), akun_id: await idAkun('1-1102'), dana_diusulkan: 10000000, batas_transaksi: 1000000 }));
  await lakukan('wd2', async (conn, ctx) => buatDana(conn, ctx, { kode: 'KK-TU', nama: 'Kas Kecil Tata Usaha', pemegang_id: (await sebagai('kaskecil2')).user.id, departemen_id: await idDept('TU'), akun_id: await idAkun('1-1103'), dana_diusulkan: 7500000, batas_transaksi: 1000000 }));

  log('Saldo awal dan tutup periode sebelumnya ...');
  const saldoAwalTgl = akhirBulan(M2.tahun, M2.bulan);
  aturHariIni(saldoAwalTgl);
  const jm = await lakukan('kasubag', async (conn, ctx) =>
    buatJM(conn, ctx, {
      tanggal: saldoAwalTgl,
      jenis: 'SALDO_AWAL',
      keterangan: `Saldo awal per ${saldoAwalTgl} dari neraca saldo sistem lama`,
      baris: [
        { akun_id: await idAkun('1-1111'), debit: 2500000000, kredit: 0, keterangan: 'Saldo Bank BJB Rekening Operasional FEB' },
        { akun_id: await idAkun('1-1112'), debit: 750000000, kredit: 0, keterangan: 'Saldo Bank BSI Rekening Kegiatan dan Hibah FEB' },
        { akun_id: await idAkun('1-1301'), debit: 850000000, kredit: 0, keterangan: 'Persediaan alat tulis dan bahan habis pakai' },
        { akun_id: await idAkun('1-2104'), debit: 320000000, kredit: 0, keterangan: 'Peralatan kantor' },
        { akun_id: await idAkun('1-2102'), debit: 1800000000, kredit: 0, keterangan: 'Peralatan pembelajaran dan laboratorium' },
        { akun_id: await idAkun('1-2199'), debit: 0, kredit: 450000000, keterangan: 'Akumulasi penyusutan' },
        { akun_id: await idAkun('2-1101'), pemasok_id: await idPemasok('BKN'), debit: 0, kredit: 45000000, keterangan: 'Utang PT Berkah Kertas Nusantara' },
        { akun_id: await idAkun('2-1101'), pemasok_id: await idPemasok('TPJ'), debit: 0, kredit: 12500000, keterangan: 'Utang PT Teknologi Presentasi Jaya' },
        { akun_id: await idAkun('3-1101'), debit: 0, kredit: 4000000000, keterangan: 'Dana operasional fakultas' },
        { akun_id: await idAkun('3-2101'), debit: 0, kredit: 1712500000, keterangan: 'Surplus dana akumulasian' },
      ],
    }),
  );
  await lakukan('kasubag', (conn, ctx) => ajukanJM(conn, ctx, jm.id));
  await setujuiSemua('JM', jm.id, 'Sesuai berita acara migrasi saldo awal');
  const faSaldoBKN = await lakukan('kasubag', async (conn, ctx) =>
    buatFakturSaldoAwal(conn, ctx, { pemasok_id: await idPemasok('BKN'), nomor_faktur: 'INV-BKN-0712', tanggal_faktur: tgl(M2, 12), tanggal_jatuh_tempo: tgl(M1, 11), total_utang: 45000000 }),
  );
  await lakukan('kasubag', async (conn, ctx) =>
    buatFakturSaldoAwal(conn, ctx, { pemasok_id: await idPemasok('TPJ'), nomor_faktur: 'TPJ/07/0098', tanggal_faktur: tgl(M2, 26), tanggal_jatuh_tempo: tgl(M1, 25), total_utang: 12500000 }),
  );
  await lakukan('wd2', (conn, ctx) => ubahStatusPeriode(conn, ctx, { tahun: M2.tahun, bulan: M2.bulan }, 'TUTUP'));

  log('Transaksi bulan lalu: pembentukan kas kecil ...');
  const bjb = await idRekening('BJB-OPS');
  const bsi = await idRekening('BSI-KEG');
  aturHariIni(tgl(M1, 3));
  await bkkLengkap({ jenis: 'PEMBENTUKAN_KAS_KECIL', sumber_id: await idDana('KK-DKN'), tanggal: tgl(M1, 3), rekening_kas_id: bjb, metode_bayar: 'CEK', tanggal_rencana_bayar: tgl(M1, 3) }, { bayarPada: tgl(M1, 3) });
  await bkkLengkap({ jenis: 'PEMBENTUKAN_KAS_KECIL', sumber_id: await idDana('KK-TU'), tanggal: tgl(M1, 3), rekening_kas_id: bsi, metode_bayar: 'CEK', tanggal_rencana_bayar: tgl(M1, 3) }, { bayarPada: tgl(M1, 3) });

  log('Transaksi bulan lalu: pembelian dan faktur ...');
  const poA = await poLengkap(tgl(M1, 4), {
    pemasok_id: await idPemasok('BKN'), departemen_id: await idDept('TU'), tanggal_kirim: tgl(M1, 6), ppn: true, keterangan: 'Kertas dan map untuk ujian tengah semester',
    baris: [{ uraian: 'Kertas HVS F4 70 gsm untuk naskah ujian', jenis: 'BARANG', qty: 100, satuan: 'rim', harga: 50000, akun_id: await idAkun('1-1301') }],
  });
  const poB = await poLengkap(tgl(M1, 5), {
    pemasok_id: await idPemasok('TMA'), departemen_id: await idDept('TU'), ppn: true, keterangan: 'Pemeliharaan berkala pendingin ruangan gedung perkuliahan',
    baris: [{ uraian: 'Jasa perawatan 40 unit AC ruang kuliah', jenis: 'JASA', qty: 1, satuan: 'paket', harga: 10000000, akun_id: await idAkun('6-1106') }],
  });
  const poC = await poLengkap(tgl(M1, 6), {
    pemasok_id: await idPemasok('BKN'), departemen_id: await idDept('TU'), tanggal_kirim: tgl(M1, 12), ppn: true, keterangan: 'Kebutuhan kertas dan cetakan satu tahun akademik',
    baris: [{ uraian: 'Kertas HVS A4 80 gsm', jenis: 'BARANG', qty: 3000, satuan: 'rim', harga: 50000, akun_id: await idAkun('1-1301') }],
  });
  aturHariIni(tgl(M1, 6));
  const [dA] = await barisPO(poA.id);
  await lakukan('rt1', (conn, ctx) => buatPenerimaan(conn, ctx, { jenis: 'LPB', tanggal: tgl(M1, 6), po_id: poA.id, nomor_surat_jalan: 'SJ-BKN-2231', baris: [{ po_detail_id: dA.id, qty: 80, catatan: 'Baik' }] }));
  aturHariIni(tgl(M1, 7));
  const fA = await lakukan('stafkeu1', (conn, ctx) =>
    buatFaktur(conn, ctx, { po_id: poA.id, nomor_faktur: 'INV-BKN-0803', nomor_faktur_pajak: '04002500123456789', tanggal_faktur: tgl(M1, 7), tanggal_terima: tgl(M1, 7), baris: [{ po_detail_id: dA.id, qty: 80, harga: 50000 }] }),
  );
  await lakukan('stafkeu1', (conn, ctx) => verifikasiFaktur(conn, ctx, fA.id));
  aturHariIni(tgl(M1, 10));
  const [dB] = await barisPO(poB.id);
  await lakukan('rt1', (conn, ctx) => buatPenerimaan(conn, ctx, { jenis: 'BAST', tanggal: tgl(M1, 10), po_id: poB.id, keterangan: 'Pekerjaan diterima Kepala Tata Usaha', baris: [{ po_detail_id: dB.id, qty: 1 }] }));
  aturHariIni(tgl(M1, 11));
  const fB = await lakukan('stafkeu1', async (conn, ctx) =>
    buatFaktur(conn, ctx, { po_id: poB.id, nomor_faktur: 'TMA/INV/0811', nomor_faktur_pajak: '04002500123456790', tanggal_faktur: tgl(M1, 11), tanggal_terima: tgl(M1, 11), pajak_pph_id: await idPajak('PPH23'), baris: [{ po_detail_id: dB.id, qty: 1, harga: 10000000 }] }),
  );
  await lakukan('stafkeu1', (conn, ctx) => verifikasiFaktur(conn, ctx, fB.id));
  aturHariIni(tgl(M1, 12));
  const [dC] = await barisPO(poC.id);
  await lakukan('rt1', (conn, ctx) => buatPenerimaan(conn, ctx, { jenis: 'LPB', tanggal: tgl(M1, 12), po_id: poC.id, nomor_surat_jalan: 'SJ-BKN-2290', baris: [{ po_detail_id: dC.id, qty: 3000 }] }));
  aturHariIni(tgl(M1, 13));
  const fC = await lakukan('stafkeu1', (conn, ctx) =>
    buatFaktur(conn, ctx, { po_id: poC.id, nomor_faktur: 'INV-BKN-0813', nomor_faktur_pajak: '04002500123456801', tanggal_faktur: tgl(M1, 13), tanggal_terima: tgl(M1, 13), baris: [{ po_detail_id: dC.id, qty: 3000, harga: 50500 }] }),
  );
  await lakukan('stafkeu1', (conn, ctx) => verifikasiFaktur(conn, ctx, fC.id));
  await setujuiSemua('FB', fC.id, 'Kenaikan harga 1% disetujui sesuai addendum kontrak pemasok');

  log('Transaksi bulan lalu: permintaan pembayaran ...');
  aturHariIni(tgl(M1, 8));
  const pp1 = await lakukan('dosen1', async (conn, ctx) =>
    buatPP(conn, ctx, { tanggal: tgl(M1, 8), tanggal_dibutuhkan: tgl(M1, 15), penerima_nama: 'PLN UP3 Bandung', penerima_bank_nama: 'BRI', penerima_bank_rekening: '0001-01-000123-30-9', penerima_bank_atas_nama: 'PLN UP3 Bandung', keterangan: 'Tagihan listrik gedung FEB bulan lalu', dokumen_pendukung: 'Tagihan rekening listrik', baris: [{ uraian: 'Tagihan listrik gedung FEB', akun_id: await idAkun('6-1101'), jumlah: 3250000 }] }),
  );
  await lampirkan('dosen1', 'PP', pp1.id, 'tagihan-listrik.pdf', 'Tagihan listrik gedung FEB', ['Pemakaian 2.310 kWh', 'Total tagihan Rp3.250.000']);
  await lakukan('dosen1', (conn, ctx) => ajukanPP(conn, ctx, pp1.id));
  await setujuiSemua('PP', pp1.id);
  aturHariIni(tgl(M1, 9));
  const pp2 = await lakukan('kasubag', async (conn, ctx) =>
    buatPP(conn, ctx, { tanggal: tgl(M1, 9), tanggal_dibutuhkan: tgl(M1, 16), pemasok_id: await idPemasok('MPU'), keterangan: 'Jasa pendampingan akreditasi internasional program studi', dokumen_pendukung: 'Invoice dan surat perjanjian jasa', baris: [{ uraian: 'Jasa pendampingan akreditasi termin 1', akun_id: await idAkun('5-1104'), jumlah: 15000000 }] }),
  );
  await lampirkan('kasubag', 'PP', pp2.id, 'invoice-pendampingan.pdf', 'Invoice PT Mitra Penjaminan Utama', ['Jasa pendampingan akreditasi', 'Rp15.000.000']);
  await lakukan('kasubag', (conn, ctx) => ajukanPP(conn, ctx, pp2.id));
  await setujuiSemua('PP', pp2.id);
  aturHariIni(tgl(M1, 10));
  const pp3 = await lakukan('dosen1', async (conn, ctx) =>
    buatPP(conn, ctx, { tanggal: tgl(M1, 10), tanggal_dibutuhkan: tgl(M1, 17), pemasok_id: await idPemasok('GPB'), keterangan: 'Sewa aula Seminar Nasional Akuntansi', dokumen_pendukung: 'Tagihan sewa', baris: [{ uraian: 'Sewa aula dan perlengkapan seminar satu hari', akun_id: await idAkun('6-1103'), jumlah: 20000000 }] }),
  );
  await lampirkan('dosen1', 'PP', pp3.id, 'tagihan-sewa.pdf', 'Tagihan sewa aula', ['PT Graha Pertemuan Bandung', 'Rp20.000.000']);
  await lakukan('dosen1', (conn, ctx) => ajukanPP(conn, ctx, pp3.id));
  await setujuiSemua('PP', pp3.id);

  log('Transaksi bulan lalu: uang muka ...');
  aturHariIni(tgl(M1, 5));
  const um1 = await lakukan('dosen2', (conn, ctx) => buatPUM(conn, ctx, { tanggal: tgl(M1, 5), keperluan: 'Pameran pendidikan penerimaan mahasiswa baru di Jakarta', jumlah: 3000000, tanggal_selesai_kegiatan: tgl(M1, 14) }));
  await lakukan('dosen2', (conn, ctx) => ajukanPUM(conn, ctx, um1.id));
  await setujuiSemua('PUM', um1.id);
  aturHariIni(tgl(M1, 6));
  const um2 = await lakukan('dosen1', (conn, ctx) => buatPUM(conn, ctx, { tanggal: tgl(M1, 6), keperluan: 'Rapat asosiasi program studi akuntansi di Surabaya', jumlah: 2000000, tanggal_selesai_kegiatan: tgl(M1, 12) }));
  await lakukan('dosen1', (conn, ctx) => ajukanPUM(conn, ctx, um2.id));
  await setujuiSemua('PUM', um2.id);
  aturHariIni(tgl(M1, 7));
  await bkkLengkap({ jenis: 'UANG_MUKA', sumber_id: um1.id, tanggal: tgl(M1, 7), rekening_kas_id: bjb, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M1, 7), penerima_bank_nama: 'BCA', penerima_bank_rekening: '7771234567', penerima_bank_atas_nama: 'Rizky Ramadhan' }, { bayarPada: tgl(M1, 7) });
  await bkkLengkap({ jenis: 'UANG_MUKA', sumber_id: um2.id, tanggal: tgl(M1, 7), rekening_kas_id: bjb, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M1, 7), penerima_bank_nama: 'BCA', penerima_bank_rekening: '7779876543', penerima_bank_atas_nama: 'Fajar Nugraha' }, { bayarPada: tgl(M1, 7) });

  log('Transaksi bulan lalu: kas kecil ...');
  const pkkBulanLalu = [];
  pkkBulanLalu.push(await pkkDibayar('dosen1', tgl(M1, 5), 'KK-DKN', 'Pembelian alat tulis kantor', '6-1104', 450000, 'NT-0081'));
  pkkBulanLalu.push(await pkkDibayar('dosen2', tgl(M1, 7), 'KK-DKN', 'Konsumsi rapat koordinasi program studi', '6-1110', 650000, 'KW-1123'));
  pkkBulanLalu.push(await pkkDibayar('dosen1', tgl(M1, 11), 'KK-DKN', 'Ongkos kurir dokumen akreditasi', '6-1109', 300000, 'KW-1151'));
  pkkBulanLalu.push(await pkkDibayar('dosen1', tgl(M1, 13), 'KK-DKN', 'Fotokopi dan penjilidan laporan akreditasi', '6-1105', 800000, 'NT-2290'));
  pkkBulanLalu.push(await pkkDibayar('dosen2', tgl(M1, 19), 'KK-DKN', 'Konsumsi tamu kunjungan kerja sama', '6-1110', 900000, 'KW-1189'));
  await pkkDibayar('katu', tgl(M1, 14), 'KK-TU', 'Spidol dan penghapus papan tulis ruang kuliah', '5-1103', 750000, 'NT-7781');

  log('Transaksi bulan lalu: BKK dan pembayaran ...');
  aturHariIni(tgl(M1, 15));
  await bkkLengkap(
    { jenis: 'PEMBAYARAN_FAKTUR', pemasok_id: await idPemasok('BKN'), tanggal: tgl(M1, 11), rekening_kas_id: bjb, metode_bayar: 'CEK', tanggal_rencana_bayar: tgl(M1, 15), faktur: [{ faktur_id: faSaldoBKN.id, jumlah: 45000000 }, { faktur_id: fA.id, jumlah: 4440000 }] },
    { bayarPada: tgl(M1, 15) },
  );
  aturHariIni(tgl(M1, 16));
  await bkkLengkap({ jenis: 'PEMBAYARAN_FAKTUR', pemasok_id: await idPemasok('TMA'), tanggal: tgl(M1, 16), rekening_kas_id: bjb, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M1, 16), faktur: [{ faktur_id: fB.id, jumlah: 10900000 }] }, { bayarPada: tgl(M1, 16) });
  await bkkLengkap({ jenis: 'PERMINTAAN_PEMBAYARAN', sumber_id: pp1.id, tanggal: tgl(M1, 16), rekening_kas_id: bjb, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M1, 16) }, { bayarPada: tgl(M1, 16) });
  await bkkLengkap({ jenis: 'PERMINTAAN_PEMBAYARAN', sumber_id: pp2.id, tanggal: tgl(M1, 16), rekening_kas_id: bjb, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M1, 16), potongan: [{ pajak_id: await idPajak('PPH23'), dasar: 15000000 }] }, { bayarPada: tgl(M1, 16) });
  const bkkSewa = await bkkLengkap(
    { jenis: 'PERMINTAAN_PEMBAYARAN', sumber_id: pp3.id, tanggal: tgl(M1, 16), rekening_kas_id: bsi, metode_bayar: 'CEK', tanggal_rencana_bayar: tgl(M1, 16), potongan: [{ pajak_id: await idPajak('PPH42SEWA'), dasar: 20000000 }] },
    { bayarPada: tgl(M1, 16) },
  );
  aturHariIni(tgl(M1, 17));
  const byrSalah = await satu(pool, "SELECT id FROM pembayaran WHERE bkk_id = ? AND status = 'DIBAYAR'", [bkkSewa.id]);
  await lakukan('wd2', (conn, ctx) => batalPembayaran(conn, ctx, byrSalah.id, { alasan: 'Cek salah tulis nominal terbilang; fisik cek disimpan dan dicoret BATAL' }));
  await bayar(bkkSewa.id, tgl(M1, 17));

  aturHariIni(tgl(M1, 18));
  const pj1 = await lakukan('dosen2', async (conn, ctx) =>
    buatPJUM(conn, ctx, {
      uang_muka_id: um1.id, tanggal: tgl(M1, 18), keterangan: 'Pameran pendidikan selesai',
      baris: [
        { tanggal: tgl(M1, 12), uraian: 'Hotel dua malam', akun_id: await idAkun('6-2102'), nomor_bukti: 'HTL-5521', jumlah: 1500000 },
        { tanggal: tgl(M1, 12), uraian: 'Tiket kereta pulang pergi', akun_id: await idAkun('6-1111'), nomor_bukti: 'KAI-88213', jumlah: 800000 },
        { tanggal: tgl(M1, 13), uraian: 'Konsumsi tim promosi', akun_id: await idAkun('6-2102'), nomor_bukti: 'KW-5500', jumlah: 450000 },
      ],
    }),
  );
  await lampirkan('dosen2', 'PJUM', pj1.id, 'bukti-pameran.pdf', 'Bukti pengeluaran pameran pendidikan', ['Hotel Rp1.500.000', 'Kereta Rp800.000', 'Konsumsi Rp450.000']);
  await lakukan('dosen2', (conn, ctx) => ajukanPJUM(conn, ctx, pj1.id));
  await setujuiSemua('PJUM', pj1.id);
  aturHariIni(tgl(M1, 19));
  await lakukan('kasir1', (conn, ctx) => buatBKM(conn, ctx, { tanggal: tgl(M1, 19), rekening_kas_id: bjb, sumber: 'PENGEMBALIAN_UANG_MUKA', sumber_id: pj1.id, jumlah: 250000, keterangan: 'Setoran sisa uang muka pameran ke rekening BJB' }));
  aturHariIni(tgl(M1, 15));
  const pj2 = await lakukan('dosen1', async (conn, ctx) =>
    buatPJUM(conn, ctx, {
      uang_muka_id: um2.id, tanggal: tgl(M1, 15),
      baris: [
        { tanggal: tgl(M1, 10), uraian: 'Tiket pesawat Bandung-Surabaya', akun_id: await idAkun('6-1111'), nomor_bukti: 'TKT-0910', jumlah: 1650000 },
        { tanggal: tgl(M1, 11), uraian: 'Hotel satu malam', akun_id: await idAkun('6-1111'), nomor_bukti: 'HTL-7730', jumlah: 750000 },
      ],
    }),
  );
  await lampirkan('dosen1', 'PJUM', pj2.id, 'bukti-dinas.pdf', 'Bukti perjalanan rapat asosiasi di Surabaya', ['Tiket Rp1.650.000', 'Hotel Rp750.000']);
  await lakukan('dosen1', (conn, ctx) => ajukanPJUM(conn, ctx, pj2.id));
  await setujuiSemua('PJUM', pj2.id);
  aturHariIni(tgl(M1, 17));
  await bkkLengkap({ jenis: 'KEKURANGAN_UANG_MUKA', sumber_id: pj2.id, tanggal: tgl(M1, 17), rekening_kas_id: bjb, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M1, 17), penerima_bank_nama: 'BCA', penerima_bank_rekening: '7779876543', penerima_bank_atas_nama: 'Fajar Nugraha' }, { bayarPada: tgl(M1, 17) });

  aturHariIni(tgl(M1, 20));
  await bkkLengkap({ jenis: 'PEMBAYARAN_FAKTUR', pemasok_id: await idPemasok('BKN'), tanggal: tgl(M1, 20), rekening_kas_id: bjb, metode_bayar: 'BG', tanggal_rencana_bayar: tgl(M1, 20), faktur: [{ faktur_id: fC.id, jumlah: 168165000 }] }, { bayarPada: tgl(M1, 20), jatuhTempoBg: tgl(M0, 3) });

  aturHariIni(tgl(M1, 21));
  const pdk = await lakukan('kaskecil1', async (conn, ctx) => buatPDK(conn, ctx, { dana_id: await idDana('KK-DKN'), tanggal: tgl(M1, 21), keterangan: 'Pengisian kembali minggu ketiga', pkk_ids: pkkBulanLalu.map((k) => k.id) }));
  await lakukan('kaskecil1', (conn, ctx) => ajukanPDK(conn, ctx, pdk.id));
  aturHariIni(tgl(M1, 22));
  await bkkLengkap({ jenis: 'PENGISIAN_KAS_KECIL', sumber_id: pdk.id, tanggal: tgl(M1, 22), rekening_kas_id: bjb, metode_bayar: 'CEK', tanggal_rencana_bayar: tgl(M1, 22) }, { bayarPada: tgl(M1, 22) });

  aturHariIni(tgl(M1, 24));
  const um3 = await lakukan('dosen2', (conn, ctx) => buatPUM(conn, ctx, { tanggal: tgl(M1, 24), keperluan: 'Kunjungan promosi ke SMA mitra di Cirebon', jumlah: 1500000, tanggal_selesai_kegiatan: tgl(M1, 28) }));
  await lakukan('dosen2', (conn, ctx) => ajukanPUM(conn, ctx, um3.id));
  await setujuiSemua('PUM', um3.id);
  aturHariIni(tgl(M1, 25));
  await bkkLengkap({ jenis: 'UANG_MUKA', sumber_id: um3.id, tanggal: tgl(M1, 25), rekening_kas_id: bjb, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M1, 25), penerima_bank_nama: 'BCA', penerima_bank_rekening: '7771234567', penerima_bank_atas_nama: 'Rizky Ramadhan' }, { bayarPada: tgl(M1, 25) });
  const lembarRusak = await warkatBerikut('BJB-OPS', 'CEK');
  await lakukan('kasir1', (conn, ctx) => batalkanWarkatKosong(conn, ctx, lembarRusak, 'Lembar rusak tercetak ganda oleh printer bank'));

  log('Rekonsiliasi bank bulan lalu ...');
  const akhirM1 = akhirBulan(M1.tahun, M1.bulan);
  aturHariIni(akhirM1);
  const bayarBjb = await semua(pool, "SELECT id, tanggal, metode FROM pembayaran WHERE rekening_kas_id = ? AND status = 'DIBAYAR' AND tanggal <= ? ORDER BY id", [bjb, akhirM1]);
  for (const p of bayarBjb) {
    // BG bertanggal efektif bulan berjalan dan pembayaran terakhir bulan lalu belum kliring per akhir bulan.
    if (p.metode === 'BG' || p.tanggal >= tgl(M1, 25)) continue;
    const hariKliring = Math.min(Number(p.tanggal.slice(8, 10)) + (p.metode === 'CEK' ? 2 : 0), Number(akhirM1.slice(8, 10)));
    await lakukan('kasubag', (conn, ctx) => tandaiKliring(conn, ctx, p.id, tgl(M1, hariKliring)));
  }
  const rb = await lakukan('kasubag', (conn, ctx) => buatRekonsiliasi(conn, ctx, { rekening_kas_id: bjb, tahun: M1.tahun, bulan: M1.bulan, saldo_rekening_koran: 0 }));
  await lakukan('kasubag', (conn, ctx) => tambahPos(conn, ctx, rb.id, { jenis: 'BIAYA_BANK', tanggal: akhirM1, keterangan: 'Biaya administrasi rekening giro', jumlah: 25000 }));
  await lakukan('kasubag', (conn, ctx) => tambahPos(conn, ctx, rb.id, { jenis: 'JASA_GIRO', tanggal: akhirM1, keterangan: 'Jasa giro bulan berjalan', jumlah: 150000 }));
  await lakukan('kasubag', (conn, ctx) => tambahPos(conn, ctx, rb.id, { jenis: 'PAJAK_JASA_GIRO', tanggal: akhirM1, keterangan: 'PPh final atas jasa giro', jumlah: 30000 }));
  const hitungRb = await hitungRekonsiliasi(pool, await satu(pool, 'SELECT * FROM rekonsiliasi_bank WHERE id = ?', [rb.id]));
  // Saldo rekening koran demo = saldo buku disesuaikan + warkat beredar (seperti yang akan tercetak di rekening koran bank).
  const saldoKoran = hitungRb.saldo_buku_disesuaikan + hitungRb.total_warkat_beredar;
  await lakukan('kasubag', (conn, ctx) => ubahSaldoKoran(conn, ctx, rb.id, saldoKoran));
  await lakukan('kasubag', (conn, ctx) => finalkanRekonsiliasi(conn, ctx, rb.id));

  log('Transaksi bulan berjalan ...');
  const poD = await poLengkap(tgl(M0, 2), {
    pemasok_id: await idPemasok('SAT'), departemen_id: await idDept('TU'), keterangan: 'Alat tulis kantor untuk Tata Usaha',
    baris: [
      { uraian: 'Kertas HVS A4 80 gsm', jenis: 'BARANG', qty: 20, satuan: 'rim', harga: 55000, akun_id: await idAkun('6-1104') },
      { uraian: 'Tinta printer hitam', jenis: 'BARANG', qty: 10, satuan: 'botol', harga: 185000, akun_id: await idAkun('6-1104') },
    ],
  });
  aturHariIni(tgl(M0, 4));
  const bD = await barisPO(poD.id);
  await lakukan('rt1', (conn, ctx) => buatPenerimaan(conn, ctx, { jenis: 'LPB', tanggal: tgl(M0, 4), po_id: poD.id, nomor_surat_jalan: 'SJ-SAT-0911', baris: [{ po_detail_id: bD[0].id, qty: 15, catatan: '5 rim menyusul' }, { po_detail_id: bD[1].id, qty: 10 }] }));
  aturHariIni(tgl(M0, 5));
  const fD = await lakukan('stafkeu1', (conn, ctx) =>
    buatFaktur(conn, ctx, { po_id: poD.id, nomor_faktur: 'SAT-2209', tanggal_faktur: tgl(M0, 5), tanggal_terima: tgl(M0, 5), baris: [{ po_detail_id: bD[0].id, qty: 20, harga: 55000 }, { po_detail_id: bD[1].id, qty: 10, harga: 185000 }] }),
  );
  await lakukan('stafkeu1', (conn, ctx) => verifikasiFaktur(conn, ctx, fD.id));

  const poE = await poLengkap(tgl(M0, 3), {
    pemasok_id: await idPemasok('LCP'), departemen_id: await idDept('MNJ'), keterangan: 'Cetak spanduk dan brosur penerimaan mahasiswa baru',
    baris: [{ uraian: 'Jasa cetak spanduk dan brosur PMB', jenis: 'JASA', qty: 1, satuan: 'paket', harga: 4000000, akun_id: await idAkun('6-2102') }],
  });
  aturHariIni(tgl(M0, 6));
  const [dE] = await barisPO(poE.id);
  await lakukan('rt1', (conn, ctx) => buatPenerimaan(conn, ctx, { jenis: 'BAST', tanggal: tgl(M0, 6), po_id: poE.id, keterangan: 'Cetakan diterima Program Studi Manajemen', baris: [{ po_detail_id: dE.id, qty: 1 }] }));
  const fE = await lakukan('stafkeu1', async (conn, ctx) =>
    buatFaktur(conn, ctx, { po_id: poE.id, nomor_faktur: 'LCP-0906', tanggal_faktur: tgl(M0, 6), tanggal_terima: tgl(M0, 6), pajak_pph_id: await idPajak('PPH23'), baris: [{ po_detail_id: dE.id, qty: 1, harga: 4000000 }] }),
  );
  await lakukan('stafkeu1', (conn, ctx) => verifikasiFaktur(conn, ctx, fE.id));
  await lakukan('stafkeu1', async (conn, ctx) =>
    buatBKK(conn, ctx, { jenis: 'PEMBAYARAN_FAKTUR', pemasok_id: await idPemasok('LCP'), tanggal: tgl(M0, 7), rekening_kas_id: bjb, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M0, 13), faktur: [{ faktur_id: fE.id, jumlah: 3840000 }] }),
  );

  const poF = await poLengkap(tgl(M0, 8), {
    pemasok_id: await idPemasok('TPJ'), departemen_id: await idDept('TU'), ppn: true, keterangan: 'Perlengkapan presentasi ruang kuliah',
    baris: [{ uraian: 'Baterai dan pointer presentasi', jenis: 'BARANG', qty: 500, satuan: 'buah', harga: 32000, akun_id: await idAkun('5-1103') }],
  });
  aturHariIni(tgl(M0, 10));
  const [dF] = await barisPO(poF.id);
  await lakukan('rt1', (conn, ctx) => buatPenerimaan(conn, ctx, { jenis: 'LPB', tanggal: tgl(M0, 10), po_id: poF.id, nomor_surat_jalan: 'SJ-TPJ-0877', baris: [{ po_detail_id: dF.id, qty: 500 }] }));
  const fF = await lakukan('stafkeu1', (conn, ctx) =>
    buatFaktur(conn, ctx, { po_id: poF.id, nomor_faktur: 'TPJ/09/0144', nomor_faktur_pajak: '04002500123457002', tanggal_faktur: tgl(M0, 10), tanggal_terima: tgl(M0, 11), tanggal_jatuh_tempo: tambahHari(tanggalNyata, 5), baris: [{ po_detail_id: dF.id, qty: 500, harga: 32000 }] }),
  );
  await lakukan('stafkeu1', (conn, ctx) => verifikasiFaktur(conn, ctx, fF.id));
  aturHariIni(tgl(M0, 12));
  const bkkTpj = await lakukan('stafkeu1', async (conn, ctx) =>
    buatBKK(conn, ctx, { jenis: 'PEMBAYARAN_FAKTUR', pemasok_id: await idPemasok('TPJ'), tanggal: tgl(M0, 12), rekening_kas_id: bsi, metode_bayar: 'TRANSFER', tanggal_rencana_bayar: tgl(M0, 20), faktur: [{ faktur_id: fF.id, jumlah: 17760000 }] }),
  );
  await lakukan('stafkeu1', (conn, ctx) => ajukanBKK(conn, ctx, bkkTpj.id));

  aturHariIni(tgl(M0, 9));
  const pp4 = await lakukan('dosen2', async (conn, ctx) =>
    buatPP(conn, ctx, { tanggal: tgl(M0, 9), tanggal_dibutuhkan: tgl(M0, 20), penerima_nama: 'PT Iklan Digital Kreatif', penerima_bank_nama: 'BCA', penerima_bank_rekening: '4445556667', penerima_bank_atas_nama: 'PT Iklan Digital Kreatif', keterangan: 'Iklan media sosial penerimaan mahasiswa baru gelombang 2', dokumen_pendukung: 'Penawaran harga dan invoice', baris: [{ uraian: 'Paket iklan media sosial dua minggu', akun_id: await idAkun('6-2101'), jumlah: 7500000 }] }),
  );
  await lampirkan('dosen2', 'PP', pp4.id, 'invoice-iklan.pdf', 'Invoice iklan media sosial', ['Paket dua minggu', 'Rp7.500.000']);
  await lakukan('dosen2', (conn, ctx) => ajukanPP(conn, ctx, pp4.id));
  aturHariIni(tgl(M0, 11));
  const pp5 = await lakukan('dosen1', async (conn, ctx) =>
    buatPP(conn, ctx, { tanggal: tgl(M0, 11), penerima_nama: 'Percetakan Sinar Grafika', penerima_bank_nama: 'BNI', penerima_bank_rekening: '0123987654', penerima_bank_atas_nama: 'Percetakan Sinar Grafika', keterangan: 'Cetak brosur profil program studi', dokumen_pendukung: 'Penawaran harga', baris: [{ uraian: 'Cetak brosur 2.000 lembar', akun_id: await idAkun('6-1105'), jumlah: 2500000 }] }),
  );
  await lampirkan('dosen1', 'PP', pp5.id, 'penawaran-brosur.pdf', 'Penawaran cetak brosur', ['2.000 lembar', 'Rp2.500.000']);
  await lakukan('dosen1', (conn, ctx) => ajukanPP(conn, ctx, pp5.id));
  await lakukan('kaprodiakt', (conn, ctx) =>
    prosesKeputusan(conn, ctx, { jenis: 'PP', dokumenId: pp5.id, keputusan: 'TOLAK', catatan: 'Lampirkan penawaran pembanding dari minimal dua percetakan.' }),
  );

  await pkkDibayar('dosen1', tgl(M0, 8), 'KK-DKN', 'Materai dan perangko', '6-1109', 360000, 'KW-2001');
  await pkkDibayar('dosen2', tgl(M0, 10), 'KK-DKN', 'Konsumsi rapat evaluasi penerimaan mahasiswa baru', '6-1110', 540000, 'KW-2014');
  await pkkDibayar('dosen1', tgl(M0, 12), 'KK-DKN', 'Perbaikan kunci pintu ruang arsip', '6-1106', 275000, 'NT-3310', null);
  aturHariIni(tgl(M0, 13));
  const pkkMenunggu = await lakukan('dosen1', async (conn, ctx) => buatPKK(conn, ctx, { tanggal: tgl(M0, 13), dana_id: await idDana('KK-DKN'), keperluan: 'Pembelian galon air minum', akun_id: await idAkun('6-1110'), jumlah: 180000 }));
  await lakukan('dosen1', (conn, ctx) => ajukanPKK(conn, ctx, pkkMenunggu.id));

  aturHariIni(tgl(M0, 14));
  const opn = await lakukan('auditor1', async (conn, ctx) =>
    buatOpname(conn, ctx, {
      dana_id: await idDana('KK-DKN'),
      waktu_opname: `${tgl(M0, 14)} 09:30`,
      rincian: { kertas: { 100000: 80, 50000: 15, 20000: 12, 10000: 9, 5000: 2, 2000: 2, 1000: 1 }, logam: {} },
      keterangan: 'Opname mendadak; selisih kurang dijelaskan pemegang dana sebagai uang kembalian yang belum diterima',
    }),
  );
  await lakukan('auditor1', (conn, ctx) => ubahOpname(conn, ctx, opn.id, null, true));

  aturHariIni(null);
  hapusCachePengaturan();
  log('Data demo selesai dibuat.');
}

const dijalankanLangsung = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (dijalankanLangsung) {
  (async () => {
    if (process.argv.includes('--reset')) await migrasi({ reset: true });
    const ada = await satu(pool, "SELECT COUNT(*) AS n FROM pengguna WHERE username = 'stafkeu1'");
    if (ada.n > 0) {
      console.log('Data demo sudah ada. Jalankan dengan --reset untuk membuat ulang basis data dari awal.');
    } else {
      await isiDemo();
      console.log(`Semua akun demo memakai kata sandi ${SANDI_DEMO}; akun admin memakai Admin12345.`);
    }
    await pool.end();
  })().catch(async (err) => {
    console.error('Gagal membuat data demo:', err.message);
    if (err.detail) console.error(err.detail);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  });
}
