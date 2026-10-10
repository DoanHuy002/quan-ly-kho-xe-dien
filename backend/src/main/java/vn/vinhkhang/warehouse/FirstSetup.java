package vn.vinhkhang.warehouse;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
@RestController @RequestMapping("/api/setup") public class FirstSetup {
 private final JdbcTemplate db; private final Api core;
 public FirstSetup(JdbcTemplate db,Api core){this.db=db;this.core=core;}
 @GetMapping("/status") public Map<String,Boolean> status(){return Map.of("required",!db.queryForObject("SELECT completed FROM app_setup_state WHERE id=1",Boolean.class));}
 @PostMapping @Transactional public Map<String,Object> create(@RequestBody Map<String,Object> m){
  boolean completed=(Boolean)db.queryForList("SELECT completed FROM app_setup_state WHERE id=1 FOR UPDATE").getFirst().get("COMPLETED");
  if(completed||db.queryForObject("SELECT COUNT(*) FROM app_users",Integer.class)!=0)throw new Api.Problem(409,"Máy đã có tài khoản quản trị. Anh đăng nhập để tạo thêm người dùng.");
  String name=core.str(m,"username"),display=core.str(m,"display_name"),password=Objects.toString(m.get("password"),"");
  if(!name.matches("[A-Za-z0-9_.-]{1,80}")||display.length()>120)throw new Api.Problem(400,"Tên đăng nhập dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang, tối đa 80 ký tự.");
  Accounts.validate(password);
  if(!password.equals(Objects.toString(m.get("confirm_password"),"")))throw new Api.Problem(400,"Hai mật khẩu chưa khớp");
  long id=core.insert("INSERT INTO app_users(username,password_hash,display_name,role,account_kind) VALUES(?,?,?,?,?)",name,new BCryptPasswordEncoder().encode(password),display,"ADMIN",AccountKinds.value(m));
  String code=Accounts.fresh();db.update("INSERT INTO recovery_secrets(user_id,code_hash) VALUES(?,?)",id,Accounts.hash(code));
  db.update("UPDATE app_setup_state SET completed=TRUE WHERE id=1");core.audit(new Api.Session(id,display,"ADMIN",java.time.Instant.now()),"SETUP_ADMIN","users",id);
  return Map.of("created",true,"recovery_code",code);
 }
}
