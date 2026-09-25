-- ================================================================
-- KOPI KOPEN — Migration v2
-- Jalankan SEKALI sebelum start backend Node.js:
--   mysql -u root kopi_kopen < backend/database/migration_v2.sql
-- ================================================================

USE kopi_kopen;

-- Tambah tax_amount ke orders (jika belum ada)
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `tax_amount`    decimal(10,0) DEFAULT 0 AFTER `total_amount`,
  ADD COLUMN IF NOT EXISTS `payment_method` varchar(50)  DEFAULT 'cash' AFTER `status`;

-- Tambah notes ke order_items (jika belum ada)
ALTER TABLE `order_items`
  ADD COLUMN IF NOT EXISTS `notes` text DEFAULT NULL AFTER `price`;

-- Setting pajak & toko yang dipakai backend dan nota
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`, `setting_type`, `description`) VALUES
('tax_percent',     '11',               'number', 'Persentase pajak PPN (%)'),
('store_name',      'Kopi Kopen',       'text',   'Nama toko (tampil di nota)'),
('store_address',   '',                 'text',   'Alamat toko'),
('store_phone',     '',                 'text',   'Nomor telepon toko'),
('store_instagram', '',                 'text',   'Instagram toko'),
('receipt_footer',  'Terima kasih sudah memesan! ☕', 'text', 'Pesan di bawah nota'),
('bank_name',       'BCA',              'text',   'Nama bank transfer'),
('bank_number',     '1234567890',       'text',   'Nomor rekening'),
('bank_holder',     'Kopi Kopen',       'text',   'Nama pemilik rekening'),
('service_charge',  '0',               'number', 'Service charge (%)');

SELECT 'Migration v2 selesai! ✅' AS info;
