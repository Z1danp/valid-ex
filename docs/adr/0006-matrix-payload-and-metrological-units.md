# ADR-0006: Matrix-Tabular Payload Architecture with Explicit Units and Type-Safe QC Relations

- **Status**: Accepted
- **Date**: 2026-09-27
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `packages/contracts/openapi.yaml`, `references/Instrumentations/ICP-MS/Olah Data ICP-MS.xlsx`, `project-docs/valid-ex/INVARIANTS.md`

---

## 1. Context & Problem Statement

Perancangan kontrak API untuk pengujian kimia analitik (ICP-MS, ICP-OES, AAS) menghadapi tiga tantangan arsitektural krusial pada level representasi data transfer (DTO):

1. **Struktur Multi-Analit vs Redundansi Preparasi**:
   Dalam satu kali run instrumen, analis mengukur banyak analit sekaligus (misal: Al, Pb, Cd, As, Hg) untuk puluhan sampel padatan dengan parameter preparasi fisik yang sama (bobot sampel $W$, volume labu $V$, faktor pengenceran $dF$).
2. **Kerapuhan Identifikasi QC (Regex Fragility)**:
   Di laboratorium, sampel kontrol QC (Duplo dan Matrix Spike) sering kali diberi label string seperti `1111 (1)`, `1111 (2)`, dan `1111 (3)-1`. Jika backend harus menebak relasi sampel menggunakan ekspresi reguler (*regex string parsing*), sistem sangat rentan mengalami *silent failure* saat analis menggunakan format penamaan lain.
3. **Ambiguitas Satuan dan Risiko Galat $1.000\times$ ($10^3$)**:
   Formula konversi konsentrasi larutan ke konsentrasi padatan ($\text{mg/kg}$) bergantung penuh pada satuan konsentrasi larutan ($C$):
   - Jika $C$ dalam $\text{mg/L}$ ($\text{ppm}$), rumusnya adalah $\frac{C \times V}{W}$.
   - Jika $C$ dalam $\mu\text{g/L}$ ($\text{ppb}$), rumusnya adalah $\frac{C \times V}{W \times 1000}$.
   Formula Excel laboratorium yang membagi $1000$ secara inheren mengasumsikan $C$ dalam $\mu\text{g/L}$. Jika satuan tidak dikunci secara eksplisit, risiko salah hitung hingga 1.000 kali lipat sangat tinggi.

---

## 2. Decision Drivers

- **Ergonomi DataGrid**: Payload harus selaras dengan struktur sel tabel Excel agar memudahkan proses *clipboard paste* di antarmuka React.
- **Efisiensi Komputasi & Zero Data Duplication**: Parameter fisik penimbangan sampel tidak boleh diulang berkali-kali untuk setiap analit.
- **Determinisme Relasi QC Tanpa Regex**: Evaluasi RPD Duplo dan % Recovery Spike harus terikat secara eksplisit tanpa mengandalkan tebakan nama sampel.
- **Kejelasan Dimensi Metrologi**: Mencegah salah perhitungan akibat perbedaan instrumen (ICP-MS dalam $\text{ppb}$ vs ICP-OES dalam $\text{ppm}$).

---

## 3. Considered Options

### Masalah 1: Struktur Payload (Analyte-Centric vs Matrix-Centric)
- **Opsi A (Analyte-Centric)**: Setiap analit dibungkus terpisah bersama daftar sampelnya.
  - *Kekurangan*: Redundansi masif; nilai bobot, volume, dan pengenceran sampel harus ditulis berulang di setiap unsur.
- **Opsi B (Matrix-Centric / Tabular)** (Dipilih): Sampel didefinisikan satu kali per baris, dan pembacaan multi-analit dimasukkan sebagai map `{ [analyte]: value }`.
  - *Kelebihan*: Selaras 100% dengan tabel Excel, zero data redundancy, dan komputasi traversal matriks terbukti beroperasi pada $O(A \cdot N)$ (bukan kuadratik $O(N^2)$), tuntas dalam $< 0.01 \text{ ms}$ di V8.

### Masalah 2: Relasi Sampel QC (Regex vs Type-Safe Pointer)
- **Opsi A (Backend Regex Parsing)**: Backend mem-parsing nama sampel (`1111 (2)`) untuk mencari pasangan aslinya.
  - *Kekurangan*: Sangat rapuh terhadap variasi pengetikan analis lab.
- **Opsi B (Frontend-Driven Explicit Pointers)** (Dipilih): Frontend menyediakan modal/picker interaktif untuk menentukan QC, lalu mengirimkan field eksplisit:
  - `parentSampleId`: menautkan duplo/spike ke ID sampel acuan.
  - `spikeAdded`: konsentrasi larutan spike yang ditambahkan per analit.
  - `expectedConc`: konsentrasi teoritis untuk larutan kontrol / CCV.

### Masalah 3: Pengelolaan Satuan
- **Opsi A (Asumsi Implisit Satuan ppb)**:
  - *Kekurangan*: Tidak fleksibel dan berisiko salah fatal jika diterapkan pada instrumen lain (misal ICP-OES dalam $\text{ppm}$).
- **Opsi B (Explicit Metadata Units Object)** (Dipilih): Setiap request wajib mendeklarasikan objek `units` (`solutionConcUnit`, `solidResultUnit`, `weightUnit`, `volumeUnit`).

---

## 4. Decision Outcome

Memilih kombinasi:
1. **Matrix-Tabular Payload**: Sampel per baris dengan pembacaan analit bertipe key-value map.
2. **Type-Safe QC Linking**: Menggunakan `parentSampleId`, `spikeAdded`, dan `expectedConc` eksplisit.
3. **Strict Units Metadata**: Mengunci satuan konsentrasi larutan dan hasil padatan di pintu masuk API.

Seluruh keputusan ini telah dituangkan secara resmi ke dalam spesifikasi [**`packages/contracts/openapi.yaml`**](file:///home/zidan/Projects/learning-hub/projects/valid-ex/packages/contracts/openapi.yaml).

---

## 5. Consequences & Trade-offs

- **Positive Impact**:
  - Ukuran payload HTTP sangat ringkas tanpa duplikasi parameter preparasi.
  - Perhitungan matematika di `@valid-ex/math` menjadi deterministik dan bebas dari *regex parsing bugs*.
  - Dimensi konversi satuan diverifikasi secara matematis, mengeliminasi galat $1.000\times$.
- **Negative Impact (Tax / Trade-off)**:
  - Frontend memikul tanggung jawab logika pembuatan ID dan penautan relasi duplo/spike saat analis berinteraksi dengan antarmuka DataGrid.
