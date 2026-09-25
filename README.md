<<<<<<< HEAD
# ☕ Kopi Kopen Mobile

Aplikasi mobile pelanggan + backend API untuk Kopi Kopen.

## Struktur

```
kopi-kopen-mobile/
├── backend/          Node.js + Express + Socket.IO
└── frontend-rn/      React Native (Expo SDK 54)
```

## Setup cepat

### 1. Database — jalankan migration dulu
Buka phpMyAdmin, pilih database `kopi_kopen`, jalankan:
```
backend/database/migration_v2.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edit .env: sesuaikan UPLOADS_DIR ke path folder uploads kopi-kopen
npm install
npm run dev
```

### 3. Frontend mobile
```bash
cd frontend-rn
npm install
```
Edit `src/api/client.js` — ganti IP:
```js
// Ganti dengan IP lokal laptop kamu (cek: ipconfig/ifconfig)
export const API_BASE_URL = "http://192.168.1.xxx:3000";
```
```bash
npx expo start
```
Scan QR dengan Expo Go di HP.

## Alur pesanan

```
Mobile checkout
  → POST /api/orders
    → Socket emit "order:baru" ke admin
      → Admin terima di mobile-orders.php (realtime)
        → Admin klik Terima/Proses/dst
          → PATCH /api/orders/:id/status
            → Socket emit "order:status-changed" ke mobile
              → Mobile update UI otomatis
                → Status "completed" → nota + split bill muncul
```

## Catatan penting

- Pajak di backend (`orders.js`) dan frontend (`ReceiptScreen.js`) sama-sama **11% (PPN)**
- Gambar menu diambil dari folder `uploads/` project kopi-kopen (web) via `/uploads/` endpoint
- `UPLOADS_DIR` di `.env` harus menunjuk ke folder `uploads/` yang sama dengan yang dipakai PHP
=======
# kopi-kopen-copy
>>>>>>> a3e1dd88b0b2afefe92dffdc263773d934d32ce7
