// Grafik ringan tanpa pustaka luar: kolom satu seri (SVG) dan batang mendatar berjenjang (umur utang).
// Mengikuti spesifikasi: batang <= 24px, ujung data membulat 4px, garis bantu tipis, label nilai selektif,
// tooltip saat kursor atau fokus papan ketik, serta tampilan tabel sebagai alternatif.
import { useState } from 'react';
import { rupiah, ringkas } from '../format.js';

function skalaRapi(maks, n = 4) {
  if (!(maks > 0)) return { puncak: 1, langkah: 0.25 };
  const kasar = maks / n;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  const r = kasar / pangkat;
  const langkah = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * pangkat;
  return { puncak: langkah * Math.ceil(maks / langkah), langkah };
}

function jalurKolom(x0, x1, yAtas, yDasar) {
  const h = yDasar - yAtas;
  if (h <= 0.5) return '';
  const r = Math.min(4, h, (x1 - x0) / 2);
  return `M${x0},${yDasar} L${x0},${yAtas + r} Q${x0},${yAtas} ${x0 + r},${yAtas} L${x1 - r},${yAtas} Q${x1},${yAtas} ${x1},${yAtas + r} L${x1},${yDasar} Z`;
}

/** data: [{ kategori, nilai, catatan? }] */
export function GrafikKolom({ data, judulTabel = 'Kategori', format = rupiah, formatSumbu = ringkas, warna = '#2a78d6', tinggi = 220, labelAria }) {
  const [aktif, setAktif] = useState(null);
  const [tabel, setTabel] = useState(false);
  const W = 640;
  const H = tinggi;
  const kiri = 52;
  const kanan = 12;
  const atas = 24;
  const bawah = 28;
  const lebarPlot = W - kiri - kanan;
  const tinggiPlot = H - atas - bawah;
  const { puncak, langkah } = skalaRapi(Math.max(0, ...data.map((d) => d.nilai)));
  const y = (v) => atas + tinggiPlot - (Math.max(v, 0) / puncak) * tinggiPlot;
  const band = lebarPlot / Math.max(data.length, 1);
  const lebarBatang = Math.min(24, band * 0.55);
  const iMaks = data.reduce((im, d, i) => (d.nilai > data[im].nilai ? i : im), 0);
  const label = new Set(data.length ? [iMaks, data.length - 1] : []);
  const garis = [];
  for (let v = 0; v <= puncak + langkah / 2; v += langkah) garis.push(v);

  return (
    <div>
      {tabel ? (
        <div className="tabel-bungkus">
          <table className="tabel">
            <thead>
              <tr>
                <th>{judulTabel}</th>
                <th className="angka">Nilai</th>
                {data.some((d) => d.catatan) && <th className="angka">Keterangan</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.kategori}>
                  <td>{d.kategori}</td>
                  <td className="angka">{format(d.nilai)}</td>
                  {data.some((x) => x.catatan) && <td className="angka">{d.catatan}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grafik">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labelAria}>
            <g className="sumbu">
              {garis.map((v) => (
                <g key={v}>
                  <line className={v === 0 ? 'dasar' : 'grid-garis'} x1={kiri} x2={W - kanan} y1={y(v)} y2={y(v)} />
                  <text x={kiri - 8} y={y(v) + 4} textAnchor="end">
                    {formatSumbu(v)}
                  </text>
                </g>
              ))}
            </g>
            {data.map((d, i) => {
              const cx = kiri + band * (i + 0.5);
              const yAtas = y(d.nilai);
              return (
                <g key={d.kategori}>
                  <path className="batang" d={jalurKolom(cx - lebarBatang / 2, cx + lebarBatang / 2, yAtas, y(0))} fill={warna} opacity={aktif === null || aktif === i ? 1 : 0.55} />
                  {label.has(i) && d.nilai > 0 && (
                    <text className="label-nilai" x={cx} y={yAtas - 7} textAnchor="middle">
                      {formatSumbu(d.nilai)}
                    </text>
                  )}
                  <text className="label-kategori" x={cx} y={H - 8} textAnchor="middle">
                    {d.kategori}
                  </text>
                  <rect
                    x={kiri + band * i}
                    y={atas}
                    width={band}
                    height={tinggiPlot}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${d.kategori}: ${format(d.nilai)}${d.catatan ? `, ${d.catatan}` : ''}`}
                    onMouseEnter={() => setAktif(i)}
                    onMouseLeave={() => setAktif(null)}
                    onFocus={() => setAktif(i)}
                    onBlur={() => setAktif(null)}
                  />
                </g>
              );
            })}
          </svg>
          {aktif !== null && data[aktif] && (
            <div className="tip" style={{ left: `${((kiri + band * (aktif + 0.5)) / W) * 100}%`, top: `${(y(data[aktif].nilai) / H) * 100}%` }}>
              <strong>{format(data[aktif].nilai)}</strong>
              <span>
                {data[aktif].kategori}
                {data[aktif].catatan ? ` · ${data[aktif].catatan}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="grafik-kaki">
        <span>Arahkan kursor atau fokus pada kolom untuk melihat nilainya.</span>
        <button type="button" className="tombol hantu kecil" onClick={() => setTabel((t) => !t)}>
          {tabel ? 'Tampilkan grafik' : 'Tampilkan tabel'}
        </button>
      </div>
    </div>
  );
}

/** data: [{ label, nilai, warna }] ; label nilai hanya pada batang terbesar, sisanya lewat tooltip dan tabel. */
export function GrafikBatangH({ data, format = rupiah, formatRingkas = ringkas }) {
  const [aktif, setAktif] = useState(null);
  const [tabel, setTabel] = useState(false);
  const maks = Math.max(0, ...data.map((d) => d.nilai)) || 1;
  const total = data.reduce((a, d) => a + d.nilai, 0);
  const iMaks = data.reduce((im, d, i) => (d.nilai > data[im].nilai ? i : im), 0);
  const persen = (v) => (total > 0 ? `${((v / total) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%` : '0%');

  return (
    <div>
      {tabel ? (
        <table className="tabel">
          <thead>
            <tr>
              <th>Kelompok</th>
              <th className="angka">Nilai</th>
              <th className="angka">Porsi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td className="angka">{format(d.nilai)}</td>
                <td className="angka">{persen(d.nilai)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="angka">{format(total)}</td>
              <td className="angka">100%</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div className="batang-h">
          {data.map((d, i) => (
            <div
              className="baris"
              key={d.label}
              tabIndex={0}
              aria-label={`${d.label}: ${format(d.nilai)}, ${persen(d.nilai)} dari total`}
              onMouseEnter={() => setAktif(i)}
              onMouseLeave={() => setAktif(null)}
              onFocus={() => setAktif(i)}
              onBlur={() => setAktif(null)}
            >
              <div className="label">{d.label}</div>
              <div className="jalur">
                {d.nilai > 0 && <div className="isi-batang" style={{ width: `${(d.nilai / maks) * 78}%`, background: d.warna }} />}
                {i === iMaks && d.nilai > 0 && <span className="nilai">{formatRingkas(d.nilai)}</span>}
              </div>
              {aktif === i && (
                <div className="tip" style={{ left: '60%', top: 2 }}>
                  <strong>{format(d.nilai)}</strong>
                  <span>
                    {d.label} · {persen(d.nilai)} dari total
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="grafik-kaki">
        <span>Total {format(total)}</span>
        <button type="button" className="tombol hantu kecil" onClick={() => setTabel((t) => !t)}>
          {tabel ? 'Tampilkan grafik' : 'Tampilkan tabel'}
        </button>
      </div>
    </div>
  );
}

/** Jenjang warna ordinal umur utang: terang = belum jatuh tempo, gelap = paling lama lewat. */
export const WARNA_UMUR = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
