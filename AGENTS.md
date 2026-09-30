# 🛡️ Valid-Ex Workspace Rules (AGENTS.md)

Production engineering guidelines, domain invariants, and technical constraints for **Valid-Ex**:  
*Auditable Statistical Calibration, Residual Diagnostics, & Native Formula Excel Engine for Analytical Chemistry (ISO/IEC 17025 & EURACHEM Compliant)*.

---

## 🏛️ 1. Architecture & Monorepo Boundaries (Layer 0)

- **Design-First OpenAPI SSOT (`packages/contracts`)**:
  - The OpenAPI 3.0+ specification at `packages/contracts/openapi.yaml` is the **Single Source of Truth (SSOT)**.
  - All TypeScript types for frontend and backend are generated via `pnpm gen:contracts`.
  - Never write manual DTOs, endpoint handlers, or client interfaces that deviate from the contract.
- **Isomorphic Pure TS Metrology Engine (`packages/math`)**:
  - Zero runtime dependencies (`dependencies: {}`).
  - Isomorphic: Runs identically in the browser (instant live preview) and on the Vercel serverless gateway (audit validation).
  - Must produce 100% deterministic, drift-free numerical calculations across both environments.
- **Monorepo Structure (`pnpm`)**:
  - `packages/contracts`: OpenAPI specification & generated type definitions.
  - `packages/math`: Core metrological calibration and statistical engine.
  - `apps/gateway` (planned): Hono API on Vercel Serverless (Node.js runtime) + Neon PostgreSQL (Drizzle ORM) + Excel generation.
  - `apps/web` (planned): React + TypeScript + Vite + Clipboard DataGrid + Charting.

---

## 🔬 2. Domain & Metrological Invariants (ISO/IEC 17025 & EURACHEM)

- **Invariant D1: Linear Calibration Curve (OLS)**:
  - Requires a minimum of 5 non-zero concentration levels plus a reagent blank ($0\text{ ppm}$).
  - Must use centered sums of squares/cross-products to prevent floating-point catastrophic cancellation.
- **Invariant D2: Multi-Element Independence**:
  - On multielement runs (e.g., Al, Pb, Cd, As, Hg), each analyte must maintain completely isolated regression slopes, intercepts, detection limits, and QC evaluation states.
- **Invariant D3: 3-Zone Detection Limit & Non-Negative Censoring**:
  - Net solution concentration: $C_{\text{net}} = C_{\text{sample}} - C_{\text{blank}}$.
  - **Zone 1 (Not Detected)**: If $C_{\text{net}} \le 0$ or $C_{\text{net}} < \text{LOD}_{\text{instrument}}$, reporting numerical concentrations is strictly forbidden. Must report `"Not Detected"` (`ND`).
  - **Zone 2 (Qualitative Only)**: If $\text{LOD}_{\text{instrument}} \le C_{\text{net}} < \text{LOQ}_{\text{instrument}}$, qualitative presence is confirmed but numerical quantification has unacceptable uncertainty ($\%RSD > 10\%$). Must report `"< [LOQ_method]"`.
  - **Zone 3 (Valid Quantification)**: Quantitative solid reporting ($\text{mg/kg}$) is ONLY valid if $C_{\text{net}} \ge \text{LOQ}_{\text{instrument}}$.
  - **Explicit Unit Conversion (Anti-Galat $1000\times$)**: Never hardcode division by `/ 1000`. Conversion factors must be explicitly looked up based on `solutionConcUnit` (ppb, ppm, ppt) and mass/volume units.
  - **Per-Sample Method LOQ**: `LOQ_method` is calculated per-sample using that specific sample's mass ($W$), extraction volume ($V$), and dilution factor ($dF$).
- **Invariant D4: Governed QC Profiles (ADR-0007)**:
  - QC criteria (CCV recovery, spike recovery, duplicate RPD) must **NEVER be hardcoded in application logic**.
  - All acceptance thresholds must come from an immutable, named, versioned, and cited `qcProfile` (`qcProfileId` + snapshot in batch record).
  - **Soft-Flag Invariant**: QC failures do NOT block calculations or file export. Deviations must be flagged as `INVALID_QC` / `OOS_WARNING` with an auditable `QCViolationRecord` for laboratory Out-of-Specification (OOS) investigations.
- **Invariant D5: Full Precision vs Presentation Rounding**:
  - Internal calculations in `@valid-ex/math` and database persistence must retain full 64-bit IEEE 754 precision (`double precision`).
  - Significant figure rounding (ASTM E29) is strictly confined to the presentation layer (UI DataGrid and Excel cell number formatting `numFmt`).

---

## 🛡️ 3. Runtime, Security, & Protocol Invariants (Layer -1 & Layer -2)

- **Invariant T1: Native Excel Formulas & Anti-CWE-1236**:
  - Exported Excel sheets generated via `exceljs` must write live, evaluable native formulas (`=SLOPE()`, `=INTERCEPT()`, `=STEYX()`, conditional `=IF()`). Never write hardcoded static calculation numbers into output cells.
  - **Anti-CWE-1236 (Formula Injection)**: All user-supplied strings (`sampleId`, batch titles, analyst names) must be sanitized before writing to cells. Prepend a single quote (`'`) to strings starting with `=`, `+`, `-`, or `@`.
- **Invariant T2: Serverless Bounded Memory**:
  - Maximum 250 sample rows per batch request.
  - Excel workbook generation runs in-memory (`writeBuffer()`) with a maximum V8 heap spike $< 64\text{ MB}$, safely within Vercel's Serverless Function limits.
- **Invariant T3: Stateless Gateway**:
  - No assumption of local persistent disk storage or long-running daemon workers.
- **Invariant T4: Database Connection Pooling**:
  - PostgreSQL connections via Drizzle ORM must use the `@neondatabase/serverless` HTTP/WebSocket pooler to prevent TCP connection starvation under concurrent serverless cold starts.
- **Invariant T5: Auth Integrity Guard**:
  - PostgreSQL `CHECK` constraint enforces password hashes for local email/password accounts while permitting `NULL` only for OAuth providers (preventing null-password bypasses).

---

## 🧪 4. TDD Verification & Development Workflow

- **Command Shortcuts**:
  - Run Math Engine Tests: `pnpm test:math`
  - Run All Tests: `pnpm test`
  - Typecheck: `pnpm typecheck`
  - Regenerate Types: `pnpm gen:contracts`
- **Ground-Truth Anchoring (Anti-Circular Testing)**:
  - Benchmark numbers, tolerances, and calibration datasets must NEVER be hallucinated or arbitrarily invented by AI.
  - Unit tests must be anchored directly to verified benchmarks: **NIST Standard Reference Datasets (StRD)** for OLS regression, **EURACHEM / ISO 17025** guidelines for detection limits, and real laboratory validation files.
- **Driver-Navigator Protocol**:
  - For any new math or business logic: AI provides minimal failing test suites (`Red`), user writes the implementation (`Green`) with autocompletion, followed by verification in the terminal.
