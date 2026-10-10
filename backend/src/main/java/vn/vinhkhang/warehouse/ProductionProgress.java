package vn.vinhkhang.warehouse;
import java.util.*;import java.math.*;import java.time.LocalDate;
import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.transaction.annotation.Transactional;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/production") public class ProductionProgress {
 final Api core;final JdbcTemplate db;public ProductionProgress(Api core,JdbcTemplate db){this.core=core;this.db=db;}
 static Map<String,Object> order(JdbcTemplate db,long id){var rows=db.queryForList("SELECT * FROM production_orders WHERE id=? AND deleted=FALSE FOR UPDATE",id);if(rows.isEmpty())throw new Api.Problem(404,"Không tìm thấy lệnh sản xuất");return rows.getFirst();}
 static void issue(Api core,JdbcTemplate db,Api.Session actor,long id){
  var header=order(db,id);if(Boolean.TRUE.equals(header.get("MATERIALS_ISSUED")))throw new Api.Problem(409,"Lệnh đã trừ linh kiện; không phát lệnh lần nữa");
  var lines=ProductionLines.detail(db,id);PartColors.route(core,db,id,lines);
  for(var material:db.queryForList("SELECT * FROM production_materials WHERE order_id=? ORDER BY part_id",id))core.move(((Number)material.get("PART_ID")).longValue(),((BigDecimal)material.get("QUANTITY")).negate(),null,id);
  for(var row:lines){boolean known=true;BigDecimal total=BigDecimal.ZERO;for(var m:db.queryForList("SELECT * FROM production_line_materials WHERE line_id=? ORDER BY part_id",row.get("ID"))){BigDecimal rate=Costing.sourceCost(db,((Number)m.get("PART_ID")).longValue(),null,id);if(rate==null){known=false;break;}total=total.add(rate.multiply((BigDecimal)m.get("QUANTITY")));}db.update("UPDATE production_order_lines SET planned_unit_cost=? WHERE id=?",known?total.divide(BigDecimal.valueOf(((Number)row.get("QUANTITY")).longValue()),2,RoundingMode.HALF_UP):null,row.get("ID"));}
  db.update("UPDATE production_orders SET materials_issued=TRUE,issued_at=CURRENT_TIMESTAMP WHERE id=?",id);core.audit(actor,"ISSUE_MATERIALS","production",id);
 }
 @PostMapping("/{id}/issue") @Transactional public Object start(@RequestHeader("Authorization") String token,@PathVariable long id){var actor=core.user(token,true);issue(core,db,actor,id);return Map.of("id",id);}
 @GetMapping("/{id}/progress") @Transactional public Object progress(@RequestHeader("Authorization") String token,@PathVariable long id){core.user(token,false);var header=new LinkedHashMap<>(order(db,id));header.put("lines",lines(db,id));return header;}
 static List<Map<String,Object>> lines(JdbcTemplate db,long id){return db.queryForList("SELECT l.*,m.name model,m.code model_code,(SELECT COUNT(*) FROM vehicles v WHERE v.production_line_id=l.id AND v.deleted=FALSE) received_quantity FROM production_order_lines l JOIN bom_versions b ON b.id=l.bom_id JOIN vehicle_models m ON m.id=b.model_id WHERE l.order_id=? ORDER BY l.line_number",id);}
 @PostMapping("/{id}/receive") @Transactional public Object receive(@RequestHeader("Authorization") String token,@PathVariable long id,@RequestBody Map<String,Object> input){var actor=core.user(token,true);return receive(core,db,actor,id,input);}
 static Object receive(Api core,JdbcTemplate db,Api.Session actor,long id,Map<String,Object> input){
  var header=order(db,id);if(!Boolean.TRUE.equals(header.get("MATERIALS_ISSUED")))throw new Api.Problem(409,"Anh phát lệnh để trừ linh kiện trước khi nhập xe");if(header.get("STATUS").equals("COMPLETED"))throw new Api.Problem(409,"Lệnh đã nhập đủ xe");
  LocalDate date;try{date=LocalDate.parse(core.str(input,"receipt_date"));}catch(Exception e){throw new Api.Problem(400,"Ngày nhập xe không hợp lệ");}
  var available=lines(db,id);var requested=core.lines(input,"lines");var seen=new HashSet<Long>();int total=0;boolean commercial=AccountKinds.get(db,actor.id()).equals("FACTORY")||"COMMERCIAL".equals(input.get("vehicle_type"));
  long receipt=core.insert("INSERT INTO vehicle_receipts(code,source,note,created_by,production_order_id,receipt_date) VALUES(?,?,?,?,?,?)",core.str(input,"code"),"Lệnh sản xuất "+header.get("CODE"),input.get("note"),actor.id(),id,date);
  for(var row:requested){long line=core.num(row,"line_id"),quantity=core.num(row,"quantity");if(quantity<1||quantity>1000||!seen.add(line))throw new Api.Problem(400,"Số xe và dòng lệnh không hợp lệ");var match=available.stream().filter(l->((Number)l.get("ID")).longValue()==line).findFirst().orElseThrow(()->new Api.Problem(400,"Dòng không thuộc lệnh sản xuất"));long remaining=((Number)match.get("QUANTITY")).longValue()-((Number)match.get("RECEIVED_QUANTITY")).longValue();if(quantity>remaining)throw new Api.Problem(409,"Nhập vượt số xe còn lại của "+match.get("MODEL")+" · "+match.get("COLOR")+" (còn "+remaining+")");
   var serials=commercial?List.<Map<String,Object>>of():core.lines(row,"vehicles");if(!commercial&&serials.size()!=quantity)throw new Api.Problem(400,"Số khung/số máy phải đủ số xe nhập trong đợt");
   for(int i=0;i<quantity;i++){var serial=commercial?Map.<String,Object>of():serials.get(i);long model=db.queryForObject("SELECT model_id FROM bom_versions WHERE id=?",Long.class,match.get("BOM_ID"));core.active("vehicle_models",model);db.update("INSERT INTO vehicles(model_id,order_id,production_line_id,receipt_id,color,vehicle_type,frame_number,motor_number,purchase_unit_cost) VALUES(?,?,?,?,?,?,?,?,?)",model,id,line,receipt,match.get("COLOR"),commercial?"COMMERCIAL":"REGISTERED",commercial?null:core.str(serial,"frame_number"),commercial?null:core.str(serial,"motor_number"),match.get("PLANNED_UNIT_COST"));}total+=quantity;
  }
  if(total==0)throw new Api.Problem(400,"Anh nhập ít nhất một xe");refresh(db,id);core.audit(actor,"RECEIVE","receipts",receipt);return Map.of("id",receipt,"quantity",total);
 }
 static void refresh(JdbcTemplate db,long order){long total=db.queryForObject("SELECT COUNT(*) FROM vehicles WHERE order_id=? AND deleted=FALSE",Long.class,order);long planned=db.queryForObject("SELECT quantity FROM production_orders WHERE id=?",Long.class,order);if(total>planned)throw new Api.Problem(409,"Số xe nhập vượt lệnh");db.update("UPDATE production_orders SET status=?,completed_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?",total==planned?"COMPLETED":"DRAFT",total==planned,order);}
 static void cancel(Api core,JdbcTemplate db,long id){
  if(db.queryForObject("SELECT COUNT(*) FROM vehicles WHERE order_id=? AND status='SHIPPED' AND deleted=FALSE",Integer.class,id)>0)throw new Api.Problem(409,"Lệnh có xe đã xuất; hãy hủy phiếu xuất trước");
  for(var m:db.queryForList("SELECT * FROM production_materials WHERE order_id=? ORDER BY part_id",id)){long part=((Number)m.get("PART_ID")).longValue();Costing.move(core,db,part,(BigDecimal)m.get("QUANTITY"),null,id,Costing.sourceCost(db,part,null,id),true);}
  db.update("UPDATE vehicles SET deleted=TRUE WHERE order_id=?",id);db.update("UPDATE vehicle_receipts SET deleted=TRUE WHERE production_order_id=?",id);
 }
}
