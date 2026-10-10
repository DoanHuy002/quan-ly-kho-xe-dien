package vn.vinhkhang.warehouse;

import java.math.BigDecimal;
import java.util.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import static vn.vinhkhang.warehouse.Api.Problem;

@RestController
@RequestMapping("/api")
public class Operations {
    private final Api core;
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private static final Map<String,String> TABLES = Map.ofEntries(
        Map.entry("parts","parts"), Map.entry("stock","parts"),
        Map.entry("suppliers","suppliers"), Map.entry("models","vehicle_models"),
        Map.entry("documents","stock_documents"), Map.entry("bom","bom_versions"),
        Map.entry("production","production_orders"), Map.entry("vehicles","vehicles"),
        Map.entry("shipments","vehicle_shipments"), Map.entry("users","app_users"),
        Map.entry("audit","audit_log"));

    public Operations(Api core, JdbcTemplate db, ObjectMapper json) {
        this.core=core; this.db=db; this.json=json;
    }

    private Map<String,Object> record(String entity,long id,boolean lock) {return record(entity,id,lock,false);}
    private Map<String,Object> record(String entity,long id,boolean lock,boolean includeArchived) {
        String table=TABLES.get(entity);
        if(table==null)throw new Problem(404,"Không tìm thấy mục quản lý");
        String condition=entity.equals("users")?"active=TRUE":entity.equals("audit")?(includeArchived?"1=1":"archived=FALSE"):"deleted=FALSE";
        String fields=entity.equals("users")?"id,username,display_name,role,active,account_kind":"*";
        var rows=db.queryForList("SELECT "+fields+" FROM "+table+" WHERE id=? AND "+condition+(lock?" FOR UPDATE":""),id);
        if(rows.isEmpty())throw new Problem(404,"Bản ghi không tồn tại hoặc đã xóa");
        var result=new LinkedHashMap<>(rows.getFirst());
        if(entity.equals("parts"))result.put("COLOR_MODELS",db.queryForList("SELECT model_id FROM part_color_models WHERE part_id=? ORDER BY model_id",Long.class,id));
        for(var entry:result.entrySet())if(entry.getValue() instanceof java.sql.Clob clob){try{entry.setValue(clob.getSubString(1,Math.toIntExact(clob.length())));}catch(java.sql.SQLException e){throw new IllegalStateException(e);}}
        return result;
    }

    private Object snapshot(String entity,long id) {return snapshot(entity,id,false);}
    private Object snapshot(String entity,long id,boolean includeArchived) {
        var r=record(entity,id,false,includeArchived);
        if(entity.equals("documents"))r.put("lines",db.queryForList("SELECT * FROM stock_document_lines WHERE document_id=? ORDER BY part_id",id));
        if(entity.equals("bom"))r.put("lines",db.queryForList("SELECT * FROM bom_lines WHERE bom_id=? ORDER BY part_id",id));
        if(entity.equals("production")){r.put("materials",db.queryForList("SELECT * FROM production_materials WHERE order_id=? ORDER BY part_id",id));r.put("lines",ProductionLines.detail(db,id));}
        if(entity.equals("shipments"))r.put("chargers",ShipmentChargers.lines(db,id));
        if(entity.equals("shipments"))r.put("vehicles",db.queryForList("SELECT vehicle_id id,requested_quantity,unit_price,description,item_code,frame_number,motor_number,vehicle_type FROM vehicle_shipment_lines WHERE shipment_id=? ORDER BY vehicle_id",id));
        if(entity.equals("stock")){r.put("QUANTITY",balance(id));var averages=db.queryForList("SELECT average_unit_cost FROM stock_balances WHERE part_id=? AND location_id=1",id);r.put("AVERAGE_UNIT_COST",averages.isEmpty()?null:averages.getFirst().get("AVERAGE_UNIT_COST"));}
        return r;
    }

    private void history(Api.Session actor,String action,String entity,long id,Object before,Object after,String reason) {
        try {
            db.update("INSERT INTO audit_log(user_id,action,entity,entity_id,details,before_data,after_data) VALUES(?,?,?,?,?,?,?)",
                actor.id(),action,entity,id,reason,json.writeValueAsString(before),json.writeValueAsString(after));
        } catch(JsonProcessingException e) {throw new IllegalStateException("Cannot serialize audit snapshot",e);}
    }

    private BigDecimal nonnegative(Map<String,Object> m,String field) {
        try {BigDecimal n=new BigDecimal(Objects.toString(m.getOrDefault(field,0)));if(n.signum()<0||n.scale()>3||n.precision()>15)throw new NumberFormatException();return n;}
        catch(NumberFormatException e){throw new Problem(400,"Giá trị "+field+" phải từ 0 trở lên, tối đa 3 chữ số thập phân");}
    }

    private BigDecimal balance(long part) {
        var rows=db.queryForList("SELECT quantity FROM stock_balances WHERE part_id=? AND location_id=1 FOR UPDATE",part);
        return rows.isEmpty()?BigDecimal.ZERO:(BigDecimal)rows.getFirst().get("QUANTITY");
    }

    private List<Map<String,Object>> materials(Map<String,Object> m) {
        var result=new ArrayList<Map<String,Object>>();var seen=new HashSet<Long>();
        for(var line:core.lines(m,"lines")){
            long part=core.num(line,"part_id");core.active("parts",part);
            if(!seen.add(part))throw new Problem(400,"Mỗi linh kiện chỉ xuất hiện một lần");
            var item=new LinkedHashMap<String,Object>();item.put("part_id",part);item.put("color_model_id",line.get("color_model_id"));item.put("quantity",core.dec(line,"quantity"));item.put("unit_cost",m.containsKey("type")?Costing.cost(line,"unit_cost"):nonnegative(line,"unit_cost"));result.add(item);
        }
        result.sort(Comparator.comparingLong(l->((Number)l.get("part_id")).longValue()));return result;
    }

    private boolean sameCost(BigDecimal a,BigDecimal b){return a==null?b==null:b!=null&&a.compareTo(b)==0;}
    private void applyStockDelta(long document,String oldType,List<Map<String,Object>> oldLines,String newType,List<Map<String,Object>> newLines) {
        boolean same=oldType.equals(newType)&&oldLines.size()==newLines.size();
        if(same)for(var old:oldLines){var matches=newLines.stream().filter(l->((Number)l.get("part_id")).longValue()==((Number)old.get("PART_ID")).longValue()).toList();if(matches.size()!=1||((BigDecimal)old.get("QUANTITY")).compareTo((BigDecimal)matches.getFirst().get("quantity"))!=0||oldType.equals("IN")&&!sameCost((BigDecimal)old.get("UNIT_COST"),(BigDecimal)matches.getFirst().get("unit_cost"))){same=false;break;}}
        if(same)return;
        if(oldType.equals("IN"))for(var old:oldLines){long part=((Number)old.get("PART_ID")).longValue();if(db.queryForObject("SELECT COUNT(*) FROM stock_movements WHERE part_id=? AND (document_id IS NULL OR document_id<>?) AND id>(SELECT MIN(id) FROM stock_movements WHERE document_id=? AND part_id=?)",Integer.class,part,document,document,part)>0)throw new Problem(409,"Phiếu nhập đã có giao dịch sau đó. Giữ giá lịch sử; anh tạo phiếu mới khi giá nhập thay đổi, không sửa hoặc hủy phiếu nhập này.");}
        for(var old:oldLines){long part=((Number)old.get("PART_ID")).longValue();var quantity=(BigDecimal)old.get("QUANTITY");var cost=oldType.equals("IN")?(BigDecimal)old.get("UNIT_COST"):Costing.sourceCost(db,part,document,null);Costing.move(core,db,part,oldType.equals("IN")?quantity.negate():quantity,document,null,cost,true);}
        for(var line:newLines){long part=((Number)line.get("part_id")).longValue();var quantity=(BigDecimal)line.get("quantity");Costing.move(core,db,part,newType.equals("IN")?quantity:quantity.negate(),document,null,newType.equals("IN")?(BigDecimal)line.get("unit_cost"):null,newType.equals("IN"));}
    }

    private long adjustment(Api.Session actor,long part,BigDecimal target,String reason) {
        record("parts",part,true);BigDecimal delta=target.subtract(balance(part));
        if(delta.signum()==0)return 0;
        String type=delta.signum()>0?"IN":"OUT";
        long doc=core.insert("INSERT INTO stock_documents(code,type,location_id,status,note,created_by,posted_at) VALUES(?,?,1,'POSTED',?,?,CURRENT_TIMESTAMP)",
            "DC-"+UUID.randomUUID().toString().substring(0,18),type,reason,actor.id());
        db.update("INSERT INTO stock_document_lines(document_id,part_id,quantity) VALUES(?,?,?)",doc,part,delta.abs());
        core.move(part,delta,doc,null);
        history(actor,"ADJUST","documents",doc,null,snapshot("documents",doc),reason);return doc;
    }

    @GetMapping("/{entity}/{id}")
    public Object detail(@RequestHeader(value="Authorization",required=false) String t,@PathVariable String entity,@PathVariable long id) {
        core.user(t,false);if(entity.equals("users"))core.admin(t);var result=(Map<String,Object>)snapshot(entity,id,entity.equals("audit"));if(Set.of("parts","stock").contains(entity))result.put("CODE",PartColors.displayCode(db,id));if(entity.equals("audit")&&Boolean.TRUE.equals(result.get("ARCHIVED")))core.admin(t);return result;
    }

    @GetMapping("/audit/archived")
    public Object archived(@RequestHeader(value="Authorization",required=false) String t) {
        core.admin(t);return db.queryForList("SELECT a.id,a.user_id,a.action,a.entity,a.entity_id,a.details,a.user_note,a.archived,a.created_at,u.display_name actor FROM audit_log a JOIN app_users u ON u.id=a.user_id WHERE a.archived=TRUE ORDER BY a.id DESC LIMIT 500");
    }

    @GetMapping("/me")
    public Object me(@RequestHeader(value="Authorization",required=false) String t) {
        var s=core.user(t,false);return Map.of("id",s.id(),"name",s.name(),"role",s.role(),"account_kind",AccountKinds.get(db,s.id()));
    }

    @PostMapping("/vehicles") @Transactional
    public Object createVehicle(@RequestHeader(value="Authorization",required=false) String t,@RequestBody Map<String,Object> m) {
        var s=core.user(t,true);core.active("vehicle_models",core.num(m,"model_id"));
        long id=core.insert("INSERT INTO vehicles(model_id,color,vehicle_type,frame_number,motor_number,purchase_unit_cost) VALUES(?,?,?,?,?,?)",
            core.num(m,"model_id"),core.str(m,"color"),VehicleTypes.type(m),VehicleTypes.serial(core,m,"frame_number"),VehicleTypes.serial(core,m,"motor_number"),RevenueReports.money(m,"purchase_unit_cost",false));
        history(s,"CREATE","vehicles",id,null,snapshot("vehicles",id),Objects.toString(m.get("reason"),"Nhập xe thành phẩm có sẵn"));return Map.of("id",id);
    }

    @PostMapping("/audit") @Transactional
    public Object createNote(@RequestHeader(value="Authorization",required=false) String t,@RequestBody Map<String,Object> m) {
        var s=core.admin(t);long id=core.insert("INSERT INTO audit_log(user_id,action,entity,details,user_note) VALUES(?,'NOTE','notes',?,?)",s.id(),"Ghi chú thủ công",core.str(m,"user_note"));return Map.of("id",id);
    }

    @PutMapping("/{entity}/{id}") @Transactional
    public Object update(@RequestHeader(value="Authorization",required=false) String t,@PathVariable String entity,@PathVariable long id,@RequestBody Map<String,Object> m) {
        var s=core.user(t,true);if(Set.of("users","bom","audit","stock").contains(entity))s=core.admin(t);
        if(entity.equals("users"))db.queryForList("SELECT id FROM app_users WHERE role='ADMIN' AND active=TRUE ORDER BY id FOR UPDATE");
        var old=record(entity,id,true);if(entity.equals("documents"))ShipmentChargers.guard(db,id);RevenueReports.ensureUnlinked(db,entity,id);Object before=snapshot(entity,id);
        switch(entity){
            case "parts" -> {
                PartColors.configure(core,db,id,m);
                if(!old.get("UNIT").equals(core.str(m,"unit"))&&db.queryForObject("SELECT COUNT(*) FROM parts WHERE color_parent_id=?",Integer.class,id)>0)throw new Problem(409,"Giữ đơn vị linh kiện gốc đồng nhất với các màu đã tạo");
                if(!old.get("UNIT").equals(core.str(m,"unit"))&&db.queryForObject("SELECT COUNT(*) FROM stock_movements WHERE part_id=?",Integer.class,id)>0)throw new Problem(409,"Không đổi đơn vị của linh kiện đã có giao dịch; hãy thêm mã linh kiện mới");
                db.update("UPDATE parts SET code=?,name=?,unit=?,minimum=? WHERE id=?",old.get("COLOR_PARENT_ID")==null?core.str(m,"code"):old.get("CODE"),core.str(m,"name"),core.str(m,"unit"),nonnegative(m,"minimum"),id);
            }
            case "suppliers" -> db.update("UPDATE suppliers SET code=?,name=?,phone=?,address=? WHERE id=?",core.str(m,"code"),core.str(m,"name"),m.get("phone"),m.get("address"),id);
            case "models" -> db.update("UPDATE vehicle_models SET code=?,name=? WHERE id=?",core.str(m,"code"),core.str(m,"name"),id);
            case "users" -> {
                String role=core.str(m,"role");if(!Set.of("ADMIN","WAREHOUSE","VIEWER").contains(role))throw new Problem(400,"Vai trò không hợp lệ");
                if(id==s.id()&&!role.equals("ADMIN"))throw new Problem(409,"Không tự hạ quyền tài khoản quản trị đang sử dụng");
                if(old.get("ROLE").equals("ADMIN")&&!role.equals("ADMIN")&&db.queryForObject("SELECT COUNT(*) FROM app_users WHERE role='ADMIN' AND active=TRUE",Integer.class)<=1)throw new Problem(409,"Phải giữ ít nhất một quản trị viên");
                db.update("UPDATE app_users SET username=?,display_name=?,role=?,account_kind=? WHERE id=?",core.str(m,"username"),core.str(m,"display_name"),role,m.containsKey("account_kind")?AccountKinds.value(m):old.get("ACCOUNT_KIND"),id);
                String pw=Objects.toString(m.get("password"),"");if(!pw.isEmpty()){if(id==s.id())throw new Problem(400,"Hãy dùng nút Đổi mật khẩu để đổi mật khẩu của anh");if(pw.length()<1)throw new Problem(400,"Mật khẩu cần ít nhất 1 ký tự");Accounts.validate(pw);db.update("UPDATE app_users SET password_hash=? WHERE id=?",new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode(pw),id);core.invalidateSessions(id);}
            }
            case "documents" -> {
                if(old.get("RETURN_SOURCE_ID")!=null&&old.get("STATUS").equals("POSTED"))throw new Problem(409,"Phiếu trả đã ghi sổ không sửa số lượng; hủy phiếu rồi tạo phiếu trả mới");
                if(old.get("RETURN_SOURCE_ID")!=null&&m.get("return_source_id")==null)throw new Problem(409,"Phiếu trả phải giữ liên kết lô nhập");
                m=MaterialPricing.prepare(core,db,s,m,id);
                String type=core.str(m,"type");if(!Set.of("IN","OUT").contains(type))throw new Problem(400,"Loại phiếu không hợp lệ");
                if(type.equals("IN")&&m.get("supplier_id")!=null&&!Objects.equals(Objects.toString(m.get("supplier_id")),Objects.toString(old.get("SUPPLIER_ID"))))core.active("suppliers",Long.parseLong(m.get("supplier_id").toString()));
                var ls=materials(m);var oldLines=db.queryForList("SELECT * FROM stock_document_lines WHERE document_id=? ORDER BY part_id",id);
                if(old.get("STATUS").equals("POSTED")){core.admin(t);core.str(m,"reason");if(!ReceiptPricing.supplement(core,db,id,(String)old.get("TYPE"),oldLines,type,ls))applyStockDelta(id,(String)old.get("TYPE"),oldLines,type,ls);}
                db.update("UPDATE stock_documents SET code=?,type=?,supplier_id=?,note=? WHERE id=?",core.str(m,"code"),type,type.equals("IN")||m.get("return_source_id")!=null?m.get("supplier_id"):null,m.get("note"),id);
                db.update("DELETE FROM stock_document_lines WHERE document_id=?",id);
                for(var l:ls)db.update("INSERT INTO stock_document_lines(document_id,part_id,quantity,unit_cost,color_model_id) VALUES(?,?,?,?,?)",id,l.get("part_id"),l.get("quantity"),l.get("unit_cost"),l.get("color_model_id"));
                SupplierReturns.persist(db,id,m);SalesFlow.header(db,"PART",id,m);SalesFlow.prices(core,db,id,m);if(old.get("STATUS").equals("POSTED"))SalesFlow.post(core,db,"PART",id,s);
            }
            case "bom" -> {
                if(db.queryForObject("SELECT COUNT(*) FROM production_orders WHERE id IN (SELECT order_id FROM production_order_lines WHERE bom_id=?)",Integer.class,id)>0)throw new Problem(409,"Định mức đã dùng cho sản xuất. Hãy Thêm phiên bản mới để giữ định mức của lệnh cũ");
                core.active("vehicle_models",core.num(m,"model_id"));var ls=materials(m);for(var l:ls)PartColors.bomPart(db,((Number)l.get("part_id")).longValue());
                db.update("UPDATE bom_versions SET model_id=?,version=? WHERE id=?",core.num(m,"model_id"),core.num(m,"version"),id);
                db.update("DELETE FROM bom_lines WHERE bom_id=?",id);for(var l:ls)db.update("INSERT INTO bom_lines(bom_id,part_id,quantity) VALUES(?,?,?)",id,l.get("part_id"),l.get("quantity"));
            }
            case "production" -> {ProductionLines.edit(core,db,t,id,old,m);}
            case "vehicles" -> {
                if(old.get("PRODUCTION_LINE_ID")!=null&&(core.num(m,"model_id")!=((Number)old.get("MODEL_ID")).longValue()||!core.str(m,"color").equals(old.get("COLOR"))))throw new Problem(409,"Xe từ lệnh sản xuất giữ nguyên mẫu và màu theo linh kiện đã dùng");
                if(old.get("STATUS").equals("SHIPPED"))core.admin(t);
                if(core.num(m,"model_id")!=((Number)old.get("MODEL_ID")).longValue())core.active("vehicle_models",core.num(m,"model_id"));
                db.update("UPDATE vehicles SET model_id=?,color=?,vehicle_type=?,frame_number=?,motor_number=?,purchase_unit_cost=? WHERE id=?",core.num(m,"model_id"),core.str(m,"color"),VehicleTypes.type(m),VehicleTypes.serial(core,m,"frame_number"),VehicleTypes.serial(core,m,"motor_number"),Costing.cost(m,"purchase_unit_cost"),id);
            }
            case "shipments" -> {
                core.admin(t);SalesShipments.validate(core,m);Set<Long> desired=new TreeSet<>();for(var v:core.lines(m,"vehicles"))if(!desired.add(core.num(v,"id")))throw new Problem(400,"Xe bị chọn trùng");
                for(long v:desired)if(db.queryForObject("SELECT COUNT(*) FROM vehicles WHERE id=? AND vehicle_type=?",Integer.class,v,VehicleTypes.type(m))!=1)throw new Problem(400,"Xe được chọn không thuộc dòng xe trên phiếu");
                Set<Long> current=new TreeSet<>(db.queryForList("SELECT vehicle_id FROM vehicle_shipment_lines WHERE shipment_id=?",Long.class,id));
                for(long v:current)if(!desired.contains(v)){
                    if(db.update("UPDATE vehicles SET status='AVAILABLE' WHERE id=? AND status='SHIPPED' AND deleted=FALSE",v)!=1)throw new Problem(409,"Trạng thái xe đã thay đổi");
                    db.update("DELETE FROM vehicle_shipment_lines WHERE shipment_id=? AND vehicle_id=?",id,v);
                }
                for(long v:desired)if(!current.contains(v)){
                    if(db.update("UPDATE vehicles SET status='SHIPPED' WHERE id=? AND status='AVAILABLE' AND deleted=FALSE",v)!=1)throw new Problem(409,"Xe không còn sẵn có để xuất");
                    db.update("INSERT INTO vehicle_shipment_lines(shipment_id,vehicle_id) VALUES(?,?)",id,v);
                }
                db.update("UPDATE vehicle_shipments SET code=?,customer=? WHERE id=?",core.str(m,"code"),core.str(m,"customer"),id);ShipmentChargers.persist(core,db,s,id,m);SalesShipments.persist(db,core,id,m);SalesFlow.header(db,"VEHICLE",id,m);SalesFlow.post(core,db,"VEHICLE",id,s);
            }
            case "stock" -> {adjustment(s,id,nonnegative(m,"quantity"),core.str(m,"reason"));if(m.containsKey("average_unit_cost"))db.update("UPDATE stock_balances SET average_unit_cost=? WHERE part_id=? AND location_id=1",Costing.cost(m,"average_unit_cost"),id);}
            case "audit" -> db.update("UPDATE audit_log SET user_note=? WHERE id=?",core.str(m,"user_note"),id);
            default -> throw new Problem(404,"Không tìm thấy mục quản lý");
        }
        history(s,"UPDATE",entity,id,before,snapshot(entity,id),Objects.toString(m.get("reason"),"Cập nhật thông tin"));
        return Map.of("id",id);
    }

    @DeleteMapping("/{entity}/{id}") @Transactional
    public void delete(@RequestHeader(value="Authorization",required=false) String t,@PathVariable String entity,@PathVariable long id,@RequestBody Map<String,Object> m) {
        var s=core.user(t,true);if(Set.of("users","bom","audit").contains(entity))s=core.admin(t);
        String reason=core.str(m,"reason");
        if(entity.equals("audit")){
            record(entity,id,true,true);
            db.update("DELETE FROM audit_log WHERE id=?",id);
            return;
        }
        if(entity.equals("users"))db.queryForList("SELECT id FROM app_users WHERE role='ADMIN' AND active=TRUE ORDER BY id FOR UPDATE");
        var r=record(entity,id,true);if(entity.equals("documents"))ShipmentChargers.guard(db,id);RevenueReports.ensureUnlinked(db,entity,id);Object before=snapshot(entity,id);DeletedRecords.capture(db,json,entity,id,before);
        switch(entity){
            case "parts", "stock" -> {
                if(db.queryForObject("SELECT COUNT(*) FROM parts WHERE color_parent_id=? AND deleted=FALSE",Integer.class,id)>0)throw new Problem(409,"Linh kiện có các màu đang sử dụng; không xóa danh mục gốc");
                if(balance(id).signum()!=0)throw new Problem(409,"Linh kiện còn tồn kho. Hãy xử lý hoặc điều chỉnh tồn về 0 trước khi xóa");
                if(db.queryForObject("SELECT COUNT(*) FROM production_materials m JOIN production_orders o ON o.id=m.order_id WHERE m.part_id=? AND o.status='COMPLETED' AND o.deleted=FALSE",Integer.class,id)>0)throw new Problem(409,"Linh kiện đã dùng trong lệnh hoàn thành; giữ danh mục để có thể hoàn trả đúng kho khi hủy lệnh");
                int openBom=db.queryForObject("SELECT COUNT(*) FROM bom_lines l JOIN bom_versions b ON b.id=l.bom_id WHERE l.part_id=? AND b.deleted=FALSE",Integer.class,id);
                int draftDocs=db.queryForObject("SELECT COUNT(*) FROM stock_document_lines l JOIN stock_documents d ON d.id=l.document_id WHERE l.part_id=? AND d.status='DRAFT' AND d.deleted=FALSE",Integer.class,id);
                int draftOrders=db.queryForObject("SELECT COUNT(*) FROM production_materials m JOIN production_orders p ON p.id=m.order_id WHERE m.part_id=? AND p.status='DRAFT' AND p.deleted=FALSE",Integer.class,id);
                if(openBom+draftDocs+draftOrders>0)throw new Problem(409,"Linh kiện đang dùng trong BOM hoặc phiếu/lệnh nháp. Hãy sửa hoặc xóa các mục đó trước");
                db.update("UPDATE parts SET deleted=TRUE WHERE id=?",id);
            }
            case "suppliers" -> db.update("UPDATE suppliers SET deleted=TRUE WHERE id=?",id);
            case "models" -> {
                if(db.queryForObject("SELECT COUNT(*) FROM bom_versions WHERE model_id=? AND deleted=FALSE",Integer.class,id)>0)throw new Problem(409,"Mẫu xe đang có BOM sử dụng. Hãy ngừng/xóa BOM trước");
                db.update("UPDATE vehicle_models SET deleted=TRUE WHERE id=?",id);
            }
            case "users" -> {
                if(id==s.id())throw new Problem(409,"Không xóa tài khoản đang đăng nhập");
                if(r.get("ROLE").equals("ADMIN")&&db.queryForObject("SELECT COUNT(*) FROM app_users WHERE role='ADMIN' AND active=TRUE",Integer.class)<=1)throw new Problem(409,"Phải giữ ít nhất một quản trị viên");
                db.update("UPDATE app_users SET active=FALSE WHERE id=?",id);
            }
            case "documents" -> {
                if(r.get("STATUS").equals("POSTED")){core.admin(t);applyStockDelta(id,(String)r.get("TYPE"),db.queryForList("SELECT * FROM stock_document_lines WHERE document_id=? ORDER BY part_id",id),"IN",List.of());}
                db.update("UPDATE stock_documents SET deleted=TRUE WHERE id=?",id);
            }
            case "bom" -> {
                if(db.queryForObject("SELECT COUNT(*) FROM production_orders WHERE id IN (SELECT order_id FROM production_order_lines WHERE bom_id=?) AND status='DRAFT' AND deleted=FALSE",Integer.class,id)>0)throw new Problem(409,"BOM còn lệnh sản xuất nháp. Hãy xử lý lệnh trước");
                db.update("UPDATE bom_versions SET deleted=TRUE,status='RETIRED' WHERE id=?",id);
            }
            case "production" -> {
                if(Boolean.TRUE.equals(r.get("MATERIALS_ISSUED"))){core.admin(t);ProductionProgress.cancel(core,db,id);}
                db.update("UPDATE production_orders SET deleted=TRUE WHERE id=?",id);
            }
            case "vehicles" -> {
                if(r.get("PRODUCTION_LINE_ID")!=null&&r.get("RECEIPT_ID")!=null)throw new Problem(409,"Xe nhập từ lệnh: anh hủy phiếu nhập xe theo đợt để giữ đúng tiến độ lệnh");
                if(r.get("STATUS").equals("SHIPPED"))throw new Problem(409,"Xe đã xuất. Hãy hủy phiếu xuất xe trước khi xóa");
                db.update("UPDATE vehicles SET deleted=TRUE WHERE id=?",id);
            }
            case "shipments" -> {
                core.admin(t);for(long vehicle:db.queryForList("SELECT vehicle_id FROM vehicle_shipment_lines WHERE shipment_id=? ORDER BY vehicle_id",Long.class,id)){
                    if(db.update("UPDATE vehicles SET status='AVAILABLE' WHERE id=? AND status='SHIPPED' AND deleted=FALSE",vehicle)!=1)throw new Problem(409,"Trạng thái xe đã thay đổi");
                }
                ShipmentChargers.cancel(core,db,id);db.update("UPDATE vehicle_shipments SET deleted=TRUE WHERE id=?",id);
            }
            default -> throw new Problem(404,"Không tìm thấy mục quản lý");
        }
        history(s,"DELETE",entity,id,before,Map.of("deleted",true),reason);
    }
}
