ALTER TABLE vehicles ADD COLUMN vehicle_type VARCHAR(20) NOT NULL DEFAULT 'REGISTERED' CHECK(vehicle_type IN ('REGISTERED','COMMERCIAL'));
ALTER TABLE vehicles ALTER COLUMN frame_number DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN motor_number DROP NOT NULL;
ALTER TABLE vehicles ADD CONSTRAINT ck_vehicle_type_serials CHECK((vehicle_type='COMMERCIAL' AND frame_number IS NULL AND motor_number IS NULL) OR (vehicle_type='REGISTERED' AND frame_number IS NOT NULL AND motor_number IS NOT NULL AND LENGTH(TRIM(frame_number))>0 AND LENGTH(TRIM(motor_number))>0));
ALTER TABLE vehicle_shipments ADD COLUMN vehicle_type VARCHAR(20) NOT NULL DEFAULT 'REGISTERED' CHECK(vehicle_type IN ('REGISTERED','COMMERCIAL'));
ALTER TABLE vehicle_shipment_lines ADD COLUMN vehicle_type VARCHAR(20) NOT NULL DEFAULT 'REGISTERED' CHECK(vehicle_type IN ('REGISTERED','COMMERCIAL'));
