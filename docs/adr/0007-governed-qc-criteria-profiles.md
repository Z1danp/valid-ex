# ADR-0007: Governed Versioned QC Criteria Profiles with Banded Thresholds & Immutable Batch Snapshot

- **Status**: Accepted
- **Date**: 2026-09-27
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `project-docs/valid-ex/INVARIANTS.md`, `project-docs/valid-ex/CONTEXT.md`, `packages/contracts/openapi.yaml`, `notes/analytical_chemistry/Validasi Metode/Equation.md`, SOP Lab "QC CRITERIA CHECK", AOAC Appendix F Table A5, USACE EM 200-1-10, EPA SW-846 6010D/6020B

---

## 1. Context & Problem Statement

Pada Milestone 1, kriteria QC dispesifikasikan sebagai **angka tetap** di dalam kontrak
(`QCCriteriaConfig`: `minR`, `ccvRecoveryMin/Max`, `spikeRecoveryMin/Max`, `maxRpd`) dan di `INVARIANTS.md` D4.

Namun muncul temuan bahwa **kriteria penerimaan QC bervariasi**, dan yang lebih penting: kriteria adalah
**kebijakan laboratorium/metode**, bukan konstanta aplikasi. Sumber primer memverifikasi hal ini:

- **EPA SW-846 (Chapter One / 6020B)**: *"Most promulgated EPA methods have defined acceptance criteria that must be met... Where method defined acceptance criteria don't exist, the laboratory must determine its own criteria... calculate the upper and lower control limits from the mean and standard deviation of percent recovery for at least 20 data points."*
- **EPA 6020B**: *"historically derived acceptance limits must not exceed ±20% of the target element spike values."*
- **AOAC Appendix F Table A5**: rentang recovery yang diterima **melebar saat konsentrasi menurun** (level-dependent).
- **USACE EM 200-1-10**: CCV mid-level 90–110%, tetapi **low-level CCV 85–115%**.
- **SOP lab pengguna** ("QC CRITERIA CHECK") justru **flat**: r ≥ 0.995; calibration standard check recovery 100 ± 10%; sample & QC spike recovery 60–115%; RPD ≤ 25%.

Kontradiksi inti: kriteria tidak boleh di-hardcode, tetapi kebebasan penuh per batch juga melanggar semangat
ISO/IEC 17025 (kriteria harus terdokumentasi, terlacak, dan reproducible). Dibutuhkan titik tengah yang ter-governance.

---

## 2. Decision Drivers

- **Auditability (ISO/IEC 17025)**: hasil harus reproducible; auditor harus tahu kriteria mana yang dipakai.
- **Traceability**: setiap kriteria harus punya sitasi sumber (`methodRef`).
- **Future-proofing**: literatur membuktikan kriteria dapat bersifat level-dependent (band).
- **Integritas**: analis tidak boleh melonggarkan ambang per batch demi meloloskan data.
- **Determinisme**: pemilihan kriteria tidak boleh bergantung tafsir manusia saat runtime.

---

## 3. Considered Options

- **Opsi A: Free-form kriteria per batch (analis mengetik angka)**
  - *Kelebihan*: fleksibel maksimal.
  - *Kekurangan*: menghancurkan reproducibility audit, rawan manipulasi, tidak dapat dipertahankan di hadapan auditor.
- **Opsi B: Kriteria hardcoded di aplikasi (status quo Milestone 1)**
  - *Kelebihan*: sederhana & deterministik.
  - *Kekurangan*: melanggar fakta bahwa kriteria adalah kebijakan lab/metode; setiap perubahan SOP = rilis kode baru.
- **Opsi C: Governed versioned profile (Dipilih)**
  - *Kelebihan*: kriteria dideklarasikan sebagai profil bernama + ber-versi + bersitasi; analis hanya MEMILIH; profil di-snapshot immutable ke batch; perubahan angka = versi baru.
  - *Kekurangan*: menambah entitas DB, endpoint, dan kompleksitas resolver.

### Sub-keputusan: struktur kriteria
- Per analit (Invariant D2) **dan** per tipe QC, dengan **band** rentang konsentrasi.
- Band **absolut** dalam `solutionConcUnit`; kriteria flat = **satu band catch-all** (`maxConc: null`).
- **Tanpa override** per batch.
- `linearity.minR` **global** per profil (bukan per band).
- **Tanpa** kriteria blanko (SOP tidak mendefinisikannya).

### Sub-keputusan: pemilih band
- CCV → `expectedConc` (target diketahui a priori).
- Spike → `spikeAdded` (level spike diketahui a priori).
- Duplo → rata-rata `C_net` terukur.

---

## 4. Decision Outcome

Memilih **Opsi C: Governed Versioned QC Criteria Profiles**.

### Aturan Arsitektural (invariants baru):
1. `CalibrationBatchRequest` **wajib** menyertakan `qcProfileId`. Field `qcCriteria` inline dihapus.
2. Profil **immutable**; perubahan angka menghasilkan `version` baru.
3. Batch menyimpan **`qcProfileSnapshot`** (salinan kriteria yang benar-benar diterapkan) + `qcProfileRef {id, version}`.
4. `QCViolationRecord` mencatat `profileVersion` + `appliedCriteria` (band & ambang aktual).
5. Band wajib **kontigu, non-overlap, dan berakhir dengan catch-all** (`maxConc: null`); divalidasi server (422 bila invalid).
6. `solutionConcUnit` profil wajib bila ada batas band finit; konversi unit dilakukan **eksplisit** (anti-jebakan 1000×).
7. Profil wajib memuat entri untuk **setiap** analit yang dipakai batch; tidak ada fallback implisit.
8. **Soft-flag tetap berlaku** (ADR-0005): kegagalan QC tidak memblokir perhitungan/ekspor, tetapi menandai `INVALID_QC`.

Seluruh keputusan ini dituangkan ke [**`packages/contracts/openapi.yaml`**](file:///home/zidan/Projects/valid-ex/packages/contracts/openapi.yaml)
(`QCCriteriaProfile`, `AnalyteCriteria`, `RecoveryBand`, `RpdBand`, endpoint `/qc-profiles`).

---

## 5. Consequences & Trade-offs

- **Positive Impact**:
  - Setiap hasil punya jejak audit lengkap: profil mana, versi berapa, band mana, ambang apa.
  - Perubahan SOP tidak memerlukan rilis kode, tetapi tetap ter-governance (bukan free-form).
  - Band membuat sistem siap menghadapi QAPP/AOAC level-dependent tanpa breaking migration.
- **Negative Impact (Tax / Trade-off)**:
  - Menambah entitas DB (`qc_criteria_profiles`), endpoint CRUD profil, dan resolver band di `@valid-ex/math`.
  - Profil default harus diberi sitasi nyata (SOP) — tidak boleh angka karangan.
  - Beban validasi kontiguitas band di server.

---

## 6. Falsification Vectors

1. Apakah "band" benar-benar dibutuhkan bila SOP lab flat? → Diuji dengan kasus: profil flat = 1 band catch-all harus lulus semua skenario tanpa cabang kode khusus.
2. Bisakah analis mem-bypass profile via input? → Uji kontrak: tidak ada field kriteria di request.
3. Apakah snapshot cukup untuk reproducibility? → Uji: mengubah profil setelah batch dibuat tidak boleh mengubah hasil batch lama.
4. Edge band: nilai tepat di batas band (mis. `maxConc = 10`) → harus masuk band berikutnya (inklusif bawah, eksklusif atas).
5. Unit mismatch profil vs batch (ppb vs ppm) → harus dikonversi eksplisit atau ditolak, bukan silent.
