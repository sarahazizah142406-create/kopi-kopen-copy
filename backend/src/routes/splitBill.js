import { Router } from "express";
import { pool } from "../config/db.js";

export const splitBillRouter = Router();

/**
 * POST /api/split-bill/rata
 * Body: { orderNumber, jumlahOrang }
 * Split total dibagi rata ke semua orang
 */
splitBillRouter.post("/rata", async (req, res, next) => {
  try {
    const { orderNumber, jumlahOrang } = req.body;
    if (!orderNumber || !jumlahOrang || jumlahOrang < 2) {
      return res.status(422).json({ message: "orderNumber dan jumlahOrang (min 2) wajib diisi." });
    }

    const [orders] = await pool.execute(
      `SELECT id, order_number AS orderNumber, customer_name AS customerName,
              total_amount AS totalAmount, tax_amount AS taxAmount
       FROM orders WHERE order_number = ?`,
      [orderNumber]
    );
    if (!orders.length) {
      return res.status(404).json({ message: "Pesanan tidak ditemukan." });
    }

    const order = orders[0];
    const subtotal = order.totalAmount - (order.taxAmount || 0);
    const taxAmount = order.taxAmount || 0;
    const total = order.totalAmount;

    const perOrang = Math.ceil(total / jumlahOrang);
    // Orang terakhir bayar sisanya (supaya total pas)
    const sisanya = total - perOrang * (jumlahOrang - 1);

    const hasil = Array.from({ length: jumlahOrang }, (_, i) => ({
      orang: i + 1,
      nama: `Orang ${i + 1}`,
      subtotal: Math.ceil(subtotal / jumlahOrang),
      pajak: Math.ceil(taxAmount / jumlahOrang),
      total: i === jumlahOrang - 1 ? sisanya : perOrang
    }));

    res.json({
      data: {
        orderNumber,
        metode: "rata",
        jumlahOrang,
        subtotal,
        taxAmount,
        total,
        perOrang: hasil
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/split-bill/per-item
 * Body: { orderNumber, pembagian: [{ nama, itemIds: [{orderItemId, jumlah}] }] }
 * Setiap orang bayar item yang mereka pesan
 */
splitBillRouter.post("/per-item", async (req, res, next) => {
  try {
    const { orderNumber, pembagian } = req.body;
    if (!orderNumber || !Array.isArray(pembagian) || pembagian.length < 2) {
      return res.status(422).json({ message: "orderNumber dan pembagian (min 2 orang) wajib diisi." });
    }

    const [orders] = await pool.execute(
      `SELECT id, total_amount AS totalAmount, tax_amount AS taxAmount FROM orders WHERE order_number = ?`,
      [orderNumber]
    );
    if (!orders.length) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

    const order = orders[0];
    const [items] = await pool.execute(
      `SELECT oi.id, oi.quantity, oi.price, m.name
       FROM order_items oi JOIN menu m ON m.id = oi.menu_id WHERE oi.order_id = ?`,
      [order.id]
    );
    const itemMap = new Map(items.map((i) => [Number(i.id), i]));

    const taxPercent = order.taxAmount && order.totalAmount
      ? (order.taxAmount / (order.totalAmount - order.taxAmount)) * 100
      : 0;

    let totalDibagi = 0;
    const hasil = pembagian.map((orang) => {
      let subtotalOrang = 0;
      const detailItems = [];

      for (const { orderItemId, jumlah } of (orang.items || [])) {
        const item = itemMap.get(Number(orderItemId));
        if (!item) continue;
        const qty = Math.min(jumlah || 1, item.quantity);
        const subtotalItem = Number(item.price) * qty;
        subtotalOrang += subtotalItem;
        detailItems.push({ nama: item.name, jumlah: qty, harga: Number(item.price), subtotal: subtotalItem });
      }

      const pajak = Math.round(subtotalOrang * taxPercent / 100);
      const total = subtotalOrang + pajak;
      totalDibagi += total;

      return { nama: orang.nama || "Orang", subtotal: subtotalOrang, pajak, total, items: detailItems };
    });

    res.json({
      data: {
        orderNumber,
        metode: "per_item",
        jumlahOrang: pembagian.length,
        totalPesanan: order.totalAmount,
        totalDibagi,
        selisih: order.totalAmount - totalDibagi,
        perOrang: hasil
      }
    });
  } catch (error) {
    next(error);
  }
});
