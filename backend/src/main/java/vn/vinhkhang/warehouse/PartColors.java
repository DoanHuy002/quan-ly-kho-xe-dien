package vn.vinhkhang.warehouse;
import java.util.*;import java.text.Normalizer;import java.math.BigDecimal;import org.springframework.jdbc.core.JdbcTemplate;
final class PartColors {
 static String key(String value){String s=Normalizer.normalize(value,Normalizer.Form.NFC).strip().toLowerCase(Locale.ROOT).replaceAll("[\\s\\p{Pd}]+"," ").strip();if(s.isEmpty()||s.length()>60)throw new Api.Problem(400,"Màu cần từ 1 đến 60 ký tự");return s;}
 static void bomPart(JdbcTemplate db,long part){if(db.queryForObject("SELECT COUNT(*) FROM parts WHERE id=? AND color_parent_id IS NOT NULL",Integer.class,part)>0)throw new Api.Problem(400,"BOM chung dùng linh kiện gốc, không dùng biến thể màu");}
 static void ensureResolved(JdbcTemplate db,long document){if(db.queryForObject("SELECT COUNT(*) FROM stock_document_lines l WHERE l.document_id=? AND EXISTS(SELECT 1 FROM part_color_models c WHERE c.part_id=l.part_id) AND (l.color_model_id IS NULL OR EXISTS(SELECT 1 FROM part_color_models c WHERE c.part_id=l.part_id AND c.model_id=l.color_model_id))",Integer.class,document)>0)throw new Api.Problem(409,"Phiếu có linh kiện chưa phân màu; anh sửa phiếu để chọn mẫu xe và màu trước khi ghi sổ");}
 static boolean tracked(JdbcTemplate db,long part,long model){return db.queryForObject("SELECT COUNT(*) FROM part_color_models WHERE part_id=? AND model_id=?",Integer.class,part,model)>0;}
 static void configure(Api core,JdbcTemplate db,long part,Map<String,Object> m){
  if(m.containsKey("material_group"))MaterialGroups.set(db,part,Objects.toString(m.get("material_group"),"UNASSIGNED"));
  db.update("UPDATE parts SET is_charger=TRUE WHERE id=? AND (LOWER(name) LIKE 'sạc%' OR LOWER(name) LIKE 'bộ sạc%')",part);
  if(!m.containsKey("color_models"))return;
  if(db.queryForObject("SELECT COUNT(*) FROM parts WHERE id=? AND color_parent_id IS NOT NULL",Integer.class,part)>0)throw new Api.Problem(409,"Không đổi phân loại của biến thể màu");
  if(!(m.get("color_models") instanceof List<?> values))throw new Api.Problem(400,"Danh sách mẫu xe không hợp lệ");
  var desired=new TreeSet<Long>();for(var v:values){long model=Long.parseLong(v.toString());core.active("vehicle_models",model);desired.add(model);}
  for(long model:db.queryForList("SELECT model_id FROM part_color_models WHERE part_id=?",Long.class,part))if(!desired.contains(model)){
   if(db.queryForObject("SELECT COUNT(*) FROM parts WHERE color_parent_id=? AND color_model_id=?",Integer.class,part,model)>0)throw new Api.Problem(409,"Đã có linh kiện theo màu; giữ phân loại để không trừ sai kho");
   db.update("DELETE FROM part_color_models WHERE part_id=? AND model_id=?",part,model);
  }
  for(long model:desired)if(!tracked(db,part,model))db.update("INSERT INTO part_color_models(part_id,model_id) VALUES(?,?)",part,model);
 }
 static String displayCode(JdbcTemplate db,long part){return db.queryForObject("SELECT CASE WHEN p.color_parent_id IS NULL THEN p.code ELSE g.code||' · '||m.code||' · '||p.color END FROM parts p LEFT JOIN parts g ON g.id=p.color_parent_id LEFT JOIN vehicle_models m ON m.id=p.color_model_id WHERE p.id=?",String.class,part);}
 static List<Map<String,Object>> catalog(JdbcTemplate db,String sql){var rows=db.queryForList(sql);for(var p:rows){p.put("MATERIAL_GROUP",db.queryForObject("SELECT material_group FROM parts WHERE id=(SELECT COALESCE(color_parent_id,id) FROM parts WHERE id=?)",String.class,p.get("ID")));p.put("IS_CHARGER",ShipmentChargers.charger(db,((Number)p.get("ID")).longValue()));p.put("CODE",displayCode(db,((Number)p.get("ID")).longValue()));var prices=db.queryForList("SELECT l.unit_cost,d.code,d.posted_at FROM stock_document_lines l JOIN stock_documents d ON d.id=l.document_id WHERE l.part_id=? AND l.unit_cost IS NOT NULL AND d.type='IN' AND d.status='POSTED' AND d.deleted=FALSE AND d.code NOT LIKE 'DC-%' ORDER BY d.posted_at DESC,d.id DESC LIMIT 1",p.get("ID"));p.put("LATEST_UNIT_COST",prices.isEmpty()?null:prices.getFirst().get("UNIT_COST"));p.put("LATEST_PRICE_SOURCE",prices.isEmpty()?null:prices.getFirst().get("CODE"));p.put("BOM_MODELS",db.queryForList("SELECT DISTINCT b.model_id FROM bom_lines l JOIN bom_versions b ON b.id=l.bom_id WHERE l.part_id=? AND b.deleted=FALSE AND b.status='ACTIVE' ORDER BY b.model_id",Long.class,p.get("ID")));p.put("COLOR_MODELS",db.queryForList("SELECT model_id FROM part_color_models WHERE part_id=? ORDER BY model_id",Long.class,p.get("ID")));}return rows;}
 static Map<String,Object> prepare(Api core,JdbcTemplate db,Api.Session actor,Map<String,Object> input){
  var out=new LinkedHashMap<String,Object>(input);var lines=new ArrayList<Map<String,Object>>();var seen=new HashSet<Long>();
  for(var raw:core.lines(input,"lines")){var line=new LinkedHashMap<String,Object>(raw);if(Objects.toString(line.get("color_model_id"),"").isBlank())line.remove("color_model_id");long part=core.num(raw,"part_id");core.active("parts",part);
   var p=db.queryForList("SELECT * FROM parts WHERE id=? FOR UPDATE",part).getFirst();
   if(p.get("COLOR_PARENT_ID")==null&&db.queryForObject("SELECT COUNT(*) FROM part_color_models WHERE part_id=?",Integer.class,part)>0){
    long model=core.num(raw,"color_model_id");core.active("vehicle_models",model);if(!tracked(db,part,model)){if(db.queryForObject("SELECT COUNT(*) FROM bom_lines l JOIN bom_versions b ON b.id=l.bom_id WHERE l.part_id=? AND b.model_id=? AND b.deleted=FALSE AND b.status='ACTIVE'",Integer.class,part,model)==0)throw new Api.Problem(400,"Linh kiện không thuộc BOM của mẫu xe đã chọn");if(!Objects.toString(raw.get("color"),"").isBlank())throw new Api.Problem(400,"Linh kiện này dùng chung, không phân màu cho mẫu xe đã chọn");}else{
    String color=core.str(raw,"color"),normalized=key(color);var found=db.queryForList("SELECT id,deleted FROM parts WHERE color_parent_id=? AND color_model_id=? AND color_key=?",part,model,normalized);
    if(found.isEmpty()){
     if(!"IN".equals(input.get("type")))throw new Api.Problem(409,"Chưa nhập linh kiện màu "+color+" cho mẫu xe này");
     String name=p.get("NAME")+" · "+db.queryForObject("SELECT name FROM vehicle_models WHERE id=?",String.class,model)+" · "+color;
     if(name.length()>200)throw new Api.Problem(400,"Tên linh kiện và màu quá dài");
     part=core.insert("INSERT INTO parts(code,name,unit,color_parent_id,color_model_id,color,color_key) VALUES(?,?,?,?,?,?,?)","M-"+UUID.randomUUID().toString().substring(0,20),name,p.get("UNIT"),part,model,color,normalized);db.update("UPDATE parts SET material_group=? WHERE id=?",p.get("MATERIAL_GROUP"),part);core.audit(actor,"CREATE","parts",part);
    }else{if(Boolean.TRUE.equals(found.getFirst().get("DELETED")))throw new Api.Problem(409,"Linh kiện màu đã xóa; cần khôi phục danh mục trước khi nhập");part=((Number)found.getFirst().get("ID")).longValue();}
    }
   }
   if(p.get("COLOR_MODEL_ID")!=null)line.put("color_model_id",p.get("COLOR_MODEL_ID"));if(!seen.add(part))throw new Api.Problem(400,"Mỗi linh kiện, mẫu xe và màu chỉ xuất hiện một dòng");line.put("part_id",part);lines.add(line);
  }out.put("lines",lines);return out;
 }
 static void route(Api core,JdbcTemplate db,long order,List<Map<String,Object>> rows){
  var all=new TreeMap<Long,BigDecimal>();
  for(var row:rows){long line=((Number)row.get("ID")).longValue(),model=((Number)row.get("MODEL_ID")).longValue();var routed=new TreeMap<Long,BigDecimal>();var sources=new HashMap<Long,Long>();
   for(var material:db.queryForList("SELECT * FROM production_line_materials WHERE line_id=? ORDER BY part_id",line)){
    long source=((Number)material.get("BOM_PART_ID")).longValue(),part=source;core.active("parts",source);
    if(tracked(db,source,model)){String color=Objects.toString(row.get("COLOR"));var matches=db.queryForList("SELECT id FROM parts WHERE color_parent_id=? AND color_model_id=? AND color_key=? AND deleted=FALSE",source,model,key(color));
     if(matches.isEmpty())throw new Api.Problem(409,"Chưa có "+db.queryForObject("SELECT name FROM parts WHERE id=?",String.class,source)+" · "+row.get("MODEL")+" · "+color+" trong kho; anh nhập đúng mẫu xe và màu trước");part=((Number)matches.getFirst().get("ID")).longValue();
    }
    core.active("parts",part);routed.merge(part,(BigDecimal)material.get("QUANTITY"),BigDecimal::add);sources.put(part,source);
   }
   db.update("DELETE FROM production_line_materials WHERE line_id=?",line);
   for(var e:routed.entrySet()){db.update("INSERT INTO production_line_materials(line_id,part_id,bom_part_id,quantity) VALUES(?,?,?,?)",line,e.getKey(),sources.get(e.getKey()),e.getValue());all.merge(e.getKey(),e.getValue(),BigDecimal::add);}
  }
  db.update("DELETE FROM production_materials WHERE order_id=?",order);for(var e:all.entrySet())db.update("INSERT INTO production_materials(order_id,part_id,quantity) VALUES(?,?,?)",order,e.getKey(),e.getValue());
 }
}
