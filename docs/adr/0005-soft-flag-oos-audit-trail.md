# ADR-0005: Soft-Flag OOS Regulatory Audit Trail vs Hard Block Rejection

- **Status**: Accepted
- **Date**: 2026-09-27
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `project-docs/valid-ex/CONTEXT.md`, `project-docs/valid-ex/INVARIANTS.md`, ISO/IEC 17025 SOPs

---

## 1. Context & Problem Statement

Dalam pengujian laboratorium analitik berstandar ISO/IEC 17025, setiap rangkaian pengujian diwajibkan melewati evaluasi kontrol kualitas (*Quality Control / QC*):
- Koefisien korelasi linearitas kurva ($r \ge 0.995$).
- Continuing Calibration Verification (CCV recovery $100 \pm 10\%$).
- Relative Percent Difference pada duplo ($RPD \le 25\%$).
- Matrix Spike Recovery ($60\% - 115\%$).

### Dilemma Arsitektural:
Jika salah satu kriteria QC gagal (misalnya $r = 0.991$ atau CCV melayang ke $116\%$), bagaimana sistem Valid-Ex merespons request kuantifikasi dan ekspor dokumen Excel?
1. Apakah API Gateway harus **memblokir total** (Hard Block: menolak menyimpan data dan mengembalikan HTTP 422 Unprocessable Entity)?
2. Ataukah sistem tetap melakukan kalkulasi dan mengizinkan ekspor, namun menyematkan **tanda audit deviasi regulatori** (Soft Flag / OOS Warning)?

---

## 2. Decision Drivers

- **Kepatuhan Alur Kerja Lab Nyata (ISO 17025 OOS Investigation)**: Di laboratorium pengujian riil, jika hasil pengujian berada di luar spesifikasi (*Out of Specification / OOS*), analis dan Quality Assurance (QA) manajer **wajib memiliki data mentah dan lembar kalkulasi** untuk melakukan investigasi akar masalah (*root cause analysis*). Memblokir total data menyebabkan analis tidak bisa menginvestigasi kegagalan tersebut.
- **Integritas Metrologi**: Hasil pengujian yang tidak memenuhi QC tidak boleh sampai disalahartikan sebagai data yang sah atau lolos sertifikasi.

---

## 3. Considered Options

- **Opsi A: Hard Block Rejection (HTTP 422)**
  - *Mekanisme*: Sistem melempar exception, menolak menyimpan data sampel, dan mematikan fungsi tombol ekspor Excel.
  - *Kelebihan*: Sangat aman dari risiko kelalaian analis menerbitkan sertifikat palsu.
  - *Kekurangan*: Bertentangan dengan realitas laboratorium. Analis kehilangan akses ke angka perhitungan, tidak bisa melihat tren drift instrumen, dan terpaksa kembali mengolah data manual di luar sistem.
- **Opsi B: Soft-Flag Audit Trail & Regulatory Watermarking** (Dipilih)
  - *Mekanisme*: Sistem tetap memproses kalkulasi dan mengizinkan penyimpanan serta ekspor spreadsheet, tetapi status batch otomatis ditandai sebagai `INVALID_QC / OOS_WARNING`. Pada UI antarmuka dan lembar dokumen Excel, disematkan badge peringatan deviasi dan penanda audit yang tidak dapat dihapus.

---

## 4. Decision Outcome

Memilih **Opsi B: Soft-Flag Audit Trail & Regulatory Watermarking**.

### Aturan Penerapan (System Invariants D4):
1. **Database & API Response**: Response API menyertakan array `qcViolations` yang merinci parameter apa yang gagal (misal: `{ rule: "CCV_RECOVERY", expected: "90-110%", actual: "115.4%" }`). Status kalibrasi disimpan sebagai `INVALID_QC`.
2. **Frontend UI**: Menampilkan banner merah kontras tinggi dan badge peringatan deviasi regulatori pada setiap baris sampel terkait.
3. **Dokumen Excel**: Pada header lembar kerja dan sel status, dicantumkan status `"OOS / INVALID QC - FOR INVESTIGATION ONLY"` agar dokumen tidak dapat disalahgunakan sebagai laporan resmi yang sah (*Certificate of Analysis*).

---

## 5. Consequences & Trade-offs

- **Positive Impact**:
  - Mengakomodasi alur kerja investigasi deviasi lab ISO 17025 yang sesungguhnya.
  - Data mentah dan kalkulasi tetap dapat dianalisis untuk menemukan penyebab instrumen drift atau kontaminasi reagen.
- **Negative Impact (Tax / Trade-off)**:
  - Tanggung jawab visual di Presentation Layer (UI & Excel) menjadi lebih tinggi. Sistem harus memastikan penandaan peringatan tidak ambigu agar pengguna tidak terkecoh mengira pengujian tersebut valid.
