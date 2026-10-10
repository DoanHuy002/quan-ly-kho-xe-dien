package vn.vinhkhang.warehouse;
import org.springframework.boot.SpringApplication;import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication public class Application {public static void main(String[] args){if(args.length==3&&args[0].equals("--validate-backup")){try{RestoreTool.extract(args[1],args[2]);}catch(Exception e){System.err.println("Không đọc được bản sao lưu: "+e.getMessage());System.exit(2);}return;}SpringApplication.run(Application.class,args);}}
