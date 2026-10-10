# Xóa dữ liệu có chọn mục

Đăng nhập Admin → Xóa dữ liệu ở thanh bên → chọn mục → Xem dữ liệu sẽ xóa.

Danh sách xem trước gồm cả dữ liệu liên quan do ràng buộc giữa các bảng. Đọc hết danh sách trước khi tiếp tục. Các phiếu, tồn kho, sản xuất và xe của Kho được xử lý cùng nhau để không lệch tồn. Có thể giữ lại danh mục linh kiện, mẫu xe và BOM nếu chỉ chọn giao dịch.

Nhập lý do, mật khẩu Admin và XOA DU LIEU → Sao lưu và xóa hẳn dữ liệu đã chọn. Xóa bằng câu lệnh DELETE trong transaction; không phải chỉ ẩn bản ghi. Giữ cấu trúc database và số thứ tự để tránh trùng mã liên kết khi đồng bộ. App tự sao lưu trước khi xóa; nếu không tạo được sao lưu, thao tác dừng. Sau khi xóa, lưu lại đường dẫn bản sao lưu rồi tải lại app. Nếu chọn tài khoản, đăng ký Admin mới.

Máy chạy riêng: chỉ xóa database của app trên máy đó. Máy kết nối dữ liệu chung: xóa trên máy giữ database, ảnh hưởng tất cả máy kết nối. Muốn xóa database cục bộ cũ của laptop thì chuyển về chế độ Dùng riêng trước, kiểm tra đúng database và đăng nhập Admin cục bộ rồi thực hiện. Không xóa database đang dùng chung nếu chỉ muốn dọn dữ liệu riêng của laptop.

Thực hiện riêng trong Kho và Thu Chi nếu cần làm sạch cả hai. Dọn dữ liệu Kho trước rồi Thu Chi để tránh đồng bộ đưa phiếu cũ trở lại. Không xóa bộ cài, cấu hình kết nối, mã kết nối máy, lịch sử migration hoặc bản sao lưu. Bản sao lưu vẫn chứa dữ liệu trước khi xóa và được quản lý riêng trong mục sao lưu.

Nếu có dữ liệu mới sau lúc xem trước, app yêu cầu xem lại. Chức năng chỉ dành cho Admin, kiểm tra mật khẩu hiện tại và khóa thử lại 5 phút sau nhiều lần sai mật khẩu. Không tự thực hiện xóa khi nâng cấp app.
