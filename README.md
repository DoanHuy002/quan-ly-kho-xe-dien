# Vĩnh Khang – Quản lý kho xe điện

Ứng dụng Windows quản lý linh kiện, sản xuất, xe thành phẩm và xuất hàng. Phiên bản hiện tại: **0.0.21**.

## Cài đặt

Tải bộ cài `.exe` tại [Releases](https://github.com/DoanHuy002/quan-ly-kho-xe-dien/releases/latest). Máy mới tạo tài khoản quản trị khi mở lần đầu. Cập nhật trên máy đã sử dụng giữ nguyên dữ liệu hiện có.

## Chức năng

- Phân nhóm linh kiện Nhựa, Sắt (gồm cơ khí, nhôm và cao su), Điện tử.
- Phiếu nhập, xuất linh kiện và trả nhà cung cấp. Theo dõi giá nhập theo từng phiếu.
- Tồn kho, mẫu xe, định mức BOM, phát lệnh sản xuất và nhập xe từng đợt.
- Đại lý và nhà xe vận chuyển trong hai tab. Theo dõi cước đã biết hoặc chờ bổ sung.
- Báo cáo, nhật ký thao tác, sao lưu, khôi phục và cập nhật ứng dụng.
- Máy bàn giữ dữ liệu chung, laptop kết nối qua mạng nội bộ.
- Xuất nguồn đồng bộ để app [Thu Chi](https://github.com/DoanHuy002/ThuChiVK) ghi công nợ nhà cung cấp và vận chuyển.

## Hai máy và Thu Chi

Xem [hướng dẫn kết nối](docs/KET-NOI-HAI-MAY.md). Mỗi app có mã kết nối riêng. Máy bàn phải mở app và duy trì kết nối mạng. Kho sang Thu Chi dùng nút **Đồng bộ từ kho**, không tự tạo phiếu chi. Các máy dùng chung dữ liệu cần cùng phiên bản của từng app.

## Phát triển

Desktop: Electron và React. Backend: Java 21, Spring Boot, H2 cục bộ.

1. Cài Node.js phù hợp với Vite 7, JDK 21 và Maven.
2. Chạy `npm ci` tại thư mục gốc.
3. Chạy `mvn -f backend/pom.xml clean package` để build backend và chạy kiểm thử Java.
4. Chạy `npm run build` để build giao diện.
5. Chuẩn bị Java runtime tại `runtime/` (thư mục có `bin/java.exe`, `bin/keytool.exe`). Runtime không lưu trong Git.
6. Chạy `npm start`, hoặc `npm run package` để tạo bộ cài Windows.

Repository không chứa database, tài khoản sử dụng, bản sao lưu hay giao dịch nội bộ. Bộ cài không kèm dữ liệu thử. Sao lưu dữ liệu trước khi khôi phục hoặc chuyển máy.
