import express           from "express";
import cors              from "cors";
import helmet            from "helmet";
import path              from "node:path";
import { createServer }  from "node:http";
import { Server }        from "socket.io";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { assertDatabase } from "./config/db.js";
import { catalogRouter }  from "./routes/catalog.js";
import { ordersRouter }   from "./routes/orders.js";
import { setIO }          from "./socket.js";      // ← singleton, bukan circular

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const app        = express();
const httpServer = createServer(app);
const port       = Number(process.env.PORT || 3000);

// ── Upload dir ──────────────────────────────────────────────────────────────
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, "../../kopi-kopen/uploads");

// ── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH"] },
  transports: ["websocket", "polling"]
});

setIO(io);   // ← simpan singleton, bisa dipakai di routes tanpa circular import

io.on("connection", (socket) => {
  // Admin panel join room
  socket.on("join:admin", () => {
    socket.join("admin");
    console.log("[Socket] Admin joined:", socket.id);
  });

  // Mobile tracking pesanan spesifik
  socket.on("track:order", (orderNumber) => {
    socket.join(`order:${orderNumber}`);
    console.log(`[Socket] Tracking order: ${orderNumber} — socket: ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log("[Socket] Disconnected:", socket.id);
  });
});

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));

// ── Routes ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "kopi-kopen-api-v2", uploadsDir });
});

app.use("/api",        catalogRouter);
app.use("/api/orders", ordersRouter);

// ── 404 & Error handlers ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} tidak ditemukan.` });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  console.error("[Error]", error.message);
  res.status(status).json({
    message: status === 500 ? "Terjadi kesalahan server." : error.message,
    detail:  process.env.NODE_ENV === "production" ? undefined : error.message
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
assertDatabase()
  .then(() => {
    httpServer.listen(port, () => {
      console.log(`☕ Kopi Kopen API  →  http://10.250.182.155:${port}`);
      console.log(`📁 Uploads dir     →  ${uploadsDir}`);
      console.log(`🔌 Socket.IO ready`);
    });
  })
  .catch((err) => {
    console.error("Gagal konek database:", err.message);
    process.exit(1);
  });
