package vn.vinhkhang.warehouse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.flywaydb.core.Flyway;
import java.nio.file.*;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;
class RestoreToolTest {
 @TempDir Path dir;
 @Test void acceptsCurrentBackupAndRejectsUnknownFutureSchema() throws Exception {
  String url="jdbc:h2:file:"+dir.resolve("source").toString().replace('\\','/');
  Flyway.configure().dataSource(url,"sa","").locations("classpath:db/migration").load().migrate();
  Path zip=dir.resolve("current.zip");
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()) {
   s.executeUpdate("INSERT INTO app_users(username,password_hash,display_name,role) VALUES('keep-admin','test','Admin','ADMIN')");
   s.executeUpdate("INSERT INTO parts(code,name,unit) VALUES('KEEP','Linh kiện giữ lại','Cái')");
   s.execute("BACKUP TO '"+zip.toString().replace('\\','/')+"'");
  }
  // H2 BACKUP uses the database's filename; production databases are named warehouse.
  Path normalized=dir.resolve("valid.zip");
  try(var in=new java.util.zip.ZipInputStream(Files.newInputStream(zip));var out=new java.util.zip.ZipOutputStream(Files.newOutputStream(normalized))) {
   assertNotNull(in.getNextEntry());out.putNextEntry(new java.util.zip.ZipEntry("warehouse.mv.db"));in.transferTo(out);out.closeEntry();
  }
  Path restored=dir.resolve("restored");RestoreTool.extract(normalized.toString(),restored.toString());
  try(var c=DriverManager.getConnection("jdbc:h2:file:"+restored.resolve("warehouse").toString().replace('\\','/'),"sa","");var s=c.createStatement();var r=s.executeQuery("SELECT name FROM parts WHERE code='KEEP'")) {
   assertTrue(r.next());assertEquals("Linh kiện giữ lại",r.getString(1));
  }
  Path future=dir.resolve("future.zip");
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()) {
   s.executeUpdate("UPDATE \"flyway_schema_history\" SET \"version\"='999' WHERE \"version\"='17'");
   s.execute("BACKUP TO '"+future.toString().replace('\\','/')+"'");
  }
  Path unknown=dir.resolve("unknown.zip");
  try(var in=new java.util.zip.ZipInputStream(Files.newInputStream(future));var out=new java.util.zip.ZipOutputStream(Files.newOutputStream(unknown))) {
   in.getNextEntry();out.putNextEntry(new java.util.zip.ZipEntry("warehouse.mv.db"));in.transferTo(out);out.closeEntry();
  }
  Path rejected=dir.resolve("rejected");
  assertTrue(assertThrows(Exception.class,()->RestoreTool.extract(unknown.toString(),rejected.toString())).getMessage().contains("mới hơn"));
  assertFalse(Files.exists(rejected.resolve("warehouse.mv.db")));
  assertTrue(Files.exists(restored.resolve("warehouse.mv.db")));
 }
}
