package vn.vinhkhang.warehouse;
import java.util.*;import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.web.bind.annotation.*;import org.springframework.transaction.annotation.Transactional;
@RestController @RequestMapping("/api/parts/material-group") public class MaterialGroups {
 final Api core;final JdbcTemplate db;public MaterialGroups(Api core,JdbcTemplate db){this.core=core;this.db=db;}
 @ExceptionHandler(Api.Problem.class) org.springframework.http.ResponseEntity<?> fail(Api.Problem e){return core.problem(e);}
 static void set(JdbcTemplate db,long id,String group){if(!Set.of("PLASTIC","METAL","ELECTRONIC","UNASSIGNED").contains(group))throw new Api.Problem(400,"Chọn nhóm linh kiện hợp lệ");Long parent=db.queryForObject("SELECT COALESCE(color_parent_id,id) FROM parts WHERE id=? AND deleted=FALSE",Long.class,id);db.update("UPDATE parts SET material_group=? WHERE id=? OR color_parent_id=?",group,parent,parent);}
 @PostMapping @Transactional public Map<String,Integer> assign(@RequestHeader(value="Authorization",required=false) String token,@RequestBody Map<String,Object>b){var actor=core.user(token,true);if(!(b.get("ids") instanceof List<?> ids)||ids.isEmpty()||ids.size()>1000)throw new Api.Problem(400,"Chọn linh kiện cần phân nhóm");String group=Objects.toString(b.get("group"),"");var seen=new HashSet<Long>();for(var raw:ids){long id=Long.parseLong(raw.toString());core.active("parts",id);if(seen.add(id)){set(db,id,group);core.audit(actor,"UPDATE","parts",id);}}return Map.of("updated",seen.size());}
}
