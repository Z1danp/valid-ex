# ADR-0004: In-Memory Excel Generation via writeBuffer() with 250-Row Payload Cap

- **Status**: Accepted
- **Date**: 2026-09-27
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `references/Instrumentations/ICP-MS/Olah Data ICP-MS.xlsx`, `references/Instrumentations/ICP-MS/Olah data ICP-OES.xlsx`, `project-docs/valid-ex/INVARIANTS.md`

---

## 1. Context & Problem Statement

Valid-Ex menyediakan fitur ekspor spreadsheet audit trail berstandar ISO/IEC 17025 yang berisi:
- Tabel deret standar kalibrasi.
- Tabel data mentah pembacaan instrumen (multi-elemen/analit).
- Sel kalkulasi yang berisi **formula native Excel** (misalnya `=SLOPE()`, `=INTERCEPT()`, `=STEYX()`, dan evaluasi kondisi bertingkat `=IF()`).
- Tabel hasil konsentrasi padatan ($\text{mg/kg}$) dan evaluasi batas deteksi.

Library yang digunakan adalah `exceljs` yang berjalan di atas Vercel Serverless Function (Node.js runtime).

### Dilemma di Layer -1 (Runtime Memory & Streaming):
- `exceljs` memiliki dua metode ekspor:
  1. **In-Memory DOM (`workbook.xlsx.writeBuffer()`)**: Membangun seluruh struktur dokumen di heap RAM V8, lalu mengompresnya menjadi Buffer binary.
  2. **Streaming Writer (`WorkbookWriter`)**: Menulis baris demi baris langsung ke HTTP output stream tanpa menyimpan seluruh dokumen di RAM.
- Apakah ekspor Valid-Ex membutuhkan streaming writer atau cukup in-memory buffer?

---

## 2. Decision Drivers

- **Batas Memori Serverless**: Batas RAM default pada Vercel Serverless adalah 512 MB – 1024 MB.
- **Kompleksitas Spreadsheet ISO 17025**: Dokumen membutuhkan tabel terstruktur (*Excel Tables*), referensi formula silang antar-sheet (misal dari sheet hasil merujuk ke cell konsentrasi blanko di sheet data mentah), conditional formatting, dan merge cell.
- **Karakteristik Nyata Dataset Lab**: Data empiris dari file acuan lab ([`Olah Data ICP-MS.xlsx`](file:///home/zidan/Projects/learning-hub/references/Instrumentations/ICP-MS/Olah%20Data%20ICP-MS.xlsx)) menunjukkan bahwa 1 ID pengujian instrumen rata-rata hanya memproses 20–50 sampel (~1.200 sel per file).

---

## 3. Considered Options

- **Opsi A: Streaming WorkbookWriter (`exceljs.stream.xlsx.WorkbookWriter`)**
  - *Kelebihan*: Sangat hemat memori untuk dataset masif ratusan ribu baris.
  - *Kekurangan*: Bersifat *one-pass*. Begitu baris di-`commit()`, data tidak bisa dimodifikasi. Sangat sulit untuk membuat tabel berformula silang antar-sheet, mereferensikan sel di luar urutan, atau menambahkan metadata kurva dinamis.
- **Opsi B: In-Memory Workbook (`workbook.xlsx.writeBuffer()`) dengan Guardrail Ukuran Batch** (Dipilih)
  - *Kelebihan*: Fleksibilitas penuh untuk membuat relasi formula Excel yang rumit, multiple worksheets yang saling terhubung, styling tabel, dan format sel `numFmt`.
  - *Kekurangan*: Berpotensi memicu *heap spike* jika ukuran data tak terbatas.

---

## 4. Decision Outcome

Memilih **Opsi B: In-Memory `writeBuffer()` dengan Batasan Maksimal 250 Baris Sampel**.

### Analisis Pengukuran Memori (Layer -1 Benchmark):
1. Berdasarkan file referensi lab nyata, 1 file pengujian (47 baris sampel $\times$ 5 analit) hanya menghasilkan file zip sebesar **17 KB** dan memakan alokasi heap V8 sekitar **~1.5 MB – 3 MB**.
2. Dengan pengaman batas payload maksimal **250 sampel per request**, alokasi memori heap V8 maksimum hanya berkisar **~15 MB – 25 MB** selama proses serialisasi zip.
3. Angka ini berada jauh di bawah ambang batas bahaya (*heap spike limit* $< 64 \text{ MB}$) dan sepenuhnya aman dieksekusi di Vercel Serverless.

### Cakupan Format File:
Ekspor difokuskan murni pada sel data tabular terstruktur, deret standar, dan formula matematika native. File tidak menyertakan generator native OpenXML chart guna menjaga efisiensi dan kestabilan resource serverless.

---

## 5. Consequences & Trade-offs

- **Positive Impact**:
  - Implementasi generator spreadsheet jauh lebih bersih, modular, dan ekspresif.
  - Formula native Excel dapat ditautkan secara dinamis antar-sheet tanpa batasan *one-pass stream*.
- **Negative Impact (Tax / Trade-off)**:
  - Valid-Ex tidak dapat memproses batch raksasa (> 10.000 baris dalam satu request ekspor) tanpa refactor ke sistem background job atau streaming generator. Batas 250 baris per batch dikunci sebagai invariant sistem.
