const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const { UpdateManager } = require('./updates.cjs');
const FILES = ['QLK VK USB.exe','resources','locales','chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','dxcompiler.dll','dxil.dll','ffmpeg.dll','icudtl.dat','LICENSE.electron.txt','LICENSES.chromium.html','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','vk_swiftshader_icd.json','vk_swiftshader.dll','vulkan-1.dll','HUONG-DAN.txt'];
const versionParts = v => /^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : null;
function newer(a,b) { a=versionParts(a);b=versionParts(b);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false; }
function hash(file) { return new Promise((resolve,reject)=>{const h=crypto.createHash('sha256'),s=fs.createReadStream(file);s.on('data',b=>h.update(b));s.on('error',reject);s.on('end',()=>resolve(h.digest('hex')));}); }
function helper(jobFile,phase,detached=false) {
  const script=path.join(path.dirname(jobFile),'helper.ps1');
  const ps=path.join(process.env.SystemRoot || 'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const marker=path.join(path.dirname(jobFile),'helper-started.json');
  if(detached&&fs.existsSync(marker))fs.unlinkSync(marker);
  const log=detached?fs.openSync(path.join(path.dirname(jobFile),'helper-process.log'),'a'):null;
  let args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-JobFile',jobFile,'-Phase',phase];
  if(detached){
    // Start outside the desktop process job so closing Electron cannot stop the worker.
    const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
    const environment=['VK_BACKEND_PORT','VK_TEST_EXPORT_DIR','VK_UPDATE_AUTO_CHECK'].filter(k=>process.env[k]).map(k=>`$env:${k}=${quote(process.env[k])};`).join('');
    const worker=environment+`& ${quote(script)} -JobFile ${quote(jobFile)} -Phase ${quote(phase)}`;
    const command=`"${ps}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${Buffer.from(worker,'utf16le').toString('base64')}`;
    const broker=`$startup=([wmiclass]'Win32_ProcessStartup').CreateInstance();$startup.ShowWindow=0;$result=([wmiclass]'Win32_Process').Create(${quote(command)},$null,$startup);if($result.ReturnValue -ne 0){throw 'Cannot start USB update worker'}`;
    args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(broker,'utf16le').toString('base64')];
  }
  const child=spawn(ps,args,{env:{...process.env,PSModulePath:path.join(process.env.SystemRoot || 'C:\\Windows','System32/WindowsPowerShell/v1.0/Modules')},windowsHide:true,detached:false,stdio:detached?['ignore',log,log]:['ignore','pipe','pipe']});
  if(detached){
    fs.closeSync(log);
    return new Promise((resolve,reject)=>{
      let finished=false;const complete=e=>{if(finished)return;finished=true;clearInterval(timer);if(e)reject(e);else{child.unref();resolve();}};
      const started=Date.now(),timer=setInterval(()=>{if(fs.existsSync(marker))complete();else if(Date.now()-started>20000)complete(Error('Chưa mở được bộ cập nhật USB. Anh mở lại app rồi thử lại.'));},100);
      child.once('error',complete);child.once('close',code=>{if(!finished&&code!==0)complete(Error('Bộ cập nhật USB chưa khởi động. Anh mở lại app rồi thử lại.'));});
    });
  }
  return new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>{child.kill();reject(Error('Chuẩn bị cập nhật quá lâu. Anh thử lại.'));},180000);child.on('error',e=>{clearTimeout(timer);reject(e);});child.stderr.on('data',b=>output=(output+b).slice(-2000));child.on('close',code=>{clearTimeout(timer);if(code===0)resolve();else{fs.writeFileSync(path.join(path.dirname(jobFile),'helper.log'),output);reject(Error('Không chuẩn bị được gói cập nhật USB. Anh kiểm tra dung lượng và quyền ghi của USB rồi thử lại.'));}});});
}
function pendingJob(root) {
  const pending=path.join(root,'.usb-updates/pending.json');if(!fs.existsSync(pending))return null;
  const id=JSON.parse(fs.readFileSync(pending,'utf8')).id;
  if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Nhật ký cập nhật USB không hợp lệ');
  return path.join(root,'.usb-updates',id,'job.json');
}
class UsbUpdateManager extends UpdateManager {
  constructor(options) {
    const updater=new EventEmitter();updater.setFeedURL=()=>{};
    super({...options,updater,packaged:true});Object.assign(this,{root:options.root,quit:options.quit,fetcher:options.fetcher||fetch});
    this.state.usbPortable=true;this.state.message='Cập nhật riêng cho USB. Dữ liệu được giữ trên USB.';
  }
  validateManifest(m,version) {
    if(m?.schema!==1||m.kind!=='vinhkhang-usb'||m.arch!=='x64'||m.version!==version||!versionParts(m.version)||!/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isSafeInteger(m.bytes)||m.bytes<1||m.bytes>2e9||!Number.isSafeInteger(m.unpackedBytes)||m.unpackedBytes<1||m.unpackedBytes>4e9||!Array.isArray(m.files)||new Set(m.files).size!==m.files.length||m.files.some(n=>!FILES.includes(n))||!['QLK VK USB.exe','resources','locales'].every(n=>m.files.includes(n)))throw Error('Gói phát hành USB không hợp lệ');
    const url=new URL(m.url),prefix=`/${this.config.owner}/${this.config.repo}/releases/download/usb-v${version}/`;
    if(url.protocol!=='https:'||url.hostname!=='github.com'||!url.pathname.startsWith(prefix)||!url.pathname.endsWith('.zip')||url.search||url.hash)throw Error('Địa chỉ gói USB không hợp lệ');
    return m;
  }
  async json(url) {const r=await this.fetcher(url,{signal:AbortSignal.timeout(30000),headers:{'Accept':'application/vnd.github+json','User-Agent':'QLK-VK-USB'}});if(!r.ok)throw Error('Không kết nối được nơi phát hành');const s=await r.text();if(s.length>1000000)throw Error('Phản hồi quá lớn');return JSON.parse(s);}
  async check(token,automatic=false) {
    if(!automatic)await this.authorize(token,false);if(this.busy||this.downloaded)return this.snapshot();this.requireReady();this.busy='check';this.set({status:'checking',message:''});
    try {
      const releases=await this.json(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/releases?per_page=100`);
      if(!Array.isArray(releases))throw Error('Danh sách phát hành không hợp lệ');
      const candidates=releases.filter(r=>!r.draft&&/^usb-v\d+\.\d+\.\d+$/.test(r.tag_name)&&r.assets?.some(a=>a.name==='usb-update.json')).sort((a,b)=>newer(a.tag_name.slice(5),b.tag_name.slice(5))?-1:newer(b.tag_name.slice(5),a.tag_name.slice(5))?1:0);
      const chosen=candidates[0],v=chosen?.tag_name.slice(5);this.manifest=null;
      if(v&&newer(v,this.state.currentVersion)){const m=await this.json(`https://github.com/${this.config.owner}/${this.config.repo}/releases/download/${chosen.tag_name}/usb-update.json`);this.manifest=this.validateManifest(m,v);this.set({status:'available',version:v,notes:String(m.notes||'').slice(0,4000),message:'Có bản USB mới. Admin sao lưu trước khi cập nhật.'});}
      else this.set({status:'current',version:'',message:'Anh đang dùng bản USB mới nhất.'});
      this.set({checkedAt:new Date().toISOString()});
    }catch{this.manifest=null;this.set({status:'error',version:'',message:'Chưa kiểm tra được bản USB. Anh kiểm tra Internet rồi thử lại; app vẫn dùng bình thường.'});}
    finally{this.busy=false;this.set({});}return this.snapshot();
  }
  async download(token) {
    await this.authorize(token,true);if(this.busy||this.downloaded)return this.snapshot();if(!this.manifest)throw Error('Anh kiểm tra bản USB mới trước khi tải.');this.requireBackup(token);
    this.busy='download';this.set({status:'downloading',percent:0,message:''});
    try {
      const m=this.validateManifest(this.manifest,this.state.version),space=fs.statfsSync(this.root);if(Number(space.bavail)*Number(space.bsize)<m.bytes+m.unpackedBytes+64*1024*1024)throw Error('USB không đủ dung lượng trống để tải và giải nén.');
      const id=crypto.randomUUID(),folder=path.join(this.root,'.usb-updates',id);fs.mkdirSync(folder,{recursive:true});this.jobFile=path.join(folder,'job.json');
      const archive=path.join(folder,'update.zip'),r=await this.fetcher(m.url,{signal:AbortSignal.timeout(15*60*1000)});if(!r.ok||!r.body)throw Error('Không tải được gói USB');
      if(r.url){const u=new URL(r.url);if(u.protocol!=='https:'||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname))throw Error('Địa chỉ tải không hợp lệ');}
      const fd=fs.openSync(archive,'wx');let bytes=0;try{for await(const b of r.body){bytes+=b.length;if(bytes>m.bytes)throw Error('Gói tải vượt dung lượng');fs.writeSync(fd,b);this.set({percent:Math.floor(bytes*100/m.bytes)});}fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      if(bytes!==m.bytes||await hash(archive)!==m.sha256)throw Error('Gói tải không qua kiểm tra toàn vẹn');
      fs.copyFileSync(path.join(__dirname,'usb-helper.ps1'),path.join(folder,'helper.ps1'));
      fs.writeFileSync(this.jobFile,JSON.stringify({id,version:m.version,files:m.files,sha256:m.sha256,unpackedBytes:m.unpackedBytes,parentPid:process.pid}));
      await helper(this.jobFile,'Stage');this.downloaded=true;this.set({status:'downloaded',percent:100,message:'Đã tải và kiểm tra gói USB. Anh có thể cập nhật và mở lại.'});
    }catch(e){this.downloaded=false;this.set({status:'error',message:'Chưa tải được bản USB: '+e.message+'. Chương trình và dữ liệu hiện tại được giữ nguyên.'});}
    finally{this.busy=false;this.set({});}return this.snapshot();
  }
  async install(token) {
    await this.authorize(token,true);if(this.busy)throw Error('App đang xử lý cập nhật');if(!this.downloaded)throw Error('Bản USB chưa tải xong');this.requireBackup(token);
    this.busy='install';this.set({status:'installing',message:'Đang đóng dữ liệu để cập nhật USB…'});
    try {
      if(await hash(path.join(path.dirname(this.jobFile),'update.zip'))!==this.manifest.sha256)throw Error('Gói cập nhật đã thay đổi');
      // Re-extract before stopping the database, rejecting changed staging files.
      await helper(this.jobFile,'Stage');
      const before=await this.prepareInstall();const job=JSON.parse(fs.readFileSync(this.jobFile,'utf8'));job.databaseBackup=path.relative(this.root,before);job.parentPid=process.pid;fs.writeFileSync(this.jobFile,JSON.stringify(job));
      await helper(this.jobFile,'Install',true);this.quit();
    }catch(e){this.set({status:'error',message:'Chưa cập nhật được USB: '+e.message+'. Anh đóng và mở lại app để tiếp tục.'});}
    finally{this.busy=false;this.set({});}return this.snapshot();
  }
}
module.exports={UsbUpdateManager,newer,hash,helper,pendingJob,FILES};
