package vn.vinhkhang.warehouse;
import java.util.*;import java.math.*;import org.springframework.jdbc.core.JdbcTemplate;

final class ProductionLines {
 record Draft(long bom,int quantity,String color,Map<Long,BigDecimal> materials){}
 static List<Draft> parse(Api core,JdbcTemplate db,Map<String,Object> m){
  var input=m.containsKey("lines")?core.lines(m,"lines"):List.of(m);
  if(input.size()>100)throw new Api.Problem(400,"Một lệnh tối đa 100 dòng");
  var result=new ArrayList<Draft>();long total=0;
  for(var row:input){long qty=core.num(row,"quantity"),bom=core.num(row,"bom_id");total+=qty;
   if(qty<1||total>1000)throw new Api.Problem(400,"Tổng số xe cần từ 1 đến 1000");
   String color=core.str(row,"color");if(color.length()>60)throw new Api.Problem(400,"Màu xe tối đa 60 ký tự");
   core.active("bom_versions",bom);long model=db.queryForObject("SELECT model_id FROM bom_versions WHERE id=?",Long.class,bom);core.active("vehicle_models",model);
   var materials=new TreeMap<Long,BigDecimal>();
   for(var l:db.queryForList("SELECT part_id,quantity FROM bom_lines WHERE bom_id=?",bom)){long part=((Number)l.get("PART_ID")).longValue();core.active("parts",part);if(ShipmentChargers.charger(db,part))continue;PartColors.bomPart(db,part);materials.put(part,((BigDecimal)l.get("QUANTITY")).multiply(BigDecimal.valueOf(qty)));}
   if(materials.isEmpty())throw new Api.Problem(400,"BOM phải có linh kiện");
   result.add(new Draft(bom,(int)qty,color,materials));
  }return result;
 }
 static void write(Api core,JdbcTemplate db,long id,List<Draft> rows){
  var all=new TreeMap<Long,BigDecimal>();int number=0;
  for(var r:rows){long line=core.insert("INSERT INTO production_order_lines(order_id,line_number,bom_id,quantity,color) VALUES(?,?,?,?,?)",id,++number,r.bom,r.quantity,r.color);
   for(var e:r.materials.entrySet()){db.update("INSERT INTO production_line_materials(line_id,part_id,bom_part_id,quantity) VALUES(?,?,?,?)",line,e.getKey(),e.getKey(),e.getValue());all.merge(e.getKey(),e.getValue(),BigDecimal::add);}
  }for(var e:all.entrySet())db.update("INSERT INTO production_materials(order_id,part_id,quantity) VALUES(?,?,?)",id,e.getKey(),e.getValue());
 }
 static long create(Api core,JdbcTemplate db,Api.Session s,Map<String,Object> m){
  var rows=parse(core,db,m);var first=rows.getFirst();int total=rows.stream().mapToInt(Draft::quantity).sum();
  long id=core.insert("INSERT INTO production_orders(code,bom_id,quantity,color,created_by) VALUES(?,?,?,?,?)",core.str(m,"code"),first.bom,total,rows.size()==1?first.color:"Nhiều dòng",s.id());write(core,db,id,rows);ProductionProgress.issue(core,db,s,id);return id;
 }
 static List<Map<String,Object>> detail(JdbcTemplate db,long id){return db.queryForList("SELECT l.*,b.model_id,m.code model_code,m.name model FROM production_order_lines l JOIN bom_versions b ON b.id=l.bom_id JOIN vehicle_models m ON m.id=b.model_id WHERE l.order_id=? ORDER BY l.line_number",id);}
 static void edit(Api core,JdbcTemplate db,String token,long id,Map<String,Object> old,Map<String,Object> m){
  if(Boolean.TRUE.equals(old.get("MATERIALS_ISSUED"))){
   core.admin(token);
   var requestedLocked=m.containsKey("lines")?core.lines(m,"lines"):List.of(m);var previousLocked=detail(db,id);if(requestedLocked.size()!=previousLocked.size())throw new Api.Problem(409,"Lệnh đã trừ linh kiện; không đổi các dòng sản xuất");for(int i=0;i<previousLocked.size();i++){var oldLine=previousLocked.get(i);var newLine=requestedLocked.get(i);if(core.num(newLine,"bom_id")!=((Number)oldLine.get("BOM_ID")).longValue()||core.num(newLine,"quantity")!=((Number)oldLine.get("QUANTITY")).longValue()||!core.str(newLine,"color").equals(oldLine.get("COLOR")))throw new Api.Problem(409,"Lệnh đã trừ linh kiện; không đổi BOM, màu hoặc số xe. Hãy hủy lệnh khi đủ điều kiện rồi tạo lại");}db.update("UPDATE production_orders SET code=? WHERE id=?",core.str(m,"code"),id);return;
  }
  if(old.get("STATUS").equals("COMPLETED")){
   core.admin(token);var previous=detail(db,id);var requested=m.containsKey("lines")?core.lines(m,"lines"):List.of(m);
   if(previous.size()!=requested.size())throw new Api.Problem(409,"Lệnh hoàn thành không đổi số dòng");
   for(int i=0;i<previous.size();i++){var p=previous.get(i);var r=requested.get(i);long line=((Number)p.get("ID")).longValue();
    if(core.num(r,"bom_id")!=((Number)p.get("BOM_ID")).longValue()||core.num(r,"quantity")!=((Number)p.get("QUANTITY")).longValue())throw new Api.Problem(409,"Lệnh hoàn thành không đổi BOM hoặc số xe; hãy hủy và tạo lại");
    String color=core.str(r,"color");if(!color.equals(p.get("COLOR"))){if(db.queryForObject("SELECT COUNT(*) FROM production_line_materials l JOIN parts p ON p.id=l.part_id WHERE l.line_id=? AND p.color_parent_id IS NOT NULL",Integer.class,line)>0)throw new Api.Problem(409,"Lệnh đã trừ linh kiện theo màu; muốn đổi màu cần hủy và tạo lại");if(db.queryForObject("SELECT COUNT(*) FROM vehicles WHERE production_line_id=? AND (status='SHIPPED' OR deleted=TRUE)",Integer.class,line)>0)throw new Api.Problem(409,"Không đổi màu dòng có xe đã xuất hoặc xóa");db.update("UPDATE vehicles SET color=? WHERE production_line_id=?",color,line);db.update("UPDATE production_order_lines SET color=? WHERE id=?",color,line);}
   }db.update("UPDATE production_orders SET code=?,color=? WHERE id=?",core.str(m,"code"),requested.size()==1?core.str(requested.getFirst(),"color"):"Nhiều dòng",id);return;
  }
  var rows=parse(core,db,m);db.update("DELETE FROM production_line_materials WHERE line_id IN (SELECT id FROM production_order_lines WHERE order_id=?)",id);db.update("DELETE FROM production_order_lines WHERE order_id=?",id);db.update("DELETE FROM production_materials WHERE order_id=?",id);write(core,db,id,rows);
  db.update("UPDATE production_orders SET code=?,bom_id=?,quantity=?,color=? WHERE id=?",core.str(m,"code"),rows.getFirst().bom,rows.stream().mapToInt(Draft::quantity).sum(),rows.size()==1?rows.getFirst().color:"Nhiều dòng",id);
 }
 static void complete(Api core,JdbcTemplate db,Api.Session s,long id,Map<String,Object> m,Map<String,Object> header){
  var rows=detail(db,id);boolean commercial=AccountKinds.get(db,s.id()).equals("FACTORY")||"COMMERCIAL".equals(m.get("vehicle_type"));
  int total=((Number)header.get("QUANTITY")).intValue();var serials=commercial?List.<Map<String,Object>>of():core.lines(m,"vehicles");
  if(!commercial&&serials.size()!=total)throw new Api.Problem(400,"Số xe phải bằng tổng số xe của lệnh");
  PartColors.route(core,db,id,rows);
  for(var material:db.queryForList("SELECT * FROM production_materials WHERE order_id=? ORDER BY part_id",id))core.move(((Number)material.get("PART_ID")).longValue(),((BigDecimal)material.get("QUANTITY")).negate(),null,id);
  int index=0;for(var r:rows){int qty=((Number)r.get("QUANTITY")).intValue();for(int i=0;i<qty;i++){var serial=commercial?Map.<String,Object>of():serials.get(index++);db.update("INSERT INTO vehicles(model_id,order_id,production_line_id,color,vehicle_type,frame_number,motor_number) VALUES(?,?,?,?,?,?,?)",r.get("MODEL_ID"),id,r.get("ID"),r.get("COLOR"),commercial?"COMMERCIAL":"REGISTERED",commercial?null:core.str(serial,"frame_number"),commercial?null:core.str(serial,"motor_number"));}}
  db.update("UPDATE production_orders SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP WHERE id=?",id);cost(db,id,rows);
 }
 static void cost(JdbcTemplate db,long order,List<Map<String,Object>> rows){
  var rates=new HashMap<Long,BigDecimal>();
  for(var m:db.queryForList("SELECT part_id,SUM(-quantity*unit_cost) amount,SUM(-quantity) quantity,SUM(CASE WHEN unit_cost IS NULL THEN 1 ELSE 0 END) unknown_count FROM stock_movements WHERE production_id=? GROUP BY part_id",order)){
   if(((Number)m.get("UNKNOWN_COUNT")).longValue()>0)return;
   rates.put(((Number)m.get("PART_ID")).longValue(),((BigDecimal)m.get("AMOUNT")).divide((BigDecimal)m.get("QUANTITY"),12,RoundingMode.HALF_UP));
  }
  for(var row:rows){long line=((Number)row.get("ID")).longValue();BigDecimal amount=BigDecimal.ZERO;
   for(var material:db.queryForList("SELECT * FROM production_line_materials WHERE line_id=?",line))amount=amount.add(((BigDecimal)material.get("QUANTITY")).multiply(rates.get(((Number)material.get("PART_ID")).longValue())));
   amount=amount.setScale(2,RoundingMode.HALF_UP);var vehicles=db.queryForList("SELECT id FROM vehicles WHERE production_line_id=? ORDER BY id",line);BigDecimal each=amount.divide(BigDecimal.valueOf(vehicles.size()),2,RoundingMode.DOWN);
   for(int i=0;i<vehicles.size();i++)db.update("UPDATE vehicles SET purchase_unit_cost=? WHERE id=?",i==vehicles.size()-1?amount.subtract(each.multiply(BigDecimal.valueOf(vehicles.size()-1))):each,vehicles.get(i).get("ID"));
  }
 }
}

