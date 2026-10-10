package vn.vinhkhang.warehouse;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.dao.DataIntegrityViolationException;
@RestControllerAdvice public class Errors {
 @ExceptionHandler(Api.Problem.class) public ResponseEntity<?> problem(Api.Problem e){return ResponseEntity.status(e.status).body(Map.of("message",e.getMessage()));}
 @ExceptionHandler(DataIntegrityViolationException.class) public ResponseEntity<?> conflict(Exception e){return ResponseEntity.status(409).body(Map.of("message","Mã hoặc số khung/số máy bị trùng, dữ liệu tham chiếu không tồn tại, hoặc giá trị vượt giới hạn."));}
 @ExceptionHandler({NumberFormatException.class,ClassCastException.class}) public ResponseEntity<?> invalid(Exception e){return ResponseEntity.badRequest().body(Map.of("message","Dữ liệu không đúng định dạng"));}
}
