# myKoordinat — Poster Pendakian Custom dari GPX

Ubah rekaman GPX pendakian jadi poster **20×30 cm** siap cetak: peta jalur asli, pos, profil elevasi, statistik, foto, plus **jalur 3D timbul** (file STL/SVG presisi 1:1 dengan poster). Mendukung poster **1 pendakian** maupun **koleksi ekspedisi 2–3 gunung**.

Dibangun dengan **Next.js 16 (App Router) + React 19 + Tailwind + MapLibre**.

---

## Struktur aplikasi

Ada dua sisi, dipisah oleh gerbang akses (proxy):

| Bagian | URL | Akses |
| --- | --- | --- |
| **Etalase jualan** | `/landingpage` | Publik |
| **Form pesan + preview** | `/landingpage/pesan` | Publik |
| **Login admin** | `/admin` | Publik (gerbang masuk) |
| **Editor poster (tools)** | `/` dan `/editor` | **Admin saja** |

Pengunjung biasa hanya bisa membuka landing page. Semua tools editor (`/`, `/editor`) otomatis dialihkan ke `/landingpage` kecuali sudah login admin.

---

## Menjalankan lokal

```bash
npm install
npm run dev        # http://localhost:3000
```

Saat `dev`, gerbang akses **nonaktif** supaya kamu bebas membuka editor tanpa login. Gerbang hanya aktif di build production (yang dipakai Netlify).

Perintah lain:

```bash
npm run build      # build production (sekalian type-check)
npm run start      # jalankan hasil build production
npm run lint       # ESLint
```

---

## Deploy ke Netlify

### 1. Push ke GitHub

Pastikan proyek sudah ada di repo GitHub (atau GitLab/Bitbucket).

```bash
git add .
git commit -m "Siap deploy"
git push
```

> File `netlify.toml` sudah disertakan — Netlify otomatis memakai `npm run build`, Node 22, dan plugin resmi Next.js (`@netlify/plugin-nextjs`) yang membuat SSR + proxy/gerbang admin berjalan.

### 2. Buat site di Netlify

1. Login ke [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
2. Pilih penyedia Git dan repo `gpx-summit-poster`.
3. Build settings biasanya **terdeteksi otomatis** dari `netlify.toml`:
   - Build command: `npm run build`
   - Plugin: `@netlify/plugin-nextjs`

   Biarkan apa adanya.
4. **JANGAN klik Deploy dulu** — set dulu environment variable di bawah.

### 3. Set environment variable (WAJIB)

Di **Site configuration → Environment variables**, tambahkan:

| Key | Value | Wajib? |
| --- | --- | --- |
| `ADMIN_USER` | username admin pilihanmu | **Ya** |
| `ADMIN_PASS` | password admin yang kuat | **Ya** |

> ⚠️ **Penting soal keamanan.** Kalau `ADMIN_USER`/`ADMIN_PASS` tidak diisi, aplikasi memakai kredensial default yang **tertulis di kode** (bisa dibaca siapa saja jika repo publik). Selalu isi env ini dengan nilaimu sendiri saat deploy.

### 4. Deploy

Klik **Deploy site**. Setelah selesai, situsmu hidup di `https://<nama-site>.netlify.app`.

### 5. Cek setelah live

- **Landing (bagikan ke calon pembeli):** `https://<nama-site>.netlify.app/landingpage`
- **Login admin (untuk kamu):** `https://<nama-site>.netlify.app/admin` → masuk pakai `ADMIN_USER`/`ADMIN_PASS`. Setelah login, kamu diarahkan ke editor dan aksesnya bertahan 30 hari di browser itu.
- Coba buka `/editor` di jendela penyamaran (tanpa login) — harus terlempar ke `/landingpage` (gerbang bekerja).

---

## Kustomisasi cepat

Semua yang sering diubah ada di **`lib/landing.ts`**:

- **Nomor WhatsApp** → konstanta `WA_NUMBER` (format internasional tanpa `+`, mis. `628xxxx`).
- **Harga & paket** → array `PACKAGES` (nama, harga, deskripsi media, fitur).
- **Langkah "Cara pesan"** → array `STEPS`.

Ganti nilainya, commit, push — Netlify otomatis rebuild & deploy.

---

## Catatan teknis

- **Data tidak disimpan di server.** Form pesan hanya merangkai pesan WhatsApp; data editor tersimpan di `localStorage` browser admin.
- **Proxy/gerbang** ada di `proxy.ts` (fitur "Proxy" Next.js 16, setara middleware). Netlify menjalankannya sebagai Edge Function.
- **Login** ditangani `app/api/login/route.ts`; cookie berisi hash (bukan password mentah), dicek di `proxy.ts`.
- Jika suatu saat build gagal karena versi plugin Next, pastikan Netlify memakai `@netlify/plugin-nextjs` terbaru (Netlify meng-install versi terkini secara otomatis).

---

## Troubleshooting

| Gejala | Solusi |
| --- | --- |
| Buka `/editor` publik tapi tidak dialihkan | Gerbang hanya aktif di production. Pastikan mengetes di URL Netlify (bukan `next dev` lokal). |
| Login admin gagal terus | Cek `ADMIN_USER`/`ADMIN_PASS` di Environment variables sudah benar, lalu **redeploy** (env baru butuh build ulang). |
| Build error soal Node | `netlify.toml` sudah mengunci `NODE_VERSION = "22"`. Pastikan tidak ada override Node lebih rendah di dashboard. |
