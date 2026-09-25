// Ikon garis sederhana (24x24) yang digambar sendiri agar aplikasi tidak bergantung pada pustaka atau internet.

const JALUR = {
  beranda: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  setuju: (
    <>
      <path d="M3 13h5l1.5 3h5L16 13h5" />
      <path d="M5 5h14l2 8v6H3v-6z" />
    </>
  ),
  dokumen: (
    <>
      <path d="M14 3H6v18h12V7z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  dompet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M16 15h2" />
      <path d="M6 6l10-3 1 3" />
    </>
  ),
  centang: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  koin: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  keranjang: (
    <>
      <path d="M3 4h2l2.5 11h11L21 8H6.2" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </>
  ),
  kotak: (
    <>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4" />
      <path d="M12 11v10" />
    </>
  ),
  gedung: (
    <>
      <path d="M4 21V5l8-2v18" />
      <path d="M12 9h8v12" />
      <path d="M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2" />
      <path d="M2 21h20" />
    </>
  ),
  faktur: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  keluar: (
    <>
      <path d="M4 13v7h16v-7" />
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
    </>
  ),
  masuk: (
    <>
      <path d="M4 13v7h16v-7" />
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
    </>
  ),
  bayar: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </>
  ),
  cek: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="1" />
      <path d="M6 14h7M16 14h2M6 10h3" />
    </>
  ),
  timbang: (
    <>
      <path d="M12 3v18" />
      <path d="M5 7h14" />
      <path d="M5 7l-3 7a3 3 0 006 0z" />
      <path d="M19 7l-3 7a3 3 0 006 0z" />
      <path d="M8 21h8" />
    </>
  ),
  brankas: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 8v1M12 15v1M8 12h1M15 12h1" />
    </>
  ),
  isi: (
    <>
      <path d="M20 11a8 8 0 00-14.3-4.9L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0014.3 4.9L20 16" />
      <path d="M20 21v-5h-5" />
    </>
  ),
  hitung: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </>
  ),
  buku: (
    <>
      <path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z" />
      <path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z" />
    </>
  ),
  pena: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  kalender: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  grafik: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16v-5M12 16V6M17 16v-8" />
    </>
  ),
  daftar: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  persen: (
    <>
      <path d="M19 5L5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  bank: (
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" />
      <path d="M3 21h18" />
    </>
  ),
  orang: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0" />
      <path d="M16 4.5a3.5 3.5 0 010 7" />
      <path d="M18 14a6 6 0 013.5 6" />
    </>
  ),
  tangga: <path d="M4 20h5v-5h5v-5h5V5" />,
  perisai: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  gerigi: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  jejak: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  layar: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  cetak: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M6 14h12v7H6z" />
    </>
  ),
  tambah: <path d="M12 5v14M5 12h14" />,
  silang: <path d="M6 6l12 12M18 6L6 18" />,
  unggah: (
    <>
      <path d="M4 16v4h16v-4" />
      <path d="M12 4v12" />
      <path d="M7 9l5-5 5 5" />
    </>
  ),
  unduh: (
    <>
      <path d="M4 16v4h16v-4" />
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
    </>
  ),
  keluarAkun: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  kunci: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  kembali: <path d="M19 12H5M12 19l-7-7 7-7" />,
  klip: <path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7" />,
  peringatan: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18h.01" />
    </>
  ),
  kirim: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </>
  ),
  mata: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

export function Ikon({ nama, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {JALUR[nama] || JALUR.dokumen}
    </svg>
  );
}
