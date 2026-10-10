## 0.0.16
- Gợi ý giá nhập gần nhất theo đúng linh kiện, mẫu xe và màu; mỗi phiếu lưu giá riêng.
- Để trống giá khi nhập kho; bổ sung giá còn thiếu sau khi đã có giao dịch, giữ số lượng và giá trên phiếu khác.
- Công nợ Thu Chi chỉ nhận phiếu có đủ giá và nhà cung cấp, chặn nhập trùng.

## 0.0.15
- Nhà máy nhập đơn giá linh kiện và xe khi nhập kho.
- Tất cả ô tiền tự thêm dấu chấm hàng nghìn; giữ giá trị số đúng khi lưu và tính báo cáo.

## 0.0.14
- Sửa khôi phục bản sao lưu có cấu trúc dữ liệu mới: kiểm tra theo các phiên bản được đóng gói cùng app.
- Sửa hiển thị tiếng Việt trong lỗi kiểm tra bản sao lưu.

# 0.0.13

Thêm Nhập Excel và Tải mẫu Excel cho Linh kiện/BOM. Xem trước, báo lỗi từng dòng, tự đặt mã LK, giữ BOM và lệnh cũ, không ghi tồn kho. Kiểm tra danh mục lại trước lưu và nhập nguyên file trong một giao dịch.

## 0.6.4
- Xuất linh kiện ẩn nhà cung cấp; xuất nội bộ ẩn giá bán/tham khảo, vẫn ghi giá vốn tự động.
- Tạo linh kiện ngay trong phiếu nhập, giữ nội dung đang điền.
- Xe quản lý trong Tồn kho; bỏ mục Xe thành phẩm ở thanh bên.
- Tài khoản Nhà máy/Cửa hàng hiển thị chức năng phù hợp; tài khoản cũ chọn loại sau cập nhật, giữ dữ liệu.

## 0.6.3
- Tách Tồn kho xe và Tồn kho linh kiện; gộp xe theo mẫu/màu/dòng và có chi tiết số khung/số máy.
- Chọn tất cả và xuất Excel tồn riêng từng bảng; giữ thao tác sửa/xóa linh kiện theo quyền.
- Bỏ nút Thêm ở danh mục Linh kiện; tạo mã từ bảng tồn linh kiện. Đổi các nút Thêm còn lại thành Tạo mới.

## 0.6.2
- Đổi Xuất xe thành Xuất hàng; ba loại khách, nội bộ và khách nhận ký gửi.
- Nội bộ/ký gửi chỉ xuất kho, không tính báo cáo doanh số, chặn thêm thủ công; phiếu in và Excel thể hiện loại xuất.
- Bỏ nút Thêm ở Xe thành phẩm; giữ dữ liệu cũ và sao lưu/khôi phục.

## 0.6.1
- Giá nhập xe, giá vốn bình quân linh kiện và giá vốn giữ theo thời điểm xuất; tính giá vốn lắp ráp.
- Phiếu in xe ẩn giá và thành tiền, gộp xe Thương Mại cùng mẫu/màu.
- Xuất bán tự tạo báo cáo; chiết khấu/hỗ trợ đại lý và vận chuyển công ty/khách ngay trên phiếu.
- Báo cáo doanh số, doanh thu, lợi nhuận và số lượng TM/ĐK/LK; sao lưu/khôi phục và nâng cấp dữ liệu cũ.

## 0.6.0
- Báo cáo doanh số Khách cửa hàng / Đại lý / Tổng hợp 3 khu vực, TM/ĐK/LK, giá xuất xưởng và lãi/lỗ.
- Lịch sử thanh toán, CSKH, công nợ, tuổi nợ; quyền admin, chặn thu vượt nợ và ghi nhật ký sửa/hủy.
- Excel theo lựa chọn, PDF/in, bảo vệ phiếu kho gắn doanh số; sao lưu/khôi phục dữ liệu tài chính.

## 0.5.9
- Thêm Khôi phục dữ liệu: admin chọn file ZIP, kiểm tra tính hợp lệ, xác nhận thay dữ liệu và tài khoản.
- Tạo bản sao lưu ZIP trước khôi phục; tự quay lại dữ liệu cũ nếu lỗi hoặc gián đoạn.
- Giữ nguyên cập nhật bắt buộc sao lưu; không có chức năng Gmail.

## 0.5.8

- Phiếu in/PDF gộp xe Thương Mại cùng mẫu, màu và đơn giá thành một dòng; cộng đúng số lượng yêu cầu, thực xuất và thành tiền.
- Xe Đăng Kiểm vẫn hiển thị từng xe với số khung/số máy.

## 0.5.7

- Máy cài mới tự tạo quản trị đầu tiên và nhận mã khôi phục riêng; không có tài khoản quản trị mặc định hoặc file thiết lập riêng.
- Quản trị tạo thêm người dùng trong mục Tài khoản.
- Bắt buộc quản trị sao lưu và lưu file thành công trước khi tải/cài bản cập nhật. Hủy hoặc lỗi sao lưu chặn cập nhật.
- Máy đã có dữ liệu giữ nguyên tài khoản và dữ liệu khi cập nhật.

## 0.5.6

- Bộ cài công khai không chứa thông tin đăng nhập quản trị cố định.
- Máy cài mới có thể nhận thiết lập quản trị từ file nội bộ do công ty cung cấp riêng, chỉ áp dụng trước khi khởi tạo dữ liệu.
- Xóa file cấu hình tạm sau khi khởi tạo thành công; cập nhật không ghi đè tài khoản hoặc dữ liệu đang có.

## 0.5.5

- Máy cài mới khởi tạo thêm tài khoản quản trị thứ hai theo yêu cầu.
- Chỉ tạo ở lần khởi tạo dữ liệu đầu tiên; cập nhật và mở lại không tạo lại hay ghi đè tài khoản, mật khẩu và mã khôi phục đã đổi.
- Mã khôi phục ban đầu dùng một lần; giữ nguyên chức năng đổi mật khẩu và tạo mã mới.

## 0.5.4

- Đổi màn hình đăng nhập và khôi phục mật khẩu sang xanh dương nhạt đồng nhất với logo và thanh bên.
- Nút, chữ nhấn và ô nhập dùng cùng tông xanh dương; giữ nguyên chức năng.

## 0.5.3 — 04/10/2026

- Chọn tất cả/từng dòng trong các bảng và dòng đang nhập; xuất Excel đúng lựa chọn và chi tiết liên quan.
- Xóa nhiều dòng có xác nhận, lý do và quyền; rollback cả batch khi một dòng bị chặn, kể cả đảo tồn vật tư.
- Chọn tất cả xe đúng dòng xe; sao lưu hỗ trợ lưu nhiều bản và chuyển các bản xóa vào thư mục có thể tìm lại.

## 0.5.2 — 04/10/2026

- Mục Sao lưu dữ liệu: tạo ZIP nhất quán bằng H2 BACKUP, liệt kê các bản thủ công/tự động, mở thư mục và lưu một bản riêng ra ổ D/USB.
- Quyền admin; bản trên máy được giữ khi hủy hộp thoại lưu ngoài. Đã kiểm tra phục hồi kho và tài khoản từ ZIP trong hồ sơ thử riêng.

## 0.5.1 — 04/10/2026

- Lịch tiếng Việt; thương hiệu Quản lý kho thông minh; hai dòng xe Thương Mại / Xe Đăng Kiểm khi nhập và xuất.
- Xe Thương Mại không có số khung/số máy, hỗ trợ nhập số lượng. Migration V5 giữ xe cũ là Xe Đăng Kiểm.

## 0.5.0 — 04/10/2026

- Phiếu xuất bán hàng: một hoặc nhiều xe; khách hàng/điện thoại/địa chỉ, ngày và mã phiếu, lý do xuất, phụ kiện, người giao/nhận và thủ kho.
- Số lượng yêu cầu, thực xuất theo xe, đơn giá và tổng tiền. Thông tin xe được lưu tại thời điểm xuất.
- Xem/in A4 qua hộp thoại máy in Windows hoặc lưu PDF, tự chia nhiều trang và lặp đầu bảng.
- Schema V4 nâng cấp phiếu cũ; sửa/hủy đảo tồn và lưu lịch sử theo quyền hiện có; thêm thông tin xuất Excel.

## 0.4.1 — 03/10/2026

- Thanh menu xanh dương nhạt theo tông logo Vĩnh Khang; chữ và mục đang chọn rõ hơn.
## 0.4.0 — 03/10/2026

- Màn hình Cập nhật: kiểm tra phiên bản, nội dung, tiến độ tải, tải lại và cài sau xác nhận.
- GitHub public Releases; cấu hình gắn sẵn vào bộ cài hoặc admin đổi link từng máy.
- Đóng/sao lưu database trước khi mở bộ cài; chặn cài khi tải hỏng hoặc chuẩn bị dữ liệu lỗi.
- Không tự tải/cài, không hạ phiên bản hoặc dùng prerelease.
- Script gắn kho phát hành; build không tự publish.

## 0.3.0 — 02/10/2026

- Nút mắt cho mật khẩu; đổi mật khẩu mọi vai trò; mã khôi phục offline dùng một lần; admin đặt lại tài khoản khác và thu hồi phiên.
- Logo Vĩnh Khang từ ảnh cung cấp trên UI và biểu tượng Windows/bộ cài.
- Phiếu nhập xe máy điện, sửa thông tin, hủy khi xe còn trong kho; chi tiết mẫu/màu/số khung/số máy.
- Xuất Excel từng mục hoặc toàn bộ, gồm chi tiết giao dịch và định mức, giữ số 0 đầu, không xuất bí mật.
- Flyway V3 giữ dữ liệu V1/V2; sao lưu trước khởi động tiếp tục hoạt động.

# 0.2.0

- Nút Thêm ở đầu bảng; Sửa/Xóa trên từng dòng.
- Form sửa nạp dữ liệu hiện có; mật khẩu mới tùy chọn.
- Xóa có xác nhận, lý do, kiểm tra quyền và ràng buộc nghiệp vụ.
- Sửa/hủy phiếu cập nhật tồn theo transaction; hủy sản xuất và xuất xe có đảo dữ liệu liên quan.
- Thêm xe thành phẩm có sẵn, chỉnh tồn có lý do, ghi chú/ẩn nhật ký.
- Audit snapshot trước/sau, báo cáo net sau sửa/hủy, dữ liệu cũ nâng bằng V2.
- Database WRITE_DELAY=0, bảo vệ cập nhật cuối khi backend bị dừng đột ngột.

