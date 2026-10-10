package vn.vinhkhang.warehouse;
import jakarta.servlet.*;import jakarta.servlet.http.*;import org.springframework.stereotype.Component;import org.springframework.core.annotation.Order;import org.springframework.web.filter.OncePerRequestFilter;import java.io.IOException;import java.util.concurrent.locks.ReentrantLock;
/** One shared server: keep validation, database writes and transaction commits in order across clients. */
@Component @Order(-100) public class SharedDataFilter extends OncePerRequestFilter {
 private final ReentrantLock gate=new ReentrantLock(true);
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException {gate.lock();try{chain.doFilter(req,res);}finally{gate.unlock();}}
}
