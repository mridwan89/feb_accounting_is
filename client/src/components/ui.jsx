// Komponen antarmuka yang dipakai bersama: tombol, kartu, formulir, tabel, dialog, notifikasi, dan konfirmasi.
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { STATUS, RUTE_DOKUMEN } from '../konstanta.js';
import { angka, rupiah, terbilang, uraiUang } from '../format.js';
import { Ikon } from './Ikon.jsx';

// ---------------------------------------------------------------- tombol dan tautan

export function Tombol({ varian = '', kecil, ikon, sibuk, children, className = '', type = 'button', disabled, ...rest }) {
  return (
    <button type={type} className={`tombol ${varian} ${kecil ? 'kecil' : ''} ${className}`} disabled={disabled || sibuk} {...rest}>
      {ikon && <Ikon nama={ikon} />}
      {sibuk ? 'Memproses...' : children}
    </button>
  );
}

export function TautanTombol({ ke, varian = '', kecil, ikon, children, ...rest }) {
  return (
    <Link to={ke} className={`tombol ${varian} ${kecil ? 'kecil' : ''}`} {...rest}>
      {ikon && <Ikon nama={ikon} />}
      {children}
    </Link>
  );
}

export function TautanDok({ jenis, id, children }) {
  if (!id) return children || '-';
  return <Link to={`${RUTE_DOKUMEN[jenis] || '/'}/${id}`}>{children}</Link>;
}

// ---------------------------------------------------------------- kerangka halaman

export function Status({ kode, label }) {
  if (!kode) return null;
  const [teks, nada] = STATUS[kode] || [kode, 'abu'];
  return <span className={`lencana ${nada}`}>{label || teks}</span>;
}

export function Kepala({ judul, sub, remah, status, aksi }) {
  useEffect(() => {
    document.title = `${judul} | SIAPKas`;
  }, [judul]);
  return (
    <div className="kepala">
      <div className="judul">
        {remah && (
          <div className="remah">
            {remah.map((r, i) => (
              <span key={i}>
                {i > 0 && ' / '}
                {r.ke ? <Link to={r.ke}>{r.label}</Link> : r.label}
              </span>
            ))}
          </div>
        )}
        <div className="baris-judul">
          <h1>{judul}</h1>
          {status}
        </div>
        {sub && <div className="lemah">{sub}</div>}
      </div>
      {aksi && <div className="aksi">{aksi}</div>}
    </div>
  );
}

export function Kartu({ judul, aksi, children, rapat, className = '', id }) {
  return (
    <section className={`kartu ${className}`} id={id}>
      {(judul || aksi) && (
        <div className="kartu-kepala">
          {typeof judul === 'string' ? <h2>{judul}</h2> : judul}
          {aksi && <div className="aksi" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{aksi}</div>}
        </div>
      )}
      <div className={`kartu-isi ${rapat ? 'rapat' : ''}`}>{children}</div>
    </section>
  );
}

export function Info({ butir }) {
  return (
    <div className="info">
      {butir.filter(Boolean).map(([label, nilai], i) => (
        <div className="butir" key={i}>
          <div className="label">{label}</div>
          <div className="nilai">{nilai === null || nilai === undefined || nilai === '' ? '-' : nilai}</div>
        </div>
      ))}
    </div>
  );
}

export function TotalRingkas({ baris, nilaiTerbilang }) {
  return (
    <>
      <div className="total-ringkas">
        {baris.filter(Boolean).map(([label, nilai, besar], i) => (
          <div className={`baris ${besar ? 'besar' : ''}`} key={i}>
            <span>{label}</span>
            <span className="angka">{rupiah(nilai)}</span>
          </div>
        ))}
      </div>
      {nilaiTerbilang !== undefined && <div className="terbilang">Terbilang: {terbilang(nilaiTerbilang)}</div>}
    </>
  );
}

export function Pesan({ jenis = 'info', judul, children }) {
  return (
    <div className={`pesan ${jenis}`} role={jenis === 'galat' ? 'alert' : undefined}>
      <Ikon nama={jenis === 'galat' || jenis === 'peringatan' ? 'peringatan' : 'centang'} width={18} height={18} style={{ flex: 'none', marginTop: 1 }} />
      <div>
        {judul && <strong style={{ display: 'block' }}>{judul}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Kosong({ judul = 'Belum ada data', children, aksi }) {
  return (
    <div className="kosong">
      <strong>{judul}</strong>
      {children}
      {aksi && <div>{aksi}</div>}
    </div>
  );
}

export function BarisKosong({ kolom, judul = 'Belum ada data', children }) {
  return (
    <tr>
      <td colSpan={kolom} style={{ background: '#fff' }}>
        <Kosong judul={judul}>{children}</Kosong>
      </td>
    </tr>
  );
}

export function Memuat({ teks = 'Memuat data...' }) {
  return <div className="memuat">{teks}</div>;
}

/** Tampilkan status kueri: memuat, galat, atau isi. */
export function Muat({ kueri, children }) {
  if (kueri.isPending) return <Memuat />;
  if (kueri.isError) {
    return (
      <Pesan jenis="galat" judul="Data gagal dimuat">
        {kueri.error.message}{' '}
        <button type="button" className="tombol hantu kecil" onClick={() => kueri.refetch()}>
          Coba lagi
        </button>
      </Pesan>
    );
  }
  return children(kueri.data);
}

export function Tab({ pilihan, aktif, onPilih }) {
  return (
    <div className="tab" role="tablist">
      {pilihan.map(([kunci, label]) => (
        <button key={kunci} type="button" role="tab" aria-selected={aktif === kunci} className={aktif === kunci ? 'aktif' : ''} onClick={() => onPilih(kunci)}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- formulir

export function useFormulir(awal) {
  const [nilai, setNilai] = useState(awal);
  const [galat, setGalat] = useState({});
  const atur = useCallback((kunci, v) => {
    setNilai((n) => ({ ...n, [kunci]: v }));
    setGalat((g) => (g[kunci] ? { ...g, [kunci]: undefined } : g));
  }, []);
  const ikat = (kunci) => ({ value: nilai[kunci] ?? '', onChange: (e) => atur(kunci, e.target.value) });
  return { nilai, setNilai, atur, ikat, galat, setGalat };
}

export function Kolom({ label, opsional, galat, bantuan, lebar = 4, children, className = '' }) {
  const idOtomatis = useId();
  const anak = isValidElement(children) && !children.props.id ? cloneElement(children, { id: idOtomatis }) : children;
  const idAnak = isValidElement(anak) ? anak.props.id : undefined;
  return (
    <div className={`kolom l${lebar} ${className}`}>
      {label && (
        <label htmlFor={idAnak}>
          {label}
          {opsional && <span className="opsional"> (opsional)</span>}
        </label>
      )}
      {anak}
      {galat ? <span className="galat">{galat}</span> : bantuan ? <span className="bantuan">{bantuan}</span> : null}
    </div>
  );
}

export function Masukan({ salah, className = '', ...rest }) {
  return <input className={`masukan ${salah ? 'salah' : ''} ${className}`} {...rest} />;
}

export function AreaTeks({ salah, className = '', rows = 3, ...rest }) {
  return <textarea className={`masukan ${salah ? 'salah' : ''} ${className}`} rows={rows} {...rest} />;
}

/** Pilihan native. `pilihan`: [[nilai, label]] atau [{ nilai, label }]. */
export function Pilihan({ pilihan, kosong, salah, className = '', ...rest }) {
  return (
    <select className={`masukan ${salah ? 'salah' : ''} ${className}`} {...rest}>
      {kosong !== undefined && <option value="">{kosong}</option>}
      {pilihan.map((p) => {
        const [nilai, label] = Array.isArray(p) ? p : [p.nilai, p.label];
        return (
          <option key={nilai} value={nilai}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

export function Centang({ label, checked, onChange, disabled, id }) {
  return (
    <label className="centang">
      <input type="checkbox" id={id} checked={!!checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      {label}
    </label>
  );
}

/** Masukan uang gaya Indonesia: pemisah ribuan titik, desimal koma. Nilai keluar berupa angka atau ''. */
export function InputUang({ value, onChange, salah, className = '', ...rest }) {
  const tampil = (v) => (v === '' || v === null || v === undefined ? '' : angka(v));
  const [teks, setTeks] = useState(tampil(value));
  const [fokus, setFokus] = useState(false);
  useEffect(() => {
    if (!fokus) setTeks(tampil(value));
  }, [value, fokus]);
  return (
    <input
      className={`masukan angka ${salah ? 'salah' : ''} ${className}`}
      inputMode="decimal"
      autoComplete="off"
      value={teks}
      onFocus={() => setFokus(true)}
      onBlur={() => {
        setFokus(false);
        setTeks(tampil(value));
      }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,-]/g, '');
        setTeks(t);
        onChange(uraiUang(t));
      }}
      {...rest}
    />
  );
}

/** Pilihan dengan pencarian ketik. `pilihan`: [{ nilai, label, sub?, cari? }]. */
export function Kombo({ id, pilihan = [], value, onChange, placeholder = 'Ketik untuk mencari', salah, disabled, batas = 150 }) {
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState('');
  const [sorot, setSorot] = useState(0);
  const daftarRef = useRef(null);
  const terpilih = pilihan.find((p) => String(p.nilai) === String(value ?? ''));
  const daftar = useMemo(() => {
    const kata = cari.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hasil = kata.length ? pilihan.filter((p) => kata.every((k) => `${p.label} ${p.sub || ''} ${p.cari || ''}`.toLowerCase().includes(k))) : pilihan;
    return hasil.slice(0, batas);
  }, [pilihan, cari, batas]);

  useEffect(() => {
    const el = daftarRef.current?.querySelector('li.sorot');
    el?.scrollIntoView({ block: 'nearest' });
  }, [sorot, buka]);

  const pilih = (p) => {
    onChange(p ? p.nilai : '');
    setBuka(false);
    setCari('');
  };

  return (
    <div className="kombo">
      <input
        id={id}
        className={`masukan ${salah ? 'salah' : ''}`}
        value={buka ? cari : terpilih?.label || ''}
        placeholder={terpilih && buka ? terpilih.label : placeholder}
        onFocus={() => {
          setBuka(true);
          setCari('');
          const i = daftar.findIndex((p) => String(p.nilai) === String(value ?? ''));
          setSorot(i >= 0 ? i : 0);
        }}
        onBlur={() => setBuka(false)}
        onChange={(e) => {
          setCari(e.target.value);
          setSorot(0);
          setBuka(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setBuka(true);
            setSorot((s) => Math.min(s + 1, daftar.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSorot((s) => Math.max(s - 1, 0));
          } else if (e.key === 'Enter') {
            if (buka && daftar[sorot]) {
              e.preventDefault();
              pilih(daftar[sorot]);
            }
          } else if (e.key === 'Escape') {
            setBuka(false);
          }
        }}
        disabled={disabled}
        role="combobox"
        aria-expanded={buka}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {buka && (
        <ul className="kombo-daftar" role="listbox" ref={daftarRef}>
          {daftar.length === 0 && <li className="kosong-kecil">Tidak ada yang cocok dengan pencarian ini</li>}
          {daftar.map((p, i) => (
            <li
              key={p.nilai}
              role="option"
              aria-selected={i === sorot}
              className={i === sorot ? 'sorot' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                pilih(p);
              }}
              onMouseEnter={() => setSorot(i)}
            >
              <span>{p.label}</span>
              {p.sub && <small>{p.sub}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- dialog

export function Modal({ judul, onTutup, children, kaki, lebar }) {
  useEffect(() => {
    const f = (e) => {
      if (e.key === 'Escape') onTutup?.();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onTutup]);
  return createPortal(
    <div className="latar-dialog">
      <div className={`dialog ${lebar ? 'lebar' : ''}`} role="dialog" aria-modal="true" aria-label={judul}>
        <div className="dialog-kepala">
          <h2>{judul}</h2>
          <button type="button" className="tombol-ikon" onClick={onTutup} aria-label="Tutup">
            <Ikon nama="silang" width={18} height={18} />
          </button>
        </div>
        <div className="dialog-isi">{children}</div>
        {kaki && <div className="dialog-kaki">{kaki}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- notifikasi singkat (toast)

const KonteksToast = createContext(null);

export function ToastProvider({ children }) {
  const [daftar, setDaftar] = useState([]);
  const tampil = useCallback((pesan, jenis) => {
    const id = `${Date.now()}-${Math.random()}`;
    setDaftar((d) => [...d.slice(-3), { id, pesan, jenis }]);
    setTimeout(() => setDaftar((d) => d.filter((t) => t.id !== id)), jenis === 'galat' ? 8000 : 4500);
  }, []);
  const nilai = useMemo(
    () => ({ sukses: (p) => tampil(p, 'sukses'), galat: (p) => tampil(p, 'galat'), info: (p) => tampil(p, 'info') }),
    [tampil],
  );
  return (
    <KonteksToast.Provider value={nilai}>
      {children}
      <div className="wadah-toast" role="status" aria-live="polite">
        {daftar.map((t) => (
          <div key={t.id} className={`toast ${t.jenis}`}>
            {t.pesan}
          </div>
        ))}
      </div>
    </KonteksToast.Provider>
  );
}

export const useToast = () => useContext(KonteksToast);

// ---------------------------------------------------------------- dialog konfirmasi dan alasan

const KonteksKonfirmasi = createContext(null);

/**
 * konfirmasi({ judul, pesan, label, bahaya, alasan: { label, wajib } })
 * menghasilkan null bila dibatalkan, atau { alasan } bila dilanjutkan.
 */
export function KonfirmasiProvider({ children }) {
  const [aktif, setAktif] = useState(null);
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState('');
  const konfirmasi = useCallback(
    (opsi) =>
      new Promise((resolve) => {
        setAlasan('');
        setGalat('');
        setAktif({ opsi, resolve });
      }),
    [],
  );
  const tutup = (hasil) => {
    aktif?.resolve(hasil);
    setAktif(null);
  };
  const lanjut = () => {
    if (aktif.opsi.alasan && aktif.opsi.alasan.wajib !== false && !alasan.trim()) {
      setGalat('Wajib diisi.');
      return;
    }
    tutup({ alasan: alasan.trim() });
  };
  return (
    <KonteksKonfirmasi.Provider value={konfirmasi}>
      {children}
      {aktif && (
        <Modal
          judul={aktif.opsi.judul}
          onTutup={() => tutup(null)}
          kaki={
            <>
              <Tombol onClick={() => tutup(null)}>Batal</Tombol>
              <Tombol varian={aktif.opsi.bahaya ? 'bahaya-penuh' : 'utama'} onClick={lanjut}>
                {aktif.opsi.label || 'Lanjutkan'}
              </Tombol>
            </>
          }
        >
          {aktif.opsi.pesan && <div style={{ marginBottom: 12 }}>{aktif.opsi.pesan}</div>}
          {aktif.opsi.alasan && (
            <Kolom label={aktif.opsi.alasan.label || 'Alasan'} galat={galat} bantuan={aktif.opsi.alasan.bantuan} lebar={12}>
              <AreaTeks
                salah={!!galat}
                value={alasan}
                autoFocus
                maxLength={aktif.opsi.alasan.maks || 255}
                onChange={(e) => {
                  setAlasan(e.target.value);
                  setGalat('');
                }}
              />
            </Kolom>
          )}
        </Modal>
      )}
    </KonteksKonfirmasi.Provider>
  );
}

export const useKonfirmasi = () => useContext(KonteksKonfirmasi);
