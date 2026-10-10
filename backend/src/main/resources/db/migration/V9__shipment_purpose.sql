ALTER TABLE vehicle_shipments ADD COLUMN shipment_purpose VARCHAR(20) NOT NULL DEFAULT 'SALE' CHECK (shipment_purpose IN ('SALE','INTERNAL','CONSIGNMENT'));
