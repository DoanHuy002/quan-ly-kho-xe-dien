# Giá nhập gần nhất và công nợ nhà cung cấp

Bản Kho 0.0.16; bản Thu Chi 1.1.4.

## Nhập kho

1. Vào Nhập / xuất linh kiện → Tạo mới → Nhập kho.
2. Chọn nhà cung cấp nếu muốn nhận công nợ bên Thu Chi.
3. Chọn linh kiện, mẫu xe và màu nếu có. App gợi ý giá của phiếu nhập đã ghi sổ gần nhất có giá cho đúng linh kiện/biến thể; bỏ qua phiếu nháp, phiếu đã hủy và điều chỉnh tồn.
4. Kiểm tra giá. Giá thay đổi thì sửa trên phiếu đang tạo; giá của các phiếu khác giữ nguyên.
5. Chưa biết giá: bấm Chưa biết giá hoặc xóa ô giá. App lưu là chưa có giá, khác với giá 0 đồng. Lưu và Ghi sổ để nhận hàng vào kho.

## Bổ sung sau

Admin mở phiếu nhập đã ghi sổ → Sửa, điền giá còn thiếu và lý do → Lưu. Có thể bổ sung sau khi đã xuất hoặc dùng linh kiện. App không thay số lượng tồn và không sửa giá vốn đã lưu trên các phiếu xuất hay báo cáo cũ. Với giá đã biết và đã phát sinh giao dịch sau đó, giữ phiếu cũ; lô mới dùng phiếu nhập mới.

## Đồng bộ Thu Chi

Mở app Kho để cập nhật file kết nối. Trong Thu Chi, mục Kết nối app Kho → Đồng bộ từ kho. Nếu chưa kết nối, chọn finance-sync.json trong thư mục dữ liệu Kho qua nút Kết nối app Kho.

Phiếu phải đã ghi sổ, có nhà cung cấp và đủ giá cho mọi dòng mới được tính công nợ. Phiếu thiếu giá chưa tạo nợ. Bổ sung đủ rồi đồng bộ sẽ tạo một khoản nợ cho đúng phiếu. Đồng bộ lặp lại không cộng trùng; không tự tạo phiếu chi hoặc thay các khoản thanh toán.

Kết nối dùng file dữ liệu trên máy. Nếu hai app ở hai máy khác nhau, cần chuyển bản finance-sync.json mới và kết nối tới file đó; đây không phải đồng bộ qua Internet.

## Cài bản mới

Sao lưu trước khi cài đè. Bộ cài không kèm dữ liệu thử. Không xóa thư mục dữ liệu. Với USB, giải nén thư mục mới và chép nguyên Du-lieu từ bản cũ sang cùng cấp QLK VK USB.exe.
