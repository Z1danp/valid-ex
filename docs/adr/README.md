# 🏛️ Architecture Decision Records (ADR): valid-ex

Dokumen ini memuat keputusan arsitektur penting (*One-Way Door Decisions*) yang telah disepakati dan diimplementasikan pada proyek `valid-ex`. Setiap record mendokumentasikan konteks masalah, opsi yang dipertimbangkan, keputusan akhir, serta konsekuensi teknisnya.

---

## 📑 Daftar Record ADR

| ID | Judul Keputusan | Status | Tanggal | Topik Utama |
|---|---|---|---|---|
| [ADR-0001](file:///home/zidan/Projects/learning-hub/project-docs/valid-ex/adr/0001-design-first-openapi.md) | Design-First OpenAPI Specification as SSOT | **Accepted** | 2026-09-27 | API Contract, Type-Safety, AI Alignment |
| [ADR-0002](file:///home/zidan/Projects/learning-hub/project-docs/valid-ex/adr/0002-single-table-auth-schema.md) | Single-Table Auth Schema with DB CHECK Constraint | **Accepted** | 2026-09-27 | Database Security, Local & OAuth Identity |
| [ADR-0003](file:///home/zidan/Projects/learning-hub/project-docs/valid-ex/adr/0003-isomorphic-typescript-math-engine.md) | Isomorphic Pure TypeScript Math Engine (`@valid-ex/math`) | **Accepted** | 2026-09-27 | Zero Latency Live Preview, Monorepo Architecture |
| [ADR-0004](file:///home/zidan/Projects/learning-hub/project-docs/valid-ex/adr/0004-in-memory-exceljs-export-with-bounded-payload.md) | In-Memory Excel Generation via `writeBuffer()` with 250-Row Cap | **Accepted** | 2026-09-27 | Serverless Memory Bound, Native Formulas |
| [ADR-0005](file:///home/zidan/Projects/learning-hub/project-docs/valid-ex/adr/0005-soft-flag-oos-audit-trail.md) | Soft-Flag OOS Regulatory Audit Trail vs Hard Block | **Accepted** | 2026-09-27 | ISO/IEC 17025 QC Gating, Out of Specification SOP |
| [ADR-0006](file:///home/zidan/Projects/learning-hub/project-docs/valid-ex/adr/0006-matrix-payload-and-metrological-units.md) | Matrix-Tabular Payload with Explicit Units & QC Relations | **Accepted** | 2026-09-27 | DTO Ergonomics, Unit Dimensional Analysis, Anti-Regex |
| [ADR-0007](file:///home/zidan/Projects/learning-hub/project-docs/valid-ex/adr/0007-governed-qc-criteria-profiles.md) | Governed Versioned QC Criteria Profiles with Banded Thresholds | **Accepted** | 2026-09-27 | QC Governance, Audit Snapshot, Level-Dependent Criteria |
| [ADR-0008](file:///home/zidan/Projects/learning-hub/project-docs/valid-ex/adr/0008-sample-row-export.md) | Sample-Row Persistence with Per-Sample Excel Export | **Accepted** | 2026-10-15 | Schema, One Excel per Sample, Optional Lab Sample ID |

---

## 🛠️ Panduan Menulis ADR Baru

Setiap keputusan baru yang memenuhi kriteria berikut wajib dibuatkan ADR baru:
1. Mengubah struktur skema database atau kontrak API antarsistem.
2. Memilih teknologi/library baru yang memengaruhi batasan runtime (Layer -1 & Layer -2).
3. Mengubah alur bisnis regulatori metrologi kimia analitik (ISO 17025 & EURACHEM).
