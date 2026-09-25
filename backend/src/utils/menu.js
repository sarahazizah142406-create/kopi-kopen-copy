import path from "node:path";

const appUrl     = process.env.APP_URL    || `http://localhost:${process.env.PORT || 3000}`;
const uploadsDir = process.env.UPLOADS_DIR || "C:/xampp/htdocs/kopi-kopen/uploads";

function buildImageUrl(rawImage, baseUrl) {
  if (!rawImage) return null;

  const normalized = String(rawImage).trim();
  if (!normalized) return null;

  // Sudah berupa URL lengkap
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const normalizedPath = normalized.replace(/\\/g, "/");
  const uploadsIndex   = normalizedPath.toLowerCase().lastIndexOf("uploads/");
  let imagePath;

  if (uploadsIndex !== -1) {
    imagePath = normalizedPath.slice(uploadsIndex + "uploads/".length).replace(/^\/+/, "");
  } else if (path.isAbsolute(normalized)) {
    const normalizedUploadsDir = uploadsDir.replace(/\\/g, "/");
    const uploadsDirIndex      = normalizedPath.toLowerCase().indexOf(normalizedUploadsDir.toLowerCase());
    imagePath = uploadsDirIndex !== -1
      ? normalizedPath.slice(uploadsDirIndex + normalizedUploadsDir.length).replace(/^\/+/, "")
      : path.basename(normalizedPath);
  } else {
    imagePath = normalizedPath.replace(/^\/+/, "");
  }

  if (!imagePath) return null;

  // Decode dulu biar ga double-encode (DB kadang sudah simpan %20)
  try { imagePath = decodeURIComponent(imagePath); } catch (_) {}

  const base = baseUrl || appUrl;
  // Encode per segment supaya spasi dan karakter khusus aman
  const encodedPath = imagePath.split("/").map(encodeURIComponent).join("/");
  return `${base}/uploads/${encodedPath}`;
}

export function toMenuDto(row, baseUrl) {
  return {
    id:           row.id,
    categoryId:   row.category_id,
    categoryName: row.category_name,
    name:         row.name,
    slug:         row.slug,
    description:  row.description,
    price:        Number(row.price),
    rating:       Number(row.rating || 0),
    badge:        row.badge || null,
    imageUrl:     buildImageUrl(row.image_url || row.img, baseUrl),
    isPopular:    Boolean(row.is_popular),
    isNew:        Boolean(row.is_new),
    stockStatus:  row.stock_status || "available"
  };
}

export function makeOrderNumber() {
  const d      = new Date();
  const ymd    = d.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MOB-${ymd}-${random}`;
}
