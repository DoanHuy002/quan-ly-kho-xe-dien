ALTER TABLE vehicles DROP CONSTRAINT ck_vehicle_type_serials;
ALTER TABLE vehicles ADD CONSTRAINT ck_vehicle_type_serials CHECK((vehicle_type='COMMERCIAL' AND frame_number IS NULL AND motor_number IS NULL) OR (vehicle_type='REGISTERED' AND (frame_number IS NULL OR LENGTH(TRIM(frame_number))>0) AND (motor_number IS NULL OR LENGTH(TRIM(motor_number))>0)));
