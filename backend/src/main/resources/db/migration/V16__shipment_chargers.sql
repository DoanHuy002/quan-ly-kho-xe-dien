ALTER TABLE parts ADD COLUMN is_charger BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE parts SET is_charger=TRUE WHERE (LOWER(name) LIKE 'sạc%' OR LOWER(name) LIKE 'bộ sạc%');
ALTER TABLE vehicle_shipments ADD COLUMN charger_document_id BIGINT REFERENCES stock_documents(id);
