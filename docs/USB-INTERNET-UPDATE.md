# QLK VK USB — cập nhật riêng

Bản USB hiện tại: 0.6.8. Bản cài Windows: 0.6.8. Không đổi appId/data của bản cài Windows khi phát hành USB.

Cấu hình electron-builder.usb.json: extraMetadata.usbPortable=true, extraMetadata.version là phiên bản USB, directories.output riêng; jar backend phù hợp extraResources. Dữ liệu luôn ở Du-lieu cạnh exe; profile đi theo dữ liệu. Java USB có manifest UTF-8 (scripts/Patch-USB-Runtime.py).

Quy trình tạo bản USB tiếp theo:
1. Sửa version/output trong electron-builder.usb.json; sửa backend jar nếu backend thay đổi.
2. npm run package:usb (cần PATH tools/npm.cmd và bộ Node/npm của máy phát triển).
3. Tạo outputs/QLK-VK-USB-<version>/HUONG-DAN.txt; chạy scripts/Pack-USB-Release.py để tạo ZIP và usb-update.json.
4. Kiểm tra bằng dữ liệu riêng: quyền admin, bắt buộc sao lưu, SHA256, giải nén, đóng H2, thay chương trình, mở lại, giữ dữ liệu; lỗi khởi động và phục hồi giao dịch dang dở.
5. Tạo release nháp tag usb-v<version>, pre-release=true, latest=false; chỉ upload ZIP và usb-update.json. Xác minh SHA256 assets rồi công bố, giữ pre-release/latest=false để Windows không nhận nhầm.
6. Kiểm tra app USB nhận manifest thật và GitHub /releases/latest vẫn là bản Windows.

UsbUpdateManager lọc riêng tag usb-v*, kiểm tra kind/version/arch/hash/URL. Backup ticket dùng lại cơ chế token+version+hash+30 phút. Stage chỉ cho phép file chương trình, chặn đường dẫn đi ra ngoài ZIP. Bộ cập nhật chạy ẩn qua Windows WMI trong phiên người dùng, độc lập với job của Electron. Chỉ thay file chương trình đã liệt kê, giữ Du-lieu/Xuat-file/Sao-luu và file cá nhân. Có nhật ký .usb-updates/pending.json, old-program và before-update database. Bản mới xác nhận version/backend sẵn sàng trước khi hoàn tất; thất bại quay lại cả chương trình và database.

USB 0.6.4 chưa có bộ cập nhật này: cần chuyển thủ công một lần sang 0.6.5, chép Du-lieu sau khi đóng app. Không dùng bộ cài NSIS cho USB.

Kiểm tra thực tế 0.6.5: full UI update/restart/data giữ nguyên (kể cả thay đổi sau backup); unit guards; PowerShell archive/rollback/interruption; live GitHub feed và hash. Fixture: work/usb-internet-test-latest.json. Không dùng database của người dùng cho test.
