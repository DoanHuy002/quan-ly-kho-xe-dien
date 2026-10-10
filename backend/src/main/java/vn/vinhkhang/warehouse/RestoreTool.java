package vn.vinhkhang.warehouse;
import java.nio.file.*;
import java.util.zip.*;
import java.sql.*;
import org.flywaydb.core.Flyway;
import java.util.*;
public class RestoreTool {
 public static void extract(String source,String target) throws Exception {
  // Resolve versions from the migrations shipped with this app, including Java migrations.
  // Only inspect an empty temporary database; never migrate or modify the backup.
  Set<String> supported=new HashSet<>();
  var migrations=Flyway.configure().dataSource("jdbc:h2:mem:restore_versions_"+UUID.randomUUID(),"sa","").locations("classpath:db/migration").load().info().all();
  for(var migration:migrations)if(migration.getVersion()!=null)supported.add(migration.getVersion().toString());
  Path dir=Path.of(target);Files.createDirectories(dir);Path db=dir.resolve("warehouse.mv.db");
  try {
   int count=0;long size=0;
   try(var zip=new ZipInputStream(Files.newInputStream(Path.of(source)))) {
    ZipEntry entry;while((entry=zip.getNextEntry())!=null){
     if(++count!=1||!entry.getName().equals("warehouse.mv.db")||entry.isDirectory())throw new Exception("File không phải bản sao lưu Vĩnh Khang hợp lệ");
     try(var out=Files.newOutputStream(db,StandardOpenOption.CREATE_NEW)){byte[] buf=new byte[65536];int n;while((n=zip.read(buf))!=-1){size+=n;if(size>4L*1024*1024*1024)throw new Exception("Bản sao lưu vượt giới hạn 4 GB");out.write(buf,0,n);}}
    }if(count!=1||size==0)throw new Exception("Bản sao lưu rỗng");
   }
   try(var c=DriverManager.getConnection("jdbc:h2:file:"+dir.resolve("warehouse").toAbsolutePath().toString().replace('\\','/')+";IFEXISTS=TRUE;ACCESS_MODE_DATA=r","sa",System.getenv().getOrDefault("VK_DB_PASSWORD",""));var s=c.createStatement()){
    for(String table:new String[]{"APP_USERS","PARTS","VEHICLES","STOCK_MOVEMENTS","VEHICLE_SHIPMENTS"})try(var r=s.executeQuery("SELECT COUNT(*) FROM "+table)){r.next();}
    try(var r=s.executeQuery("SELECT COUNT(*) FROM APP_USERS WHERE ROLE='ADMIN'")){r.next();if(r.getInt(1)==0)throw new Exception("Bản sao lưu thiếu tài khoản quản trị");}
    try(var r=s.executeQuery("SELECT \"version\" FROM \"flyway_schema_history\" WHERE \"success\"=TRUE AND \"version\" IS NOT NULL")){while(r.next())if(!supported.contains(r.getString(1)))throw new Exception("Bản sao lưu dùng phiên bản dữ liệu mới hơn app này");}
   }
  }catch(Exception e){Files.deleteIfExists(db);throw e;}
 }
}
