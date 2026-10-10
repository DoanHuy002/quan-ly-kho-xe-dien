# Kho và Thu Chi dùng chung dữ liệu

Bản Kho 0.0.21 và Thu Chi 1.2.1. Máy bàn giữ dữ liệu, laptop kết nối qua cùng mạng Wi-Fi hoặc mạng dây. Mỗi app dùng một mã kết nối riêng. Thông tin truyền được mã hóa; vẫn đăng nhập bằng tài khoản của từng app.

## 1. Thiết lập máy bàn mới

1. Sao chép toàn bộ thư mục này sang máy bàn. Máy bàn cần có ổ D theo nơi lưu Thu Chi đã chọn.
2. Cài hai bộ cài trong thư mục này. Chọn nơi cài trên ổ D; chưa mở app hoặc đóng cả hai app trước bước tiếp theo.
3. Chạy `Chuyen-du-lieu-sang-may-ban.cmd`. Chương trình chỉ chuyển khi máy bàn chưa có database; không ghi đè dữ liệu đã có. Mở từng app và tạo tài khoản Admin mới sau khi chuyển. Giao dịch, nguồn tiền, đối tác và tài khoản cũ đã được xóa; Kho chỉ giữ linh kiện chuẩn, mẫu xe và BOM. Kho giữ nguyên mã nguồn đồng bộ để không tạo trùng công nợ.
4. Mở Kho, tạo tài khoản Admin rồi đăng nhập, bấm **Kết nối máy chủ** ở góc dưới bên phải → **Máy chủ — giữ dữ liệu chung** → **Lưu và mở lại app**. Làm tương tự với Thu Chi.
5. Chạy **Bat-ket-noi-WiFi.cmd**, chấp nhận quyền Windows. Chỉ mở hai cổng trong mạng nội bộ với cấu hình mạng **Private**. Nếu Wi-Fi đang là Public, đổi mạng tin cậy của công ty sang Private trong Cài đặt mạng Windows.
6. Trong Thu Chi → Công nợ phải trả → Kết nối app Kho, chọn file `%APPDATA%\VinhKhangWarehouse\data\finance-sync.json`. Bấm **Đồng bộ từ kho**. Các nguồn cũ được cập nhật đường dẫn, không tạo thêm nguồn trùng. Mở Kho trước và chờ vài giây để file được cập nhật.
7. Trong từng app, đăng nhập Admin → Kết nối máy chủ → **Hiện mã để kết nối laptop**. Sao chép mã của Kho và mã của Thu Chi riêng biệt. Chọn địa chỉ Wi-Fi của máy bàn nếu có nhiều địa chỉ.

## 2. Kết nối laptop

1. Cài đúng hai phiên bản trên laptop. Dữ liệu riêng đang có vẫn được giữ lại.
2. Mở Kho → **Kết nối máy chủ** → **Laptop — kết nối máy chủ** → dán mã của Kho → **Kiểm tra kết nối** → **Lưu và mở lại app**.
3. Làm tương tự với Thu Chi bằng mã Thu Chi.
4. Đăng nhập bằng tài khoản đang có trên máy bàn. Góc dưới app hiển thị **Dữ liệu chung** và địa chỉ máy chủ.
5. Thử thêm một bản ghi nhỏ rồi kiểm tra máy còn lại: bảng đang xem tự cập nhật khoảng 2 giây khi không mở form hoặc chọn dòng. Biểu mẫu đang nhập được giữ nguyên; sau khi lưu, app đọc lại dữ liệu chung.

## Khi sử dụng

- Giữ cả hai app trên máy bàn mở; máy bàn không ngủ trong giờ làm việc. Đóng app Kho sẽ ngắt các laptop dùng Kho; Thu Chi tương tự.
- Mất Wi-Fi hoặc máy chủ tắt: laptop dừng ghi, không tự chuyển sang dữ liệu riêng. Nếu thông báo mất kết nối sau khi bấm Lưu, kiểm tra chứng từ trước khi nhập lại, vì máy chủ có thể đã ghi xong.
- Khi máy chủ mở lại, đăng nhập lại nếu phiên cũ hết hiệu lực. Nếu địa chỉ máy bàn đổi, lấy mã mới. Có thể đặt cố định địa chỉ máy bàn trong router để ít phải đổi mã.
- Sao lưu/khôi phục database chung trên máy bàn. Chuyển về **Dùng dữ liệu riêng** chỉ đổi nơi kết nối; không sao chép hoặc gộp hai database.
- Kho ↔ Thu Chi vẫn dùng nghiệp vụ **Đồng bộ từ kho** và đối chiếu thay đổi. Dữ liệu của từng app được dùng chung giữa hai máy; việc ghi công nợ từ Kho vẫn qua nút đồng bộ, không tự tạo phiếu chi.
- Hai máy phải dùng cùng phiên bản của từng app. Bộ cài Kho này chỉ cung cấp cục bộ theo yêu cầu; không phát hành Kho lên GitHub.

Bản sao trong thư mục này là dữ liệu tại thời điểm ghi ở `kiem-tra-file.json`. Nếu tiếp tục nhập thêm trước lúc chuyển máy, tạo lại sao lưu mới rồi chuyển để không thiếu giao dịch.
