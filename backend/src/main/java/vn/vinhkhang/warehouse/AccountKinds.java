package vn.vinhkhang.warehouse;
import java.util.*;import org.springframework.jdbc.core.JdbcTemplate;import org.springframework.web.bind.annotation.*;import org.springframework.transaction.annotation.Transactional;import org.springframework.context.annotation.Configuration;import org.springframework.web.servlet.config.annotation.*;import org.springframework.web.servlet.*;import jakarta.servlet.http.*;
@RestController @RequestMapping("/api/account") public class AccountKinds {
 final Api core;final JdbcTemplate db;public AccountKinds(Api core,JdbcTemplate db){this.core=core;this.db=db;}
 static String value(Map<String,Object> m){String k=Objects.toString(m.get("account_kind"),"UNSET");if(!Set.of("FACTORY","STORE","UNSET").contains(k))throw new Api.Problem(400,"Chọn loại tài khoản Nhà máy hoặc Cửa hàng");return k;}
 static String get(JdbcTemplate db,long id){return db.queryForObject("SELECT account_kind FROM app_users WHERE id=?",String.class,id);}
 @PostMapping("/kind") @Transactional public Object choose(@RequestHeader("Authorization") String t,@RequestBody Map<String,Object> m){var s=core.user(t,false);String k=value(m);if(k.equals("UNSET"))throw new Api.Problem(400,"Chọn Nhà máy hoặc Cửa hàng");var current=db.queryForObject("SELECT account_kind FROM app_users WHERE id=? FOR UPDATE",String.class,s.id());if(!current.equals("UNSET"))throw new Api.Problem(409,"Tài khoản đã chọn loại. Admin có thể sửa trong mục Tài khoản.");db.update("UPDATE app_users SET account_kind=? WHERE id=?",k,s.id());core.audit(s,"UPDATE","users",s.id());return Map.of("account_kind",k);}
}
@Configuration class AccountFeatureAccess implements WebMvcConfigurer {
 final Api core;final JdbcTemplate db;AccountFeatureAccess(Api core,JdbcTemplate db){this.core=core;this.db=db;}
 public void addInterceptors(InterceptorRegistry registry){registry.addInterceptor(new HandlerInterceptor(){public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler)throws Exception{
  String path=request.getRequestURI();boolean report=path.startsWith("/api/sales-report"),production=path.matches("/api/(bom|production)(/.*)?")||path.matches("/api/exports/(bom|production)");if(!report&&!production)return true;
  var s=core.user(request.getHeader("Authorization"),false);String k=AccountKinds.get(db,s.id());if(report&&k.equals("FACTORY")||production&&k.equals("STORE")){response.setStatus(403);response.setCharacterEncoding("UTF-8");response.setContentType("application/json");response.getWriter().write("{\"message\":\"Chức năng không áp dụng cho loại tài khoản này\"}");return false;}return true;
 }}).addPathPatterns("/api/**");}
}
