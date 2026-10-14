---
name: explain-the-layer
description: Explains the problem underneath code that was written, why each tool, construct, technique, and term fits, and the extreme input or state where that choice breaks. Use when the user asks to explain what was written, why a library or technique was chosen, to study the layer under the work, to find limits or failure edges, or says jelaskan, mengapa, alasan, lapisan di bawah, batas ekstrim, limitasi, rusak, or why this approach.
---

# Lapisan di Bawah Pekerjaan

Jelaskan keputusan yang mengubah desain, mulai dari masalah yang sudah ada sebelum kode itu ditulis. Pembacanya insinyur yang ingin bisa memprediksi keputusan serupa berikutnya.

Tulis dalam bahasa Indonesia. Nama library, identifier, SQL, dan id invariant tetap dalam bentuk aslinya.

## Kapan

Pakai skill ini saat pengguna meminta penjelasan atas kode yang baru ditulis atau yang sedang ditunjuk: mengapa suatu alat, potongan kode, teknik, atau istilah dipakai.

Jangan dipakai untuk memburu bug di luar keputusan yang dibahas, mengulang diff, atau merangkum isi file.

Kalau pengguna menunjuk satu simbol, jelaskan lapisan simbol itu saja.

## Sebelum menulis

1. Baca kode yang ditunjuk. Bila repo memilikinya, baca juga `AGENTS.md`, ADR, dan kontrak yang keputusan itu mengikat.
2. Kelompokkan perubahan menjadi keputusan. Satu keputusan adalah satu masalah yang, kalau dijawab lain, bentuk solusinya berubah.
3. Lewati boilerplate yang tidak mengubah desain, kecuali pengguna menanyakannya.

## Satu lapisan

Turun satu lapisan di bawah pekerjaan. Berhenti saat pembaca bisa memprediksi keputusan yang mirip.

Kalau pengguna bertanya lagi, turun satu lapisan dari jawaban sebelumnya. Jangan loncat ke teori yang tidak mengubah keputusan ini.

## Bentuk jawaban

Buka dengan satu atau dua kalimat: masalah di bawah seluruh perubahan. Lalu tiap keputusan:

### [alat, kode, teknik, atau istilah]

- **Masalah**: kegagalan yang tetap ada andaikan kode ini tidak ditulis. Sebut siapa yang kena. Bila repo mendefinisikannya, sebut id invariant atau ADR.
- **Pilihan**: simbol, library, atau teknik, beserta path file.
- **Kenapa pas**: sifat pilihan itu yang menutup masalah tadi, plus satu kejadian konkret yang sekarang tertolak.
- **Rusak**: satu batas ekstrim, sesuai bagian di bawah.
- **Batas**: apa yang keputusan ini sengaja belum selesaikan.

Istilah dijelaskan hanya sejauh ia menamai masalahnya, bukan sebagai entri glosarium.

Sebut alternatif hanya bila pilihan itu wajar dan masih meninggalkan masalah terbuka. Yang disebut adalah masalah yang tetap terbuka.

## Asumsikan rusak

Untuk setiap keputusan, anggap pemakai, lapisan di atas, atau data akan membawa pilihan ini sampai jaminannya berhenti.

Batas ekstrim adalah input, state, atau urutan kejadian di titik itu. Pilih satu: yang paling mampu membatalkan keputusan. Jangan menghitung setiap cara sesuatu bisa gagal.

Untuk kode yang sudah ada, sebut apa yang terjadi di batas itu: ditolak, tersimpan dalam keadaan rusak, atau dibiarkan. Tunjuk file atau tes. Perilaku yang tidak terlihat dari kode disebut belum ditetapkan.

Untuk konsep yang belum diimplementasikan, batas ekstrim adalah tekanan yang masih terbuka. Jangan mengklaim kode sudah menolaknya.

**Batas** adalah pekerjaan yang sengaja ditunda. **Rusak** adalah tepi tempat jaminan berhenti.

## Jangkar

Setiap klaim menempel pada kode, tes, invariant, atau ADR yang ada. Jangan mengarang alasan yang tidak dijalankan kode. Kalau kode dan dokumen tidak sejalan, sebutkan keduanya.

## Contoh bentuk jawaban

### WebSocket `Pool` `@neondatabase/serverless`

- **Masalah**: batch kalibrasi dan audit log-nya harus commit atau rollback bersama (Invariant T6). Di serverless, koneksi TCP langsung ke Postgres kehabisan slot saat banyak instance bangkit bersamaan (Invariant T4).
- **Pilihan**: `createDb` di `packages/db/src/client.ts` memakai `Pool` WebSocket ke host yang mengandung `-pooler`.
- **Kenapa pas**: pooler memegang transaksi interaktif, jadi dua `INSERT` punya satu batas commit. Query lewat driver HTTP selesai dalam satu request, sehingga kedua insert itu tidak berbagi transaksi dan T6 tetap terbuka.
- **Rusak**: `DATABASE_URL` tanpa `-pooler` tetap diterima `createDb`. `Pool` membuka koneksi langsung, dan kehabisan slot TCP yang T4 cegah tidak ditolak di kode.
- **Batas**: pilihan driver belum menentukan isi tabel, dan belum membuka route Hono.

## Yang tidak dilakukan

- Mengulang diff baris demi baris.
- Memuji pilihan.
- Menjelaskan sintaks yang sudah terlihat dari kode.
- Menurunkan seluruh lapisan sampai ke sistem operasi dalam satu jawaban.
- Menghitung setiap cara sesuatu bisa gagal. Satu batas ekstrim per keputusan.
