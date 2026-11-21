# Ringkasan Implementasi Pemisahan QC, Opsi 2 (Nullable Prep Params), & Validasi Metrologi

Dokumen ini mencatat seluruh perubahan yang dikerjakan pada sesi lanjutan setelah refactor modul kalibrasi frontend, mencakup pemisahan tabel Sampel vs QC (Gap 1), penegakan metrologi **Opsi 2** lintas layer (`contracts` -> `math` -> `db` -> `gateway` -> `web`), serta penambahan verifikasi **NIST StRD `Norris`** dan _cross-reference_ data lab nyata.

---

## 1. Fase 1: Pemisahan Tabel Sampel & QC (Gap 1 Frontend)

Disiapkan sebelum masuk ke fase pembuatan _custom hooks_ & integrasi API Gateway:

- **Pemisahan Tabel Input Step 3** ([SampleWizard.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/components/SampleWizard.tsx)):
  - **Tabel 1: Sampel Uji** ([SampleDataGrid.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/components/SampleDataGrid.tsx)): khusus baris `sample` dengan urutan kolom `Sample ID | <Analyte 1..n> | Bobot (g) | Vol (mL) | dF` (ditambah toggle opsional `Lab Sample ID`).
  - **Tabel 2: Kontrol Mutu / QC** ([QcDataGrid.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/components/QcDataGrid.tsx)): memuat `blank_method`, `ccv`, `spike`, dan `duplicate` dengan urutan kolom `Sample ID | <Analyte 1..n> | Tipe QC | Parent | Bobot (g) | Vol (mL) | dF`.
- **Dropdown Sel Custom & Panel Target QC**:
  - [gridDropdownCell.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/components/gridDropdownCell.tsx): renderer dropdown enum untuk `Tipe QC` dan daftar `Parent` dinamis dari `Sample ID` bertipe `sample` (kolom `Parent` diblokir `--` untuk `blank_method` dan `ccv`).
  - [QcTargetParametersPanel.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/components/QcTargetParametersPanel.tsx): input per-analit untuk `expectedConc` (`ccv`) dan `spikeAdded` (`spike`).

---

## 2. Fase 2: Opsi 2 Full-Stack TDD (Nullable Prep Params untuk `blank_method` & `ccv`)

Untuk kepatuhan ISO/IEC 17025, baris larutan QC murni (`blank_method` dan `ccv`) tidak lagi diberi bobot/volume/dF fiktif dan tidak melalui konversi matriks padatan (`mg/kg`, `ug/kg`, `percent`):

1. **OpenAPI SSOT (`packages/contracts`)**:
   - Memperbarui [openapi.yaml](file:///d:/Projects/valid-ex/packages/contracts/openapi.yaml) agar `weight`, `volume`, dan `df` bertipe `number | null` pada `SampleRowInput` & `EvaluatedSampleRow`, serta `lodMethod` dan `loqMethod` bertipe `number | null` pada `AnalyteSampleResult`.
   - Memperjelas spesifikasi `reportedValue`: padatan memakai 3-zona (`ND`, `< [LOQ_metode]`, atau `[concSolid] [solidResultUnit]`), `blank_method` selalu `'ND'`, dan `ccv` menampilkan konsentrasi larutan terukur (`cRaw`) dalam `solutionConcUnit`.
   - Meregenerasi [types.ts](file:///d:/Projects/valid-ex/packages/contracts/src/types.ts) via `pnpm gen:contracts`.

2. **Isomorphic Metrology Engine (`packages/math`)**:
   - Memperbarui [types.ts](file:///d:/Projects/valid-ex/packages/math/src/types.ts) (`weight`, `volume`, `df`, `lodMethod`, `loqMethod` nullable).
   - Menambahkan `isSolidSampleType` di [evaluate.ts](file:///d:/Projects/valid-ex/packages/math/src/evaluate.ts): memvalidasi `weight/volume/df > 0` pada `sample | spike | duplicate`, dan melewati `toSolidConcentration` untuk `blank_method | ccv` (`lodMethod: null, loqMethod: null, concSolid: null`, `reportedValue: 'ND'` untuk `blank_method` dan `${cRaw.toFixed(3)} ${solutionConcUnit}` untuk `ccv`).

3. **Database Schema & Migrasi (`packages/db`)**:
   - Mengubah kolom `weight`, `volume`, dan `df` menjadi nullable di [sample-rows.ts](file:///d:/Projects/valid-ex/packages/db/src/schema/sample-rows.ts) dengan constraint `sample_rows_prep_params_by_type_chk` (termasuk guard `IS NOT NULL` untuk logika `NULL` tiga-nilai SQL PostgreSQL).
   - Menambahkan migrasi [0002_nullable_qc_prep_params.sql](file:///d:/Projects/valid-ex/packages/db/drizzle/0002_nullable_qc_prep_params.sql) dan mendaftarkannya di [_journal.json](file:///d:/Projects/valid-ex/packages/db/drizzle/meta/_journal.json).
   - Menambahkan Skenario 7 pada [integrity.test.ts](file:///d:/Projects/valid-ex/packages/db/test/integrity.test.ts).

4. **API Gateway & Ekspor Excel Native (`apps/gateway`)**:
   - Menambahkan `.superRefine` pada `SampleRowInputSchema` di [calibrations.ts](file:///d:/Projects/valid-ex/apps/gateway/src/routes/calibrations.ts) untuk menolak `null` pada `sample/spike/duplicate` (`400`) dan menolak nilai non-null pada `blank_method/ccv` (`400`).
   - Memperbarui [excel.ts](file:///d:/Projects/valid-ex/apps/gateway/src/lib/excel.ts) agar `blank_method` dan `ccv` menulis `'-'` pada `Weight`/`Volume`/`dF`/`LOQ Method`/`Conc Solid`, sambil mempertahankan formula native `C_raw`, `C_net`, dan `Reported Result`.
   - Memperbarui [test-db.ts](file:///d:/Projects/valid-ex/apps/gateway/test/helpers/test-db.ts), [calibrations.test.ts](file:///d:/Projects/valid-ex/apps/gateway/test/calibrations.test.ts), dan [export.test.ts](file:///d:/Projects/valid-ex/apps/gateway/test/export.test.ts).

5. **Frontend Web (`apps/web`)**:
   - Mengganti `isWeightRequired` dengan `isPrepParamsRequired` di [sampleValidation.ts](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/utils/sampleValidation.ts) (`false` untuk `blank_method` & `ccv`), menormalisasi DTO `toSampleRowInputs` ke `null`, dan memulihkan default positif saat tipe diubah ke `spike`/`duplicate`.
   - Memblokir `Bobot (g)`, `Vol (mL)`, dan `dF` (`--`) di [QcDataGrid.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/components/QcDataGrid.tsx) untuk `blank_method` dan `ccv`.
   - Memperbarui [SampleDataGrid.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/components/SampleDataGrid.tsx), [CalibrationWizardPage.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/pages/CalibrationWizardPage.tsx), [SampleEvaluationTable.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/components/SampleEvaluationTable.tsx), [CalibrationDetailPage.tsx](file:///d:/Projects/valid-ex/apps/web/src/features/calibration/pages/CalibrationDetailPage.tsx), serta [sample-validation.test.ts](file:///d:/Projects/valid-ex/apps/web/test/sample-validation.test.ts).

---

## 3. Fase 3: Verifikasi NIST StRD `Norris` & Cross-Reference Data Lab Nyata

Menambahkan dua lapis bukti validasi software (ISO/IEC 17025 Klausul 7.11) di `@valid-ex/math`:

- **Benchmark NIST StRD `Norris`** ([reference.ts](file:///d:/Projects/valid-ex/packages/math/test/fixtures/reference.ts), [regression.test.ts](file:///d:/Projects/valid-ex/packages/math/test/regression.test.ts)):
  - Menguji `linearRegression()` terhadap 36 observasi `Norris.dat` dan 4 nilai tersertifikasi NIST (`slope`, `intercept`, `rSquared` `< 1e-12`; `syx` `~2.05e-12`, diuji `< 1e-9`).
- **Cross-Reference Data Lab ICP-OES Nyata** ([Olah data ICP-OES.xlsx](file:///d:/Projects/valid-ex/docs/Olah%20data%20ICP-OES.xlsx), [evaluate.test.ts](file:///d:/Projects/valid-ex/packages/math/test/evaluate.test.ts)):
  - Menguji deret standar 7 titik Logam `Mo 202.032 nm`, kriteria QC sheet `Mo`, `Blank`, `HKUST-1` (ditahan menjadi `'ND'` sesuai Invariant D3), 4 sampel `PMA (...) @HKUST-1` (`8454.106`, `9193.777`, `13089.005`, `20352.035 mg/kg`), dan `Cek Std` (`100%` recovery, `'0.500 ppm'`).

---

## 4. Ringkasan Status Verifikasi

| Pemeriksaan                                           | Scope                                                           | Hasil                                     |
| :---------------------------------------------------- | :-------------------------------------------------------------- | :---------------------------------------- |
| `pnpm test:math`                                      | `@valid-ex/math` (termasuk NIST `Norris` & ICP-OES `Mo`)        | Lulus (`6` file test, `74/74` test cases) |
| `pnpm --filter @valid-ex/db test`                     | `@valid-ex/db` (termasuk `sample_rows_prep_params_by_type_chk`) | Lulus (`7/7` skenario)                    |
| `pnpm --filter @valid-ex/gateway test`                | `@valid-ex/gateway` (API & ekspor `.xlsx` `blank_method`/`ccv`) | Lulus (`3` file test, `14/14` test cases) |
| `node --test apps/web/test/sample-validation.test.ts` | Validasi & mapper DTO frontend                                  | Lulus (`8/8` test cases)                  |
| `pnpm typecheck`                                      | Seluruh 5 package (`contracts`, `math`, `db`, `web`, `gateway`) | Lulus (`0` error)                         |
| `pnpm --filter @valid-ex/web build`                   | Production bundle web (`tsc -b && vite build`)                  | Lulus                                     |
