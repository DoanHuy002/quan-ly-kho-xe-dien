import ctypes,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
k=ctypes.WinDLL('kernel32',use_last_error=True)
k.BeginUpdateResourceW.argtypes=[ctypes.c_wchar_p,ctypes.c_bool];k.BeginUpdateResourceW.restype=ctypes.c_void_p
k.UpdateResourceW.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_ushort,ctypes.c_void_p,ctypes.c_uint];k.UpdateResourceW.restype=ctypes.c_bool
k.EndUpdateResourceW.argtypes=[ctypes.c_void_p,ctypes.c_bool];k.EndUpdateResourceW.restype=ctypes.c_bool
output=json.loads((root/'electron-builder.usb.json').read_text())['directories']['output']
f=str(root/output/'win-unpacked/resources/runtime/bin/java.exe');h=k.BeginUpdateResourceW(f,False);assert h,ctypes.get_last_error()
b=(root/'desktop/java-usb.manifest').read_bytes();buf=ctypes.create_string_buffer(b);assert k.UpdateResourceW(h,24,1,1033,buf,len(b)),ctypes.get_last_error();assert k.EndUpdateResourceW(h,False),ctypes.get_last_error()
