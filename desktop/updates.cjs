const fs = require('fs');
const path = require('path');

function githubConfig(value) {
  const url = String(value?.url || '').trim().replace(/\/$/, '').replace(/\.git$/, '');
  if (!url) return null;
  const match = /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9_.-]{1,100})$/.exec(url);
  if (!match || ['.', '..'].includes(match[2])) throw Error('Anh nhập link kho GitHub dạng https://github.com/tai-khoan/ten-kho.');
  return { url: `https://github.com/${match[1]}/${match[2]}`, owner: match[1], repo: match[2] };
}

class UpdateManager {
  constructor({ updater, version, packaged, dataDir, defaults, authorize, prepareInstall, notify, testFeed, makeBackup, validateBackup }) {
    Object.assign(this, { updater, packaged, dataDir, authorize, prepareInstall, notify, testFeed, makeBackup, validateBackup });
    this.file = path.join(dataDir, 'updates.json');
    this.busy = false;
    this.backupTicket = null;
    this.downloaded = false;
    this.state = { status: 'unconfigured', currentVersion: version, version: '', percent: 0, message: '', notes: '', checkedAt: '', githubUrl: '', packaged, backupReady: false, backupAt: '', backupFile: '' };
    try {
      const config = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : defaults;
      this.configure(githubConfig(config));
    } catch { this.state.message = 'Cấu hình cập nhật chưa hợp lệ. Admin hãy kiểm tra lại link GitHub.'; }
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.disableWebInstaller = true;
    updater.disableDifferentialDownload = true;
    updater.on('checking-for-update', () => this.set({ status: 'checking', message: '' }));
    updater.on('update-available', info => this.set({ status: 'available', version: info.version, notes: this.notes(info.releaseNotes), message: '' }));
    updater.on('update-not-available', () => this.set({ status: 'current', version: '', notes: '', percent: 0, checkedAt: new Date().toISOString(), message: 'Anh đang dùng phiên bản mới nhất.' }));
    updater.on('download-progress', info => this.set({ status: 'downloading', percent: Math.max(0, Math.min(100, Math.round(info.percent))), message: '' }));
    updater.on('update-downloaded', info => { this.downloaded = true; this.set({ status: 'downloaded', version: info.version, percent: 100, message: 'Đã tải xong. Anh có thể lưu công việc rồi cài bản mới.' }); });
    updater.on('error', () => this.set({ status: 'error', message: (this.busy === 'install' || this.state.status === 'installing') ? 'Chưa cài được bản mới. Anh đóng và mở lại app rồi thử lại; dữ liệu vẫn được giữ.' : 'Chưa cập nhật được. Anh kiểm tra Internet, link GitHub và bản phát hành rồi thử lại.' }));
  }
  notes(value) { return (Array.isArray(value) ? value.map(x => x.note || '').join('\n') : String(value || '')).slice(0, 4000); }
  set(values) { if (values.version !== undefined && values.version !== this.state.version) { this.backupTicket=null; Object.assign(this.state,{backupReady:false,backupAt:'',backupFile:''}); } Object.assign(this.state, values); this.notify?.(this.snapshot()); }
  snapshot() { if (this.backupTicket && Date.now()-this.backupTicket.time>30*60*1000) {this.backupTicket=null;this.state.backupReady=false;} return { ...this.state, busy: !!this.busy, downloaded: this.downloaded }; }
  configure(config) {
    this.config = config;
    if (config) this.updater.setFeedURL({ provider: 'github', owner: config.owner, repo: config.repo, private: false });
    if (this.testFeed) this.updater.setFeedURL({ provider: 'generic', url: this.testFeed });
    this.state.githubUrl = config?.url || '';
    this.state.status = config || this.testFeed ? 'idle' : 'unconfigured';
  }
  async save(request) {
    await this.authorize(request.token, true);
    if (this.busy || this.downloaded) throw Error('Không đổi nơi cập nhật trong lúc đang tải hoặc đã có bản chờ cài.');
    const config = githubConfig(request);
    if (!config) throw Error('Anh nhập link kho GitHub trước khi lưu.');
    // Write a full replacement atomically; never store GitHub credentials in a client.
    const temp = this.file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(config, null, 2));
    fs.renameSync(temp, this.file);
    this.configure(config);
    this.set({ version: '', percent: 0, notes: '', message: 'Đã lưu nơi cập nhật.', checkedAt: '' });
    return this.snapshot();
  }
  requireReady() {
    if (!this.config && !this.testFeed) throw Error('Chưa gắn kho phát hành. Admin hãy nhập link GitHub.');
    if (!this.packaged && !this.testFeed) throw Error('Bản chạy từ project chỉ xem cấu hình. Anh cài bằng bộ cài để nhận cập nhật.');
  }
  async check(token, automatic = false) {
    if (!automatic) await this.authorize(token, false);
    if (this.busy || this.downloaded) return this.snapshot();
    this.requireReady(); this.busy = 'check';
    try { await this.updater.checkForUpdates(); this.set({ checkedAt: new Date().toISOString() }); }
    catch (e) { this.set({ status: 'error', message: 'Không kiểm tra được bản mới. Anh kiểm tra Internet hoặc nơi phát hành; app vẫn dùng bình thường.' }); }
    finally { this.busy = false; this.set({}); }
    return this.snapshot();
  }

  requireBackup(token){
    const ticket=this.backupTicket;
    if(!ticket||ticket.token!==token||ticket.version!==this.state.version||Date.now()-ticket.time>30*60*1000||!this.validateBackup?.(ticket.record)){
      this.backupTicket=null;this.set({backupReady:false,backupFile:'',backupAt:''});throw Error('Anh phải sao lưu và lưu bản riêng thành công trước khi cập nhật.');
    }
  }
  async backup(token){
    await this.authorize(token,true);this.requireReady();
    if(this.busy)throw Error('App đang xử lý cập nhật.');if(!this.state.version)throw Error('Anh kiểm tra bản mới trước khi sao lưu cập nhật.');
    this.busy='backup';this.backupTicket=null;this.set({backupReady:false,backupFile:'',backupAt:'',message:'Đang sao lưu dữ liệu…'});
    try{const record=await this.makeBackup(token);if(record.canceled){this.set({message:'Chưa lưu bản sao riêng. Anh cần sao lưu lại trước khi cập nhật.'});return this.snapshot();}if(!this.validateBackup?.(record))throw Error('Bản sao lưu không đầy đủ');this.backupTicket={token,version:this.state.version,time:Date.now(),record};this.set({backupReady:true,backupAt:new Date().toISOString(),backupFile:record.exported,message:'Đã sao lưu và lưu bản riêng. Anh có thể tiếp tục cập nhật.'});}
    catch{this.set({backupReady:false,message:'Sao lưu chưa thành công. App chưa được cập nhật; anh thử sao lưu lại.'});}
    finally{this.busy=false;this.set({});}return this.snapshot();
  }

  async download(token) {
    await this.authorize(token, true); this.requireReady();
    if (this.busy || this.downloaded) return this.snapshot();
    if (!this.state.version) throw Error('Anh kiểm tra phiên bản mới trước khi tải.');
    this.requireBackup(token);
    this.busy = 'download'; this.set({ status: 'downloading', percent: 0, message: '' });
    try { await this.updater.downloadUpdate(); }
    catch { this.set({ status: 'error', message: 'Tải bản mới chưa thành công hoặc file không qua kiểm tra. Anh thử tải lại; chưa có thay đổi nào với app và dữ liệu.' }); }
    finally { this.busy = false; this.set({}); }
    return this.snapshot();
  }
  async install(token) {
    await this.authorize(token, true); this.requireReady();
    if (this.busy) throw Error('App đang xử lý cập nhật. Anh chờ hoàn tất.');
    if (!this.downloaded) throw Error('Bản mới chưa tải xong hoặc chưa qua kiểm tra.');
    this.requireBackup(token);
    this.busy = 'install'; this.set({ status: 'installing', message: 'Đang đóng dữ liệu và sao lưu trước khi cài bản mới…' });
    try {
      await this.prepareInstall();
      // electron-updater launches the installer before app.quit(), so the database
      // must be closed and its backup finished BEFORE calling quitAndInstall.
      this.updater.quitAndInstall(false, true);
    } catch { this.set({ status: 'error', message: 'Chưa thể sao lưu / đóng dữ liệu để cài. App chưa được cập nhật. Anh đóng và mở lại app rồi thử lại.' }); }
    finally { this.busy = false; this.set({}); }
    return this.snapshot();
  }
}
module.exports = { UpdateManager, githubConfig };
