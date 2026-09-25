# Kopi Kopen Customer API

Backend Node.js + Express.js untuk aplikasi pelanggan.

## Setup

1. Pastikan database `kopi_kopen` dari aplikasi kasir sudah di-import ke MySQL.
2. Jalankan:

```bash
cp .env.example .env
npm install
npm run dev
```

Jika dijalankan dari HP fisik Expo Go, ubah `APP_URL` di `.env` menjadi IP laptop, misalnya `http://192.168.1.78:3000`.

## Endpoint

- `GET /health`
- `GET /api/categories`
- `GET /api/branches`
- `GET /api/menus`
- `GET /api/menus?category=coffee&q=latte`
- `POST /api/orders`
- `GET /api/orders/:orderNumber`

Contoh payload order:

```json
{
  "customerName": "Alya",
  "customerPhone": "08123456789",
  "branchId": 1,
  "orderType": "takeaway",
  "paymentMethod": "cash",
  "notes": "Gula normal",
  "items": [
    { "menuId": 2, "quantity": 1 },
    { "menuId": 17, "quantity": 2 }
  ]
}
```
