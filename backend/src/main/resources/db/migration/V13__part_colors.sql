ALTER TABLE parts ADD COLUMN color_parent_id BIGINT REFERENCES parts(id);
ALTER TABLE parts ADD COLUMN color_model_id BIGINT REFERENCES vehicle_models(id);
ALTER TABLE parts ADD COLUMN color VARCHAR(60);
ALTER TABLE parts ADD COLUMN color_key VARCHAR(60);
ALTER TABLE parts ADD CONSTRAINT uq_part_color UNIQUE(color_parent_id,color_model_id,color_key);
CREATE TABLE part_color_models(part_id BIGINT REFERENCES parts(id),model_id BIGINT REFERENCES vehicle_models(id),PRIMARY KEY(part_id,model_id));
ALTER TABLE production_line_materials ADD COLUMN bom_part_id BIGINT REFERENCES parts(id);
UPDATE production_line_materials SET bom_part_id=part_id;
INSERT INTO part_color_models(part_id,model_id)
SELECT DISTINCT p.id,m.id FROM parts p JOIN bom_lines l ON l.part_id=p.id JOIN bom_versions b ON b.id=l.bom_id JOIN vehicle_models m ON m.id=b.model_id
WHERE p.deleted=FALSE AND b.deleted=FALSE AND
((UPPER(m.code) IN ('S650','LX-650') AND LOWER(TRIM(p.name)) IN ('sườn trái','sườn phải','cốp đựng đồ dài','chắn bùn trước','chắn bùn sau','ốp chắn xích nhỏ','ốp trên đèn hậu','ốp dưới đèn hậu','mặt nạ','ốp càng sau trái','ốp càng sau phải','tem khung','tem nhựa'))
OR (UPPER(m.code)='S800' AND LOWER(TRIM(p.name)) IN ('cốp đựng đồ dài xe','chắn bùn trước','chắn bùn sau','ốp trên đèn hậu','ốp dưới đèn hậu','ốp càng sau trái','ốp càng sau phải','mặt nạ','trang trí ốp sườn trái','trang trí ốp sườn phải','ốp chắn xích trái','ốp chắn xích phải','tem khung','tem nhựa')));
