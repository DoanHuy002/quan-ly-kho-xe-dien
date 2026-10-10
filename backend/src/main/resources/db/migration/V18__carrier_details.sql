ALTER TABLE stock_documents ADD COLUMN carrier_name VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE stock_documents ADD COLUMN carrier_phone VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE vehicle_shipments ADD COLUMN carrier_name VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE vehicle_shipments ADD COLUMN carrier_phone VARCHAR(100) NOT NULL DEFAULT '';
