ALTER TABLE stock_document_lines ADD COLUMN color_model_id BIGINT REFERENCES vehicle_models(id);
UPDATE stock_document_lines l SET color_model_id=(SELECT p.color_model_id FROM parts p WHERE p.id=l.part_id) WHERE EXISTS(SELECT 1 FROM parts p WHERE p.id=l.part_id AND p.color_model_id IS NOT NULL);
