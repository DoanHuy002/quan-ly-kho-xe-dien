package vn.vinhkhang.warehouse;
import org.junit.jupiter.api.Test;import org.flywaydb.core.Flyway;import java.sql.DriverManager;import static org.junit.jupiter.api.Assertions.*;
class MigrationTest {
 @Test void upgradePreservesExistingWarehouseData() throws Exception {
  String url="jdbc:h2:mem:upgrade;DB_CLOSE_DELAY=-1";
  Flyway.configure().dataSource(url,"sa","").locations("classpath:db/migration","classpath:test-migration").target("1").load().migrate();
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){s.executeUpdate("INSERT INTO suppliers(code,name) VALUES('KEEP','Vĩnh Khang migration test')");
   s.executeUpdate("INSERT INTO app_users(id,username,password_hash,display_name,role) VALUES(1,'test','not-a-real-password','Test','ADMIN')");
   s.executeUpdate("INSERT INTO vehicle_models(id,code,name) VALUES(1,'MODEL','Xe cũ')");
   s.executeUpdate("INSERT INTO bom_versions(id,model_id,version) VALUES(1,1,1)");
   s.executeUpdate("INSERT INTO production_orders(id,code,bom_id,quantity,color,status,created_by) VALUES(1,'ORDER',1,1,'Đen','COMPLETED',1)");
   s.executeUpdate("INSERT INTO vehicles(id,model_id,order_id,color,frame_number,motor_number,status) VALUES(1,1,1,'Đen','OLD-FRAME','OLD-MOTOR','SHIPPED')");
   s.executeUpdate("INSERT INTO vehicle_shipments(id,code,customer,created_by) VALUES(1,'SHIP','Khách cũ',1)");
   s.executeUpdate("INSERT INTO vehicle_shipment_lines(shipment_id,vehicle_id) VALUES(1,1)");}
  Flyway.configure().dataSource(url,"sa","").locations("classpath:db/migration","classpath:test-migration").load().migrate();
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement();var r=s.executeQuery("SELECT code,name,email FROM suppliers WHERE code='KEEP'")){assertTrue(r.next());assertEquals("Vĩnh Khang migration test",r.getString("name"));assertNull(r.getString("email"));assertFalse(r.next());}
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement();var r=s.executeQuery("SELECT materials_issued FROM production_orders WHERE id=1")){assertTrue(r.next());assertTrue(r.getBoolean(1));}
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement();var r=s.executeQuery("SELECT v.frame_number,v.deleted,l.shipment_id FROM vehicles v JOIN vehicle_shipment_lines l ON l.vehicle_id=v.id WHERE v.id=1")){assertTrue(r.next());assertEquals("OLD-FRAME",r.getString(1));assertFalse(r.getBoolean(2));assertEquals(1,r.getLong(3));}
 }
}
