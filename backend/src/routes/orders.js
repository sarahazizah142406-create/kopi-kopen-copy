import { Router } from "express";
import { pool }   from "../config/db.js";
import { makeOrderNumber } from "../utils/menu.js";
import { getIO }  from "../socket.js";   // ← fix circular import

export const ordersRouter = Router();

// ── kolom cache ─────────────────────────────────────────────────────────────
let _orderCols   = null;
let _oiHasNotes  = null;

async function getOrderCols() {
  if (_orderCols) return _orderCols;
  const [cols] = await pool.query("SHOW COLUMNS FROM orders");
  _orderCols   = new Set(cols.map((c) => c.Field));
  return _orderCols;
}

async function checkOiNotes() {
  if (_oiHasNotes !== null) return _oiHasNotes;
  const [cols] = await pool.query("SHOW COLUMNS FROM order_items LIKE 'notes'");
  _oiHasNotes  = cols.length > 0;
  return _oiHasNotes;
}

// ── helper: ambil detail order lengkap ──────────────────────────────────────
async function fetchOrderDetail(conn, orderNumber) {
  const [rows] = await conn.execute(
    `SELECT o.id,
            o.order_number    AS orderNumber,
            o.customer_name   AS customerName,
            o.customer_phone  AS customerPhone,
            o.order_type      AS orderType,
            o.status,
            o.total_amount    AS totalAmount,
            o.notes,
            o.created_at      AS createdAt,
            o.updated_at      AS updatedAt
     FROM orders o WHERE o.order_number = ?`,
    [orderNumber]
  );
  if (!rows.length) return null;

  const order = rows[0];

  // Ambil kolom opsional yang mungkin belum ada di DB lama
  const cols = await getOrderCols();
  if (cols.has("tax_amount")) {
    const [taxRow] = await conn.execute(
      "SELECT tax_amount AS taxAmount FROM orders WHERE order_number = ?",
      [orderNumber]
    );
    order.taxAmount = taxRow[0]?.taxAmount ?? null;
  }

  const [items] = await conn.execute(
    `SELECT oi.quantity, oi.price, m.name, m.id AS menuId
     FROM order_items oi JOIN menu m ON m.id = oi.menu_id
     WHERE oi.order_id = ?`,
    [order.id]
  );
  order.items = items;
  return order;
}

// ── POST /api/orders — pelanggan buat pesanan ────────────────────────────────
ordersRouter.post("/", async (req, res, next) => {
  const {
    customerName,
    customerPhone,
    customerEmail  = null,
    branchId       = null,
    orderType      = "takeaway",
    paymentMethod  = "cash",
    notes          = null,
    items
  } = req.body;

  if (!customerName?.trim() || !customerPhone?.trim()) {
    return res.status(422).json({ message: "Nama dan nomor HP wajib diisi." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(422).json({ message: "Keranjang masih kosong." });
  }

  const cleanItems = items.map((item) => ({
    menuId:   Number(item.menuId || item.id),
    quantity: Math.max(1, Number(item.quantity || 1)),
    notes:    item.notes || null
  }));

  if (cleanItems.some((item) => !Number.isInteger(item.menuId) || item.menuId <= 0)) {
    return res.status(422).json({ message: "Item pesanan tidak valid." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const ids = cleanItems.map((item) => item.menuId);
    const [menus] = await connection.query(
      `SELECT id, name, price, stock_status FROM menu WHERE is_active = 1 AND id IN (?)`,
      [ids]
    );
    const menuMap = new Map(menus.map((m) => [Number(m.id), m]));

    for (const item of cleanItems) {
      const menu = menuMap.get(item.menuId);
      if (!menu) throw Object.assign(new Error(`Menu ID ${item.menuId} tidak ditemukan.`), { status: 422 });
      if (menu.stock_status === "sold_out") {
        throw Object.assign(new Error(`${menu.name} sedang habis.`), { status: 422 });
      }
    }

    const subtotal    = cleanItems.reduce((s, i) => s + Number(menuMap.get(i.menuId).price) * i.quantity, 0);
    const TAX_RATE    = 0.11;
    const taxAmount   = Math.round(subtotal * TAX_RATE);
    const totalAmount = subtotal + taxAmount;
    const orderNumber = makeOrderNumber();
    const cols        = await getOrderCols();

    // INSERT dinamis — aman untuk DB yang kolom opsionalnya belum ada
    const fields = ["order_number", "customer_name", "customer_phone", "total_amount", "status"];
    const values = [orderNumber, customerName, customerPhone, totalAmount, "pending"];

    if (cols.has("tax_amount"))     { fields.push("tax_amount");     values.push(taxAmount); }
    if (cols.has("customer_email") && customerEmail) { fields.push("customer_email"); values.push(customerEmail); }
    if (cols.has("branch_id")      && branchId)      { fields.push("branch_id");      values.push(branchId); }
    if (cols.has("order_type"))     { fields.push("order_type");     values.push(orderType); }
    if (cols.has("payment_method")) { fields.push("payment_method"); values.push(paymentMethod); }
    if (cols.has("notes")) {
      const notesVal = notes ? String(notes).trim() : null;
      fields.push("notes"); values.push(notesVal);
    }

    const [result] = await connection.execute(
      `INSERT INTO orders (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
      values
    );
    const orderId = result.insertId;

    const oiHasNotes = await checkOiNotes();
    for (const item of cleanItems) {
      const menu = menuMap.get(item.menuId);
      if (oiHasNotes) {
        await connection.execute(
          `INSERT INTO order_items (order_id, menu_id, quantity, price, notes) VALUES (?,?,?,?,?)`,
          [orderId, item.menuId, item.quantity, Number(menu.price), item.notes]
        );
      } else {
        await connection.execute(
          `INSERT INTO order_items (order_id, menu_id, quantity, price) VALUES (?,?,?,?)`,
          [orderId, item.menuId, item.quantity, Number(menu.price)]
        );
      }
    }

    await connection.commit();

    // Notif realtime ke admin
    const io = getIO();
    if (io) {
      const detail = await fetchOrderDetail(connection, orderNumber);
      io.to("admin").emit("order:baru", detail);
    }

    res.status(201).json({
      data:    { id: orderId, orderNumber, status: "pending", totalAmount, taxAmount, subtotal },
      message: "Pesanan berhasil dibuat."
    });

  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

// ── GET /api/orders/:orderNumber — cek status + detail ──────────────────────
ordersRouter.get("/:orderNumber", async (req, res, next) => {
  // Validasi format order number supaya tidak bentrok dengan route lain
  const { orderNumber } = req.params;
  if (!orderNumber || orderNumber.length < 5) {
    return res.status(400).json({ message: "Format order number tidak valid." });
  }

  try {
    const conn  = await pool.getConnection();
    const order = await fetchOrderDetail(conn, orderNumber);
    conn.release();

    if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/orders/:id/status — admin update status ──────────────────────
ordersRouter.patch("/:id/status", async (req, res, next) => {
  const { status } = req.body;
  const ALLOWED = ["pending", "confirmed", "processing", "ready", "completed", "cancelled"];

  if (!status || !ALLOWED.includes(status)) {
    return res.status(422).json({ message: `Status tidak valid. Pilihan: ${ALLOWED.join(", ")}` });
  }

  const orderId = parseInt(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: "ID order tidak valid." });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Order tidak ditemukan." });
    }

    const [rows] = await pool.execute(
      `SELECT id, order_number AS orderNumber, customer_name AS customerName,
              status, total_amount AS totalAmount, updated_at AS updatedAt
       FROM orders WHERE id = ?`,
      [orderId]
    );
    const updated = rows[0];

    // Push ke mobile yang tracking dan ke semua admin
    const io = getIO();
    if (io) {
      io.to(`order:${updated.orderNumber}`).emit("order:status-changed", {
        orderNumber: updated.orderNumber,
        status,
        updatedAt:   updated.updatedAt
      });
      io.to("admin").emit("order:status-changed", {
        orderId, orderNumber: updated.orderNumber, status
      });
    }

    res.json({ data: updated, message: `Status diubah ke "${status}".` });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/orders — daftar order untuk admin ───────────────────────────────
// Dipanggil mobile-orders.php untuk load awal
ordersRouter.get("/", async (req, res, next) => {
  const { adminKey, status, date } = req.query;
  if (adminKey !== (process.env.ADMIN_SECRET_KEY || "kopikopen2024")) {
    return res.status(403).json({ message: "Akses ditolak." });
  }
  try {
    const conditions = ["1=1"];
    const params     = [];

    if (status) { conditions.push("o.status = ?"); params.push(status); }
    if (date)   { conditions.push("DATE(o.created_at) = ?"); params.push(date); }

    const [rows] = await pool.execute(
      `SELECT o.id, o.order_number AS orderNumber, o.customer_name AS customerName,
              o.customer_phone AS customerPhone, o.order_type AS orderType,
              o.status, o.total_amount AS totalAmount, o.notes, o.created_at AS createdAt,
              COUNT(oi.id) AS itemCount
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY o.id
       ORDER BY FIELD(o.status,'pending','confirmed','processing','ready','completed','cancelled'),
                o.created_at DESC
       LIMIT 200`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/orders/history?phone=xxx — riwayat pesanan by phone ──────────────
ordersRouter.get("/history", async (req, res, next) => {
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).json({ message: "Parameter phone wajib diisi." });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT o.id, o.order_number, o.customer_name, o.customer_phone,
              o.order_type, o.status, o.total_amount, o.notes, o.created_at,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'name', m.name,
                  'quantity', oi.quantity,
                  'price', oi.price
                )
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu m ON m.id = oi.menu_id
       WHERE o.customer_phone = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 50`,
      [phone]
    );
    // Parse items JSON string
    const data = rows.map(r => ({
      ...r,
      items: typeof r.items === "string" ? JSON.parse(r.items) : (r.items || [])
    }));
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
