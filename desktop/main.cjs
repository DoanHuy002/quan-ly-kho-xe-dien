const {Lan}=require('./lan.cjs');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const { UpdateManager } = require('./updates.cjs');
const { UsbUpdateManager, helper: usbHelper, pendingJob: usbPendingJob } = require('./usb-updates.cjs');
let child, closing = false, maintenance = false, activeRequests = 0, data, updates, mainWindow;
const usbMode = require('../package.json').usbPortable === true;
const usbRoot = usbMode ? path.dirname(app.getPath('exe')) : null;
if (usbMode) process.env.VK_DATA_DIR = path.join(usbRoot, 'Du-lieu');
app.setName(usbMode ? 'QLK VK USB' : 'VinhKhangWarehouse');
if (process.env.VK_DATA_DIR) { const profile = path.join(process.env.VK_DATA_DIR, 'profile'); fs.mkdirSync(profile, { recursive: true }); app.setPath('userData', profile); }
let port = Number(process.env.VK_BACKEND_PORT || 18765);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid backend port');
let baseUrl = 'http://127.0.0.1:' + port;
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();
app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });

let lan;
const transport=(...args)=>lan?lan.fetch(...args):fetch(...args);
const localOnly=()=>{if(lan?.client)throw Error('Sao lưu và khôi phục dữ liệu chung thực hiện trên máy chủ.');};
function initializeLan(){lan=new Lan({folder:app.getPath('userData'),product:'warehouse',version:app.getVersion(),port:Number(process.env.VK_LAN_PORT||19765),keytool:()=>app.isPackaged?path.join(process.resourcesPath,'runtime/bin/keytool.exe'):path.join(__dirname,'../runtime/bin/keytool.exe'),backend:()=>baseUrl,headers:()=>({}),authorize:t=>authorize(t,true),maintenance:()=>maintenance,restart:()=>{app.relaunch();app.quit();}});}
ipcMain.handle('connection',(_e,b)=>lan.handle(b));

async function startBackend() {

  const java = app.isPackaged ? path.join(process.resourcesPath, 'runtime/bin/java.exe') : fs.readdirSync('D:/Codex/Tools/java').map(n => path.join('D:/Codex/Tools/java', n, 'bin/java.exe')).find(fs.existsSync);
  const version = require('../package.json').version;
  const jar = app.isPackaged ? path.join(process.resourcesPath, 'backend.jar') : path.join(__dirname, `../backend/target/warehouse-${version}.jar`);
  const sockets = path.join(data, 'sockets'); fs.mkdirSync(sockets, { recursive: true });
  if (fs.existsSync(path.join(data, 'warehouse.mv.db'))) {
    const backups = path.join(data, 'backups'); fs.mkdirSync(backups, { recursive: true });
    fs.copyFileSync(path.join(data, 'warehouse.mv.db'), path.join(backups, 'warehouse-' + Date.now() + '.mv.db'));
  }
  const instance = crypto.randomUUID(), log = fs.openSync(path.join(data, 'backend.log'), 'a');
  child = spawn(java, ['-Djdk.net.unixdomain.tmpdir=' + sockets, '-jar', path.basename(jar)], { cwd: path.dirname(jar), windowsHide: true, env: { ...process.env, VK_DATA_DIR: data, VK_INSTANCE_ID: instance, VK_DESKTOP: 'true', SERVER_PORT: String(port) }, stdio: ['pipe', log, log] });
  fs.closeSync(log);
  let spawnError; child.on('error', e => { spawnError = e; });
  for (let i = 0; i < 90; i++) {
    if (spawnError || child.exitCode !== null) break;
    try { const r = await transport(baseUrl + '/api/health'); if (r.ok) { const h = await r.json(); if (h.instanceId === instance && h.status === 'UP') return; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw Error('Không khởi động được backend. Xem backend.log trong ' + data);
}
function stopBackend(force = false) {
  const current = child;
  if (!current || current.exitCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finished = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { current.removeListener('exit', finished); if (force) { current.kill(); resolve(); } else reject(Error('Database shutdown timeout')); }, 10000);
    current.once('exit', finished);
    current.stdin.end();
  });
}
async function authorize(token, admin) {
  const r = await transport(baseUrl + '/api/me', { headers: { Authorization: 'Bearer ' + (token || '') } });
  if (!r.ok) throw Error('Anh đăng nhập lại để sử dụng chức năng cập nhật.');
  const user = await r.json();
  if (admin && user.role !== 'ADMIN') throw Error('Chỉ admin được thay đổi nơi phát hành cập nhật.');
  return user;
}

async function backupForUpdate(token){
 if(lan?.client)return {clientOnly:true};
 if(maintenance)throw Error('App đang chuẩn bị cập nhật');activeRequests++;
 try{const r=await transport(baseUrl+'/api/backup',{method:'POST',headers:{Authorization:'Bearer '+token}});const result=await r.json();if(!r.ok)throw Error(result.message||'Không sao lưu được');const saved=await exportBackup(path.resolve(result.file));if(saved.canceled)return saved;const hash=crypto.createHash('sha256').update(fs.readFileSync(saved.file)).digest('hex');const record={...saved,hash};if(!validUpdateBackup(record))throw Error('Bản sao lưu chưa đầy đủ');return record;}finally{activeRequests--;}
}
function validUpdateBackup(record){if(lan?.client)return record?.clientOnly===true;try{return [record.file,record.exported].every(file=>fs.statSync(file).isFile()&&fs.statSync(file).size>0&&crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===record.hash);}catch{return false;}}

async function prepareInstall() {
 if(lan?.client){maintenance=true;return "client-program-only";}
  maintenance = true;
  await lan?.idle();
  try {
    for (let i = 0; activeRequests > 0 && i < 150; i++) await new Promise(r => setTimeout(r, 100));
    if (activeRequests > 0) throw Error('Đang có giao dịch chưa hoàn tất');
    await stopBackend(false);
    const backups = path.join(data, 'backups'); fs.mkdirSync(backups, { recursive: true });
    const file = path.join(backups, 'before-update-' + Date.now() + '.mv.db');
    fs.copyFileSync(path.join(data, 'warehouse.mv.db'), file);
    if (fs.statSync(file).size === 0) throw Error('Bản sao lưu rỗng');
    return file;
  } catch (e) {
    maintenance = false;
    // If the backup failed after shutdown, restore a running backend instead of
    // leaving the warehouse in a half-closed state. Its old sessions are revoked.
    if (child?.exitCode !== null) await startBackend().catch(() => {});
    throw e;
  }
}

if (primary) app.whenReady().then(async () => {
  data = process.env.VK_DATA_DIR || (app.isPackaged ? path.join(app.getPath('userData'), 'data') : path.join(__dirname, '../data'));
  fs.mkdirSync(data, { recursive: true });
  initializeLan();
  if (usbMode) {
    try { const probe = path.join(data, '.write-test'); fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe); }
    catch { dialog.showErrorBox('USB không ghi được dữ liệu', 'Anh giải nén toàn bộ thư mục vào USB có quyền ghi rồi mở lại.'); app.quit(); return; }
    if (!process.env.VK_BACKEND_PORT) { port = await new Promise((resolve, reject) => { const server = require('net').createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { const chosen = server.address().port; server.close(() => resolve(chosen)); }); }); baseUrl = 'http://127.0.0.1:' + port; }
  }
  if (usbMode) {
    const pending = usbPendingJob(usbRoot);
    if (pending && path.resolve(process.env.VK_USB_UPDATE_JOB || '.') !== path.resolve(pending)) {
      const job = JSON.parse(fs.readFileSync(pending, 'utf8')); job.parentPid = process.pid; fs.writeFileSync(pending, JSON.stringify(job));
      await usbHelper(pending, 'Recover', true); app.quit(); return;
    }
  }
  const journal=path.join(data,'restore-pending.json');
  if(!lan.client&&fs.existsSync(journal)){const pending=JSON.parse(fs.readFileSync(journal,'utf8'));const saved=path.resolve(pending.previous);if(path.dirname(saved)!==path.join(path.resolve(data),'backups')||!path.basename(saved).startsWith('before-restore-'))throw Error('Nhật ký khôi phục không hợp lệ');fs.copyFileSync(saved,path.join(data,'warehouse.mv.db'));fs.unlinkSync(journal);}
  try { if(!lan.client){await startBackend();await lan.start();} }
  catch (e) { dialog.showErrorBox('Không khởi động được app', e.message); app.quit(); return; }
  if (usbMode && process.env.VK_USB_UPDATE_JOB) {
    const pending = usbPendingJob(usbRoot), jobFile = path.resolve(process.env.VK_USB_UPDATE_JOB);
    if (!pending || path.resolve(pending) !== jobFile) { app.quit(); return; }
    const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
    if (job.version !== app.getVersion()) { app.quit(); return; }
    fs.writeFileSync(path.join(path.dirname(jobFile), 'ready.json'), JSON.stringify({ version: app.getVersion() }));
    for (let i=0; usbPendingJob(usbRoot) && i<100; i++) await new Promise(r=>setTimeout(r,100));
    if (usbPendingJob(usbRoot)) { app.quit(); return; }
    delete process.env.VK_USB_UPDATE_JOB;
  }
  autoUpdater.logger = { info() {}, warn() {}, error() {} };
  updates = new (usbMode ? UsbUpdateManager : UpdateManager)({ root: usbRoot, quit: () => app.quit(), updater: autoUpdater, version: app.getVersion(), packaged: app.isPackaged, dataDir: data, defaults: require('./release-channel.json'), authorize, prepareInstall, makeBackup: backupForUpdate, validateBackup: validUpdateBackup, notify: state => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-state', state); } });
  mainWindow = new BrowserWindow({ width: 1440, height: 940, minWidth: 1060, minHeight: 720, title: usbMode ? 'QLK VK USB · Quản lý kho thông minh' : 'Vĩnh Khang · Quản lý kho thông minh', icon: path.join(__dirname, 'logo.ico'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
  await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  if (app.isPackaged && updates.config && process.env.VK_UPDATE_AUTO_CHECK !== 'false') {
    setTimeout(() => updates.check(null, true).catch(() => {}), 15000).unref();
    setInterval(() => updates.check(null, true).catch(() => {}), 4 * 60 * 60 * 1000).unref();
  }
});

ipcMain.handle('api', async (_e, { route, method, body, token }) => {
  if (!/^\/api\/[a-z0-9/\-]+$/.test(route) || !['GET', 'POST', 'PUT', 'DELETE'].includes(method)) throw Error('Invalid request');
  if (maintenance) return { status: 503, data: { message: 'App đang đóng dữ liệu để cập nhật. Anh chờ cài xong rồi mở lại.' } };
  activeRequests++;
  try {
    const r = await transport(baseUrl + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await r.text(); return { status: r.status, data: text ? JSON.parse(text) : null };
  } finally { activeRequests--; }
});
ipcMain.handle('updates', async (_e, request) => {
  if (!updates) throw Error('App chưa sẵn sàng.');
  if(maintenance)throw Error('App đang xử lý dữ liệu. Anh thử lại sau.');
  switch (request?.action) {
    case 'status': return updates.snapshot();
    case 'configure': return updates.save(request);
    case 'check': return updates.check(request.token);
    case 'backup': return updates.backup(request.token);
    case 'download': return updates.download(request.token);
    case 'install': {
      await authorize(request.token, true);
      if (!updates.downloaded) throw Error('Anh tải bản mới trước khi cài.');
      const answer = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Cài bản cập nhật Vĩnh Khang', message: 'Anh đã lưu xong công việc?', detail: usbMode ? 'App sẽ đóng, sao lưu dữ liệu rồi cập nhật chương trình ngay trên USB. Giữ USB kết nối đến khi app mở lại.' : 'App sẽ đóng, sao lưu dữ liệu và mở bộ cài. Sau khi cài xong, ứng dụng sẽ mở lại.', buttons: ['Cài bản mới', 'Để sau'], defaultId: 1, cancelId: 1 });
      if (answer.response !== 0) return updates.snapshot();
      return updates.install(request.token);
    }
    default: throw Error('Thao tác cập nhật không hợp lệ');
  }
});

async function saveFile(bytes, name, filters) {
  let file;
  if (process.env.VK_TEST_EXPORT_DIR) file = path.join(process.env.VK_TEST_EXPORT_DIR, name);
  else {
    const preferred = usbMode ? path.join(usbRoot, 'Xuat-file') : 'D:/Codex/Downloads'; if (usbMode || fs.existsSync('D:/')) fs.mkdirSync(preferred, { recursive: true });
    const result = await dialog.showSaveDialog({ title: 'Lưu file Vĩnh Khang', defaultPath: fs.existsSync(preferred) ? path.join(preferred, name) : name, filters });
    if (result.canceled) return { canceled: true }; file = result.filePath;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); return { canceled: false, file };
}
ipcMain.handle('exportExcel', async (_e, { entity, token, ids, archived }) => {
  if (!/^[a-z]+$/.test(entity)) throw Error('Mục xuất không hợp lệ');
  if(ids&&(!Array.isArray(ids)||!ids.length||ids.length>1000||ids.some(id=>!Number.isSafeInteger(id)||id<1)))throw Error('Danh sách xuất không hợp lệ');
  const query=ids?'?ids='+encodeURIComponent(ids.join(','))+'&archived='+(archived===true):'';
  const r = await transport(baseUrl + '/api/exports/' + entity + query, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw Error((await r.json()).message);
  return saveFile(Buffer.from(await r.arrayBuffer()), 'vinh-khang-' + entity + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.xlsx', [{ name: 'Excel', extensions: ['xlsx'] }]);
});
ipcMain.handle('printShipment', async (_e, {id,token,mode}) => {
 if(!Number.isSafeInteger(id)||id<1||!['print','pdf'].includes(mode))throw Error('Phiếu hoặc thao tác in không hợp lệ');
 if(maintenance)throw Error('App đang chuẩn bị cập nhật');
 activeRequests++;
 let preview;
 try {
  const r=await transport(baseUrl+'/api/shipment-print/'+id,{headers:{Authorization:'Bearer '+token}});const doc=await r.json();if(!r.ok)throw Error(doc.message||'Không mở được phiếu');
  preview=new BrowserWindow({show:false,width:900,height:950,parent:mainWindow,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});preview.setMenu(null);
  preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  await preview.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(doc.html));
  if(mode==='pdf'){const bytes=await preview.webContents.printToPDF({pageSize:'A4',printBackground:true,preferCSSPageSize:true});return saveFile(bytes,'Phieu-xuat-'+id+'.pdf',[{name:'PDF',extensions:['pdf']}]);}
  preview.show();await new Promise((resolve,reject)=>preview.webContents.print({silent:false,printBackground:true,pageSize:'A4'},(ok,reason)=>ok||reason==='Print job canceled'?resolve():reject(Error(reason||'Không in được phiếu'))));return {canceled:false};
 }finally{if(preview&&!preview.isDestroyed())preview.destroy();activeRequests--;}
});
function backupEntries(){
 const folder=path.join(data,'backups');fs.mkdirSync(folder,{recursive:true});
 const files=[];for(const dir of [folder,data])for(const name of fs.readdirSync(dir)){
  if(!(dir===folder?/^(backup-|before-update-|before-restore-|warehouse-).+\.(zip|mv\.db)$/:/^backup-.+\.zip$/).test(name))continue;
  const file=path.join(dir,name),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())continue;
  files.push({name,file,bytes:stat.size,createdAt:stat.mtime.toISOString(),kind:name.startsWith('before-restore-')?'Tự động trước khôi phục':name.startsWith('before-update-')?'Tự động trước cập nhật':name.startsWith('warehouse-')?'Tự động khi mở app':'Sao lưu ZIP'});
 }return {folder,files:files.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};
}
function knownBackup(file){const record=backupEntries().files.find(f=>f.file===file);if(!record||!record.bytes)throw Error('Bản sao lưu không tồn tại hoặc không hợp lệ');return record;}
async function exportBackup(file){
 const record=knownBackup(file);let destination;
 if(process.env.VK_TEST_EXPORT_DIR)destination=path.join(process.env.VK_TEST_EXPORT_DIR,'VinhKhang-QLK-'+record.name);
 else{
  const preferred=usbMode?path.join(usbRoot,'Sao-luu'):'D:/Codex/Projects/vinhkhang_QLK/backups';let defaultPath='VinhKhang-QLK-'+record.name;
  if(usbMode||fs.existsSync('D:/')){fs.mkdirSync(preferred,{recursive:true});defaultPath=path.join(preferred,defaultPath);}
  const result=await dialog.showSaveDialog(mainWindow,{title:'Lưu bản sao dữ liệu trước cập nhật',defaultPath,filters:[{name:record.name.endsWith('.zip')?'Sao lưu ZIP':'Database H2',extensions:[record.name.endsWith('.zip')?'zip':'db']}]});
  if(result.canceled)return {canceled:true,file};destination=result.filePath;
 }
 fs.mkdirSync(path.dirname(destination),{recursive:true});if(path.resolve(destination)!==path.resolve(file))await fs.promises.copyFile(file,destination);
 if(fs.statSync(destination).size!==record.bytes)throw Error('Bản sao chưa đầy đủ. Anh thử lưu lại.');return {canceled:false,file,exported:destination};
}

async function restoreBackup(token){
 await authorize(token,true);
 if(maintenance)throw Error('App đang xử lý dữ liệu. Anh thử lại sau.');
 const choice=await dialog.showOpenDialog(mainWindow,{title:'Chọn file sao lưu Vĩnh Khang',filters:[{name:'Bản sao lưu ZIP',extensions:['zip']}],properties:['openFile']});
 if(choice.canceled)return {canceled:true};

 await authorize(token,true);if(maintenance)throw Error('App đang xử lý dữ liệu');maintenance=true;await lan?.idle();
 const staging=path.join(data,'restore-'+crypto.randomUUID()),db=path.join(data,'warehouse.mv.db'),journal=path.join(data,'restore-pending.json');let previous,swapped=false;
 try{
  for(let i=0;activeRequests>0&&i<150;i++)await new Promise(r=>setTimeout(r,100));
  if(activeRequests)throw Error('Đang có giao dịch chưa hoàn tất');
  const java=app.isPackaged?path.join(process.resourcesPath,'runtime/bin/java.exe'):fs.readdirSync('D:/Codex/Tools/java').map(n=>path.join('D:/Codex/Tools/java',n,'bin/java.exe')).find(fs.existsSync);
  const jar=app.isPackaged?path.join(process.resourcesPath,'backend.jar'):path.join(__dirname,'../backend/target/warehouse-'+require('../package.json').version+'.jar');
  await new Promise((resolve,reject)=>{const tool=spawn(java,['-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','-jar',jar,'--validate-backup',choice.filePaths[0],staging],{windowsHide:true,env:process.env});let message='';tool.stderr.setEncoding('utf8');tool.stderr.on('data',b=>{message=(message+b).slice(-2000)});tool.on('error',reject);tool.on('close',code=>code===0?resolve():reject(Error(message||'File sao lưu không hợp lệ')));const timer=setTimeout(()=>{tool.kill();reject(Error('Kiểm tra bản sao lưu quá lâu. Anh thử lại.'))},120000);tool.on('close',()=>clearTimeout(timer));});
  const answer=await dialog.showMessageBox(mainWindow,{type:'warning',title:'Xác nhận khôi phục dữ liệu',message:'Thay dữ liệu trên máy bằng bản sao lưu này?',detail:'File: '+path.basename(choice.filePaths[0])+'\nDữ liệu và tài khoản hiện tại sẽ được thay thế. App tự giữ một bản dữ liệu hiện tại để quay lại nếu cần. Sau đó anh đăng nhập bằng tài khoản trong bản sao lưu.',buttons:['Khôi phục dữ liệu','Hủy'],defaultId:1,cancelId:1});
  if(answer.response!==0)return {canceled:true};
  const safetyResponse=await transport(baseUrl+'/api/backup',{method:'POST',headers:{Authorization:'Bearer '+token}});const safety=await safetyResponse.json();if(!safetyResponse.ok)throw Error('Không tạo được bản sao lưu trước khôi phục');
  await stopBackend(false);
  previous=path.join(data,'backups','before-restore-'+Date.now()+'.mv.db');fs.mkdirSync(path.dirname(previous),{recursive:true});fs.copyFileSync(db,previous);
  fs.writeFileSync(journal,JSON.stringify({previous}));swapped=true;
  fs.copyFileSync(path.join(staging,'warehouse.mv.db'),db);
  await startBackend();
  fs.unlinkSync(journal);swapped=false;maintenance=false;
  if(updates){updates.backupTicket=null;updates.downloaded=false;}
  await dialog.showMessageBox(mainWindow,{type:'info',title:'Đã khôi phục dữ liệu',message:'Khôi phục thành công. Anh đăng nhập bằng tài khoản trong bản sao lưu.',detail:'Bản sao lưu dữ liệu trước khôi phục: '+safety.file});
  await mainWindow.reload();return {restored:true};
 }catch(e){
  if(swapped){try{await stopBackend(false);fs.copyFileSync(previous,db);await startBackend();fs.unlinkSync(journal);}catch{throw Error('Chưa khôi phục được. App sẽ quay lại dữ liệu cũ khi mở lại. Bản dữ liệu cũ: '+previous);}}
  else if(child?.exitCode!==null)await startBackend().catch(()=>{});
  throw Error('Không khôi phục được dữ liệu: '+e.message);
 }finally{maintenance=false;for(const name of ['warehouse.mv.db','warehouse.trace.db']){const file=path.join(staging,name);if(fs.existsSync(file))fs.unlinkSync(file);}if(fs.existsSync(staging)&&!fs.readdirSync(staging).length)fs.rmdirSync(staging);}
}

async function resetTransactions(token,confirmation){
 await authorize(token,true);if(confirmation!=='XOA GIAO DICH')throw Error('Nhập XOA GIAO DICH để xác nhận');if(maintenance)throw Error('App đang xử lý dữ liệu');maintenance=true;
 try{
  for(let i=0;activeRequests>0&&i<150;i++)await new Promise(r=>setTimeout(r,100));if(activeRequests)throw Error('Đang có giao dịch chưa hoàn tất');
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const response=await transport(baseUrl+'/api/backup',{method:'POST',headers});const backup=await response.json();if(!response.ok)throw Error(backup.message||'Không sao lưu được');
  const saved=await exportBackup(path.resolve(backup.file));if(saved.canceled)return {canceled:true};
  const r=await transport(baseUrl+'/api/data-reset',{method:'POST',headers,body:JSON.stringify({confirmation})});const result=await r.json();if(!r.ok)throw Error(result.message||'Chưa đặt lại dữ liệu');
  if(updates)updates.backupTicket=null;return {...result,exported:saved.exported};
 }finally{maintenance=false;}
}
async function purgeRecords(request){
 const {token,entity,ids,reason,confirmation,fingerprint}=request;await authorize(token,true);if(confirmation!=='XOA HAN')throw Error('Nhập XOA HAN để xác nhận');if(!/^[a-z]+$/.test(entity))throw Error('Mục không hợp lệ');if(maintenance)throw Error('App đang xử lý dữ liệu');maintenance=true;
 try{for(let i=0;activeRequests>0&&i<150;i++)await new Promise(r=>setTimeout(r,100));if(activeRequests)throw Error('Đang có giao dịch chưa hoàn tất');
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const preview=await transport(baseUrl+'/api/purge/'+entity+'/preview',{method:'POST',headers,body:JSON.stringify({ids})});const plan=await preview.json();if(!preview.ok)throw Error(plan.message||'Không xóa hẳn được');if(plan.fingerprint!==fingerprint)throw Error('Dữ liệu đã thay đổi. Anh xem lại trước khi xóa');
 const response=await transport(baseUrl+'/api/backup',{method:'POST',headers});const backup=await response.json();if(!response.ok)throw Error(backup.message||'Không sao lưu được');const saved=await exportBackup(path.resolve(backup.file));if(saved.canceled)return {canceled:true};
 const r=await transport(baseUrl+'/api/purge/'+entity,{method:'POST',headers,body:JSON.stringify({ids,reason,confirmation,fingerprint})});const result=await r.json();if(!r.ok)throw Error(result.message||'Chưa xóa hẳn dữ liệu');if(updates)updates.backupTicket=null;return {...result,exported:saved.exported};
 }finally{maintenance=false}
}
ipcMain.handle('backups',async(_e,request)=>{
 const {action,token,file,files,reason,confirmation}=request;localOnly();
 if(action==='purgeRecords')return purgeRecords(request);
 if(action==='resetTransactions')return resetTransactions(token,confirmation);
 if(action==='restore')return restoreBackup(token);
 await authorize(token,true);if(maintenance)throw Error('App đang chuẩn bị cập nhật. Anh thử lại sau.');activeRequests++;
 try{
  if(action==='list')return backupEntries();
  if(['exportMany','deleteMany'].includes(action)){
   if(!Array.isArray(files)||!files.length||files.length>1000||new Set(files).size!==files.length)throw Error('Chọn từ 1 đến 1000 bản sao lưu khác nhau');const records=files.map(knownBackup);
   if(action==='exportMany'){
    let folder=process.env.VK_TEST_EXPORT_DIR;
    if(!folder){const preferred=usbMode?path.join(usbRoot,'Sao-luu'):'D:/Codex/Projects/vinhkhang_QLK/backups';if(fs.existsSync('D:/'))fs.mkdirSync(preferred,{recursive:true});const result=await dialog.showOpenDialog(mainWindow,{title:'Chọn thư mục lưu các bản sao lưu',defaultPath:fs.existsSync(preferred)?preferred:undefined,properties:['openDirectory','createDirectory']});if(result.canceled)return {canceled:true};folder=result.filePaths[0];}
    const batch=path.join(folder,'VinhKhang-Sao-luu-'+Date.now()+'-'+crypto.randomUUID().slice(0,8));fs.mkdirSync(batch,{recursive:true});for(const r of records){const destination=path.join(batch,r.name);await fs.promises.copyFile(r.file,destination);if(fs.statSync(destination).size!==r.bytes)throw Error('Bản sao chưa đầy đủ. Các file đã lưu nằm tại '+batch);}return {count:records.length,folder:batch};
   }
   if(typeof reason!=='string'||!reason.trim()||reason.trim().length>400)throw Error('Nhập lý do xóa, tối đa 400 ký tự');
   const folder=path.join(data,'backups','cac-ban-da-xoa',Date.now()+'-'+crypto.randomUUID()),moved=[];fs.mkdirSync(folder,{recursive:true});
   try{for(let i=0;i<records.length;i++){const destination=path.join(folder,i+'-'+records[i].name);await fs.promises.rename(records[i].file,destination);moved.push({from:records[i].file,to:destination});}fs.writeFileSync(path.join(folder,'thong-tin.json'),JSON.stringify({reason:reason.trim(),createdAt:new Date().toISOString(),files:moved},null,2));const r=await transport(baseUrl+'/api/audit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({user_note:'Chuyển '+records.length+' bản sao lưu vào thư mục các bản đã xóa. Lý do: '+reason.trim()})});if(!r.ok)throw Error('Không ghi được nhật ký');return {count:records.length,folder};}
   catch(e){const failed=[];for(const move of moved.reverse()){try{await fs.promises.rename(move.to,move.from)}catch{failed.push(move.to)}}throw Error(failed.length?'Một số bản nằm tại '+folder+'. Anh kiểm tra thư mục này.':'Chưa xóa bản sao lưu nào: '+e.message);}
  }
  if(action==='openFolder'){const result=await shell.openPath(backupEntries().folder);if(result)throw Error('Không mở được thư mục sao lưu');return {};}
  if(action==='export')return await exportBackup(file);
  if(action==='create'){
   const r=await transport(baseUrl+'/api/backup',{method:'POST',headers:{Authorization:'Bearer '+token}});const result=await r.json();if(!r.ok)throw Error(result.message||'Không sao lưu được dữ liệu');
   return await exportBackup(path.resolve(result.file));
  }throw Error('Thao tác sao lưu không hợp lệ');
 }finally{activeRequests--;}
});
ipcMain.handle('saveRecovery', async (_e, { code }) => {
  if (!/^[A-Za-z0-9_-]{32}$/.test(code)) throw Error('Mã không hợp lệ');
  return saveFile('Mã khôi phục Vĩnh Khang (dùng một lần):\n' + code + '\nCất riêng ở nơi an toàn.\n', 'VinhKhang-ma-khoi-phuc.txt', [{ name: 'Văn bản', extensions: ['txt'] }]);
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit',()=>lan?.close());
app.on('before-quit', e => { if (!closing && child && child.exitCode === null) { e.preventDefault(); closing = true; maintenance=true; Promise.resolve(lan?.idle()).then(()=>stopBackend(true)).finally(() => app.quit()); } });
module.exports.getUpdateManager = () => updates;
module.exports.prepareInstall = prepareInstall;

ipcMain.handle('revenueReport',async(_e,request)=>{
 if(maintenance)throw Error('App đang xử lý dữ liệu');if(!['excel','pdf','print'].includes(request.mode))throw Error('Thao tác không hợp lệ');
 activeRequests++;let preview;try{
 const response=await transport(baseUrl+'/api/sales-report/document',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+request.token},body:JSON.stringify({...request,mode:request.mode==='excel'?'excel':'html'})});const doc=await response.json();if(!response.ok)throw Error(doc.message||'Không mở được báo cáo');
 const name='VinhKhang-Doanh-so-'+request.view+'-'+Date.now();if(request.mode==='excel')return saveFile(Buffer.from(doc.bytes,'base64'),name+'.xlsx',[{name:'Excel',extensions:['xlsx']}]);
 preview=new BrowserWindow({show:false,width:1200,height:850,parent:mainWindow,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});preview.setMenu(null);preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));await preview.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(doc.html));
 if(request.mode==='pdf')return saveFile(await preview.webContents.printToPDF({pageSize:'A3',landscape:true,printBackground:true,preferCSSPageSize:true}),name+'.pdf',[{name:'PDF',extensions:['pdf']}]);
 preview.show();await new Promise((resolve,reject)=>preview.webContents.print({silent:false,landscape:true,printBackground:true,pageSize:'A3'},(ok,reason)=>ok||reason==='Print job canceled'?resolve():reject(Error(reason||'Không in được'))));return {canceled:false};
 }finally{if(preview&&!preview.isDestroyed())preview.destroy();activeRequests--;}
});

ipcMain.handle('productionDocument',async(_event,request)=>{
 const {ids,token,options={}}=request||{};
 if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>!Number.isSafeInteger(id)||id<1))throw Error('Chọn từ 1 đến 100 lệnh sản xuất');
 if(maintenance)throw Error('App đang chuẩn bị cập nhật');
 activeRequests++;let preview;
 try{
  const read=async route=>{const r=await transport(baseUrl+'/api/'+route,{headers:{Authorization:'Bearer '+(token||'')}});const d=await r.json();if(!r.ok)throw Error(d.message||'Không đọc được lệnh');return d};
  await authorize(token,false);
  const models=await read('models'),orders=[];
  for(const id of [...ids].sort((a,b)=>a-b)){
   const order=await read('production/'+id),bom=await read('bom/'+order.BOM_ID);
   const model=models.find(m=>m.ID===bom.MODEL_ID);
   if(!model)throw Error('Mẫu xe của lệnh đã ngừng hoạt động');
   for(const line of (order.lines||[{BOM_ID:order.BOM_ID,COLOR:order.COLOR,QUANTITY:order.QUANTITY}])){
    const lineBom=await read('bom/'+line.BOM_ID),lineModel=models.find(m=>m.ID===lineBom.MODEL_ID);
    if(!lineModel)throw Error('Mẫu xe của dòng đã ngừng hoạt động');
    orders.push({...order,COLOR:line.COLOR,QUANTITY:line.QUANTITY,MODEL_CODE:lineModel.CODE,MODEL_NAME:lineModel.NAME});
   }
  }
  const html=require('./production-print.cjs').render(orders,options);
  preview=new BrowserWindow({show:false,parent:mainWindow,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  preview.setMenu(null);preview.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  await preview.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  const bytes=await preview.webContents.printToPDF({pageSize:'A4',printBackground:true,preferCSSPageSize:true});
  return saveFile(bytes,'Lenh-san-xuat-'+ids.join('-')+'.pdf',[{name:'PDF',extensions:['pdf']}]);
 }finally{if(preview&&!preview.isDestroyed())preview.destroy();activeRequests--;}
});

ipcMain.handle('salesTransfer',async(_e,{action,token,ids})=>{
 await authorize(token,true);if(maintenance)throw Error('App đang xử lý dữ liệu');activeRequests++;
 try{
  const folder=path.join(data,'Xuat-hang');
  if(action==='openFolder'){fs.mkdirSync(folder,{recursive:true});const error=await shell.openPath(folder);if(error)throw Error('Không mở được thư mục');return {};}
  if(action==='read'){
   const choice=process.env.VK_TEST_TRANSFER_FILE?{canceled:false,filePaths:[process.env.VK_TEST_TRANSFER_FILE]}:await dialog.showOpenDialog(mainWindow,{title:'Chọn dữ liệu doanh số từ nhà máy',filters:[{name:'Doanh số Vĩnh Khang',extensions:['json']}],properties:['openFile']});if(choice.canceled)return {canceled:true};const file=choice.filePaths[0];const stat=fs.statSync(file);if(!stat.isFile()||stat.size>8*1024*1024)throw Error('File doanh số không hợp lệ hoặc vượt 8 MB');let packet;try{packet=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))}catch{throw Error('File không đúng định dạng dữ liệu doanh số');}return {packet,name:path.basename(file)};
  }
  if(action==='export'){
   const r=await transport(baseUrl+'/api/sales-transfer/export',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({ids})});const text=await r.text();if(!r.ok){let result;try{result=JSON.parse(text)}catch{}throw Error(result?.message||'Không xuất được dữ liệu doanh số');}
   const name='VinhKhang-doanh-so-'+Date.now()+'.json';let destination;
   if(process.env.VK_TEST_EXPORT_DIR){fs.mkdirSync(process.env.VK_TEST_EXPORT_DIR,{recursive:true});destination=path.join(process.env.VK_TEST_EXPORT_DIR,name)}
   else{const preferred=usbMode?path.join(usbRoot,'Xuat-hang'):'D:/Codex/Downloads';fs.mkdirSync(preferred,{recursive:true});const saved=await dialog.showSaveDialog(mainWindow,{title:'Lưu dữ liệu doanh số chuyển cửa hàng',defaultPath:path.join(preferred,name),filters:[{name:'Doanh số Vĩnh Khang',extensions:['json']}]});if(saved.canceled)return {canceled:true};destination=saved.filePath;}
   fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,text);fs.mkdirSync(folder,{recursive:true});const archived=path.join(folder,name);if(path.resolve(archived)!==path.resolve(destination))fs.writeFileSync(archived,text);return {file:destination,archived};
  }throw Error('Thao tác dữ liệu doanh số không hợp lệ');
 }finally{activeRequests--;}
});
ipcMain.handle('excelImport',async(_e,{action,kind,token})=>{
 if(!['parts','bom'].includes(kind))throw Error('Mục nhập Excel không hợp lệ');await authorize(token,kind==='bom');if(maintenance)throw Error('App đang xử lý dữ liệu');activeRequests++;
 try{
  if(action==='read'){let file=process.env.VK_TEST_EXCEL_FILE;if(!file){const r=await dialog.showOpenDialog(mainWindow,{title:'Chọn file Excel theo mẫu',filters:[{name:'Excel',extensions:['xlsx']}],properties:['openFile']});if(r.canceled)return {canceled:true};file=r.filePaths[0]}if(path.extname(file).toLowerCase()!=='.xlsx')throw Error('Chọn file .xlsx');const stat=fs.statSync(file);if(!stat.isFile()||stat.size>8000000)throw Error('File tối đa 8 MB');return {name:path.basename(file),file:fs.readFileSync(file).toString('base64')};}
  if(action==='template'){const source=path.join(__dirname,'../dist/templates',kind+'.xlsx');let destination;if(process.env.VK_TEST_EXPORT_DIR){fs.mkdirSync(process.env.VK_TEST_EXPORT_DIR,{recursive:true});destination=path.join(process.env.VK_TEST_EXPORT_DIR,'Mau-'+kind+'.xlsx')}else{const preferred=usbMode?path.join(usbRoot,'Mau-Excel'):'D:/Codex/Downloads';const hasDefault=fs.existsSync(usbMode?usbRoot:'D:/');if(hasDefault)fs.mkdirSync(preferred,{recursive:true});const filename=kind==='bom'?'Mau-Dinh-muc-BOM.xlsx':'Mau-Linh-kien.xlsx';const r=await dialog.showSaveDialog(mainWindow,{title:hasDefault?'Lưu mẫu Excel':'Máy không có ổ D — anh chọn nơi lưu mẫu Excel',defaultPath:hasDefault?path.join(preferred,filename):filename,filters:[{name:'Excel',extensions:['xlsx']}]});if(r.canceled)return {canceled:true};destination=r.filePath}fs.copyFileSync(source,destination);return {path:destination};}
  throw Error('Thao tác Excel không hợp lệ');
 }finally{activeRequests--;}
});

