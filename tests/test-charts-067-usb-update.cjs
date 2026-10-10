const {_electron}=require('C:/Users/Doan Huy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const root='D:/Codex/Projects/vinhkhang_QLK',out=root+'/outputs/QLK-VK-USB-0.6.7',folder=root+'/work/USB cập nhật '+Date.now(),port=18941;
const manifest=JSON.parse(fs.readFileSync(out+'/usb-update.json','utf8'));
fs.cpSync(root+'/releases/USB-0.6.6/win-unpacked',folder,{recursive:true});
async function poll(fn,ms=90000){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,500));}throw Error('Timed out');}
(async()=>{let app;try{
 app=await _electron.launch({executablePath:folder+'/QLK VK USB.exe',env:{...process.env,VK_UPDATE_AUTO_CHECK:'false',VK_BACKEND_PORT:String(port),VK_TEST_EXPORT_DIR:folder+'/Sao-luu'},timeout:60000});
 const page=await app.firstWindow();await page.locator('.login h2').waitFor({timeout:60000});
 let token;const req=async(route,method='GET',body)=>{const r=await page.evaluate(r=>window.warehouse.api(r),{route:'/api/'+route,method,body,token});assert.equal(r.status,200,JSON.stringify(r));return r.data};
 await req('setup','POST',{username:'usbadmin',display_name:'Admin USB',password:'UsbInternetTest2026!',confirm_password:'UsbInternetTest2026!',account_kind:'STORE'});
 token=(await req('login','POST',{username:'usbadmin',password:'UsbInternetTest2026!'})).token;
 const part=await req('parts','POST',{code:'USB-INTERNET',name:'Càng xe USB',unit:'Cái',minimum_stock:1});
 const doc=await req('documents/draft','POST',{code:'USB-IN-1',type:'IN',lines:[{part_id:part.id||part.ID,quantity:10,unit_cost:11000}]});
 await req('documents/'+(doc.id||doc.ID)+'/post','POST');
 await page.reload();await page.getByRole('heading',{name:'Chào mừng trở lại',exact:true}).waitFor();await page.getByLabel('Tên đăng nhập',{exact:true}).fill('usbadmin');await page.getByLabel('Mật khẩu',{exact:true}).fill('UsbInternetTest2026!');await page.getByRole('button',{name:/Đăng nhập/}).click();await page.getByRole('button',{name:'Đăng xuất',exact:true}).waitFor();
 await app.evaluate(({dialog,app},args)=>{
   const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
   const {Readable}=require('stream'),fs=require('fs');const manager=require(require('path').join(require('electron').app.getAppPath(),'desktop/main.cjs')).getUpdateManager();
   manager.state.currentVersion='0.6.6';
   manager.fetcher=async url=>url.includes('api.github.com')?new Response(JSON.stringify([{tag_name:'v9.9.9',draft:false,assets:[{name:'usb-update.json'}]},{tag_name:'usb-v0.6.7',draft:false,assets:[{name:'usb-update.json'}]}])):url.endsWith('usb-update.json')?new Response(JSON.stringify(args.manifest)):new Response(Readable.toWeb(fs.createReadStream(args.zip)));
   dialog.showMessageBox=async()=>({response:0});
 },{manifest,zip:out+'/QLK-VK-USB-0.6.7.zip'});
 await page.getByRole('button',{name:'Cập nhật',exact:true}).click();await page.getByRole('button',{name:'Kiểm tra cập nhật',exact:true}).click();await page.getByRole('heading',{name:'Có phiên bản mới',exact:true}).waitFor();
 await assert.rejects(page.evaluate(token=>window.warehouse.updates({action:'download',token}),token),/sao lưu/);
 await page.getByRole('button',{name:'Sao lưu và lưu bản riêng',exact:true}).click();await page.getByText(/Đã sao lưu:/).waitFor();
 await req('parts','POST',{code:'AFTER-BACKUP',name:'Thay đổi sau sao lưu',unit:'Cái',minimum_stock:0});
 await page.getByRole('button',{name:'Tải bản mới',exact:true}).click(); const downloaded=await poll(async()=>{const s=await page.evaluate(()=>window.warehouse.updates({action:'status'}));return ['downloaded','error'].includes(s.status)?s:null;},180000);assert.equal(downloaded.status,'downloaded',JSON.stringify(downloaded));await page.getByRole('button',{name:'Cài bản mới và mở lại',exact:true}).waitFor();
 await page.screenshot({path:out+'/Cap-nhat-USB.png',fullPage:true});
 const backups=fs.readdirSync(folder+'/Sao-luu');assert(backups.some(n=>n.endsWith('.zip')));
 await page.getByRole('button',{name:'Cài bản mới và mở lại',exact:true}).click().catch(()=>{});
 const result=await poll(()=>{const p=folder+'/.usb-updates/result.json';if(!fs.existsSync(p))return;const r=JSON.parse(fs.readFileSync(p));return r;},120000);
 assert.equal(result.status,'success',JSON.stringify(result));const health=await(await fetch('http://127.0.0.1:'+port+'/api/health')).json();assert.equal(health.version,'0.6.7');assert.equal(fs.existsSync(folder+'/.usb-updates/pending.json'),false);
 const login=await poll(async()=>{try{const r=await fetch('http://127.0.0.1:'+port+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'usbadmin',password:'UsbInternetTest2026!'})});if(r.ok)return r.json();}catch{}});
 const parts=await(await fetch('http://127.0.0.1:'+port+'/api/parts',{headers:{Authorization:'Bearer '+login.token}})).json();assert(parts.some(p=>p.CODE==='AFTER-BACKUP'));
 const stock=await(await fetch('http://127.0.0.1:'+port+'/api/stock',{headers:{Authorization:'Bearer '+login.token}})).json();assert.equal(stock.find(p=>p.CODE==='USB-INTERNET').QUANTITY,10);
 assert(fs.existsSync(folder+'/Du-lieu/warehouse.mv.db'));const jobs=fs.readdirSync(folder+'/.usb-updates').filter(n=>/^[a-f0-9-]{36}$/.test(n));assert(jobs.some(n=>fs.existsSync(folder+'/.usb-updates/'+n+'/old-program/QLK VK USB.exe')));
 fs.writeFileSync(root+'/work/usb-internet-test-latest.json',JSON.stringify({folder,port,result}));
 console.log('PASS real USB UI: independent channel, backup gate, ZIP/hash/extraction, closed DB, program swap and restart, same admin/stock, post-backup changes preserved, old program retained, Vietnamese USB path');
 }finally{if(app)await app.close().catch(()=>{});const script="$target=$env:VK_TEST_USB_ROOT; Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq (Join-Path $target 'QLK VK USB.exe') } | ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue}";spawnSync('powershell.exe',['-NoProfile','-Command',script],{env:{...process.env,VK_TEST_USB_ROOT:folder},windowsHide:true});}
})().catch(e=>{console.error(e);process.exitCode=1});



