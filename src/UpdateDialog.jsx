import React, { useEffect, useState } from 'react';

const stateNames = { unconfigured: 'Chưa gắn nơi phát hành', idle: 'Sẵn sàng kiểm tra', checking: 'Đang kiểm tra bản mới…', current: 'Đang dùng bản mới nhất', available: 'Có phiên bản mới', downloading: 'Đang tải bản mới…', downloaded: 'Đã tải xong', installing: 'Đang chuẩn bị cài đặt…', error: 'Chưa hoàn tất cập nhật' };

export default function UpdateDialog({ session, state, onState, onClose }) {
  const [url, setUrl] = useState(state?.githubUrl || '');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState(!state?.githubUrl);
  useEffect(() => { setUrl(state?.githubUrl || ''); }, [state?.githubUrl]);
  const s = state || {};
  const admin=session.role==='ADMIN';
  const busy = working || s.busy || s.status === 'installing';
  async function action(name, extras = {}) {
    setWorking(true); setError('');
    try { const next = await window.warehouse.updates({ action: name, token: session.token, ...extras }); onState(next); if (name === 'configure') setEditing(false); }
    catch (e) { setError(e.message.replace(/^Error invoking remote method '[^']+': Error: /, '')); }
    finally { setWorking(false); }
  }
  return <div className="overlay"><div className="modal update-modal">
    <div className="section-title"><h2>{s.usbPortable?'Cập nhật QLK VK USB':'Cập nhật ứng dụng'}</h2><button type="button" className="ghost" aria-label="Đóng cập nhật" disabled={s.status === 'installing'} onClick={onClose}>✕</button></div>
    <div className="update-body"><div className="update-version"><span>Phiên bản đang dùng</span><strong>{s.currentVersion || '0.4.0'}</strong></div>
    <h3>{stateNames[s.status] || 'Đang tải thông tin…'}</h3>
    {s.version && <p>Phiên bản mới: <b>{s.version}</b></p>}
    {s.message && <p role="status">{s.message}</p>}
    {s.notes && <div className="release-notes"><b>Nội dung bản mới</b><pre>{s.notes}</pre></div>}
    {s.status === 'downloading' && <div className="update-progress"><progress aria-label="Tiến độ tải cập nhật" max="100" value={s.percent || 0}/><b>{s.percent || 0}%</b></div>}
    {error && <div className="alert" role="alert">{error}</div>}
    {s.usbPortable && <p className="notice">Gói cập nhật riêng cho USB. Giữ USB kết nối đến khi app mở lại; dữ liệu trong Du-lieu được giữ nguyên.</p>}
    {!s.githubUrl && <p className="hint">Admin cần gắn kho GitHub phát hành để máy này nhận bản mới.</p>}
    {s.githubUrl && <p className="hint">Nơi phát hành: {s.githubUrl}<br/>{s.checkedAt && 'Kiểm tra gần nhất: ' + new Date(s.checkedAt).toLocaleString('vi-VN')}</p>}
    {!s.packaged && <p className="hint">Anh đang chạy bản phát triển. Cài bằng bộ cài Windows để tải và cài cập nhật.</p>}
    {!!s.version&&<div className="update-backup-step"><h3>1. Sao lưu dữ liệu trước cập nhật</h3><p>Admin phải lưu bản sao dữ liệu thành công trước khi tải hoặc cài bản mới.</p>{s.backupReady?<p role="status">Đã sao lưu: {s.backupFile}</p>:<p>Chưa hoàn tất sao lưu cho lần cập nhật này.</p>}<button disabled={busy||!admin||!s.packaged} onClick={()=>action('backup')}>{s.backupReady?'Sao lưu lại':'Sao lưu và lưu bản riêng'}</button><h3>2. Cập nhật phiên bản</h3></div>}
    {!admin&&<p className="notice">Chỉ quản trị được sao lưu và cài bản cập nhật.</p>}
    <div className="update-buttons">
      <button className="ghost" disabled={busy || !s.githubUrl || s.downloaded || !s.packaged} onClick={() => action('check')}>Kiểm tra cập nhật</button>
      {!!s.version && !s.downloaded && <button disabled={busy || !s.packaged || !admin || !s.backupReady} onClick={() => action('download')}>{s.status === 'error' ? 'Tải lại bản mới' : 'Tải bản mới'}</button>}
      {s.downloaded && <button disabled={busy || !admin || !s.backupReady} onClick={() => action('install')}>Cài bản mới và mở lại</button>}
    </div>
    <p className="hint">Sao lưu có hiệu lực cho phiên bản này trong 30 phút. Trước khi cài, app vẫn đóng dữ liệu và tạo thêm bản sao cuối cùng để giữ cả thay đổi phát sinh trong lúc tải.</p>
    {session.role === 'ADMIN' && <div className="update-settings">
      {!editing && <button className="ghost" disabled={busy || s.downloaded} onClick={() => setEditing(true)}>Đổi nơi phát hành</button>}
      {editing && <form onSubmit={e => { e.preventDefault(); action('configure', { url }); }}><label>Link kho GitHub phát hành<input aria-label="Link kho GitHub phát hành" type="url" required value={url} placeholder="https://github.com/tai-khoan/ten-kho" disabled={busy} onChange={e => setUrl(e.target.value)}/></label><p className="hint">Dùng kho phát hành công khai. Không nhập mật khẩu hay mã truy cập GitHub.</p><button disabled={busy || s.downloaded}>Lưu nơi phát hành</button></form>}
    </div>}
  </div></div></div>;
}
