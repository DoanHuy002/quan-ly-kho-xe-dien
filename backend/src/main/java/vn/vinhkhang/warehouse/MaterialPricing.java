package vn.vinhkhang.warehouse;
import java.util.*;import org.springframework.jdbc.core.JdbcTemplate;
final class MaterialPricing {
 static Map<String,Object> prepare(Api core,JdbcTemplate db,Api.Session actor,Map<String,Object> input,Long document){
  input=new LinkedHashMap<>(input);if(Objects.toString(input.get("return_source_id"),"").isBlank())input.remove("return_source_id");
  if(input.get("return_source_id")!=null)return SupplierReturns.prepare(core,db,input,document);
  input=PartColors.prepare(core,db,actor,input);
  boolean factory=AccountKinds.get(db,actor.id()).equals("FACTORY");
  var m=new LinkedHashMap<String,Object>(input);m.put("_factory_no_prices",factory);
  var lines=new ArrayList<Map<String,Object>>();
  for(var raw:core.lines(input,"lines")){
   var line=new LinkedHashMap<String,Object>(raw);
   if(factory&&!"IN".equals(m.get("type"))){
    var old=document==null?List.<Map<String,Object>>of():db.queryForList("SELECT unit_cost,sale_unit_price FROM stock_document_lines WHERE document_id=? AND part_id=?",document,core.num(raw,"part_id"));
    line.put("unit_cost",old.isEmpty()?null:old.getFirst().get("UNIT_COST"));line.put("sale_unit_price",old.isEmpty()?null:old.getFirst().get("SALE_UNIT_PRICE"));
   }
   lines.add(line);
  }
  m.put("lines",lines);return m;
 }
}
