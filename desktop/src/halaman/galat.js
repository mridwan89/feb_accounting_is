// Halaman galat koneksi: menampilkan alamat dan pesan dari Chromium, lalu menawarkan coba lagi.
const q = new URLSearchParams(location.search);
document.getElementById('rinci').textContent = `Alamat: ${q.get('alamat') || '-'}\nPesan: ${q.get('pesan') || '-'}\nWaktu: ${new Date().toLocaleString('id-ID')}`;
document.getElementById('ulang').addEventListener('click', () => window.siapkasDesktop.muatUlang());
const ubah = document.getElementById('ubah');
if (q.get('dikunci') === '1') ubah.remove();
else ubah.addEventListener('click', () => location.assign('pengaturan.html'));
