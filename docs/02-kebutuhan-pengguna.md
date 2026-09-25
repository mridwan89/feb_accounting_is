# Spesifikasi kebutuhan pengguna

Versi 1.0, 25 September 2026. Dokumen ini menetapkan apa yang harus dapat dilakukan SIAPKas, untuk siapa, dan bagaimana setiap kebutuhan diuji. Setelah disetujui Pemilik Proses, dokumen ini menjadi dasar pengembangan dan UAT.

## 1. Pendahuluan

### 1.1 Cara kebutuhan dikumpulkan

| Teknik | Sasaran | Keluaran |
|---|---|---|
| Wawancara terstruktur | Setiap fungsi pada tabel 2.2 | Catatan wawancara, daftar masalah |
| Observasi | Proses pembayaran, kas kecil, rekonsiliasi bank | Waktu proses nyata per langkah |
| Penelusuran dokumen | 30 transaksi pembayaran terakhir, ditelusuri dari permintaan sampai jurnal | Titik lemah kontrol dan dokumen yang hilang |
| Kajian dokumen | Formulir berlaku, bagan akun, kebijakan otorisasi, SAD v1.1 | Daftar data dan aturan yang harus dipertahankan |
| Lokakarya purwarupa | Pengguna kunci mencoba alur di aplikasi rilis awal | Daftar ketidaksesuaian dan kebutuhan tambahan |

Isi dokumen versi 1.0 ini disusun dari SAD v1.1, praktik sistem akuntansi pengeluaran kas yang lazim (fungsi, dokumen, catatan, jaringan prosedur, dan unsur pengendalian intern), serta ketentuan perpajakan dan kearsipan yang berlaku di Indonesia. Angka volume dan masalah pada bagian 2 dan 3 adalah asumsi kerja yang wajib divalidasi dengan panduan wawancara di Lampiran A.

### 1.2 Konvensi

| Kode | Arti |
|---|---|
| M-nn | Masalah saat ini |
| KB-nn | Kebutuhan bisnis |
| KF-MOD-nn | Kebutuhan fungsional per modul |
| AB-nn | Aturan bisnis |
| US-nn | Cerita pengguna (*user story*) beserta kriteria penerimaan |
| KNF-nn | Kebutuhan nonfungsional |
| LAP-nn | Kebutuhan laporan |

Prioritas memakai metode MoSCoW: **W** = wajib ada saat go-live, **S** = sebaiknya ada, **B** = bisa ditambahkan bila waktu memungkinkan, **T** = tidak di Fase 1.

## 2. Profil organisasi dan pengguna

### 2.1 Unit kerja terkait

| Kode | Departemen | Keterlibatan dalam pengeluaran kas |
|---|---|---|
| DIR | Direksi | Otorisasi nilai besar |
| KEU | Keuangan dan Akuntansi | Pencatatan utang, verifikasi, kas, rekonsiliasi, tutup buku |
| PBL | Pembelian | Pesanan pembelian dan data pemasok |
| GDG | Gudang | Penerimaan barang |
| PRD | Produksi | Pemohon pembelian dan kas kecil pabrik |
| PMS | Pemasaran | Pemohon uang muka kegiatan dan pembayaran jasa |
| UMS | Umum dan SDM | Pemohon tagihan rutin, pemegang kas kecil kantor pusat |
| TI | Teknologi Informasi | Administrasi sistem |
| SPI | Satuan Pengawasan Intern | Pemeriksaan dan opname |

### 2.2 Peran pengguna

Setiap peran dipetakan ke fungsi dalam sistem akuntansi pengeluaran kas: fungsi yang memerlukan pembayaran, fungsi akuntansi, fungsi kas, fungsi otorisasi, dan fungsi pemeriksa intern.

| Kode peran | Nama peran | Fungsi | Perkiraan jumlah pengguna | Tanggung jawab di sistem |
|---|---|---|---|---|
| PEMOHON | Pemohon | Fungsi yang memerlukan pembayaran | hingga 200 | Membuat permintaan pembayaran, uang muka, pertanggungjawaban, pengeluaran kas kecil |
| KEPALA_DEPT | Kepala Departemen | Otorisasi di departemen | 9 | Menyetujui dokumen dari departemennya |
| PEMBELIAN | Staf Pembelian | Fungsi pembelian | 3 | Membuat PO, memelihara data pemasok |
| GUDANG | Staf Gudang | Fungsi penerimaan | 4 | Mencatat LPB dan BAST |
| AKUNTANSI | Staf Akuntansi Utang | Fungsi akuntansi (pencatat utang) | 3 | Mencatat faktur, membuat BKK, memproses pengisian kas kecil, jurnal manual |
| SPV_AKUNTANSI | Kepala Bagian Akuntansi | Fungsi akuntansi (penyelia) | 1 | Memeriksa BKK, memverifikasi pertanggungjawaban uang muka dan rekening pemasok, rekonsiliasi bank, bagan akun |
| MANAJER_KEUANGAN | Manajer Keuangan | Otorisasi keuangan | 1 | Menyetujui BKK dan jurnal manual, menyetujui selisih pencocokan, membatalkan pembayaran, menutup periode |
| DIREKTUR | Direktur Keuangan | Otorisasi tertinggi | 1 | Menyetujui BKK dan PO bernilai besar |
| KASIR | Kasir | Fungsi kas | 2 | Membayar BKK, mengelola buku cek, mencatat kas masuk |
| KAS_KECIL | Pemegang Kas Kecil | Fungsi kas kecil | 3 | Membayar pengeluaran kas kecil, mengajukan pengisian kembali |
| AUDITOR | Auditor Internal | Fungsi pemeriksa intern | 2 | Membaca seluruh data, opname kas kecil, log audit, laporan pengecualian |
| ADMIN | Administrator Sistem | Fungsi TI | 2 | Akun pengguna, aturan persetujuan, pengaturan |

Satu akun dapat memegang lebih dari satu peran selama kombinasinya tidak tercantum di matriks konflik peran (dokumen D04 bagian 3).

### 2.3 Asumsi volume transaksi

| Transaksi | Per bulan | Puncak per hari | Keterangan |
|---|---|---|---|
| Pesanan pembelian | 250 | 25 | |
| LPB dan BAST | 300 | 30 | Termasuk penerimaan sebagian |
| Faktur pemasok | 280 | 40 | Puncak minggu terakhir bulan |
| Permintaan pembayaran nonpembelian | 150 | 20 | Listrik, air, sewa, jasa, langganan |
| Uang muka kerja | 40 | 5 | Perjalanan dinas dan kegiatan pemasaran |
| Pengeluaran kas kecil | 400 | 30 | Tiga dana kas kecil |
| BKK | 350 | 45 | |
| Pembayaran (cek, bilyet giro, transfer) | 330 | 45 | |
| Pemasok aktif | 300 | | |

Pertumbuhan diasumsikan 20% per tahun. Pada volume ini basis data tanpa lampiran tumbuh kurang dari 1 GB per tahun, sedangkan lampiran hasil pindai sekitar 9 GB per tahun (rata-rata 500 KB per berkas).

### 2.4 Persona

**Staf Akuntansi Utang.** Mencatat 15 sampai 20 faktur per hari. Untuk setiap faktur harus membuka berkas PO dari Pembelian dan fotokopi LPB dari Gudang, lalu mencocokkan baris demi baris. Kebutuhan utamanya: faktur langsung tercocokkan dengan PO dan LPB, dan faktur yang sudah dibayar tidak mungkin tercatat lagi.

**Kasir.** Mengeluarkan 10 sampai 45 pembayaran per hari. Menulis register cek dengan tangan dan harus mengecek tanda tangan persetujuan sebelum membayar. Kebutuhannya: antrean BKK yang pasti sudah disetujui lengkap, nomor cek yang diusulkan sistem, dan cetakan tanda terima.

**Manajer Keuangan.** Menyetujui sekitar 80 BKK per minggu, sering di sela rapat. Kebutuhannya: satu layar yang memuat BKK, faktur sumber, lampiran, dan persetujuan sebelumnya, serta daftar utang jatuh tempo untuk merencanakan saldo bank.

**Kepala Departemen.** Menyetujui permintaan dari stafnya tanpa tahu apakah permintaan itu sudah dibayar. Kebutuhannya: kotak persetujuan yang hanya berisi dokumen departemennya dan status pembayaran yang dapat dilacak.

**Pemegang Kas Kecil.** Memegang dana Rp10.000.000 dan harus menunggu hingga 5 hari kerja untuk pengisian kembali. Kebutuhannya: saldo tunai selalu terlihat, dan pengisian kembali dapat diajukan dari bukti yang sudah tercatat tanpa menyalin ulang.

**Auditor Internal.** Menemukan selisih kas kecil dan uang muka yang tidak dipertanggungjawabkan pada audit terakhir. Kebutuhannya: log audit, laporan pengecualian, dan berita acara opname yang tercetak dari sistem.

## 3. Masalah dan kebutuhan bisnis

### 3.1 Masalah saat ini

| Kode | Masalah | Akibat |
|---|---|---|
| M-01 | Pencocokan PO, LPB, dan faktur manual di tiga berkas | Risiko pembayaran ganda atau pembayaran atas barang yang belum diterima |
| M-02 | Persetujuan bergantung pada perpindahan berkas fisik | Rata-rata ±9 hari kerja dari faktur diterima sampai siap dibayar |
| M-03 | Jatuh tempo utang tidak terpantau | Denda keterlambatan, potongan tunai hilang, hubungan pemasok memburuk |
| M-04 | Register cek dan bilyet giro ditulis tangan | Lembar batal atau hilang tidak terdeteksi |
| M-05 | Bukti kas kecil tercecer, pengisian kembali lambat | Selisih kas saat opname, dana sering habis |
| M-06 | Uang muka tidak dipertanggungjawabkan tepat waktu | Saldo uang muka menumpuk dan tidak jelas umurnya |
| M-07 | Daftar cek beredar disusun ulang setiap bulan | Rekonsiliasi bank butuh 4 sampai 5 hari kerja |
| M-08 | Jurnal diketik ulang dari formulir | Input ganda dan salah ketik |
| M-09 | Tidak ada jejak siapa mengubah apa | Sulit menelusuri kesalahan dan kecurangan |

### 3.2 Kebutuhan bisnis

| Kode | Kebutuhan bisnis | Menjawab |
|---|---|---|
| KB-01 | Setiap pengeluaran kas didukung dokumen sumber yang lengkap dan diotorisasi pejabat berwenang sesuai nilainya | M-02, M-09 |
| KB-02 | Utang hanya dibayar untuk barang atau jasa yang dipesan, diterima, dan ditagih dengan harga pesanan | M-01 |
| KB-03 | Satu kewajiban tidak mungkin dibayar dua kali | M-01 |
| KB-04 | Jatuh tempo utang dan kebutuhan kas terlihat setiap saat | M-03 |
| KB-05 | Setiap lembar cek dan bilyet giro dapat dipertanggungjawabkan | M-04 |
| KB-06 | Dana kas kecil selalu dapat dicocokkan antara uang tunai dan bukti | M-05 |
| KB-07 | Uang muka dipertanggungjawabkan sebelum tenggat | M-06 |
| KB-08 | Rekonsiliasi bank selesai paling lama 3 hari kerja | M-07 |
| KB-09 | Jurnal terbentuk otomatis dari transaksi | M-08 |
| KB-10 | Seluruh perubahan data tercatat dan tugas yang bertentangan terpisah | M-09 |

## 4. Kebutuhan fungsional

### 4.1 Administrasi dan keamanan (ADM)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-ADM-01 | Pengguna masuk dengan nama pengguna dan kata sandi. Akun terkunci 15 menit setelah 5 kali gagal berturut-turut | Semua | W |
| KF-ADM-02 | Pengguna wajib mengganti kata sandi saat pertama masuk dan setelah direset. Kata sandi minimal 8 karakter, memuat huruf dan angka, dan tidak sama dengan nama pengguna | Semua | W |
| KF-ADM-03 | Sesi berakhir setelah 30 menit tanpa aktivitas (dapat diatur) | Semua | W |
| KF-ADM-04 | Administrator menambah, mengubah, menonaktifkan akun, mereset kata sandi, serta mengatur peran dan departemen. Akun tidak dihapus, hanya dinonaktifkan | ADMIN | W |
| KF-ADM-05 | Sistem menolak kombinasi peran yang tercantum di matriks konflik peran dan menyebutkan alasannya | ADMIN | W |
| KF-ADM-06 | Administrator mengelola aturan persetujuan: jenis dokumen, urutan langkah, peran, lingkup departemen, batas nilai, dan peran pengganti | ADMIN | W |
| KF-ADM-07 | Administrator mengelola pengaturan: profil perusahaan untuk kop formulir, toleransi pencocokan, tenggat pertanggungjawaban uang muka, parameter keamanan, dan pemetaan akun sistem | ADMIN | W |
| KF-ADM-08 | Sistem mencatat log audit untuk setiap penambahan, perubahan, perubahan status, masuk, keluar, dan gagal masuk: waktu, pengguna, alamat IP, entitas, data sebelum dan sesudah. Log tidak dapat diubah dari aplikasi | Sistem | W |
| KF-ADM-09 | Administrator dan Auditor mencari log audit berdasarkan tanggal, pengguna, entitas, dan aksi | ADMIN, AUDITOR | W |
| KF-ADM-10 | Administrator melihat sesi aktif dan dapat mengakhiri sesi pengguna tertentu | ADMIN | S |

### 4.2 Data master (MST)

| Kode | Kebutuhan | Pengelola | Prioritas |
|---|---|---|---|
| KF-MST-01 | Departemen: kode, nama, status aktif | ADMIN | W |
| KF-MST-02 | Bagan akun: kode, nama, kategori, saldo normal, akun induk, tipe (induk atau detail), status aktif. Hanya akun detail yang aktif dapat dipakai transaksi | SPV_AKUNTANSI | W |
| KF-MST-03 | Pemasok: kode, nama, alamat, NPWP, status PKP, rekening bank (bank, nomor, atas nama), termin pembayaran, kontak | PEMBELIAN | W |
| KF-MST-04 | Perubahan rekening bank pemasok membuat rekening berstatus belum terverifikasi. Kepala Bagian Akuntansi memverifikasi sebelum BKK transfer ke pemasok itu dapat diajukan | SPV_AKUNTANSI | W |
| KF-MST-05 | Rekening kas dan bank Perusahaan: kode, nama, bank, nomor rekening, akun buku besar | MANAJER_KEUANGAN | W |
| KF-MST-06 | Buku cek dan bilyet giro: rekening, jenis, nomor awal dan akhir. Sistem membuat daftar lembar warkat satu per satu | KASIR | W |
| KF-MST-07 | Kode pajak: nama, jenis (PPN atau PPh), tarif, akun, dan penanda tarif naik 100% untuk pemasok tanpa NPWP | SPV_AKUNTANSI | W |
| KF-MST-08 | Dana kas kecil: nama, pemegang, akun, jumlah dana tetap, batas per transaksi | MANAJER_KEUANGAN | W |
| KF-MST-09 | Data master yang sudah dipakai transaksi tidak dapat dihapus, hanya dinonaktifkan | Semua pengelola | W |

### 4.3 Pembelian: PO dan LPB/BAST (PBL)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-PBL-01 | Membuat PO: pemasok, departemen peminta, tanggal, tanggal kirim, termin, baris (uraian, jenis barang atau jasa, kuantitas, satuan, harga, akun), dan PPN. Sistem menghitung subtotal, PPN, dan total | PEMBELIAN | W |
| KF-PBL-02 | PO diajukan untuk persetujuan berjenjang sesuai matriks otorisasi. PO yang disetujui dapat dicetak untuk pemasok | PEMBELIAN, KEPALA_DEPT, DIREKTUR | W |
| KF-PBL-03 | PO yang belum ada penerimaan dapat dibatalkan. PO yang sudah diterima sebagian dapat ditutup | PEMBELIAN | S |
| KF-PBL-04 | Mencatat LPB (barang) atau BAST (jasa) berdasarkan PO yang disetujui: kuantitas diterima per baris, nomor surat jalan, catatan kondisi. Kuantitas kumulatif tidak boleh melebihi kuantitas PO | GUDANG | W |
| KF-PBL-05 | Status PO berubah otomatis: disetujui, diterima sebagian, diterima penuh | Sistem | W |
| KF-PBL-06 | LPB dapat dibatalkan selama kuantitasnya belum ditagih di faktur | GUDANG | S |
| KF-PBL-07 | Salinan PO untuk Gudang dapat dicetak tanpa harga | GUDANG | B |

### 4.4 Faktur pemasok dan utang (UTG)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-UTG-01 | Mencatat faktur berdasarkan PO: nomor faktur pemasok, nomor faktur pajak, tanggal faktur, tanggal diterima, jatuh tempo (bawaan: tanggal faktur ditambah termin), baris dari PO (kuantitas dan harga ditagih), PPN, dan kode PPh | AKUNTANSI | W |
| KF-UTG-02 | Menolak nomor faktur yang sudah tercatat untuk pemasok yang sama | Sistem | W |
| KF-UTG-03 | Pencocokan tiga arah per baris: pemasok faktur sama dengan pemasok PO; kuantitas ditagih tidak melebihi kuantitas diterima dikurangi yang sudah ditagih; harga tidak melebihi harga PO ditambah toleransi | Sistem | W |
| KF-UTG-04 | Faktur yang cocok langsung terverifikasi dan jurnal pembelian terbentuk. Faktur yang berselisih menunggu persetujuan Manajer Keuangan | Sistem, MANAJER_KEUANGAN | W |
| KF-UTG-05 | Menghitung PPN (tarif dikali DPP, dapat disesuaikan dengan faktur pajak) dan PPh dipotong (tarif dikali DPP baris jasa, dua kali lipat untuk pemasok tanpa NPWP bila kode pajaknya menentukan demikian) | Sistem | W |
| KF-UTG-06 | Faktur terverifikasi yang belum punya pembayaran atau BKK aktif dapat dibatalkan dengan jurnal pembalik | SPV_AKUNTANSI | W |
| KF-UTG-07 | Faktur saldo awal (utang belum lunas saat go-live) dicatat tanpa PO dan tanpa jurnal, karena saldonya sudah masuk jurnal saldo awal | SPV_AKUNTANSI | W |
| KF-UTG-08 | Daftar faktur menampilkan sisa utang, jatuh tempo, dan umur; dapat disaring per pemasok dan status | AKUNTANSI | W |

### 4.5 Permintaan pembayaran nonpembelian (PMB)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-PMB-01 | Membuat permintaan pembayaran (PP): penerima (pemasok terdaftar atau pihak lain beserta rekeningnya), tanggal dibutuhkan, uraian, baris (uraian, akun, jumlah), dan lampiran tagihan | PEMOHON | W |
| KF-PMB-02 | PP disetujui Kepala Departemen pemohon. Bila pemohon adalah Kepala Departemen itu sendiri, persetujuan beralih ke Direktur | KEPALA_DEPT | W |
| KF-PMB-03 | PP wajib punya minimal satu lampiran sebelum diajukan (dapat dimatikan di Pengaturan) | Sistem | W |
| KF-PMB-04 | PP yang ditolak kembali ke pemohon dengan catatan penolakan untuk diperbaiki dan diajukan ulang, atau dibatalkan | PEMOHON | W |
| KF-PMB-05 | Pemohon memantau status PP sampai dibayar, termasuk nomor BKK dan tanggal bayar | PEMOHON | W |

### 4.6 Uang muka kerja (UMK)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-UMK-01 | Mengajukan permintaan uang muka (PUM): keperluan, jumlah, tanggal kegiatan selesai. Tenggat pertanggungjawaban = tanggal selesai ditambah 7 hari (dapat diatur) | PEMOHON | W |
| KF-UMK-02 | Menolak PUM baru bila pemohon masih punya uang muka yang melewati tenggat pertanggungjawaban | Sistem | W |
| KF-UMK-03 | PUM disetujui atasan lalu dibayar melalui BKK | KEPALA_DEPT, AKUNTANSI, KASIR | W |
| KF-UMK-04 | Membuat pertanggungjawaban uang muka (PJUM): rincian realisasi (tanggal, uraian, akun, jumlah, nomor bukti) beserta lampiran | PEMOHON | W |
| KF-UMK-05 | PJUM disetujui atasan lalu diverifikasi Kepala Bagian Akuntansi. Setelah itu sistem membentuk jurnal penyelesaian dan menentukan hasilnya: pas, sisa dikembalikan karyawan, atau kekurangan dibayar Perusahaan | KEPALA_DEPT, SPV_AKUNTANSI | W |
| KF-UMK-06 | Sisa uang muka dicatat Kasir sebagai Bukti Kas Masuk; kekurangan dibayar melalui BKK. Uang muka berstatus selesai setelah selisih diselesaikan | KASIR, AKUNTANSI | W |
| KF-UMK-07 | Laporan uang muka beredar beserta umur dan penanda lewat tenggat | AKUNTANSI, AUDITOR | W |

### 4.7 Kas kecil (KKC)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-KKC-01 | Dana kas kecil dibentuk melalui BKK jenis pembentukan dana. Dana aktif setelah BKK dibayar | AKUNTANSI, KASIR | W |
| KF-KKC-02 | Mengajukan pengeluaran kas kecil (PKK): dana, keperluan, akun, jumlah, lampiran nota. Disetujui atasan | PEMOHON, KEPALA_DEPT | W |
| KF-KKC-03 | Pemegang kas kecil membayar PKK yang disetujui dan mencatat nomor nota. Sistem menolak jumlah di atas batas per transaksi atau di atas saldo tunai dana | KAS_KECIL | W |
| KF-KKC-04 | Menampilkan posisi dana: dana tetap, bukti belum diganti, bukti dalam proses pengisian, dan saldo tunai seharusnya | KAS_KECIL | W |
| KF-KKC-05 | Pemegang kas kecil mengajukan pengisian kembali dari bukti yang sudah dibayar. Staf Akuntansi memprosesnya menjadi BKK dengan distribusi akun dari bukti. Setelah BKK dibayar, bukti berstatus diganti dan saldo tunai kembali penuh | KAS_KECIL, AKUNTANSI | W |
| KF-KKC-06 | Mencatat opname kas kecil per pecahan uang, menghitung selisih, dan mencetak berita acara | AUDITOR, SPV_AKUNTANSI | W |
| KF-KKC-07 | Beranda pemegang kas kecil memberi tanda bila saldo tunai di bawah 25% dana tetap | Sistem | S |

### 4.8 Bukti kas keluar (BKK)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-BKK-01 | Membuat BKK dari salah satu sumber: faktur terverifikasi (satu pemasok, satu atau beberapa faktur, bayar penuh atau sebagian), PP disetujui, PUM disetujui, kekurangan PJUM, pembentukan dana kas kecil, atau pengisian kembali kas kecil | AKUNTANSI | W |
| KF-BKK-02 | BKK memuat penerima, rekening sumber, metode bayar (cek, bilyet giro, transfer), tanggal rencana bayar, distribusi akun, potongan pajak, jumlah bruto, potongan, jumlah dibayar, dan terbilang | Sistem | W |
| KF-BKK-03 | Untuk BKK dari PP, akun dan departemen per baris dapat dikoreksi dan potongan PPh dapat ditambahkan, tetapi total yang disetujui tidak dapat diubah | AKUNTANSI | W |
| KF-BKK-04 | Satu faktur, PP, PUM, atau pengisian tidak dapat diproses di dua BKK aktif. Jumlah bayar faktur tidak boleh melebihi sisa utangnya | Sistem | W |
| KF-BKK-05 | BKK disetujui berjenjang: diperiksa Kepala Bagian Akuntansi, disetujui Manajer Keuangan, dan disetujui Direktur bila jumlah bruto di atas Rp50.000.000 | SPV_AKUNTANSI, MANAJER_KEUANGAN, DIREKTUR | W |
| KF-BKK-06 | BKK transfer ke pemasok hanya dapat diajukan bila rekening pemasok sudah terverifikasi | Sistem | W |
| KF-BKK-07 | BKK yang belum dibayar dapat dibatalkan: draf atau ditolak oleh pembuatnya, sudah disetujui oleh Manajer Keuangan. Dokumen sumber kembali siap diproses | AKUNTANSI, MANAJER_KEUANGAN | W |

### 4.9 Pembayaran dan register cek (BYR)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-BYR-01 | Kasir melihat antrean BKK yang sudah disetujui lengkap, urut tanggal rencana bayar | KASIR | W |
| KF-BYR-02 | Mencatat pembayaran: tanggal, metode, nomor warkat (dipilih dari lembar tersedia pada buku cek rekening sumber) atau nomor referensi transfer, dan tanggal jatuh tempo bilyet giro | KASIR | W |
| KF-BYR-03 | Saat pembayaran disimpan: jurnal pengeluaran kas terbentuk, lembar warkat terpakai, BKK dan dokumen sumber berstatus dibayar, sisa utang faktur berkurang | Sistem | W |
| KF-BYR-04 | Mencetak tanda terima cek atau bilyet giro untuk ditandatangani penerima, atau surat instruksi transfer untuk pejabat penanda tangan | KASIR | W |
| KF-BYR-05 | Manajer Keuangan membatalkan pembayaran dengan alasan: jurnal pembalik terbentuk, warkat berstatus batal, sisa utang pulih, BKK kembali ke antrean Kasir | MANAJER_KEUANGAN | W |
| KF-BYR-06 | Kasir membatalkan lembar warkat kosong yang rusak dengan alasan. Lembar batal tidak dapat dipakai lagi | KASIR | W |
| KF-BYR-07 | Register cek menampilkan setiap nomor warkat per buku beserta statusnya | KASIR, SPV_AKUNTANSI, AUDITOR | W |

### 4.10 Kas masuk dan rekonsiliasi bank (BNK)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-BNK-01 | Mencatat Bukti Kas Masuk (BKM) untuk pengembalian sisa uang muka dan penerimaan lain yang terkait pengeluaran, misalnya pengembalian kelebihan bayar oleh pemasok | KASIR | W |
| KF-BNK-02 | Membuat rekonsiliasi bank per rekening per bulan: saldo rekening koran, penandaan pembayaran yang sudah kliring beserta tanggalnya, dan pos rekonsiliasi (setoran dalam perjalanan, biaya bank, jasa giro, koreksi) | SPV_AKUNTANSI | W |
| KF-BNK-03 | Menghitung saldo bank disesuaikan dan saldo buku disesuaikan. Rekonsiliasi hanya dapat difinalkan bila selisih nol; pos penyesuaian sisi buku menjadi jurnal penyesuaian otomatis | Sistem | W |
| KF-BNK-04 | Pengguna berperan Kasir tidak dapat membuat atau memfinalkan rekonsiliasi | Sistem | W |

### 4.11 Akuntansi dan periode (AKT)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-AKT-01 | Jurnal otomatis terbentuk dari faktur, pembayaran, PJUM, BKM, dan rekonsiliasi. Jurnal manual dibuat Staf Akuntansi atau Kepala Bagian Akuntansi dan disetujui Manajer Keuangan | AKUNTANSI, MANAJER_KEUANGAN | W |
| KF-AKT-02 | Setiap jurnal seimbang. Jurnal yang sudah diposting tidak dapat diubah atau dihapus; koreksi memakai jurnal pembalik | Sistem | W |
| KF-AKT-03 | Manajer Keuangan menutup dan membuka periode bulanan. Transaksi bertanggal pada periode tutup ditolak | MANAJER_KEUANGAN | W |
| KF-AKT-04 | Saldo awal dicatat melalui jurnal manual jenis saldo awal, termasuk rincian utang per pemasok | SPV_AKUNTANSI | W |
| KF-AKT-05 | Buku besar dan neraca saldo per periode | AKUNTANSI dan di atasnya, AUDITOR | W |
| KF-AKT-06 | Ekspor jurnal ke CSV untuk dimasukkan ke perangkat lunak akuntansi lama | AKUNTANSI | W |

### 4.12 Persetujuan dan beranda (PST)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-PST-01 | Kotak persetujuan berisi dokumen yang menunggu tindakan pengguna: nomor, jenis, nilai, pembuat, dan lama menunggu | Semua penyetuju | W |
| KF-PST-02 | Penyetuju menyetujui atau menolak. Penolakan wajib disertai alasan | Semua penyetuju | W |
| KF-PST-03 | Riwayat persetujuan (siapa, kapan, catatan) tampil di dokumen dan tercetak di formulir | Sistem | W |
| KF-PST-04 | Beranda setiap peran menampilkan jumlah pekerjaan yang menunggu: dokumen untuk disetujui, faktur untuk diproses, BKK untuk dibayar, dan sebagainya | Semua | W |
| KF-PST-05 | Delegasi wewenang saat penyetuju cuti | | T |
| KF-PST-06 | Notifikasi melalui email | | T |

### 4.13 Lampiran dan cetak formulir (DOK)

| Kode | Kebutuhan | Peran | Prioritas |
|---|---|---|---|
| KF-DOK-01 | Mengunggah lampiran PDF, JPG, atau PNG (maksimal 5 MB per berkas) ke dokumen. Lampiran dapat diunduh oleh pengguna yang berhak melihat dokumennya | Semua | W |
| KF-DOK-02 | Lampiran tidak dapat dihapus setelah dokumen diajukan | Sistem | W |
| KF-DOK-03 | Semua formulir dapat dicetak di kertas A4 dengan kop perusahaan, nomor, terbilang, riwayat persetujuan, dan kolom tanda tangan | Semua | W |
| KF-DOK-04 | Cetakan pertama bertanda ASLI; cetakan berikutnya bertanda SALINAN beserta nomor urut cetak. Jumlah cetak tercatat | Sistem | W |
| KF-DOK-05 | Dokumen yang sudah dibayar tercetak dengan cap LUNAS | Sistem | W |
| KF-DOK-06 | Blanko formulir kosong dapat dicetak untuk prosedur darurat saat sistem tidak tersedia | Semua | S |

## 5. Aturan bisnis

| Kode | Aturan |
|---|---|
| AB-01 | Nomor dokumen dibuat sistem secara berurutan per jenis per bulan dengan format `JENIS/TAHUN/BULAN/URUT`, misalnya `BKK/2026/10/0001`. Nomor tidak dapat diubah. Dokumen yang dibatalkan tetap tersimpan dengan status BATAL sehingga tidak ada nomor yang hilang |
| AB-02 | Pembuat dokumen tidak dapat menyetujui dokumennya sendiri |
| AB-03 | Satu pengguna hanya menyetujui satu langkah pada satu dokumen |
| AB-04 | Jenjang persetujuan ditentukan oleh jenis dokumen dan nilainya menurut matriks otorisasi (D04 bagian 4) |
| AB-05 | Kombinasi peran pada matriks konflik tidak dapat diberikan kepada satu akun |
| AB-06 | Faktur wajib merujuk PO yang disetujui dari pemasok yang sama. Kuantitas ditagih per baris tidak melebihi kuantitas diterima dikurangi kuantitas yang sudah ditagih. Harga tidak melebihi harga PO ditambah toleransi (bawaan 0%) |
| AB-07 | Nomor faktur pemasok unik per pemasok |
| AB-08 | Faktur berselisih hanya dapat diposting setelah disetujui Manajer Keuangan beserta alasannya |
| AB-09 | Jumlah bayar atas satu faktur tidak melebihi total utang dikurangi yang sudah dibayar dan yang sedang diproses di BKK lain |
| AB-10 | BKK dibayar hanya setelah seluruh langkah persetujuan selesai, oleh Kasir yang bukan pembuat dan bukan penyetuju BKK itu |
| AB-11 | Transfer ke pemasok hanya ke rekening yang terdaftar dan terverifikasi di data pemasok. Cek dan bilyet giro ditulis atas nama penerima |
| AB-12 | Setiap nomor warkat berstatus tersedia, terpakai, atau batal. Lembar batal tidak dapat dipakai lagi |
| AB-13 | Pembatalan pembayaran hanya oleh Manajer Keuangan dengan alasan, dan dilakukan dengan jurnal pembalik |
| AB-14 | Jurnal yang sudah diposting tidak dapat diubah atau dihapus |
| AB-15 | Transaksi tidak dapat diposting ke periode berstatus TUTUP |
| AB-16 | Setiap jurnal seimbang dan hanya memakai akun detail yang aktif |
| AB-17 | Pengeluaran kas kecil paling banyak Rp1.000.000 per transaksi (dapat diatur per dana) dan tidak melebihi saldo tunai dana |
| AB-18 | Kas kecil memakai sistem imprest: beban diakui saat pengisian kembali, dan jumlah pengisian sama dengan total bukti yang diajukan |
| AB-19 | Pemohon yang masih punya uang muka lewat tenggat tidak dapat mengajukan uang muka baru |
| AB-20 | Tenggat pertanggungjawaban uang muka adalah tanggal kegiatan selesai ditambah 7 hari kalender (dapat diatur) |
| AB-21 | PPh Pasal 23 dipotong atas jasa sesuai tarif di master pajak. Untuk pemasok tanpa NPWP tarifnya 100% lebih tinggi (UU PPh Pasal 23 ayat 1a) |
| AB-22 | PP dan PJUM wajib punya minimal satu lampiran sebelum diajukan |
| AB-23 | Cetakan pertama dokumen bertanda ASLI, cetakan berikutnya bertanda SALINAN KE-n |
| AB-24 | BKK yang sudah dibayar tercetak dengan cap LUNAS agar dokumen pendukungnya tidak diajukan ulang |
| AB-25 | Akun terkunci 15 menit setelah 5 kali gagal masuk; sesi berakhir setelah 30 menit tanpa aktivitas |
| AB-26 | Perubahan rekening bank pemasok wajib diverifikasi Kepala Bagian Akuntansi, dan pemverifikasi bukan orang yang mengubah data |
| AB-27 | Rekonsiliasi bank dibuat oleh pengguna yang bukan Kasir dan hanya difinalkan bila selisihnya nol |
| AB-28 | Opname kas kecil dilakukan Auditor Internal atau Kepala Bagian Akuntansi, bukan pemegang dana itu |
| AB-29 | Semua nilai dalam Rupiah dan harus lebih besar dari nol |
| AB-30 | Faktur hanya dapat dibatalkan bila belum ada pembayaran dan tidak sedang diproses di BKK |

## 6. Cerita pengguna dan kriteria penerimaan

Kriteria penerimaan ditulis dengan pola *diberikan* (kondisi awal), *ketika* (tindakan), *maka* (hasil yang diharapkan).

**US-01. Sebagai Staf Akuntansi Utang, saya ingin faktur dicocokkan otomatis dengan PO dan LPB agar tidak perlu membuka tiga berkas untuk setiap faktur.**

1. Diberikan PO 100 unit seharga Rp50.000 per unit dan LPB 80 unit, ketika saya mencatat faktur 80 unit seharga Rp50.000, maka baris berstatus Cocok dan faktur langsung terverifikasi dengan jurnal pembelian.
2. Diberikan kondisi yang sama, ketika faktur menagih 100 unit, maka baris berstatus Selisih kuantitas dan faktur menunggu persetujuan Manajer Keuangan.
3. Ketika harga faktur Rp52.000 dengan toleransi 0%, maka baris berstatus Selisih harga.

**US-02. Sebagai Staf Akuntansi Utang, saya ingin sistem menolak faktur ganda.**

1. Diberikan faktur nomor INV-778 dari satu pemasok sudah tercatat, ketika faktur bernomor sama dari pemasok yang sama dicatat, maka sistem menolak dan menyebut nomor register faktur yang sudah ada.
2. Faktur bernomor INV-778 dari pemasok lain tetap dapat dicatat.

**US-03. Sebagai Manajer Keuangan, saya ingin melihat seluruh dasar pembayaran dalam satu layar sebelum menyetujui BKK.**

1. Ketika saya membuka BKK dari kotak persetujuan, maka saya melihat distribusi akun, dokumen sumber, lampiran, dan riwayat persetujuan sebelumnya.
2. Ketika saya menolak tanpa mengisi alasan, maka sistem meminta alasan dan penolakan belum tersimpan.

**US-04. Sebagai Direktur, saya hanya ingin menerima BKK bernilai besar.**

1. BKK dengan jumlah bruto Rp50.000.000 tidak masuk kotak persetujuan saya.
2. BKK dengan jumlah bruto Rp50.000.001 masuk kotak persetujuan saya setelah Manajer Keuangan menyetujui.

**US-05. Sebagai Kasir, saya ingin nomor cek diusulkan sistem dan tercetak di BKK.**

1. Ketika saya membayar BKK dengan cek, maka sistem mengusulkan nomor terkecil yang tersedia di buku cek rekening sumber.
2. Nomor yang sudah terpakai atau batal tidak dapat dipilih.
3. Setelah disimpan, BKK tercetak dengan nomor cek dan cap LUNAS.

**US-06. Sebagai Kasir, saya tidak boleh membayar BKK yang belum disetujui lengkap.**

1. Diberikan BKK yang baru diperiksa Kepala Bagian Akuntansi, maka BKK itu tidak tampil di antrean pembayaran dan permintaan pembayaran langsung ke server ditolak.

**US-07. Sebagai Manajer Keuangan, saya ingin membatalkan pembayaran yang salah tanpa menghapus jejaknya.**

1. Ketika saya membatalkan pembayaran dengan cek nomor 000123 beralasan "cek rusak saat ditulis", maka jurnal pembalik terbentuk, cek 000123 berstatus batal, sisa utang faktur pulih, dan BKK kembali ke antrean Kasir.

**US-08. Sebagai Pemohon, saya ingin tahu posisi permintaan pembayaran saya.**

1. Daftar PP saya menampilkan status terkini: draf, diajukan, disetujui, ditolak, diproses, atau dibayar.
2. Bila ditolak, saya melihat nama penolak dan alasannya, lalu dapat memperbaiki dan mengajukan ulang.

**US-09. Sebagai Kepala Departemen, saya hanya ingin menyetujui dokumen departemen saya.**

1. PP dari departemen lain tidak tampil di kotak persetujuan saya.
2. PP yang saya buat sendiri tidak masuk kotak saya, melainkan ke Direktur.

**US-10. Sebagai Pemohon, saya ingin diingatkan bila masih punya uang muka yang lewat tenggat.**

1. Diberikan uang muka yang melewati tenggat pertanggungjawaban, ketika saya mengajukan uang muka baru, maka sistem menolak dan menyebut nomor uang muka yang harus dipertanggungjawabkan.

**US-11. Sebagai Pemohon, saya ingin pertanggungjawaban uang muka menghitung sisa atau kekurangan.**

1. Diberikan uang muka Rp3.000.000 dan realisasi Rp2.750.000, maka setelah PJUM disetujui sistem menampilkan sisa Rp250.000 untuk disetor ke Kasir. Setelah Kasir mencatat BKM, uang muka berstatus selesai.
2. Diberikan realisasi Rp3.400.000, maka sistem menampilkan kekurangan Rp400.000 yang dibayar melalui BKK.

**US-12. Sebagai Pemegang Kas Kecil, saya ingin sistem menolak pengeluaran yang melanggar batas.**

1. Pengeluaran Rp1.200.000 ditolak karena melebihi batas Rp1.000.000 per transaksi.
2. Pengeluaran yang melebihi saldo tunai dana ditolak.

**US-13. Sebagai Pemegang Kas Kecil, saya ingin pengisian kembali dibuat dari bukti yang sudah tercatat.**

1. Ketika saya memilih bukti yang sudah dibayar, maka total pengisian sama dengan jumlah bukti yang dipilih.
2. Setelah BKK pengisian dibayar, saldo tunai kembali sama dengan dana tetap.

**US-14. Sebagai Auditor Internal, saya ingin opname kas kecil tercatat di sistem.**

1. Ketika saya memasukkan jumlah lembar dan keping per pecahan, maka sistem menghitung total fisik dan selisihnya terhadap dana tetap dikurangi bukti belum diganti.
2. Berita acara dapat dicetak untuk ditandatangani saya dan pemegang kas kecil.

**US-15. Sebagai Kepala Bagian Akuntansi, saya ingin rekonsiliasi bank disusun otomatis.**

1. Daftar cek beredar terisi otomatis dari pembayaran yang belum kliring per akhir bulan.
2. Rekonsiliasi dengan selisih tidak nol tidak dapat difinalkan.
3. Biaya administrasi bank yang dimasukkan sebagai pos sisi buku menjadi jurnal penyesuaian saat difinalkan.

**US-16. Sebagai Manajer Keuangan, saya ingin periode yang sudah ditutup terkunci.**

1. Setelah periode September 2026 ditutup, pembayaran bertanggal 30 September 2026 ditolak dengan pesan periode tutup.

**US-17. Sebagai Administrator, saya ingin sistem mencegah kombinasi peran yang bertentangan.**

1. Memberi peran Kasir kepada akun yang sudah berperan Staf Akuntansi Utang ditolak dengan alasan konflik.

**US-18. Sebagai Auditor Internal, saya ingin menelusuri perubahan data penting.**

1. Saya dapat melihat siapa yang mengubah rekening bank pemasok, nilai sebelum dan sesudahnya, waktu, dan alamat IP.

**US-19. Sebagai Staf Pembelian, saya ingin PO bernilai besar disetujui berjenjang.**

1. PO dengan total Rp150.000.000 harus disetujui Kepala Departemen Pembelian lalu Direktur sebelum dapat dicetak.

**US-20. Sebagai Staf Gudang, saya ingin penerimaan tidak melebihi pesanan.**

1. Diberikan PO 100 unit yang sudah diterima 80 unit, ketika saya mencatat LPB 30 unit, maka sistem menolak dan menyebut sisa yang boleh diterima (20 unit).

## 7. Kebutuhan nonfungsional

| Kode | Kategori | Kebutuhan |
|---|---|---|
| KNF-01 | Kinerja | 95% operasi simpan dan buka dokumen selesai paling lama 2 detik pada LAN 1 Gbps dengan 80 sesi bersamaan. Laporan bulanan paling lama 10 detik |
| KNF-02 | Kapasitas | 200 akun pengguna, 60.000 dokumen per tahun, dan 5 tahun data tetap daring |
| KNF-03 | Ketersediaan | 99% pada jam kerja 07.00 sampai 19.00 WIB, Senin sampai Sabtu |
| KNF-04 | Keamanan akses | Kata sandi disimpan dalam bentuk hash scrypt bergaram. Hak akses berbasis peran diperiksa di server untuk setiap permintaan |
| KNF-05 | Jejak audit | Log audit menyimpan waktu, pengguna, IP, entitas, data sebelum dan sesudah. Log disimpan paling sedikit 10 tahun |
| KNF-06 | Integritas data | Setiap transaksi berjalan dalam satu transaksi basis data (InnoDB). Baris dokumen dikunci saat disetujui atau dibayar agar dua pengguna tidak memproses dokumen yang sama |
| KNF-07 | Cadangan dan pemulihan | Cadangan penuh harian otomatis ke NAS pukul 22.00 WIB, retensi 30 cadangan harian dan 12 cadangan bulanan. Uji pemulihan setiap triwulan. RPO 24 jam, RTO 4 jam |
| KNF-08 | Jaringan | Berjalan penuh di LAN tanpa internet. Semua aset antarmuka dibundel di server |
| KNF-09 | Kompatibilitas | Aplikasi desktop untuk Windows 10 dan 11 64-bit. Sebagai cadangan, dapat dibuka melalui peramban Chrome atau Edge di LAN |
| KNF-10 | Kegunaan | Seluruh antarmuka berbahasa Indonesia dengan format Rupiah dan tanggal Indonesia. Pengguna baru dapat menyelesaikan transaksi peran utamanya setelah pelatihan 2 jam |
| KNF-11 | Pemeliharaan | Skema basis data berversi melalui berkas migrasi. Konfigurasi server melalui berkas `.env` |
| KNF-12 | Retensi dan arsip | Data dan dokumen keuangan disimpan 10 tahun sesuai UU KUP Pasal 28 ayat (11) dan UU Nomor 8 Tahun 1997 tentang Dokumen Perusahaan Pasal 11 |
| KNF-13 | Keluaran | Formulir siap cetak di kertas A4. Setiap laporan dapat diekspor ke CSV |
| KNF-14 | Distribusi | Pembaruan aplikasi dilakukan terpusat di server lokal; PC klien tidak perlu diinstal ulang untuk setiap rilis antarmuka |

## 8. Kebutuhan laporan

Semua laporan dapat disaring per periode, dicetak, dan diekspor ke CSV.

| Kode | Laporan | Isi utama | Pengguna | Frekuensi |
|---|---|---|---|---|
| LAP-01 | Register BKK | Nomor, tanggal, jenis, penerima, bruto, potongan, dibayar, status | AKUNTANSI, SPV_AKUNTANSI | Harian |
| LAP-02 | Register cek dan pembayaran | Nomor warkat, tanggal, penerima, jumlah, status, tanggal kliring | KASIR, SPV_AKUNTANSI, AUDITOR | Harian |
| LAP-03 | Jurnal pengeluaran kas | Kolom debit utang usaha, debit lain-lain, kredit bank, kredit utang pajak | AKUNTANSI, SPV_AKUNTANSI | Bulanan |
| LAP-04 | Buku pembantu utang | Mutasi dan saldo per pemasok | AKUNTANSI | Sesuai kebutuhan |
| LAP-05 | Daftar saldo utang | Saldo per pemasok dan pencocokannya dengan akun Utang Usaha di buku besar | SPV_AKUNTANSI, AUDITOR | Bulanan |
| LAP-06 | Umur utang | Belum jatuh tempo, 1 s.d. 30, 31 s.d. 60, 61 s.d. 90, di atas 90 hari | MANAJER_KEUANGAN | Mingguan |
| LAP-07 | Faktur jatuh tempo | Faktur jatuh tempo dalam N hari ke depan sebagai rencana kebutuhan kas | MANAJER_KEUANGAN, AKUNTANSI | Harian |
| LAP-08 | Laporan kas kecil | Per dana: dana tetap, pengeluaran, pengisian, saldo tunai | KAS_KECIL, SPV_AKUNTANSI | Mingguan |
| LAP-09 | Uang muka beredar | Per karyawan: jumlah, tenggat, umur, status lewat tenggat | AKUNTANSI, AUDITOR | Mingguan |
| LAP-10 | Buku besar | Mutasi per akun beserta saldo | AKUNTANSI dan di atasnya | Bulanan |
| LAP-11 | Neraca saldo | Saldo seluruh akun per akhir periode | SPV_AKUNTANSI, MANAJER_KEUANGAN | Bulanan |
| LAP-12 | Pengeluaran per departemen dan akun | Total beban per departemen per akun | MANAJER_KEUANGAN, DIREKTUR | Bulanan |
| LAP-13 | Laporan pengecualian | Selisih pencocokan yang disetujui, pembayaran batal, warkat batal, dokumen ditolak, pembayaran melewati jatuh tempo, perubahan rekening pemasok | AUDITOR, MANAJER_KEUANGAN | Bulanan |

## 9. Batasan

1. Sistem hanya berjalan di LAN Perusahaan sesuai SAD v1.1.
2. Mata uang tunggal: Rupiah.
3. Satu entitas perusahaan.
4. Pembayaran transfer dieksekusi manual oleh pejabat berwenang di internet banking. SIAPKas mencatat nomor referensinya; integrasi langsung dengan bank di luar lingkup.
5. Faktur pajak dan bukti potong tetap dibuat di aplikasi DJP. SIAPKas mencatat nomor faktur pajak dan menghitung PPh yang dipotong.

## 10. Matriks keterlacakan

| Kebutuhan bisnis | Kebutuhan fungsional | Cerita pengguna |
|---|---|---|
| KB-01 | KF-PST-01 s.d. 04, KF-BKK-05, KF-PMB-02, KF-DOK-01 s.d. 03 | US-03, US-04, US-09 |
| KB-02 | KF-PBL-01 s.d. 05, KF-UTG-01, 03, 04 | US-01, US-19, US-20 |
| KB-03 | KF-UTG-02, KF-BKK-04, KF-DOK-05 | US-02 |
| KB-04 | KF-UTG-08, LAP-06, LAP-07 | US-03 |
| KB-05 | KF-MST-06, KF-BYR-02, 05, 06, 07 | US-05, US-07 |
| KB-06 | KF-KKC-01 s.d. 07 | US-12, US-13, US-14 |
| KB-07 | KF-UMK-01 s.d. 07 | US-10, US-11 |
| KB-08 | KF-BNK-02 s.d. 04 | US-15 |
| KB-09 | KF-AKT-01 s.d. 06, KF-BYR-03 | US-16 |
| KB-10 | KF-ADM-01 s.d. 10, KF-MST-04 | US-06, US-17, US-18 |

Pemetaan kebutuhan ke skenario uji ada di dokumen D10.

## Lampiran A. Panduan wawancara

Setiap wawancara berlangsung 60 sampai 90 menit. Pewawancara membawa contoh formulir yang berlaku dan meminta narasumber menunjukkan langsung langkah kerjanya.

**Pertanyaan umum untuk semua fungsi**

1. Dokumen apa yang Anda terima, dari siapa, dan dokumen apa yang Anda serahkan, kepada siapa?
2. Berapa jumlah dokumen per hari pada minggu biasa dan pada minggu terakhir bulan?
3. Berapa lama satu dokumen berada di meja Anda sebelum diteruskan? Apa penyebab terlama?
4. Kesalahan apa yang paling sering terjadi dalam tiga bulan terakhir? Bagaimana ditemukan?
5. Laporan apa yang Anda buat atau butuhkan, dan dengan alat apa (Excel, perangkat lunak akuntansi, tulis tangan)?

**Staf Akuntansi Utang**

1. Bagaimana Anda mencocokkan faktur dengan PO dan LPB? Berapa toleransi selisih harga atau kuantitas yang saat ini diterima?
2. Apa yang dilakukan bila faktur datang sebelum barang diterima?
3. Pembayaran apa saja yang tidak melalui PO? Siapa yang menyetujuinya?
4. Jasa apa saja yang dipotong PPh Pasal 23 atau Pasal 4 ayat (2)? Bagaimana menangani pemasok tanpa NPWP?
5. Bagaimana Anda memastikan faktur tidak dibayar dua kali?

**Kasir**

1. Berapa rekening bank operasional dan buku cek atau bilyet giro yang aktif?
2. Siapa penanda tangan cek dan berapa tanda tangan yang diwajibkan bank untuk setiap nilai?
3. Bagaimana pembayaran transfer dieksekusi di internet banking? Apakah ada pemisahan pembuat dan penyetuju transaksi?
4. Bagaimana cek diserahkan ke pemasok dan bukti penerimaannya disimpan?
5. Apa yang dilakukan terhadap cek yang salah tulis atau rusak?

**Pemegang Kas Kecil**

1. Berapa jumlah dana, batas per transaksi, dan frekuensi pengisian kembali?
2. Bukti apa yang diminta dari pemohon?
3. Berapa lama waktu dari pengajuan pengisian sampai uang diterima?
4. Kapan terakhir dilakukan opname dan apa hasilnya?

**Manajer Keuangan dan Direktur**

1. Berapa batas wewenang persetujuan setiap jabatan saat ini? Apakah tertulis?
2. Informasi apa yang Anda periksa sebelum menyetujui pembayaran?
3. Laporan apa yang Anda perlukan untuk merencanakan kas mingguan?
4. Siapa yang menggantikan persetujuan Anda saat cuti?

**Pembelian dan Gudang**

1. Bagaimana PO disetujui dan dikirim ke pemasok? Berapa lembar dan ke mana saja?
2. Bagaimana penerimaan sebagian dicatat? Apakah Gudang melihat harga di PO?
3. Siapa yang menandatangani berita acara serah terima untuk pekerjaan jasa?
4. Siapa yang menambah pemasok baru atau mengubah rekening banknya?

**Departemen pemohon**

1. Jenis pembayaran apa yang paling sering Anda minta di luar pembelian?
2. Bagaimana prosedur uang muka dan pertanggungjawabannya saat ini? Berapa lama biasanya pertanggungjawaban diserahkan?
3. Informasi status apa yang paling sering Anda tanyakan ke bagian keuangan?

**Audit Internal**

1. Temuan apa saja pada audit siklus pengeluaran terakhir?
2. Seberapa sering opname kas kecil dilakukan, dan dengan cara apa?
3. Laporan pengecualian apa yang Anda butuhkan setiap bulan?

**Teknologi Informasi**

1. Spesifikasi server, jaringan, UPS, dan NAS yang tersedia saat ini?
2. Kebijakan kata sandi dan pengelolaan akun yang berlaku?
3. Bagaimana cadangan data dilakukan dan kapan terakhir diuji pemulihannya?

## Lampiran B. Dokumen yang diminta dari Perusahaan

1. Struktur organisasi dan uraian jabatan fungsi keuangan, pembelian, dan gudang.
2. Contoh formulir yang berlaku: PO, LPB, BKK, permintaan pembayaran, uang muka, kas kecil, masing-masing tiga contoh yang sudah terisi.
3. Bagan akun dan neraca saldo bulan terakhir.
4. Kebijakan atau surat keputusan batas wewenang persetujuan.
5. Daftar rekening bank, buku cek, dan bilyet giro yang aktif beserta nomor serinya.
6. Daftar pemasok aktif beserta NPWP dan rekening banknya.
7. Kebijakan kas kecil dan uang muka kerja.
8. Laporan audit internal dan surat manajemen auditor eksternal dua tahun terakhir.
9. Contoh rekening koran dan rekonsiliasi bank tiga bulan terakhir.

## Lampiran C. Persetujuan dokumen

Dengan menandatangani lembar ini, Pemilik Proses menyatakan kebutuhan pada dokumen ini lengkap dan benar untuk dijadikan dasar pengembangan dan UAT. Perubahan setelah persetujuan mengikuti prosedur pengendalian perubahan di D01 bagian 9.

| Peran | Nama | Tanda tangan | Tanggal |
|---|---|---|---|
| Pemilik Proses (Manajer Keuangan) | | | |
| Kepala Bagian Akuntansi | | | |
| Kepala Satuan Pengawasan Intern | | | |
| Konsultan SIA | | | |
