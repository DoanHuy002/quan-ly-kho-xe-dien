package vn.vinhkhang.warehouse;
import java.util.*;
final class VehicleTypes {
 static String type(Map<String,Object> m){String t=Objects.toString(m.getOrDefault("vehicle_type","REGISTERED"));if(!Set.of("REGISTERED","COMMERCIAL").contains(t))throw new Api.Problem(400,"Chọn dòng xe Thương Mại hoặc Xe Đăng Kiểm");return t;}
 static String serial(Api core,Map<String,Object> m,String key){if(type(m).equals("COMMERCIAL")){if(!Objects.toString(m.get(key),"").isBlank())throw new Api.Problem(400,"Xe Thương Mại không có số khung, số máy");return null;}String s=Objects.toString(m.get(key),"").trim();if(s.isEmpty())return null;if(s.length()>100)throw new Api.Problem(400,"Số khung/số máy quá dài");return s;}
 static int quantity(Map<String,Object> m){try{int n=Integer.parseInt(Objects.toString(m.getOrDefault("quantity",1)));if(n<1||n>1000||(!type(m).equals("COMMERCIAL")&&n!=1&&(!Objects.toString(m.get("frame_number"),"").isBlank()||!Objects.toString(m.get("motor_number"),"").isBlank())))throw new NumberFormatException();return n;}catch(NumberFormatException e){throw new Api.Problem(400,"Số lượng xe Thương Mại từ 1 đến 1000; mỗi xe Đăng Kiểm nhập riêng một dòng");}}
}
