import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, siapkan, tutup, masuk, sebagai, idPengguna, idDept, pool, satu } from './bantu.js';

before(siapkan);
after(tutup);

test('KF-ADM-01: masuk berhasil mengembalikan token, peran, dan departemen', async () => {
  const r = await request(app).post('/api/auth/masuk').send({ username: 'akt1', password: 'Demo2026' });
  assert.equal(r.status, 200);
  assert.ok(r.body.token.length >= 40);
  assert.deepEqual(r.body.pengguna.peran, ['AKUNTANSI', 'PEMOHON']);
  assert.equal(r.body.pengguna.departemen_kode, 'KEU');
});

test('KF-ADM-01: lima kali salah kata sandi mengunci akun sampai dibuka Administrator', async () => {
  for (let i = 1; i <= 4; i += 1) {
    const r = await request(app).post('/api/auth/masuk').send({ username: 'kagudang', password: 'salah123' });
    assert.equal(r.status, 401);
    assert.equal(r.body.pesan, 'Nama pengguna atau kata sandi salah.');
  }
  const kelima = await request(app).post('/api/auth/masuk').send({ username: 'kagudang', password: 'salah123' });
  assert.equal(kelima.status, 401);
  assert.match(kelima.body.pesan, /dikunci 15 menit/);
  const benar = await request(app).post('/api/auth/masuk').send({ username: 'kagudang', password: 'Demo2026' });
  assert.equal(benar.status, 401);
  assert.match(benar.body.pesan, /terkunci sampai/);

  const admin = await sebagai('admin');
  const buka = await admin.post(`/api/pengguna/${await idPengguna('kagudang')}/buka-kunci`);
  assert.equal(buka.status, 200);
  assert.ok(await masuk('kagudang'));
  const log = await satu(pool, "SELECT COUNT(*) AS n FROM log_audit WHERE aksi = 'KUNCI_AKUN' AND entitas_id = ?", [String(await idPengguna('kagudang'))]);
  assert.equal(log.n, 1);
});

test('KF-ADM-02: akun baru wajib ganti kata sandi dan kebijakan kata sandi ditegakkan', async () => {
  const admin = await sebagai('admin');
  const buat = await admin.post('/api/pengguna', {
    username: 'ujibaru', nama_lengkap: 'Pengguna Uji', departemen_id: await idDept('UMS'), peran: ['PEMOHON'], password_awal: 'Awal12345',
  });
  assert.equal(buat.status, 201, JSON.stringify(buat.body));
  const token = await masuk('ujibaru', 'Awal12345');
  const pakai = (req) => req.set('Authorization', `Bearer ${token}`);

  const dasbor = await pakai(request(app).get('/api/dasbor'));
  assert.equal(dasbor.status, 403);
  assert.equal(dasbor.body.kode, 'GANTI_SANDI');

  const pendek = await pakai(request(app).post('/api/auth/ganti-sandi')).send({ password_lama: 'Awal12345', password_baru: 'abc12' });
  assert.equal(pendek.status, 400);
  const tanpaAngka = await pakai(request(app).post('/api/auth/ganti-sandi')).send({ password_lama: 'Awal12345', password_baru: 'hanyahuruf' });
  assert.equal(tanpaAngka.status, 400);
  const memuatNama = await pakai(request(app).post('/api/auth/ganti-sandi')).send({ password_lama: 'Awal12345', password_baru: 'ujibaru2026' });
  assert.equal(memuatNama.status, 400);
  const ok = await pakai(request(app).post('/api/auth/ganti-sandi')).send({ password_lama: 'Awal12345', password_baru: 'SandiBaru77' });
  assert.equal(ok.status, 200);
  assert.equal((await pakai(request(app).get('/api/dasbor'))).status, 200);
});

test('KF-ADM-03: sesi berakhir setelah 30 menit tanpa aktivitas', async () => {
  const token = await masuk('staf1');
  await pool.query(
    "UPDATE sesi SET aktivitas_terakhir = NOW() - INTERVAL 31 MINUTE WHERE pengguna_id = ? AND dicabut_pada IS NULL",
    [await idPengguna('staf1')],
  );
  const r = await request(app).get('/api/dasbor').set('Authorization', `Bearer ${token}`);
  assert.equal(r.status, 401);
  assert.match(r.body.pesan, /tidak ada aktivitas selama 30 menit/);
});

test('Keluar mencabut sesi sehingga token tidak dapat dipakai lagi', async () => {
  const token = await masuk('staf2');
  const keluar = await request(app).post('/api/auth/keluar').set('Authorization', `Bearer ${token}`);
  assert.equal(keluar.status, 200);
  const lagi = await request(app).get('/api/dasbor').set('Authorization', `Bearer ${token}`);
  assert.equal(lagi.status, 401);
});

test('Permintaan tanpa token ditolak', async () => {
  const r = await request(app).get('/api/bkk');
  assert.equal(r.status, 401);
});

test('KF-ADM-08: masuk dan gagal masuk tercatat di log audit', async () => {
  await request(app).post('/api/auth/masuk').send({ username: 'tidakada', password: 'x' });
  const gagal = await satu(pool, "SELECT COUNT(*) AS n FROM log_audit WHERE aksi = 'GAGAL_MASUK' AND ringkasan LIKE '%tidakada%'");
  assert.equal(gagal.n, 1);
  const berhasil = await satu(pool, "SELECT COUNT(*) AS n FROM log_audit WHERE aksi = 'MASUK' AND username = 'akt1'");
  assert.ok(berhasil.n >= 1);
});

test('KNF-06: percobaan masuk gagal berulang dari satu komputer dibatasi, masuk yang berhasil tidak dihitung', async () => {
  // Masuk yang berhasil berkali-kali tidak memicu pembatas.
  for (let i = 0; i < 40; i += 1) assert.ok(await masuk('staf2'));
  // Uji sebelumnya di berkas ini sudah menyumbang beberapa kegagalan; lanjutkan sampai batas 30 tercapai.
  let ditolak = 0;
  for (let i = 0; i < 40 && ditolak === 0; i += 1) {
    const r = await request(app).post('/api/auth/masuk').send({ username: `tidakada${i}`, password: 'Salah123' });
    if (r.status === 429) ditolak += 1;
    else assert.equal(r.status, 401);
  }
  assert.equal(ditolak, 1, 'pembatas percobaan gagal per komputer aktif');
  const ditahan = await request(app).post('/api/auth/masuk').send({ username: 'staf2', password: 'Demo2026' });
  assert.equal(ditahan.status, 429);
  assert.match(ditahan.body.pesan, /Tunggu 10 menit/);
});
