// Status masuk pengguna: memuat profil dari server, masuk, keluar, dan pemeriksaan peran.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, aturPenanganSesi, sesi } from './api.js';

const KonteksAuth = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  // memuat | masuk | keluar | galat
  const [status, setStatus] = useState(sesi.ambil() ? 'memuat' : 'keluar');
  const [data, setData] = useState(null);
  const [pesan, setPesan] = useState('');

  const muat = useCallback(async () => {
    setStatus('memuat');
    try {
      const d = await api.get('/auth/saya');
      setData(d);
      setStatus('masuk');
    } catch (e) {
      if (e.status === 401) {
        sesi.hapus();
        setStatus('keluar');
      } else {
        setPesan(e.message);
        setStatus('galat');
      }
    }
  }, []);

  useEffect(() => {
    if (sesi.ambil()) muat();
  }, [muat]);

  useEffect(() => {
    aturPenanganSesi((jenis, galat) => {
      if (jenis === 'KELUAR') {
        sesi.hapus();
        qc.clear();
        setData(null);
        setPesan(galat?.message || '');
        setStatus('keluar');
      }
      if (jenis === 'GANTI_SANDI') {
        setData((d) => (d ? { ...d, pengguna: { ...d.pengguna, harus_ganti_password: true } } : d));
      }
    });
  }, [qc]);

  const masuk = useCallback(
    async (username, password) => {
      const r = await api.post('/auth/masuk', { username, password });
      sesi.simpan(r.token);
      setPesan('');
      qc.clear();
      await muat();
      return r.pengguna;
    },
    [muat, qc],
  );

  const keluar = useCallback(async () => {
    try {
      await api.post('/auth/keluar');
    } catch {
      // Sesi mungkin sudah berakhir di server; tetap bersihkan sisi klien.
    }
    sesi.hapus();
    qc.clear();
    setData(null);
    setPesan('');
    setStatus('keluar');
  }, [qc]);

  const perbaruiPengguna = useCallback((pengguna) => setData((d) => ({ ...d, pengguna })), []);

  const nilai = useMemo(() => {
    const peran = data?.pengguna?.peran || [];
    return {
      status,
      pesan,
      pengguna: data?.pengguna || null,
      perusahaan: data?.perusahaan || {},
      punya: (...daftar) => daftar.flat().some((p) => peran.includes(p)),
      masuk,
      keluar,
      muat,
      perbaruiPengguna,
    };
  }, [status, pesan, data, masuk, keluar, muat, perbaruiPengguna]);

  return <KonteksAuth.Provider value={nilai}>{children}</KonteksAuth.Provider>;
}

export const useAuth = () => useContext(KonteksAuth);
