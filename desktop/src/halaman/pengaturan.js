// Halaman pengaturan alamat server. Pengujian koneksi dilakukan proses utama agar memakai sertifikat Windows.
const api = window.siapkasDesktop;
const alamat = document.getElementById('alamat');
const status = document.getElementById('status');
const tombolUji = document.getElementById('uji');
const tombolSimpan = document.getElementById('simpan');

function tampil(jenis, teks) {
  status.className = `status ${jenis}`;
  status.textContent = teks;
}

function sibuk(ya) {
  tombolUji.disabled = ya;
  tombolSimpan.disabled = ya;
}

api.infoHalaman().then((info) => {
  if (info.server) alamat.value = info.server;
  document.getElementById('versi').textContent = `Aplikasi desktop versi ${info.versi}`;
  if (info.dikunci) {
    alamat.disabled = true;
    sibuk(true);
    tampil('info', 'Alamat server diatur Bagian TI untuk komputer ini dan tidak dapat diubah dari aplikasi.');
  }
});

tombolUji.addEventListener('click', async () => {
  if (!alamat.value.trim()) return tampil('galat', 'Isi alamat server terlebih dahulu.');
  sibuk(true);
  tampil('info', 'Menghubungi server...');
  const r = await api.ujiServer(alamat.value);
  sibuk(false);
  if (r.ok) tampil('ok', `Terhubung ke SIAPKas versi ${r.versi} di ${r.server}. Waktu server ${r.waktu}.`);
  else tampil('galat', r.pesan);
});

document.getElementById('formulir').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!alamat.value.trim()) return tampil('galat', 'Isi alamat server terlebih dahulu.');
  sibuk(true);
  tampil('info', 'Menghubungi server...');
  const r = await api.simpanServer(alamat.value);
  if (!r.ok) {
    sibuk(false);
    tampil('galat', r.pesan);
  }
});
