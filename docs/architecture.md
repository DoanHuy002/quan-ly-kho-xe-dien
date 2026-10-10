# Kiến trúc và phát hành

Electron (renderer React được sandbox) → preload IPC → Spring Boot API loopback → JDBC → H2 file. Backend là nơi quyết định quyền và xử lý tồn kho, không tin dữ liệu giao diện. Mật khẩu BCrypt, phiên có hạn 8 giờ; token chỉ giữ trong bộ nhớ UI. Chưa có chống dò mật khẩu hoặc đổi/reset mật khẩu: cần bổ sung trước sử dụng thật.

## Dữ liệu và cập nhật
Dev: project/data. Bản cài: Electron userData/data, nằm ngoài thư mục chương trình; vị trí application-managed ở AppData trên từng máy. Installer không chứa database và không xóa userData khi gỡ. Flyway V1__warehouse.sql tạo bảng; nâng cấp chỉ thêm V2, V3, không sửa migration đã chạy. Trước migration của bản phát hành sau phải thực hiện backup offline hoặc backup H2 khi backend đang chạy, xác nhận backup rồi mới mở database bằng phiên bản mới. Prototype tự sao chép file H2 trước khi khởi động backend, khi backend của app chưa chạy, và có nút backup ZIP thủ công. Chưa có màn hình khôi phục hoặc kiểm thử cài nâng cấp trên máy Windows khác. Không tự hạ schema khi rollback app.

## Installer Windows
Cấu hình electron-builder NSIS đã có. Đóng gói backend.jar và Java runtime vào extraResources. Trước build bộ cài phải tạo runtime/bin/java.exe bằng jlink hoặc chép runtime đã kiểm tra giấy phép. Đã tạo installer thử nghiệm 0.1.0 có Java runtime; chưa kiểm thử trên Windows sạch. Build-Installer.ps1 tạo runtime và bộ cài; ký code, icon, release notes và smoke test máy sạch còn cần làm.

## Updater
Đã dành electron-updater trong dependency. Chưa bật tải update vì chưa có nơi phát hành, chữ ký và quy trình backup/migration. Khi triển khai: cấu hình publish generic HTTPS/GitHub Releases cho build, phát hành installer + latest.yml + blockmap; autoDownload=false; hiển thị release notes và chỉ tải/cài khi người dùng bấm. Gọi backup và dừng backend trước quitAndInstall. Không nhúng token repository private trong app.

## Nhiều máy
Không mở file H2 chung qua mạng. Chuyển Spring Boot đến server chung, database PostgreSQL, TLS, xác thực/throttle, backup server và phân quyền chặt hơn; Electron chuyển transport từ loopback sang server cấu hình. Chuẩn bị migration riêng PostgreSQL và công cụ chuyển dữ liệu, kiểm tra đối chiếu trước cutover. UI đang dùng abstraction api(), cần bổ sung config transport và main remote mode.

## Schema
app_users; suppliers; parts; locations; stock_documents/lines; stock_balances; stock_movements; vehicle_models; bom_versions/lines; production_orders/materials; vehicles; vehicle_shipments/lines; audit_log. Sổ movements là nguồn đối chiếu tồn; balances cập nhật cùng transaction. BOM bất biến trong prototype, snapshot production_materials bảo toàn định mức lệnh. Số khung và số máy độc lập có unique constraint.

## Bản 0.2.0: thao tác dữ liệu
Operations.java xử lý PUT/DELETE và các thao tác nhập xe/ghi chú; Errors.java xử lý lỗi thống nhất. Mọi mutation xác thực và kiểm tra quyền ở backend. Quyền/tình trạng tài khoản được đọc lại mỗi request, nên xóa hoặc đổi quyền có hiệu lực ngay. Xóa mềm giữ FK và lịch sử; không xóa stock_movements.

Phiếu đã ghi sổ được sửa bằng delta theo từng linh kiện; không đảo toàn bộ rồi nhập lại nên tránh lỗi tồn âm tạm thời khi phần chênh lệch vẫn hợp lệ. Hủy phiếu thêm bút toán ngược. Hủy sản xuất yêu cầu toàn bộ xe còn sẵn và chưa xóa, khôi phục đúng production_materials snapshot; xe/lệnh được đánh deleted. Hủy xuất xe trả AVAILABLE; V2 bỏ unique toàn lịch sử của shipment_lines.vehicle_id, trạng thái xe bảo đảm một giao dịch xuất đang hiệu lực tại thời điểm cập nhật.

Báo cáo gộp net movements theo part và document/production trước khi tính tổng nhập/xuất, để bút toán đảo không làm tăng giả số liệu. Audit lưu JSON trước/sau dưới CLOB; API detail chuyển CLOB sang chuỗi và không ghi password/hash vào snapshot user. Xóa audit chỉ archived, nguyên dữ liệu lịch sử vẫn được đọc lại bởi quản trị.

VK_BACKEND_PORT và VK_DATA_DIR dùng để chạy kiểm thử độc lập; default source vẫn loopback 18765 và project/data. Thử nghiệm có profile riêng nên không đóng ứng dụng người dùng khi chạy test.


V3 thêm vehicle_receipts và vehicles.receipt_id để gắn phiếu nhập xe; nhập/hủy xe cùng transaction với audit. Khôi phục dùng mã ngẫu nhiên 192 bit, DB chỉ giữ SHA-256, khóa hàng để tiêu thụ một lần. Mật khẩu BCrypt; thay mật khẩu thu hồi các token phiên. Excel xuất với Apache POI, các danh sách/chi tiết trong transaction REPEATABLE_READ; bỏ các trường mật khẩu, mã khôi phục và snapshot audit. IPC desktop chỉ lưu byte Excel từ API có xác thực qua hộp thoại Windows.


## Updater 0.4

Desktop UpdateManager dùng electron-updater/NSIS với GitHub public provider, autoDownload=false, autoInstallOnAppQuit=false, allowDowngrade=false, allowPrerelease=false. Kênh mặc định nằm trong desktop/release-channel.json; admin override trong data/updates.json được ghi thay thế atomically. IPC kiểm tra phiên ứng dụng, cấu hình yêu cầu ADMIN. UI chỉ hiển thị release notes dạng chữ, không dựng HTML. Tải qua provider và kiểm tra SHA512 của thư viện. Trước quitAndInstall, main khóa IPC API, chờ in-flight requests, chấm dứt Java qua stdin EOF, đợi tiến trình exit, copy database đã đóng vào backups; không chạy installer khi bước chuẩn bị lỗi. app-update.yml kèm tên cache cho runtime configuration. Build không tự publish. Giữ appId/userData/productName và dùng version semantic.
