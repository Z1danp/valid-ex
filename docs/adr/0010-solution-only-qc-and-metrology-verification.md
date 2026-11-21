# ADR-0010: Solution-Only QC Rows (`blank_method`, `ccv`) & Two-Tier Metrology Verification

- **Status**: Accepted
- **Date**: 2026-11-21
- **Deciders**: Zidan, Antigravity
- **Consulted**: `docs/INVARIANTS.md`, `docs/adr/0001-design-first-openapi.md`, `docs/adr/0003-isomorphic-typescript-math-engine.md`, `docs/adr/0008-sample-row-export.md`, `packages/contracts/openapi.yaml`, `docs/Olah data ICP-OES.xlsx`

---

## 1. Context & Problem Statement

Pada kontrak awal (`openapi.yaml`), `SampleRowInput`, `EvaluatedSampleRow`, dan tabel `sample_rows` mewajibkan `weight`, `volume`, dan `df` bernilai angka positif (`> 0`) untuk **semua** `sampleType`, serta mewajibkan `lodMethod` dan `loqMethod` bernilai `number` pada `AnalyteSampleResult`.

Dalam praktik laboratorium kimia analitik (ISO/IEC 17025 & EURACHEM), seperti juga terlihat pada worksheet analis [Olah data ICP-OES.xlsx](file:///d:/Projects/valid-ex/docs/Olah%20data%20ICP-OES.xlsx) (sheet `Mo`):

1. **`blank_method` dan `ccv` adalah larutan kontrol murni**, bukan sampel padatan yang ditimbang (`Weight = null`, `Volume = null`, `dF = null`).
2. Memaksa analis atau frontend mengisi nilai nominal fiktif (misalnya `weight = 1, volume = 50, df = 1`) menyebabkan `@valid-ex/math` menghitung `lodMethod`, `loqMethod`, dan `concSolid` semu dalam satuan padatan (`mg/kg`), yang secara metrologi tidak valid dan berisiko membingungkan audit ISO/IEC 17025.
3. Selain itu, verifikasi unit test di `@valid-ex/math` sebelumnya hanya mengandalkan dataset sintetis + generator Python internal, belum mengikat **benchmark OLS tersertifikasi NIST StRD** dan **cross-reference data batch laboratorium nyata** sebagaimana diamanatkan `AGENTS.md` §4 dan ISO/IEC 17025 Klausul 7.11.

---

## 2. Decision Drivers

- **ISO/IEC 17025 & EURACHEM Metrological Accuracy**: Baris tanpa penimbangan matriks padatan (`blank_method`, `ccv`) tidak boleh memiliki nilai konversi matriks padatan (`lodMethod`, `loqMethod`, `concSolid`).
- **Design-First OpenAPI SSOT (ADR-0001)**: Perubahan skema harus dimulai dari `packages/contracts/openapi.yaml` lalu diturunkan ke `@valid-ex/math`, `@valid-ex/db`, `apps/gateway`, dan `apps/web`.
- **SQL Three-Valued Logic Safety**: PostgreSQL `CHECK` constraint tidak boleh meloloskan `NULL` pada baris padatan (`sample`, `spike`, `duplicate`) akibat evaluasi `NULL > 0` menjadi `UNKNOWN`.
- **Objective Audit Evidence (ISO/IEC 17025 §7.11)**: Akurasi numerik regresi dan alur kalkulasi end-to-end perlu dibuktikan terhadap standar internasional (**NIST StRD `Norris`**) sekaligus data instrumen nyata (**`Olah data ICP-OES.xlsx`**).

---

## 3. Considered Options

### A. Penanganan `weight`, `volume`, `df` pada `blank_method` & `ccv`

- **Opsi 1: Nilai nominal fiktif (`weight: 1, volume: 50, df: 1`) di UI/DTO**
  - _Ditolak_: Menghasilkan `lodMethod`/`loqMethod`/`concSolid` palsu pada `blank_method` dan `ccv`, bertentangan dengan prinsip metrologi ISO/IEC 17025.
- **Opsi 2: Nullable `weight`, `volume`, `df`, `lodMethod`, `loqMethod` untuk QC larutan (`blank_method`, `ccv`)** (**Dipilih**)
  - Memisahkan secara tegas **baris matriks padatan** (`sample`, `spike`, `duplicate`) dan **baris larutan QC** (`blank_method`, `ccv`) di seluruh stack.

### B. Pelaporan `reportedValue` untuk `blank_method` & `ccv`

- **`blank_method`**: Selalu `'ND'` (karena $C_{\text{net}} = C_{\text{blank}} - C_{\text{blank}} = 0 \le 0$ pada Zona 1 Invariant D3; konsentrasi mentahnya tetap tercatat pada `cRaw`).
- **`ccv`**: Menampilkan **konsentrasi larutan terukur (`cRaw`)** dalam `solutionConcUnit` (`"${cRaw.toFixed(3)} ${solutionConcUnit}"`) agar analis dapat membandingkannya secara eksplisit terhadap konsentrasi nominal standar (`expectedConc`) dan `% Recovery CCV`.

### C. Strategi Validasi & Verifikasi `@valid-ex/math`

- **Verifikasi Dua Lapis (Two-Tier Verification)** (**Dipilih**):
  1. **NIST StRD `Norris` (`Norris.dat`, 36 observasi)** untuk menguji presisi numerik OLS (`slope`, `intercept`, `syx`, `rSquared`) terhadap nilai tersertifikasi 15 digit bebas bias.
  2. **Cross-Reference Data Lab Nyata (`Olah data ICP-OES.xlsx`, sheet `Mo`)** untuk memverifikasi kurva 7 titik, kriteria QC, 4 sampel `PMA @HKUST-1`, `Cek Std`, dan penahanan `HKUST-1` (`0 ppm`) ke `'ND'`.

---

## 4. Decision Outcome

1. **OpenAPI Contract (`packages/contracts/openapi.yaml`)**:
   - `SampleRowInput` & `EvaluatedSampleRow`: `weight`, `volume`, `df` menjadi `nullable: true` (`number | null`).
   - `AnalyteSampleResult`: `lodMethod`, `loqMethod` menjadi `nullable: true` (`number | null`), sejajar dengan `concSolid`.
2. **Metrology Engine (`packages/math`)**:
   - Menambahkan `isSolidSampleType(sampleType)` di `evaluate.ts`; baris padatan wajib `weight/volume/df > 0`, sedangkan `blank_method` dan `ccv` melewati `toSolidConcentration` dan mengembalikan `null` pada ketiga parameter preparasi dan `lodMethod`/`loqMethod`/`concSolid`.
3. **Database (`packages/db`)**:
   - Migrasi `0002_nullable_qc_prep_params.sql` menghapus `NOT NULL` pada `sample_rows.weight`, `volume`, `df` dan menegakkan `sample_rows_prep_params_by_type_chk`:
     ```sql
     CHECK (
       ("sample_type" IN ('blank_method', 'ccv') AND "weight" IS NULL AND "volume" IS NULL AND "df" IS NULL)
       OR
       ("sample_type" IN ('sample', 'spike', 'duplicate') AND "weight" IS NOT NULL AND "weight" > 0 AND "volume" IS NOT NULL AND "volume" > 0 AND "df" IS NOT NULL AND "df" > 0)
     )
     ```
4. **Gateway, ExcelJS Export, & Frontend (`apps/gateway`, `apps/web`)**:
   - Zod `.superRefine` pada `SampleRowInputSchema` memvalidasi kesesuaian `null` vs `> 0` sesuai `sampleType`.
   - Generator `.xlsx` menulis `'-'` pada `Weight`/`Volume`/`dF`/`LOQ Method`/`Conc Solid` untuk `blank_method` & `ccv` dengan tetap mempertahankan formula native `C_raw`, `C_net`, dan `Reported Result`.
   - `QcDataGrid` memblokir (`--`) kolom `Bobot (g)`, `Vol (mL)`, dan `dF` untuk `blank_method` dan `ccv`.
5. **Test Suite Verifikasi (`packages/math/test`)**:
   - `regression.test.ts` & `reference.ts` memuat dataset resmi **NIST StRD `Norris`**.
   - `evaluate.test.ts` memuat skenario _cross-reference_ **Logam `Mo`** dari `docs/Olah data ICP-OES.xlsx`.

---

## 5. Consequences

- **Positif**:
  - Tidak ada angka `lodMethod`, `loqMethod`, atau `concSolid` palsu pada `blank_method` dan `ccv` di database, API, UI, maupun ekspor `.xlsx`.
  - Memenuhi bukti validasi software ISO/IEC 17025 Klausul 7.11 (NIST StRD + data instrumen nyata).
- **Trade-off / Yang Perlu Diperhatikan**:
  - Karena `@valid-ex/math` sengaja terisolasi dari `@valid-ex/contracts` (Invariant A2 / _zero-dependency_), perubahan tipe `number | null` perlu disinkronkan di kedua tempat (`openapi.yaml` + `packages/math/src/types.ts`), dengan compiler TypeScript (`pnpm typecheck`) sebagai penjaga di boundary `apps/gateway` dan `apps/web`.
  - Database PostgreSQL yang sudah berjalan wajib menjalankan migrasi `0002_nullable_qc_prep_params.sql` sebelum menerima payload `blank_method`/`ccv` dengan `null`.
