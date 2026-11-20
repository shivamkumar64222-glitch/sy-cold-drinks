ALTER TABLE orders ADD COLUMN request_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_request_token ON orders(request_token);
