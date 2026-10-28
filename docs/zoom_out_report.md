# 🔍 Stage 5: Initial Zoom Out Review Report

**Target Document**: [`docs/CONTEXT.md`](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md) (Lines 1–121)  
**Standard**: [Zoom Out Standard](file:///home/zidan/.gemini/config/plugins/egm/resources/document_standards/zoom-out-standard.md)  
**Auditor**: Skeptical Architect (`egm-zoom-out`)  
**Evaluation Summary**: 1 Blocker, 4 Major, 2 Nit

---

## Findings Breakdown

### 1. Context Insufficiency & Broken Personal Vault Links
- **Severity**: 🔴 **Blocker**
- **Affected Scope**: Header ([lines 6](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L6)), Section 1 ([line 14](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L14)), Section 3 ([lines 45, 50](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L45-L50)), Section 5 ([lines 66, 67](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L66-L67)), Milestones ([lines 88, 95](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L88-L95)), and References ([lines 114–118](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L114-L118)).
- **Simplicity Rationale**: The document is saturated with Obsidian-style personal vault wikilinks (`[[notes/webdev/...]]`, `[[0008-sample-row-export|ADR-0008]]`, `[[0007-governed-qc-criteria-profiles|ADR-0007]]`, `[[auth-schema-sparring]]`) that do not exist within the workspace repository. Under **Zoom Out Standard §0 (Context Sufficiency)**, a project context document must be self-contained for any naive engineer or agent. Critical architectural decisions (such as the trade-offs behind ADR-0008's single-sample export model or ADR-0007's banded QC criteria profiles) cannot be audited or verified because their documentation is externalized to an unreachable private vault. Furthermore, references to internal repository documents like [`INVARIANTS.md`](file:///home/zidan/Projects/valid-ex/docs/INVARIANTS.md) use non-standard wikilink syntax (`[[INVARIANTS|Invariant D3]]`) rather than standard markdown relative paths (`[Invariant D3](./INVARIANTS.md#1-domain--metrological-invariants-isoiec-17025--eurachem)`).

---

### 2. Monorepo Package Drift & Omission of `@valid-ex/db`
- **Severity**: 🟡 **Major**
- **Affected Scope**: Section 1 (Mermaid Diagram, [lines 12–26](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L12-L26)) & Section 2 ("Repository Architecture: Modern pnpm Monorepo", [lines 37–43](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L37-L43)).
- **Simplicity Rationale**: Section 2 explicitly enumerates the workspace packages (`apps/web/`, `apps/gateway/`, `packages/math/`, `packages/contracts/`), but completely omits `packages/db/` (`@valid-ex/db`). In the Mermaid diagram, the gateway is shown calling Neon directly via Drizzle without showing the shared `@valid-ex/db` package boundary. In reality, Milestone 3 was specifically completed to scaffold [`packages/db`](file:///home/zidan/Projects/valid-ex/packages/db) containing the Drizzle schemas, migrations, WebSocket pooler, and transactional persistence helpers (`persistCalibrationBatch`, `deleteCalibration`). The architecture overview has drifted from the actual monorepo layout.

---

### 3. Protocol Contradiction: HTTP Pooler vs WebSocket Transaction Pooler
- **Severity**: 🟡 **Major**
- **Affected Scope**: Section 1 (Mermaid Diagram, [line 24](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L24)) vs Section 3 ([line 45](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L45)), Milestone 3 ([line 90](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L90)), and [`INVARIANTS.md`](file:///home/zidan/Projects/valid-ex/docs/INVARIANTS.md#L63-L75).
- **Simplicity Rationale**: The Mermaid diagram specifies `Gateway -->|Drizzle ORM via HTTP Pooler| DB[("Neon Serverless PostgreSQL")]`. This contradicts Section 3, Milestone 3, and Invariant T4/T6. Neon's HTTP driver (`neon()`) is stateless HTTP and does not support interactive transactions (`db.transaction()`), which are strictly mandated by Invariant T6. As implemented in [`packages/db/src/client.ts`](file:///home/zidan/Projects/valid-ex/packages/db/src/client.ts#L1-L22), the database uses the WebSocket pooler (`Pool` from `@neondatabase/serverless` configured with `ws`). Documenting "HTTP Pooler" in the system diagram presents an architectural dead-end that breaks ACID compliance.

---

### 4. Erroneous Invariant Citation (D3 vs T1)
- **Severity**: 🟡 **Major**
- **Affected Scope**: Section 5 ("Metrology & Reporting Pipeline", [line 75](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L75)).
- **Simplicity Rationale**: Line 75 states: *"In accordance with **Invariant D3**, all calculated cells MUST contain live native formula strings (e.g., `=SLOPE(...)`, `=STEYX(...)`, `=INTERCEPT(...)`), never static hardcoded numbers."* Invariant D3 is strictly the domain rule for **3-Zone Detection Limit & Non-Negative Censoring** (ND, `<LOQ`, and solid sample concentration formulas). The invariant governing live native Excel formulas and Anti-CWE-1236 escaping is **Invariant T1** ("Live Native Excel Formulas & Anti-CWE-1236"). Misattributing core technical and security rules creates confusion in the architecture's governing invariants.

---

### 5. Altitude Drop: Formula Weeds Duplicated from `INVARIANTS.md`
- **Severity**: 🟡 **Major**
- **Affected Scope**: Section 5 ("Metrology & Reporting Pipeline", [lines 58–72](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L58-L72)).
- **Simplicity Rationale**: Under **Zoom Out Standard §3 (Anti-Weeds / Altitude Control)**, high-level context documents must focus on architectural topology, component boundaries, and pipeline stages rather than micro-level equations. Section 5 duplicates verbatim the LaTeX equations for solid sample dilution, exact 4-step branching logic, and unit conversion caveats already canonicalized in [`docs/INVARIANTS.md`](file:///home/zidan/Projects/valid-ex/docs/INVARIANTS.md#L8-L38) and tested in [`@valid-ex/math`](file:///home/zidan/Projects/valid-ex/packages/math). This redundancy adds noise and creates synchronization risk. `CONTEXT.md` should summarize the high-level metrology pipeline stages (Signal Normalization $\to$ OLS Regression $\to$ 3-Zone Censoring $\to$ Governed QC Verification $\to$ Live Formula Excel Generation) and delegate the concrete equations to `INVARIANTS.md`.

---

### 6. Ambiguous Milestone State Tracking
- **Severity**: 🟢 **Nit**
- **Affected Scope**: Section "Active Goals & Milestones", Milestone 2 ([line 83](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L83)).
- **Simplicity Rationale**: Line 83 reads `- [x] **Milestone 2: Monorepo Scaffolding & Core Math Engine (@valid-ex/math)** — 🔄 In Progress`. Simultaneously marking an item as completed (`[x]`) and in-progress (`🔄 In Progress`) confuses the project baseline, especially when Milestone 3 is already marked completed (`[x]`) with passing tests.

---

### 7. Inconsistent Document Language
- **Severity**: 🟢 **Nit**
- **Affected Scope**: Sections 3, 4, 5, and Milestones ([lines 44–95](file:///home/zidan/Projects/valid-ex/docs/CONTEXT.md#L44-L95)).
- **Simplicity Rationale**: The document alternates haphazardly between English and Indonesian mid-paragraph (e.g., *"Kueri transaksi memakai WebSocket pool..."*, *"mode hanya menentukan semantik readings SAMPEL; deret standar selalu memakai signal c/s"*, *"Segel integritas ISO/IEC 17025 via trigger PL/pgSQL"*). For a core system architecture document intended as the SSOT for developers and agents, the text should be standardized in a single consistent language.
