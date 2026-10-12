# Sao lưu từng mục — Kho 0.0.25

## Chuyển danh sách đại lý sang máy khác

1. Máy đang có dữ liệu: vào **Các đại lý → Đại lý → Sao lưu đại lý**.
2. Chọn nơi lưu file `.vkbackup` trên ổ D hoặc USB; chuyển file sang máy khác.
3. Máy nhận: cập nhật Kho lên 0.0.25 trở lên, đăng nhập Admin, vào **Các đại lý → Đại lý → Khôi phục đại lý**.
4. Chọn file, xem số bản ghi sẽ thêm và bản ghi đã có, bấm **Xác nhận khôi phục**.

Khôi phục chỉ thêm mã chưa có; thông tin trùng mã trên máy nhận được giữ nguyên. Mã đã xóa trên máy nhận phải được xử lý trong mục khôi phục đã xóa trước. Tài khoản, mật khẩu và cấu hình kết nối máy chủ không nằm trong file này.

## Các mục hỗ trợ

Đại lý, Nhà xe VC, Nhà cung cấp, Mẫu xe, Linh kiện, Định mức BOM, Nhập/xuất linh kiện, Tồn kho, Sản xuất/lắp ráp, Nhập xe, Xuất hàng, Báo cáo kho, Báo cáo doanh số.

Linh kiện mang theo mẫu xe và cấu hình màu liên quan. BOM mang theo mẫu xe, linh kiện và cấu hình màu. File danh mục không mang theo số dư tồn kho.

Giao dịch, sản xuất, xe, doanh số và tồn kho liên quan chặt chẽ: sao lưu ở các mục này chuyển cả nhóm nghiệp vụ và danh mục đi kèm, không tách một phiếu khỏi lịch sử tồn. Chỉ khôi phục vào máy chưa có giao dịch/tồn kho; app chặn việc gộp hai kho và chặn danh mục cùng mã nhưng khác thông tin. Màn hình xem trước hiển thị các bảng và số bản ghi đi kèm.

Muốn chuyển nguyên dữ liệu, gồm tài khoản, nhật ký và lịch sử khôi phục mục đã xóa: dùng **Sao lưu dữ liệu → Tạo bản sao lưu / Khôi phục dữ liệu** như trước.

App tự tạo bản sao dữ liệu máy nhận trước mỗi lần khôi phục. File lỗi, sai mục, thiếu liên kết hoặc tồn không khớp lịch sử bị từ chối. Khôi phục chạy trong một giao dịch: lỗi giữa chừng không để lại dữ liệu nhập dở. Bản xem trước không ghi dữ liệu nghiệp vụ vào máy nhận.

## Máy dùng chung dữ liệu qua Wi-Fi

Sao lưu từng mục đọc/ghi dữ liệu của máy chủ đang kết nối. Nếu chỉ muốn nhập vào dữ liệu riêng của một máy, kiểm tra màn hình kết nối và chọn dữ liệu riêng trước khi khôi phục. Khôi phục từng mục không thay cấu hình kết nối.
