# ADR-0001: Design-First OpenAPI Specification as Single Source of Truth (SSOT)

- **Status**: Accepted
- **Date**: 2026-09-27
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `project-docs/valid-ex/CONTEXT.md`, `project-docs/valid-ex/INVARIANTS.md`

---

## 1. Context & Problem Statement

Valid-Ex adalah platform validasi metode kimia analitik (ISO/IEC 17025) yang melibatkan struktur data kompleks: titik deret standar, parameter preparasi sampel (bobot, volume, faktor pengenceran), parameter kalibrasi OLS multi-analit, batas deteksi (LOD/LOQ), evaluasi QC, dan ekspor spreadsheet terstruktur.

Tantangan utama:
1. **Desinkronisasi Frontend & Backend**: Jika tipe data didefinisikan secara terpisah di React (Frontend) dan Hono (Gateway), perubahan skema rentan menyebabkan *runtime type drift* dan *silent bugs*.
2. **AI-Human Collaboration Guardrail**: Pengembangan dibantu oleh AI Agentic. Tanpa kontrak yang formal dan terpusat (*machine-readable*), agen AI rentan mengasumsikan nama field atau bentuk payload yang berbeda-beda di setiap iterasi.

---

## 2. Decision Drivers

- Kebutuhan satu sumber kebenaran (*Single Source of Truth*) yang mengikat Frontend dan Backend secara bersamaan.
- Otomasi pembuatan tipe TypeScript (*type-generation*) tanpa redundansi penulisan manual.
- Validasi request otomatis di level API Gateway sebelum menyentuh logika bisnis.
- Dokumentasi interaktif (Swagger UI) yang selalu sinkron secara otomatis.

---

## 3. Considered Options

- **Opsi A: Code-First via tRPC**
  - *Kelebihan*: Sangat mulus jika Frontend dan Backend berbagi monorepo TypeScript yang sama.
  - *Kekurangan*: Terikat erat ke ekosistem TypeScript/Node.js, menyulitkan jika di masa depan ada layanan non-TypeScript (misal Python analytics atau Go), serta tidak menghasilkan dokumentasi standar industri terbuka.
- **Opsi B: Code-First via Zod-to-OpenAPI di Hono**
  - *Kelebihan*: Menulis skema langsung di TypeScript backend, lalu OpenAPI di-generate otomatis.
  - *Kekurangan*: Backend memegang kepemilikan kontrak secara sepihak. Frontend harus menunggu backend selesai di-scaffold sebelum bisa mengambil tipe kontrak.
- **Opsi C: Design-First OpenAPI 3.0+ Specification (`contracts/openapi.yaml`)** (Dipilih)
  - *Kelebihan*: Netral bahasa, menjadi cetak biru awal sebelum satu baris pun kode backend/frontend ditulis. Tipe TypeScript di-generate via `openapi-typescript` untuk kedua aplikasi.

---

## 4. Decision Outcome

Memilih **Opsi C: Design-First OpenAPI 3.0+**.
File `packages/contracts/openapi.yaml` menjadi *Single Source of Truth* tunggal dalam monorepo `projects/valid-ex`.

### Alur Kerja (Workflow):
1. Setiap fitur atau perubahan endpoint didefinisikan terlebih dahulu di `contracts/openapi.yaml`.
2. Script `pnpm run typegen` mengeksekusi `openapi-typescript` untuk meng-generate paket `@valid-ex/contracts`.
3. `apps/web` (React) dan `apps/gateway` (Hono) mengimpor tipe yang sama persis dari `@valid-ex/contracts`.
4. Hono menggunakan validator berbasis OpenAPI untuk memverifikasi request payload di pintu masuk.

---

## 5. Consequences & Trade-offs

- **Positive Impact**:
  - Eliminasi total inkonsistensi tipe antara frontend dan backend.
  - AI Agent memiliki pagar yang kaku dan objektif saat membuat endpoint atau komponen UI.
  - Validasi runtime di API Gateway terjadi di pintu gerbang (*Layer 0*), mencegah data korup masuk ke database.
- **Negative Impact (Tax / Trade-off)**:
  - Ada friksi di awal (*upfront cost*): Developer tidak bisa langsung *ngoding* endpoint sebelum spesifikasi YAML ditulis dan divalidasi.
