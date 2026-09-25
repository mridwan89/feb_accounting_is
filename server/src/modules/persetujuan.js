import { Router } from 'express';
import { pool, tx } from '../db.js';
import { z, validasi, teksOpsional } from '../lib/validasi.js';
import { tugasPersetujuan, riwayatPersetujuan, bolehMemutuskan } from '../lib/persetujuan.js';
import { prosesKeputusan } from '../lib/alur.js';
import { pastikanBolehLihat } from '../lib/dokumen.js';

export const router = Router();

export const LABEL_JENIS = {
  PO: 'Pesanan pembelian',
  FB: 'Faktur pemasok (selisih pencocokan)',
  PP: 'Permintaan pembayaran',
  PUM: 'Permintaan uang muka',
  PJUM: 'Pertanggungjawaban uang muka',
  PKK: 'Pengeluaran kas kecil',
  BKK: 'Bukti kas keluar',
  JM: 'Bukti memorial',
};

router.get('/persetujuan/tugas', async (req, res) => {
  const rows = await tugasPersetujuan(pool, req.user);
  res.json(rows.map((r) => ({ ...r, jenis_label: LABEL_JENIS[r.jenis_dokumen] || r.jenis_dokumen })));
});

router.get('/persetujuan/:jenis/:id', async (req, res) => {
  const { jenis } = req.params;
  const idDok = Number(req.params.id);
  await pastikanBolehLihat(pool, req.user, jenis, idDok);
  res.json({
    riwayat: await riwayatPersetujuan(pool, jenis, idDok),
    boleh_memutuskan: await bolehMemutuskan(pool, req.user, jenis, idDok),
  });
});

const skemaKeputusan = z.object({ catatan: teksOpsional(500) });

for (const [aksi, keputusan] of [['setujui', 'SETUJUI'], ['tolak', 'TOLAK']]) {
  router.post(`/persetujuan/:jenis/:id/${aksi}`, async (req, res) => {
    const { catatan } = validasi(skemaKeputusan, req.body);
    const hasil = await tx((conn) =>
      prosesKeputusan(conn, req.ctx, { jenis: req.params.jenis, dokumenId: Number(req.params.id), keputusan, catatan }),
    );
    res.json(hasil);
  });
}
