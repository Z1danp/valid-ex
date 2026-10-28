# ADR-0003: Isomorphic Pure TypeScript Math Engine (@valid-ex/math) vs Isolated Python Service

- **Status**: Accepted
- **Date**: 2026-09-27
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `project-docs/valid-ex/CONTEXT.md`, `project-docs/valid-ex/INVARIANTS.md`

---

## 1. Context & Problem Statement

Pada perancangan awal Valid-Ex, muncul pertimbangan untuk menggunakan Python (NumPy, SciPy, FastAPI) sebagai mesin kalkulasi statistik dan regresi kurva kalibrasi, didampingi Express/Hono sebagai web backend.

Namun, antarmuka pengguna Valid-Ex dirancang menggunakan **Clipboard Pasteable DataGrid**:
- Saat analis lab menempelkan (*paste*) deret standar dan data sampel dari Excel via `Ctrl+V`, analis mengharapkan **instant zero-latency live preview** (grafik kurva regresi, slope, intercept, residual $s_{y/x}$, dan status deteksi langsung muncul seketika tanpa jeda round-trip network HTTP).
- Pada saat yang sama, saat data disimpan secara permanen ke database atau diekspor ke Excel, backend API Gateway wajib melakukan **validasi metrologi audit independen** di sisi server.

---

## 2. Decision Drivers

- **Zero Latency UX**: Reaktivitas antarmuka tanpa lag jaringan saat analis mengedit atau mem-paste puluhan sel data di browser.
- **Isomorphic Determinism**: Hasil kalkulasi statistik di browser analis wajib identik secara deterministik dengan kalkulasi yang divalidasi dan disimpan oleh serverless gateway.
- **Operational Simplicity**: Menghindari pemeliharaan dua runtime berbeda (Node.js + Python runtime) pada arsitektur serverless (mengurangi biaya *cold start*, deployment overhead, dan kerumitan IPC/HTTP antar-servis).

---

## 3. Considered Options

- **Opsi A: Microservice Arsitektur (Hono Node.js + Python FastAPI Service)**
  - *Kelebihan*: Akses instan ke pustaka ilmiah matang seperti `scipy.stats` dan `numpy`.
  - *Kekurangan*: 
    - Setiap perubahan angka di DataGrid frontend membutuhkan request jaringan HTTP ke Python service, menimbulkan latensi (50–300 ms).
    - Dua runtime yang harus di-deploy dan dimonitor terpisah.
    - Python serverless memiliki *cold start* yang relatif lambat di lingkungan serverless.
- **Opsi B: Isomorphic Pure TypeScript Engine (`packages/math` / `@valid-ex/math`)** (Dipilih)
  - *Kelebihan*:
    - **Zero-Dependency**: Mesin matematika murni TypeScript tanpa dependensi eksternal.
    - **Isomorphic**: Pustaka yang sama dapat diimpor langsung oleh React di browser (Client Live Preview) dan oleh Hono di Vercel Serverless (Audit Trail Validation).
    - Latensi UI = 0 ms (dijalankan langsung di V8 thread browser pengguna).
    - Satu ekosistem monorepo pnpm yang ramping dan terpadu.
  - *Kekurangan*: Rumus OLS, $s_{y/x}$, LOD/LOQ, dan uji residu harus diimplementasikan dan diuji dari prinsip pertama (*first-principles*) menggunakan Vitest, bukan tinggal impor dari SciPy.

---

## 4. Decision Outcome

Memilih **Opsi B: Isomorphic Pure TypeScript Engine (`@valid-ex/math`)**.

### Aturan Arsitektural:
1. `packages/math` tidak boleh memiliki ketergantungan pada API browser (DOM/window) ataupun API server (Node fs/http). Harus 100% *pure algorithmic functions*.
2. Seluruh modul diuji secara ketat via TDD (Vitest) dengan dataset acuan resmi (EURACHEM & ISO benchmarks).
3. Kedua lingkungan (Frontend & Gateway) mengimpor fungsi yang sama persis:
   ```typescript
   import { calculateLinearRegression, evaluateDetectionZones } from '@valid-ex/math';
   ```

---

## 5. Consequences & Trade-offs

- **Positive Impact**:
  - Pengalaman analis lab sangat responsif: grafik kurva, nilai OLS, dan badge metrologi terhitung instan saat data di-paste.
  - Tidak ada biaya operasional server Python terpisah.
  - Auditibilitas kode sangat tinggi karena seluruh algoritma metrologi tertulis transparan di dalam repositori sendiri.
- **Negative Impact (Tax / Trade-off)**:
  - Beban implementasi awal: Tim harus menulis dan memverifikasi algoritma statistik matematika sendiri dari prinsip pertama.
  - Algoritma lanjutan non-linear yang sangat rumit (misal: non-linear 4PL curve fitting) membutuhkan usaha matematika ekstra jika ingin ditambahkan di kemudian hari.
