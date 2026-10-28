# ADR-0008: Sample-Row Persistence with Per-Sample Excel Export

- **Status**: Accepted
- **Date**: 2026-10-15
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `project-docs/valid-ex/CONTEXT.md`, `project-docs/valid-ex/INVARIANTS.md`, `project-docs/valid-ex/adr/0002-single-table-auth-schema.md`, `project-docs/valid-ex/adr/0004-in-memory-exceljs-export-with-bounded-payload.md`, `project-docs/valid-ex/adr/0005-soft-flag-oos-audit-trail.md`, `project-docs/valid-ex/adr/0006-matrix-payload-and-metrological-units.md`, `project-docs/valid-ex/adr/0007-governed-qc-criteria-profiles.md`, `packages/contracts/openapi.yaml`, `packages/math/src/types.ts`, `packages/math/src/evaluate.ts`

---

## 1. Context & Problem Statement

Milestone 3 di `CONTEXT.md` semula menyebut tiga hal: tabel `users`, tabel `calibrations` dengan titik kalibrasi JSONB, dan audit log. Sejak itu kontrak dan `@valid-ex/math` mengunci bentuk data yang lebih besar dari kalimat itu.

`evaluateCalibration` menerima satu `CalibrationInput` (kurva, seluruh baris sampel, satu profil QC) dan mengembalikan `CalibrationOutput`. Blanko metode, spike, duplo, dan CCV adalah baris di array sampel yang sama, dibedakan oleh `sampleType`. Induk spike/duplo dicari dengan `input.samples.find` pada label `parentSampleId` di memori. Fungsi itu tidak membuka database.

Laporan Excel yang dibutuhkan lab adalah **satu file untuk satu sampel** (satu baris DataGrid, seluruh logam sampel itu di dalam file yang sama). Menggabungkan banyak aliquot di bawah satu ID lab menjadi satu workbook ditolak, karena jumlah sheet meledak pada run ICP-MS multi-logam. Sebagian sampel punya ID lab, sebagian tidak (blanko, CCV, atau sampel tanpa ID).

Kontrak hari ini masih mengekspor seluruh batch lewat `GET /calibrations/{id}/export` dan belum punya field ID lab.

---

## 2. Decision Drivers

- Satuan yang di-query dan diekspor adalah satu sampel, plus kurva batch yang menaunginya.
- Formula native Excel (`=SLOPE()`, koreksi blanko, recovery) butuh sel kurva, baris blanko metode, dan baris induk bila sampelnya spike atau duplo.
- Urutan kolom logam mengikuti paste analis. Postgres mengurutkan ulang kunci objek JSONB, jadi urutan tidak boleh diambil dari `Object.keys` pada map hasil.
- Invariant T6: batch, baris sampel, dan audit log satu transaksi. Driver `neon-http` menolak `db.transaction()`.
- Invariant T5: akun lokal tanpa hash, dan akun Google yang masih menyimpan hash, ditolak di mesin database.
- Invariant D4 / ADR-0007: profil QC berversi, immutable, di-snapshot ke batch.
- Relasi QC sudah ada di math (`sampleType` + `parentSampleId`). Skema tidak menambah tabel QC terpisah.

---

## 3. Considered Options

- **Opsi A: Satu dokumen JSONB per batch**
  - Seluruh standar, sampel, dan hasil ada di satu baris `calibrations`.
  - Ekspor satu sampel harus membuka dokumen batch, termasuk sampel yang tidak diminta.
  - Draft belum merge `origin/cursor/milestone-3-drizzle-schema-4b50` memakai bentuk ini. Branch itu tidak digabung.
- **Opsi B: Satu baris database per logam**
  - Kueri “semua Pb” murah.
  - Excel satu sampel harus di-pivot kembali menjadi kolom. Kueri itu tidak diminta.
- **Opsi C: `calibrations` untuk kurva, `sample_rows` untuk satu sampel** (Dipilih)
  - Satu baris anak = satu sampel = satu file Excel.
  - Angka logam tetap map JSONB di baris itu. Urutan kolom disimpan sebagai `text[]` di batch.

### Sub-keputusan

- Workbook per ID lab ditolak. `lab_sample_id` adalah metadata opsional pada baris sampel, kolom DataGrid yang boleh kosong.
- `parent_sample_id` menyimpan label `sample_id` di batch yang sama. Math tidak mencari induk di batch lain, walaupun baris itu sudah ada di Postgres.
- RPD bukan jenis baris. RPD adalah angka pada baris `sample_type = duplicate`.

---

## 4. Decision Outcome

Empat tabel. Tidak ada tabel `sessions` (JWT). Tidak ada tabel QC terpisah.

### `users` (memperketat ADR-0002)

CHECK di ADR-0002 masih mengizinkan akun `google` menyimpan `password_hash`. Outline ini menggantinya dengan pagar yang sesuai maksud sparring:

```sql
CHECK (
  (auth_provider = 'local' AND password_hash IS NOT NULL AND google_id IS NULL)
  OR
  (auth_provider = 'google' AND password_hash IS NULL AND google_id IS NOT NULL)
)
```

`email` unik dan disimpan lowercase, dengan `CHECK (email = lower(email))`. `password_hash` tidak pernah keluar lewat `UserProfile`.

### `qc_criteria_profiles` (ADR-0007)

Satu baris per versi. `id` adalah keluarga profil. `GET /qc-profiles/{id}` membaca `version` tertinggi. Mengubah ambang = `INSERT` versi baru.

- PK `(id, version)`, `version >= 1`.
- `owner_user_id` ke `users`, `ON DELETE RESTRICT`.
- `linearity_min_r` bertipe `double precision`. Band per analit tetap JSONB.
- Unik `(owner_user_id, name, version)` dan `(owner_user_id, id, version)`.
- Trigger menolak `UPDATE` dan `DELETE`.

### `calibrations`

Satu baris = satu kurva, satu profil, satu status QC.

- Skalar: `user_id`, `title`, `instrument`, `input_mode`, `qc_status`, `qc_profile_id`, `qc_profile_version`, `analytes text[]`, `created_at`, `updated_at`.
- JSONB: `units`, `points`, `analytes_summary`, `qc_violations` (default `[]`), `qc_profile_snapshot`.
- FK `(user_id, qc_profile_id, qc_profile_version)` ke profil milik pengguna yang sama. `ON DELETE RESTRICT`.
- CHECK: `cardinality(analytes) >= 1`, `points` bertipe array, versi profil `>= 1`.
- Indeks daftar: `(user_id, created_at)`, `(user_id, instrument)`, `(user_id, qc_status)`.
- Tidak di-`UPDATE`. `DELETE` menghapus `sample_rows` (`ON DELETE CASCADE`). Audit log tidak ikut terhapus.

DataGrid dan Excel membaca urutan kolom dari `analytes`, lalu mengambil angka lewat nama di map JSONB.

### `sample_rows`

Satu baris = satu sampel = satu file Excel. Blanko, sampel uji, spike, duplo, dan CCV adalah baris di tabel ini.

- `calibration_id` dan `user_id`. `user_id` sama dengan pemilik batch, lewat FK komposit ke `calibrations (id, user_id)`.
- `lab_sample_id` varchar nullable. Kosong disimpan sebagai `NULL`, nilai yang tersimpan sudah di-trim. CHECK: `NULL` atau panjang setelah trim lebih dari nol.
- `sample_id` label baris di dalam batch. Unik `(calibration_id, sample_id)`.
- `sample_type`, `parent_sample_id` nullable, `weight`, `volume`, `df` sebagai `double precision`.
- `spike_added` dan `expected_conc` jsonb nullable. `readings` dan `analyte_results` jsonb.
- Indeks parsial `(user_id, lab_sample_id) WHERE lab_sample_id IS NOT NULL`.
- Indeks `(calibration_id)`.
- Batas 250 baris per batch (Invariant T2) dijaga di gateway sebelum transaksi.

Kolom yang terisi per jenis baris:

- `sample`: hasil kuantifikasi di `analyte_results`.
- `blank_method`: sumber `C_blank`. Math memakai blanko metode pertama di batch. Tidak ada FK dari sampel uji ke blanko.
- `spike`: `parent_sample_id` plus `spike_added`. Hasil `spikeRecovery`.
- `duplicate`: `parent_sample_id`. Hasil `rpd`.
- `ccv`: `expected_conc`. Hasil `ccvRecovery`. Recovery CCV memakai `cRaw`, tanpa koreksi blanko.

`lab_sample_id` tidak diwariskan ke duplo dan tidak dibaca oleh `@valid-ex/math`. Gateway melepas field itu sebelum memanggil `evaluateCalibration`.

Query Excel satu sampel memuat baris itu, batch induknya (kurva, satuan, snapshot, status QC, `analytes`), baris `blank_method` pada `calibration_id` yang sama, dan baris induk bila `parent_sample_id` terisi. Sampel lain di batch itu tidak dibaca.

### `audit_logs`

Jejak peristiwa, bukan salinan badan batch. `entity_id` bukan FK, supaya hapus batch tidak menyeret jejaknya. Trigger menolak `UPDATE` dan `DELETE`.

Satu transaksi: insert batch, insert semua `sample_rows`, insert audit. Hapus: tulis audit dulu, baru hapus batch.

### Transaksi Neon

Gateway memakai `drizzle-orm/neon-serverless` lewat WebSocket `Pool` dari `@neondatabase/serverless`, karena Invariant T6 butuh transaksi dan driver `neon-http` tidak menyediakannya. Keduanya tetap pooler Neon (Invariant T4). Migrasi `drizzle-kit` memakai koneksi langsung dari mesin developer, bukan dari request serverless.

### Kontrak sebelum kode Drizzle

File YAML tidak diubah oleh ADR ini. Sebelum skema diimplementasikan:

- `SampleRowInput` mendapat `labSampleId`, nullable.
- Ekspor berpindah dari `GET /calibrations/{id}/export` ke satu sampel, misalnya `GET /calibrations/{calibrationId}/samples/{sampleRowId}/export`.

---

## 5. Consequences & Trade-offs

- **Positive Impact**:
  - Satu sampel diambil tanpa membuka saudara-saudaranya, kecuali blanko dan induk yang rumusnya butuh.
  - Urutan kolom logam stabil.
  - Jejak QC tetap di batch (`qc_violations`), dengan label sampel pada entri yang bersangkutan. Pelanggaran linearitas punya `sampleId` kosong, karena yang gagal kurvanya.
- **Negative Impact (Tax / Trade-off)**:
  - Tidak ada satu workbook yang merangkum setiap aliquot satu ID lab. Analis menyaring kolom ID, lalu mengekspor sampel satu per satu.
  - ID `291843` dan `291843 ` terbelah di saringan kalau trim tidak jalan sebelum insert.
  - Setelah batch dihapus, Excel sampel-sampelnya tidak bisa dibuat ulang. Yang tinggal ringkasan di audit log.
  - Kueri “semua Pb Not Detected lintas lab” tetap membuka map JSONB.

---

## 6. Falsification Vectors

1. Menyimpan `S1` di batch lain tidak membuat `find` pada batch hari ini menemukan induk `SP1`. Recovery hanya terisi bila `S1` ada di array yang dikirim ke `evaluateCalibration`.
2. `Object.keys` pada `analyte_results` setelah round-trip JSONB tidak boleh menjadi urutan kolom. Urutan datang dari `calibrations.analytes`.
3. File Excel satu sampel tanpa baris blanko metode tidak dapat menaruh koreksi blanko sebagai formula native. Angka `cNet` yang sudah disimpan tidak menggantikan sel blanko itu.
4. Memanggil `evaluateCalibration` untuk satu sampel saja, tanpa standar dan tanpa blanko batch, tidak mereproduksi hasil yang tersimpan.
5. `db.transaction()` pada driver `neon-http` gagal. Persistence batch harus lewat driver WebSocket.
