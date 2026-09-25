ALTER TABLE orders
  ADD COLUMN payment decimal(10,0) NULL AFTER total_amount,
  ADD COLUMN change_amount decimal(10,0) NULL AFTER payment,
  ADD COLUMN payment_method varchar(30) NULL AFTER change_amount;
