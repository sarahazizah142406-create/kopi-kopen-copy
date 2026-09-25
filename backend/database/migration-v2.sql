-- Migration v2: Tambah kolom untuk fitur mobile order
USE kopi_kopen;

-- Tambah kolom tax_amount dan table_number ke orders jika belum ada
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `tax_amount` decimal(10,0) DEFAULT 0 AFTER `total_amount`,
  ADD COLUMN IF NOT EXISTS `table_number` varchar(20) DEFAULT NULL AFTER `tax_amount`,
  ADD COLUMN IF NOT EXISTS `payment` decimal(10,0) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `change_amount` decimal(10,0) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `payment_method` varchar(50) DEFAULT 'cash';

-- Tambah setting pajak jika belum ada
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`) VALUES
('tax_percent', '10'),
('service_charge', '0');

SELECT 'Migration v2 selesai!' AS info;
