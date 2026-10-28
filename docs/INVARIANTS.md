# 🛡️ System Invariants: valid-ex

> **Invariants** are non-negotiable rules that MUST hold true across all layers of the system.  
> Neither user code nor AI-generated code is permitted to violate these rules.

---

## 1. Domain & Metrological Invariants (ISO/IEC 17025 & EURACHEM)

- **Invariant D1 (Calibration Minimum Points)**:
  - Kurva kalibrasi linear (OLS) wajib memiliki minimal **5 level konsentrasi non-zero** (atau minimal 3 titik untuk screening kualitatif) ditambah titik blanko ($0 \text{ ppm}$).
- **Invariant D2 (Multi-Element & Multi-Analyte Support)**:
  - Pada pengujian multielement (misal: Al, Pb, Cd, As, Hg dalam satu run ICP-MS/ICP-OES), setiap analit wajib memiliki parameter regresi, batas deteksi, dan status evaluasi QC yang independen satu sama lain.
- **Invariant D3 (3-Zone Detection Limit & Non-Negative Censoring)**:
  - Nilai konsentrasi larutan bersih dihitung sebagai $C_{\text{net}} = C_{\text{sample}} - C_{\text{blank}}$.
  - **Gating 3-zona dilakukan di LEVEL LARUTAN** (satuan `solutionConcUnit`: ppb/ppm/ppt), membandingkan $C_{\text{net}}$ terhadap $\text{LOD}_{\text{instrument}}$ dan $\text{LOQ}_{\text{instrument}}$ yang diturunkan dari kurva ($3 \cdot s_{y/x}/m$ dan $10 \cdot s_{y/x}/m$).
  - **Zona 1 (Not Detected)**: Jika $C_{\text{net}} \le 0$ atau $C_{\text{net}} < \text{LOD}_{\text{instrument}}$, sistem terlarang keras menampilkan nilai numerik konsentrasi. Hasil wajib dilaporkan sebagai `"Not Detected"` (`ND`) untuk mencegah kebocoran angka negatif palsu.
  - **Zona 2 (Qualitative Detection Only)**: Jika $\text{LOD}_{\text{instrument}} \le C_{\text{net}} < \text{LOQ}_{\text{instrument}}$, analit terdeteksi secara kualitatif tetapi tidak memenuhi kepastian statistik kuantifikasi ($\%RSD > 10\%$). Sistem terlarang keras mengeluarkan angka konsentrasi padatan ($\text{mg/kg}$). Hasil wajib dilaporkan sebagai `"< [LOQ_metode]"`.
  - **Zona 3 (Valid Quantification)**: Kuantifikasi numerik padatan ($\text{mg/kg}$) HANYA sah dihitung jika $C_{\text{net}} \ge \text{LOQ}_{\text{instrument}}$:
    $$\text{Conc (mg/kg)} = \frac{(C_{\text{sample}} - C_{\text{blank}}) \times V_{\text{flask}}\ (\text{mL}) \times dF}{W_{\text{sample}}\ (\text{g}) \times 1000}$$
  - **Konversi Unit Eksplisit (Anti-Galat $1000\times$)**: Faktor `/1000` di atas HANYA valid bila $C$ dalam $\mu\text{g/L}$ (ppb). Untuk $\text{ppm}$ (mg/L) faktornya menghilang, untuk $\text{ppt}$ (ng/L) berbeda lagi. Mesin hitung WAJIB memakai tabel konversi dimensi berbasis `solutionConcUnit`/`solidResultUnit`/`weightUnit`/`volumeUnit`, DILARANG meng-hardcode `/1000`.
  - **`LOQ_metode` bersifat PER-SAMPEL**: dihitung dari $V$, $dF$, dan $W$ sampel itu sendiri (bukan satu nilai global per analit).

- **Invariant D4 (QC Gating, Governed Criteria Profiles, & Soft-Flag Audit / OOS Handling)**:
  - **Kriteria QC DILARANG di-hardcode di aplikasi.** Seluruh ambang penerimaan WAJIB berasal dari sebuah **profil kriteria QC** yang:
    1. bernama dan **ber-versi** (immutable; mengubah angka = versi baru), serta bersitasi `methodRef` (nomor SOP/metode);
    2. direferensikan oleh setiap batch via `qcProfileId` (`/qc-profiles`);
    3. **di-snapshot** ke dalam batch (`qcProfileSnapshot` + `qcProfileRef`) agar hasil reproducible saat audit.
  - **Struktur profil**: per **analit** (Invariant D2) × per **tipe QC** (CCV / spike / duplo), dengan daftar **band** rentang konsentrasi absolut (`solutionConcUnit`). Kriteria flat direpresentasikan sebagai **satu band catch-all** (`maxConc: null`). Band WAJIB kontigu, non-overlap, dan berakhir catch-all. `linearity.minR` bersifat **global** per profil.
  - **Pemilih band**: CCV → `expectedConc`; Spike → `spikeAdded`; Duplo → rata-rata `C_net`.
  - **Tanpa override per batch**: analis hanya MEMILIH profil; tidak ada field kriteria di request batch.
  - **Profil default bersitasi** (SOP Lab "QC CRITERIA CHECK", rev 1): $r \ge 0.995$; CCV recovery $90.0\% - 110.0\%$; Spike recovery $60.0\% - 115.0\%$; RPD $\le 25.0\%$. Angka-angka ini adalah **isi profil**, bukan konstanta kode.
  - **Guard numerik**: bila rata-rata pasangan duplo $\le 0$, RPD adalah `null` (undefined), bukan `Infinity`/`NaN`.
  - **Soft-Flag Invariant**: Kegagalan batas QC TIDAK MEMBLOKIR kalkulasi atau ekspor file Excel. Sistem WAJIB menyematkan status deviasi regulatori (`INVALID_QC` / `OOS_WARNING`) beserta `QCViolationRecord` (memuat `profileVersion` + `appliedCriteria`) yang tampak jelas pada UI dan dokumen Excel untuk kebutuhan investigasi *Out of Specification* (OOS) analis lab.
- **Invariant D5 (Internal Full Precision vs Presentation Rounding)**:
  - Seluruh mesin hitung `@valid-ex/math` dan penyimpanan database wajib mempertahankan presisi penuh floating-point (IEEE 754 64-bit float / `double precision`) tanpa pembulatan di langkah perantara.
  - Pembulatan angka penting (significant figures / ASTM E29) hanya diterapkan pada **Presentation Layer** (tampilan UI DataGrid dan format sel Excel `numFmt`, misalnya `0.000`).

---

## 2. Architecture & Metrology Engine Invariants

- **Invariant A1 (Design-First OpenAPI SSOT)**:
  - File `contracts/openapi.yaml` adalah satu-satunya sumber kebenaran (*Single Source of Truth*) untuk semua skema data, endpoint, query parameter, dan DTO.
  - Dilarang membuat endpoint Hono atau antarmuka React yang menyimpang dari kontrak OpenAPI yang telah divalidasi.
- **Invariant A2 (Isomorphic Determinism)**:
  - `@valid-ex/math` adalah pustaka *zero-dependency* murni TypeScript yang dijalankan secara isomorfik di Browser (Client Live Preview) dan Vercel Serverless Gateway (Audit Validation).
  - Hasil kalkulasi OLS, $s_{y/x}$, LOD, LOQ, dan kuantifikasi di kedua lingkungan wajib deterministik dan menghasilkan output yang identik secara numerik (zero-drift).

---

## 3. Technical, Runtime, & Security Invariants (Layer -1 & Layer -2)

- **Invariant T1 (Live Native Excel Formulas & Anti-CWE-1236)**:
  - Dokumen Excel yang diekspor wajib menggunakan formula native Excel yang dapat dievaluasi langsung oleh aplikasi spreadsheet (`=SLOPE()`, `=INTERCEPT()`, `=STEYX()`, formula bertingkat `=IF()`). Dilarang mencetak angka statis hasil hardcode pada sel hasil.
  - **Anti-CWE-1236 (Spreadsheet Formula Injection)**: Semua input teks pengguna (seperti `sampleId`, nama batch, catatan analis) wajib disanitasi sebelum ditulis ke sel Excel. Jika string diawali karakter `=`, `+`, `-`, atau `@`, karakter tersebut wajib di-escape (misal diawali tanda petik tunggal `'`) untuk mencegah eksekusi kode arbitrer pada komputer analis.
  - **Tabular Scope**: Ekspor Excel difokuskan murni pada sel tabular terstruktur dan formula matematika native; tidak menggunakan native chart generator OpenXML untuk menjaga stabilitas dan efisiensi resource serverless.
- **Invariant T2 (Serverless Bounded Memory & Batch Limits)**:
  - Satu batch pengujian dibatasi maksimal **250 baris sampel** per request.
  - Pembuatan file Excel via `exceljs` dieksekusi secara in-memory (`workbook.xlsx.writeBuffer()`), dengan batas *heap spike* V8 maksimum $< 64 \text{ MB}$, menjamin eksekusi aman di dalam batas resource Vercel Serverless Function (512 MB – 1024 MB).
- **Invariant T3 (Stateless Serverless / Zero Persistent Disk)**:
  - API Gateway beroperasi secara murni *stateless*. Dilarang mengasumsikan ketersediaan disk lokal persisten atau background worker/cron daemon yang berjalan terus-menerus di server.
- **Invariant T4 (Neon Serverless Connection Pooling)**:
  - Akses database PostgreSQL di Neon wajib menggunakan adapter HTTP/WebSocket pooler (`@neondatabase/serverless`) melalui Drizzle ORM untuk mencegah kehabisan slot koneksi TCP (*connection starvation*) saat terjadi lonjakan eksekusi serverless konkuren.
- **Invariant T5 (Auth DB Integrity & Null Password Bypass Guard)**:
  - Tabel `users` wajib dipagari oleh PostgreSQL `CHECK` constraint:
    ```sql
    CHECK (
      (auth_provider = 'local' AND password_hash IS NOT NULL) OR
      (auth_provider != 'local')
    )
    ```
  - Mencegah akun lokal tanpa password, serta mencegah pengambilalihan akun (*account takeover*) antara pendaftar manual dan Google OAuth.
- **Invariant T6 (ACID Transactional Persistence)**:
  - Data kurva kalibrasi, deret standar, batch sampel, dan log audit wajib disimpan dalam satu batas transaksi ACID database yang utuh. Simpan parsial (*partial writes*) dilarang keras.
