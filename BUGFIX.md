# 🐛 Daftar Bug yang Difix

## Backend (Node.js/Express)

### 1. Circular Import — CRASH saat start
**File:** `src/routes/orders.js`
**Problem:** `orders.js` import `{ io }` dari `server.js`, sementara `server.js` import `ordersRouter` dari `orders.js` → Node.js crash dengan error `Cannot access 'io' before initialization`.
**Fix:** Buat `src/socket.js` sebagai singleton. `server.js` set instance via `setIO(io)`, `orders.js` ambil via `getIO()` tanpa circular.

### 2. namedPlaceholders Error di catalog.js
**File:** `src/routes/catalog.js`
**Problem:** Query pakai `:category` dan `:q` (named placeholders) tapi `pool.execute()` tidak selalu support ini dengan benar, menyebabkan query error.
**Fix:** Ganti semua ke positional placeholder `?` yang konsisten dengan `orders.js`.

### 3. Kolom opsional tidak dicek di fetchOrderDetail
**File:** `src/routes/orders.js`
**Problem:** Query `SELECT ... tax_amount ...` di `fetchOrderDetail` akan error kalau kolom `tax_amount` belum ada di database lama.
**Fix:** Cek keberadaan kolom dulu, baru query kolom opsional secara terpisah.

---

## Frontend React Native

### 4. socket.io-client tidak ada di package.json
**File:** `package.json`
**Problem:** `OrderTrackingScreen.js` import `{ io } from "socket.io-client"` tapi dependency tidak ada di `package.json` → app crash saat start.
**Fix:** Tambah `"socket.io-client": "^4.7.5"` ke dependencies.

### 5. Double Tax di ReceiptScreen
**File:** `src/screens/ReceiptScreen.js`
**Problem:** `totalAmount` dari server **sudah include pajak** (subtotal + tax). Tapi ReceiptScreen hitung ulang `tax = totalAmount * 11%` → pajak dihitung dua kali, total jadi lebih besar dari yang seharusnya.
**Fix:** Pakai `orderData.taxAmount` langsung dari server. `subtotal = totalAmount - taxAmount`.

### 6. Race condition di fetchOrder (OrderTrackingScreen)
**File:** `src/screens/OrderTrackingScreen.js`
**Problem:** `fetchOrder` di dalam `useEffect` punya closure lama, state `navigate` bisa tidak update. Juga tidak ada guard untuk mencegah `navigate("receipt")` dipanggil berkali-kali saat polling + socket keduanya fire bersamaan.
**Fix:** Pakai `useCallback` untuk `fetchOrder`, tambah `navigatedRef.current` sebagai guard navigasi satu kali.

### 7. Status "confirmed", "ready" tidak ada di STATUS_STEPS
**File:** `src/screens/OrderTrackingScreen.js`
**Problem:** STATUS_STEPS hanya punya `pending, processing, completed` — kalau admin set ke `confirmed` atau `ready`, `getStepIndex` return -1 → UI stuck di step 0.
**Fix:** Tambah semua status: `pending → confirmed → processing → ready → completed`.

---

## Cara Setup Ulang

```bash
# 1. Jalankan migration database dulu (SEKALI)
mysql -u root kopi_kopen < backend/database/migration_v2.sql

# 2. Install & start backend
cd backend
npm install
npm run dev

# 3. Install & start frontend (ganti IP di src/api/client.js dulu!)
cd frontend-rn
npm install    ← socket.io-client akan terinstall sekarang
npx expo start
```
