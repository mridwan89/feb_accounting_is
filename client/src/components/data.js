// Kait (hook) pengambilan data dan penjalan aksi yang memperbarui seluruh data aktif setelah berhasil.
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { useToast } from './ui.jsx';

/** Ambil data GET dari API. url null = jangan ambil. */
export function useApi(url, opsi = {}) {
  return useQuery({ queryKey: [url], queryFn: () => api.get(url), ...opsi, enabled: !!url && opsi.enabled !== false });
}

/**
 * Jalankan aksi (POST/PUT/DELETE), lalu segarkan data. Hasil: { ok, hasil } atau { ok: false, galat }.
 * Pesan galat ditampilkan sebagai notifikasi; galat per kolom dikirim ke setGalat bila ada.
 */
export function useAksi() {
  const qc = useQueryClient();
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const jalankan = useCallback(
    async (fn, { sukses, setGalat } = {}) => {
      setSibuk(true);
      try {
        const hasil = await fn();
        setGalat?.({});
        await qc.invalidateQueries();
        if (sukses) toast.sukses(typeof sukses === 'function' ? sukses(hasil) : sukses);
        return { ok: true, hasil };
      } catch (err) {
        setGalat?.(err.galat || {});
        toast.galat(err.message || 'Terjadi kesalahan. Coba lagi.');
        return { ok: false, galat: err };
      } finally {
        setSibuk(false);
      }
    },
    [qc, toast],
  );
  return { jalankan, sibuk };
}

const LAMA = { staleTime: 5 * 60_000 };

/**
 * Akun detail aktif sebagai pilihan Kombo. `kategori` membatasi daftar; `pembebanan` membuang akun kas/bank/kas kecil
 * dan Utang Usaha (aturan yang sama dengan validasi server untuk PP, PJUM, dan PKK).
 */
export function usePilihanAkun({ kategori, pembebanan = false, semua = false } = {}) {
  const q = useApi(semua ? '/akun' : '/akun?detail=1&aktif=1', LAMA);
  const kas = useApi(pembebanan ? '/rekening-kas' : null, LAMA);
  const dana = useApi(pembebanan ? '/dana-kas-kecil' : null, LAMA);
  const atur = useApi(pembebanan ? '/pengaturan' : null, LAMA);
  const kunciKategori = kategori ? kategori.join(',') : '';
  return useMemo(() => {
    const akunKas = new Set([...(kas.data || []).map((r) => r.akun_id), ...(dana.data || []).map((d) => d.akun_id)]);
    const kodeUtang = pembebanan ? (atur.data || []).find((p) => p.kunci === 'akun_utang_usaha')?.nilai : null;
    const bolehKategori = kunciKategori ? kunciKategori.split(',') : null;
    return (q.data || [])
      .filter((a) => !bolehKategori || bolehKategori.includes(a.kategori))
      .filter((a) => !akunKas.has(a.id) && a.kode !== kodeUtang)
      .map((a) => ({ nilai: a.id, label: `${a.kode} ${a.nama}`, sub: a.kategori.toLowerCase(), kode: a.kode }));
  }, [q.data, kas.data, dana.data, atur.data, kunciKategori, pembebanan]);
}

export function usePilihanPemasok({ aktif = true } = {}) {
  const q = useApi(aktif ? '/pemasok?aktif=1' : '/pemasok', LAMA);
  return useMemo(
    () => (q.data || []).map((p) => ({ nilai: p.id, label: p.nama, sub: `${p.kode}${p.kota ? `, ${p.kota}` : ''}${p.npwp ? '' : ', tanpa NPWP'}`, data: p })),
    [q.data],
  );
}

export function useDepartemen() {
  return useApi('/departemen', LAMA);
}

export function useRekening() {
  return useApi('/rekening-kas', LAMA);
}

export function usePajak() {
  return useApi('/pajak', LAMA);
}

export function useDana() {
  return useApi('/dana-kas-kecil');
}
