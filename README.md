# valid-ex ⚗️📊

> **An Auditable Statistical Engine & Method Validation Platform for Analytical Chemistry (ISO/IEC 17025 & EURACHEM Compliant)**

`valid-ex` is a modern, research-grade software platform designed to bridge the gap between analytical laboratory instrumentation (e.g., ICP-MS, HPLC, GC-MS, UV-Vis) and regulatory compliance. It automates calibration diagnostics, heteroscedasticity detection, Limit of Detection (LOD/LOQ) verification, and dynamically generates fully auditable Microsoft Excel (`.xlsx`) spreadsheets populated with **live, native formulas**.

---

## 🎯 The Problem

In regulated laboratories (ISO/IEC 17025, EPA, GLP/GMP):
1. **The Vendor "Black Box" Trap**: Proprietary instrument software (Agilent MassHunter, Thermo Qtegra, PerkinElmer Syngistix) calculates LOD/LOQ using proprietary, over-simplified shortcuts (e.g., single-day 3x blank noise) that do not meet formal method validation standards. Furthermore, high correlation coefficients ($R^2 > 0.999$) often conceal severe **heteroscedasticity** and massive bias at trace levels.
2. **Spreadsheet Fragility**: To prepare auditable validation dossiers, chemists manually copy data into custom Microsoft Excel spreadsheets. These manual templates are notorious for formula corruption, cell referencing errors, and lack of systematic statistical testing.
3. **Audit Resistance**: Commercial web apps export static numbers or dumb CSVs, leaving auditors unable to inspect intermediate mathematical logic.

---

## ✨ Core Capabilities

### 1. Statistical Calibration Diagnostics
- **Ordinary Least Squares (OLS) vs. Weighted Least Squares (WLS)**: Compares unweighted models against $1/x$ and $1/x^2$ weightings to eliminate trace-level quantification error.
- **Residual Analysis**: Evaluates residual distribution patterns to detect heteroscedasticity and non-constant variance.
- **Mandel’s Linearity Test**: Runs $F$-tests comparing linear vs. quadratic polynomial fits to objectively prove whether a calibration curve is truly linear.

### 2. Regulatory LOD / LOQ Determination
- Implements EURACHEM and ICH Q2(R2) certified algorithms based on the **Residual Standard Deviation of the Regression line ($s_{y/x}$)**:
  $$\text{LOD} = \frac{3.3 \cdot s_{y/x}}{\text{Slope}}, \quad \text{LOQ} = \frac{10 \cdot s_{y/x}}{\text{Slope}}$$
- Supports EPA Method 200.8 / 6020 multi-replicate spike determinations (Student's $t_{0.99}$ approach).

### 3. Dynamic Native Formula Excel Generation (.xlsx)
- Exports formatted `.xlsx` workbooks where calculation cells contain **live, active Excel formulas** (`=SLOPE()`, `=INTERCEPT()`, `=STEYX()`, `=AVERAGE()`, `=STDEV.S()`, conditional styling) instead of static values.
- Delivers an immutable audit trail that QA assessors and ISO 17025 auditors can interactively audit and verify.

---

## 🏛️ System Architecture

`valid-ex` uses a **Service-Oriented Polyglot Architecture** separating high-performance web I/O from scientific mathematical computing:

```
[ Client: React + TypeScript + Vite ]
       │
       │ HTTP / JSON (Session Cookies / JWT)
       ▼
[ Gateway & Orchestrator: Node.js + Express + TypeScript ]
  ├── User & Laboratory Project Management
  ├── Relational Persistence: PostgreSQL + Drizzle ORM
  └── Request Validation: Zod Schema Invariants
       │
       │ Internal HTTP / IPC
       ▼
[ Scientific Compute Service: Python + FastAPI ]
  ├── Numerical Engine: SciPy, NumPy, Statsmodels
  ├── Validation Datasets: EURACHEM / NIST Ground Truth Benchmarks
  └── Spreadsheet Generation: OpenPyXL Dynamic Formula Compiler
```

---

## 🧪 Ground Truth & Method Verification

All mathematical modules in `valid-ex` are continuously validated via automated Test-Driven Development (TDD) against certified benchmark datasets from:
- **EURACHEM / CITAC Guide CG4**: *The Fitness for Purpose of Analytical Methods*.
- **ISO 11843**: *Capability of Detection*.
- **EPA Method 200.8 & 6020B**: *Determination of Trace Elements in Waters and Wastes by ICP-MS*.

---

## 🗺️ Project Roadmap

- [ ] **Phase 1: Scientific Core Engine (Python / SciPy)**
  - [ ] Implement OLS, WLS ($1/x, 1/x^2$), and residual calculation.
  - [ ] Implement Mandel's Linearity Test ($F$-test).
  - [ ] Implement EURACHEM $s_{y/x}$ and blank-based LOD/LOQ algorithms.
  - [ ] TDD validation test suite against certified reference values.
- [ ] **Phase 2: Dynamic Excel Report Generator**
  - [ ] OpenPyXL template builder injecting dynamic formulas.
  - [ ] Outlier and %RSD conditional formatting rules.
- [ ] **Phase 3: API Gateway & Persistence (Express / Postgres)**
  - [ ] Relational schema for instruments, runs, and audit logs.
  - [ ] Secure REST API and validation middleware.
- [ ] **Phase 4: Utilitarian Web UI (React / TypeScript)**
  - [ ] High-density Excel-like clipboard paste data grid.
  - [ ] Interactive calibration curve & residual plots.
  - [ ] One-click `.xlsx` report download.

---

## 📄 License

MIT License. Designed for open scientific research and lab quality automation.
