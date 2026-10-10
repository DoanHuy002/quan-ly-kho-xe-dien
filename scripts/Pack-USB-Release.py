from pathlib import Path
import zipfile,json,hashlib,shutil
root=Path(__file__).resolve().parent.parent
config=json.loads((root/'electron-builder.usb.json').read_text(encoding='utf-8'))
version=config['extraMetadata']['version'];src=root/config['directories']['output']/'win-unpacked';out=root/('outputs/QLK-VK-USB-'+version);out.mkdir(parents=True,exist_ok=True)
shutil.copy2(out/'HUONG-DAN.txt',src/'HUONG-DAN.txt')
assert not (src/'Du-lieu').exists()
files=[f for f in src.rglob('*') if f.is_file()];target=out/('QLK-VK-USB-'+version+'.zip')
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in files:z.write(f,Path('QLK VK USB')/f.relative_to(src))
with zipfile.ZipFile(target) as z:assert z.testzip() is None
with target.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
m={'schema':1,'kind':'vinhkhang-usb','arch':'x64','version':version,'url':f'https://github.com/DoanHuy002/quan-ly-kho-xe-dien/releases/download/usb-v{version}/{target.name}','bytes':target.stat().st_size,'unpackedBytes':sum(f.stat().st_size for f in files),'sha256':digest,'files':sorted(f.name for f in src.iterdir()),'notes':'Phát lệnh trừ linh kiện; nhập xe từng đợt theo tiến độ; khôi phục bản ghi có xem ảnh hưởng tồn kho; trả linh kiện lỗi theo phiếu nhập gốc. Giữ dữ liệu, sao lưu trước cập nhật.'}
(out/'usb-update.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8');print('USB ZIP/manifest verified:',out,flush=True)
