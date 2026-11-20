CREATE TABLE IF NOT EXISTS customer_devices (
  token_hash TEXT NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_devices_token_hash ON customer_devices(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_devices_customer_id ON customer_devices(customer_id);

