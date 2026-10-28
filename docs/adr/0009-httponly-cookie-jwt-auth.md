# ADR-0009: Stateless JWT Authentication via HttpOnly Cookie (`CookieAuth`)

- **Status**: Accepted
- **Date**: 2026-10-27
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `project-docs/valid-ex/CONTEXT.md`, `project-docs/valid-ex/INVARIANTS.md`, `project-docs/valid-ex/adr/0002-single-table-auth-schema.md`, `packages/contracts/openapi.yaml`

---

## 1. Context & Problem Statement

Pada rancangan awal kontrak `packages/contracts/openapi.yaml`, autentikasi pengguna menggunakan skema `BearerAuth` di mana server mengembalikan `accessToken` JWT di dalam body JSON (`AuthResponse`), dan klien (Frontend React SPA) menyimpannya lalu mengirimkannya kembali melalui header `Authorization: Bearer <token>`.

Namun, penyimpanan token secara manual di sisi klien (khususnya jika disimpan di `localStorage` atau `sessionStorage`) membuka permukaan serangan **Cross-Site Scripting (XSS)**: apabila terdapat celah injeksi skrip pada sisi browser (misalnya melalui pustaka pihak ketiga), skrip jahat dapat membaca token JWT milik analis laboratorium dan menyalahgunakan wewenang penandatanganan batch kalibrasi ISO/IEC 17025.

---

## 2. Decision Drivers

- **Mitigasi Pencurian Token via XSS**: Token sesi tidak boleh dapat diakses oleh runtime JavaScript di browser (`document.cookie` maupun `window.localStorage`).
- **Stateless Serverless (Invariant T3)**: Tetap mempertahankan sifat *stateless* JWT tanpa tabel sesi di database pada setiap *request*, selaras dengan arsitektur Vercel Serverless.
- **Kemudahan Integrasi Browser (`hono/cookie`)**: Memanfaatkan mekanisme standar HTTP `Set-Cookie` dan `Cookie` bawaan browser serta modul resmi `hono/cookie` tanpa ketergantungan pustaka eksternal `cookie-parser`.
- **Siklus Hidup Sesi yang Lengkap (Logout)**: Karena JavaScript di browser tidak dapat menghapus cookie berbendera `HttpOnly`, kontrak API wajib menyediakan endpoint eksplisit `POST /auth/logout` agar server dapat menginstruksikan penghapusan cookie (`Max-Age=0`).

---

## 3. Considered Options

- **Opsi A: `BearerAuth` via JSON Body & Header `Authorization`**
  - Mudah diuji lintas-domain, namun membebankan penyimpanan token pada JavaScript klien (rentan eksfiltrasi bila terjadi XSS).
- **Opsi B: `CookieAuth` (`HttpOnly`, `SameSite=Lax`, `Secure`)** (Dipilih)
  - Server menyematkan JWT ke dalam header `Set-Cookie: valid_ex_token=<jwt>; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` (ditambah `Secure` pada lingkungan produksi HTTPS).
  - Body JSON pada `AuthResponse` hanya mengembalikan `{ user: UserProfile }` tanpa mengekspos string token mentah ke lapisan JavaScript.

---

## 4. Decision Outcome & Contract Changes

1. **Skema Keamanan OpenAPI (`CookieAuth`)**:
   - Mengganti `BearerAuth` di `packages/contracts/openapi.yaml` menjadi:
     ```yaml
     securitySchemes:
       CookieAuth:
         type: apiKey
         in: cookie
         name: valid_ex_token
     ```
2. **Penyederhanaan `AuthResponse`**:
   - `POST /auth/register`, `POST /auth/login`, dan `POST /auth/google` mengembalikan header `Set-Cookie` berisi cookie `valid_ex_token` (`HttpOnly`) dan body JSON `{ user: UserProfile }`.
3. **Penambahan Endpoint `POST /auth/logout`**:
   - Menghapus cookie `valid_ex_token` melalui `deleteCookie(c, 'valid_ex_token', { path: '/' })` dan mengembalikan status `204 No Content`.
4. **Konfigurasi CORS & Mitigasi CSRF**:
   - Middleware CORS di Hono mengaktifkan `credentials: true`.
   - Atribut `SameSite=Lax` dikombinasikan dengan penegakan `Content-Type: application/json` (via validator kontrak Zod) pada seluruh endpoint mutasi untuk menangkal *Cross-Site Request Forgery* (CSRF).
