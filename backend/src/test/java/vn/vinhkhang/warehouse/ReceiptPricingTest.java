package vn.vinhkhang.warehouse;
import java.util.*;import java.math.*;import org.junit.jupiter.api.Test;import static org.junit.jupiter.api.Assertions.*;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.boot.test.context.SpringBootTest;import org.springframework.jdbc.core.JdbcTemplate;
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.NONE,properties={"spring.datasource.url=jdbc:h2:mem:receipt_prices;DB_CLOSE_DELAY=-1"})
class ReceiptPricingTest {
 @Autowired Api core;@Autowired FirstSetup setup;@Autowired Operations operations;@Autowired JdbcTemplate db;
 Map<String,Object> doc(String code,long part,int qty,Object cost){var line=new LinkedHashMap<String,Object>();line.put("part_id",part);line.put("quantity",qty);line.put("unit_cost",cost);return new LinkedHashMap<>(Map.of("code",code,"type","IN","lines",List.of(line)));}
 @Test void latestPricesArePerReceiptAndMissingPricesCanBeFilledWithoutChangingOtherTransactions(){
  setup.create(Map.of("username","factory","display_name","Nhà máy","password","a","confirm_password","a","account_kind","FACTORY"));String t=core.login(new Api.Login("factory","a")).get("token").toString();long part=core.create("parts",t,Map.of("code","LK1","name","Càng","unit","Cái")).get("id");
  long first=core.document(t,doc("FIRST",part,10,100)).get("id");core.post(t,first);long second=core.document(t,doc("SECOND",part,5,200)).get("id");core.post(t,second);
  assertEquals(200,((Number)core.list("parts",t).getFirst().get("LATEST_UNIT_COST")).intValue());assertEquals(100,db.queryForObject("SELECT unit_cost FROM stock_document_lines WHERE document_id=?",BigDecimal.class,first).intValue());
  long pending=core.document(t,doc("PENDING",part,3,null)).get("id");core.post(t,pending);assertEquals(200,((Number)core.list("parts",t).getFirst().get("LATEST_UNIT_COST")).intValue());
  long out=core.document(t,Map.of("code","OUT","type","OUT","lines",List.of(Map.of("part_id",part,"quantity",2)))).get("id");core.post(t,out);
  var fill=doc("PENDING",part,3,300);fill.put("reason","Bổ sung giá NCC");operations.update(t,"documents",pending,fill);
  assertEquals(16,db.queryForObject("SELECT quantity FROM stock_balances WHERE part_id=?",BigDecimal.class,part).intValue());
  assertEquals(100,db.queryForObject("SELECT unit_cost FROM stock_document_lines WHERE document_id=?",BigDecimal.class,first).intValue());assertEquals(200,db.queryForObject("SELECT unit_cost FROM stock_document_lines WHERE document_id=?",BigDecimal.class,second).intValue());
  assertNull(db.queryForObject("SELECT unit_cost FROM stock_movements WHERE document_id=?",BigDecimal.class,out));assertEquals(300,((Number)core.list("parts",t).getFirst().get("LATEST_UNIT_COST")).intValue());
  var forbidden=doc("PENDING",part,3,400);forbidden.put("reason","Không đổi giá đã chốt sau xuất");assertThrows(Api.Problem.class,()->operations.update(t,"documents",pending,forbidden));
  core.create("users",t,Map.of("username","store","display_name","Cửa hàng","password","a","role","ADMIN","account_kind","STORE"));String st=core.login(new Api.Login("store","a")).get("token").toString();assertNotNull(core.document(st,doc("STORE-UNKNOWN",part,1,null)).get("id"));
 }
}
