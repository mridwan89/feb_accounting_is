// Diimpor paling awal oleh setiap berkas uji: arahkan aplikasi ke basis data dan folder uji.
process.env.DB_NAME = process.env.DB_NAME_UJI || 'sia_pengeluaran_uji';
process.env.LOG_REQUEST = '0';
process.env.LAMPIRAN_DIR = 'data/lampiran-uji';
