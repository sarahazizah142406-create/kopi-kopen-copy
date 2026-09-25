import { Router } from "express";
import { pool }   from "../config/db.js";
import { toMenuDto } from "../utils/menu.js";

export const catalogRouter = Router();

// GET /api/categories
catalogRouter.get("/categories", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, slug, icon, display_order AS displayOrder
       FROM categories
       WHERE is_active = 1
       ORDER BY display_order, name`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/branches
catalogRouter.get("/branches", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, address, city, province, phone, whatsapp,
              open_time AS openTime, close_time AS closeTime,
              is_24h AS is24h, is_main AS isMain
       FROM branches
       WHERE status = 'active'
       ORDER BY is_main DESC, name`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/menus — FIX: ganti namedPlaceholders ke positional (?)
catalogRouter.get("/menus", async (req, res, next) => {
  try {
    const { category, q, popular } = req.query;
    const where  = ["m.is_active = 1"];
    const params = [];

    // Cek kolom stock_status — mungkin belum ada di DB lama
    let hasStock = false;
    try {
      const [cols] = await pool.query("SHOW COLUMNS FROM menu LIKE 'stock_status'");
      hasStock = cols.length > 0;
    } catch (_) {}
    if (hasStock) where.push("m.stock_status <> 'sold_out'");

    if (category) {
      // Coba match slug atau id numerik
      where.push("(c.slug = ? OR c.id = ?)");
      params.push(category, category);
    }
    if (q) {
      where.push("(m.name LIKE ? OR m.description LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    if (popular === "1" || popular === "true") {
      where.push("m.is_popular = 1");
    }

    const [rows] = await pool.execute(
      `SELECT m.*,
              c.id AS category_id_joined,
              c.name AS category_name,
              c.display_order AS category_display_order
       FROM menu m
       LEFT JOIN categories c ON c.id = m.category_id
       WHERE ${where.join(" AND ")}
       ORDER BY COALESCE(c.display_order, 9999), m.name`,
      params
    );

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({
      data: rows.map((row) => ({
        ...toMenuDto(row, baseUrl),
        categoryId: row.category_id ?? row.category_id_joined ?? null,
        categoryName: row.category_name || "Menu"
      }))
    });
  } catch (err) {
    next(err);
  }
});
