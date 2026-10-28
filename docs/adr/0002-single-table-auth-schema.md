# ADR-0002: Single-Table User Authentication with Database CHECK Constraint

- **Status**: Accepted
- **Date**: 2026-09-27
- **Deciders**: Zidan, Antigravity Sparring Partner
- **Consulted**: `project-docs/valid-ex/ai-sparring/auth-schema-sparring.md`, `project-docs/valid-ex/INVARIANTS.md`

---

## 1. Context & Problem Statement

Aplikasi Valid-Ex memerlukan dua mekanisme autentikasi pengguna:
1. Pendaftaran lokal manual menggunakan Email dan Password.
2. Single Sign-On (SSO) menggunakan Google OAuth.

Jika sistem menggunakan satu tabel `users`, kolom `password_hash` harus bersifat *nullable* agar pengguna Google OAuth dapat disimpan tanpa password.

### Kerentanan yang Teridentifikasi (Murphy's Law Red-Team):
1. **Null Password Bypass**: Implementasi login naif di backend berisiko menerima request login lokal dengan password `null` atau string kosong jika `password_hash` di database bernilai `NULL`.
2. **Account Takeover / Collision Attack**: Pengguna mendaftar dengan Google (`user@lab.com`), kemudian pihak ketiga mendaftar manual dengan email yang sama dan password sembarang. Tanpa pemisahan integritas yang ketat, akun berisiko dibajak.

---

## 2. Decision Drivers

- Menjaga kesederhanaan skema database pada fase awal tanpa redundansi JOIN antar tabel yang berlebihan.
- Mencegah celah keamanan di level terdalam (**Layer -2: Database Engine**), sehingga jika ada bug di kode aplikasi Express/Hono, database tetap menolak data yang tidak valid.

---

## 3. Considered Options

- **Opsi A: Multi-Table Schema (NextAuth/Lucia Standard)**
  - *Struktur*: Memisahkan tabel `users`, `accounts` (menyimpan provider & provider_account_id), dan `sessions`.
  - *Kelebihan*: Standar industri untuk multi-provider OAuth, sangat modular.
  - *Kekurangan*: Overkill untuk kebutuhan Valid-Ex saat ini (hanya butuh Local + Google), menambah kompleksitas JOIN kueri pada setiap autentikasi.
- **Opsi B: Single-Table Naif Tanpa Constraint**
  - *Struktur*: Kolom `password_hash` dibuat `NULL`, validasi hanya mengandalkan kode backend Hono.
  - *Kelebihan*: Sangat mudah dibuat.
  - *Kekurangan*: Sangat berbahaya. Jika terjadi regresi kode atau bypass pada API handler, database mengizinkan akun lokal tersimpan tanpa password hash.
- **Opsi C: Single-Table dengan PostgreSQL CHECK Constraint (Pragmatic)** (Dipilih)
  - *Struktur*: Satu tabel `users`, namun dipagari oleh aturan integritas relational PostgreSQL:
    ```sql
    CHECK (
      (auth_provider = 'local' AND password_hash IS NOT NULL) OR
      (auth_provider != 'local')
    )
    ```

---

## 4. Decision Outcome

Memilih **Opsi C: Single-Table dengan DB CHECK Constraint**.

### Skema Drizzle ORM:
```typescript
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  authProvider: varchar('auth_provider', { length: 50 }).notNull().default('local'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('check_password_for_local_auth', sql`
    (${table.authProvider} = 'local' AND ${table.passwordHash} IS NOT NULL) OR
    (${table.authProvider} != 'local')
  `)
]);
```

### Business Rules di Gateway:
- Login manual ditolak dengan HTTP 400 jika akun memiliki `auth_provider !== 'local'`.
- Pendaftaran lokal ditolak dengan HTTP 409 Conflict jika email sudah terdaftar via Google OAuth.

---

## 5. Consequences & Trade-offs

- **Positive Impact**:
  - Kueri autentikasi sangat cepat (single-table lookup tanpa JOIN).
  - Keamanan dijamin pada level database (Layer -2); database secara fisik menolak insert akun lokal tanpa password.
- **Negative Impact (Tax / Trade-off)**:
  - Jika di masa depan lab membutuhkan multi-provider (misal: login dengan Google DAN Microsoft Azure AD dalam satu user identity yang sama), skema ini harus dimigrasikan ke arsitektur multi-table `accounts`.
