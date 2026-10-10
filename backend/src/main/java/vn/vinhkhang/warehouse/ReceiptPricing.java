package vn.vinhkhang.warehouse;
import java.util.*;import java.math.*;import org.springframework.jdbc.core.JdbcTemplate;
/** Only fill missing prices. Quantities and other documents' cost snapshots stay unchanged. */
final class ReceiptPricing {
 static boolean supplement(Api core,JdbcTemplate db,long document,String oldType,List<Map<String,Object>> oldLines,String newType,List<Map<String,Object>> newLines){
  if(!"IN".equals(oldType)||!oldType.equals(newType)||oldLines.size()!=newLines.size())return false;
  boolean changed=false;var parts=new ArrayList<Long>();
  for(var old:oldLines){long part=((Number)old.get("PART_ID")).longValue();var next=newLines.stream().filter(l->((Number)l.get("part_id")).longValue()==part).toList();
   if(next.size()!=1||((BigDecimal)old.get("QUANTITY")).compareTo((BigDecimal)next.getFirst().get("quantity"))!=0)return false;
   var previous=(BigDecimal)old.get("UNIT_COST");var cost=(BigDecimal)next.getFirst().get("unit_cost");
   if(previous!=null&&(cost==null||previous.compareTo(cost)!=0))return false;
   if(previous==null&&cost!=null){changed=true;parts.add(part);}
  }
  if(!changed)return false;
  for(long part:parts){db.queryForList("SELECT quantity FROM stock_balances WHERE part_id=? AND location_id=1 FOR UPDATE",part);var cost=newLines.stream().filter(l->((Number)l.get("part_id")).longValue()==part).findFirst().orElseThrow().get("unit_cost");
   // Update only this receipt's still-unknown cost, never outbound snapshots or revenue lines.
   db.update("UPDATE stock_movements SET unit_cost=? WHERE document_id=? AND part_id=? AND unit_cost IS NULL AND quantity>0",cost,document,part);
   BigDecimal qty=BigDecimal.ZERO,average=null;
   for(var movement:db.queryForList("SELECT quantity,unit_cost FROM stock_history WHERE part_id=? AND location_id=1 ORDER BY created_at",part)){
    var delta=(BigDecimal)movement.get("QUANTITY");var incoming=(BigDecimal)movement.get("UNIT_COST");var after=qty.add(delta);
    if(after.signum()==0)average=null;
    else if(delta.signum()>0)average=qty.signum()==0?incoming:average==null||incoming==null?null:qty.multiply(average).add(delta.multiply(incoming)).divide(after,6,RoundingMode.HALF_UP);
    qty=after;
   }
   db.update("UPDATE stock_balances SET average_unit_cost=? WHERE part_id=? AND location_id=1",average,part);
  }
  return true;
 }
}
