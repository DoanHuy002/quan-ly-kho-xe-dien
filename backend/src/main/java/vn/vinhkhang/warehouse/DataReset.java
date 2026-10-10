package vn.vinhkhang.warehouse;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
@RestController @RequestMapping("/api/data-reset")
public class DataReset {
 private final Api core;private final JdbcTemplate db;private final TransactionTemplate tx;
 public DataReset(Api core,JdbcTemplate db,PlatformTransactionManager manager){this.core=core;this.db=db;this.tx=new TransactionTemplate(manager);}
 @ExceptionHandler(Api.Problem.class) public org.springframework.http.ResponseEntity<?> problem(Api.Problem e){return org.springframework.http.ResponseEntity.status(e.status).body(Map.of("message",e.getMessage()));}
 @PostMapping public synchronized Object reset(@RequestHeader("Authorization") String token,@RequestBody Map<String,Object> body){
  var user=core.admin(token);
  if(!"XOA GIAO DICH".equals(body.get("confirmation")))throw new Api.Problem(400,"Nhập XOA GIAO DICH để xác nhận đặt lại");
  var backup=core.backup(token);
  try(var zip=new java.util.zip.ZipFile(backup.get("file"))){if(zip.size()==0)throw new java.io.IOException("Empty backup");}catch(java.io.IOException e){throw new Api.Problem(500,"Chưa xác nhận được bản sao lưu. Chưa đặt lại dữ liệu.");}
  tx.executeWithoutResult(status->{
   for(String table:List.of("sales_transfers","revenue_entries","revenue_lines","revenue_sales","vehicle_shipment_lines","vehicle_shipments","stock_movements","production_line_materials","production_materials","vehicles","vehicle_receipts","production_order_lines","production_orders","stock_document_lines"))db.update("DELETE FROM "+table);
   db.update("UPDATE stock_documents SET return_source_id=NULL");db.update("DELETE FROM stock_documents");db.update("DELETE FROM retained_stock_effects");db.update("DELETE FROM stock_balances");db.update("DELETE FROM deleted_records");db.update("DELETE FROM audit_log");core.audit(user,"RESET_TRANSACTIONS","database",0);
  });return Map.of("reset",true,"backup",backup.get("file"));
 }
}

