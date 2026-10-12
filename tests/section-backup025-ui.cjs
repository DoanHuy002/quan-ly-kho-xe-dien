const {_electron}=require('C:/Users/Doan Huy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root='D:/Codex/Projects/vinhkhang_QLK',out='D:/Codex/Projects/Kiem-thu-sao-luu-tung-muc-2026-10-12/ui-'+Date.now();fs.mkdirSync(out,{recursive:true});
(async()=>{const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[root],env:{...process.env,VK_DATA_DIR:path.join(out,'data'),VK_BACKEND_PORT:'18772',VK_LAN_PORT:'19772',VK_TEST_HIDDEN:'true',VK_TEST_EXPORT_DIR:out},timeout:60000});try{
const page=await app.firstWindow();page.setDefaultTimeout(20000);let token;
const api=(route,method='GET',body)=>page.evaluate(async x=>{const r=await window.warehouse.api({route:'/api/'+x.route,method:x.method,body:x.body,token:x.token});return r;},{route,method,body,token}).then(r=>{assert.equal(r.status,200,JSON.stringify(r));return r.data;});
await api('setup','POST',{username:'test',display_name:'Kiểm thử',password:'1',confirm_password:'1',account_kind:'FACTORY'});token=(await api('login','POST',{username:'test',password:'1'})).token;
await api('dealers','POST',{code:'DL-UI','name':'Đại lý minh họa','phone':'0987654321'});
await page.reload();await page.getByLabel('Tên đăng nhập',{exact:true}).fill('test');await page.getByLabel('Mật khẩu',{exact:true}).fill('1');await page.getByRole('button',{name:'Đăng nhập →',exact:true}).click();
await page.locator('nav').getByRole('button',{name:'Các đại lý',exact:true}).click();await page.getByRole('button',{name:'Sao lưu đại lý',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã sao lưu'}).waitFor();
const file=fs.readdirSync(out).find(n=>n.endsWith('.vkbackup'));assert(file);const packet=JSON.parse(fs.readFileSync(path.join(out,file),'utf8'));assert.equal(packet.section,'dealers');assert.equal(packet.data.dealers.length,1);
packet.data.dealers.push({...packet.data.dealers[0],ID:100,CODE:'DL-NEW',NAME:'Đại lý mới'});const input=path.join(out,'Dai-ly-chuyen-may.vkbackup');fs.writeFileSync(input,JSON.stringify(packet));
await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},input);
await page.getByRole('button',{name:'Khôi phục đại lý',exact:true}).click();const modal=page.getByRole('dialog',{name:'Khôi phục đại lý'});await modal.waitFor();await modal.getByText('Đại lý',{exact:true}).waitFor();await page.screenshot({path:path.join(out,'xem-truoc-khoi-phuc.png'),fullPage:true});
await modal.getByRole('button',{name:'Xác nhận khôi phục',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal((await api('dealers')).length,2);
await page.getByRole('tab',{name:'Nhà xe VC',exact:true}).click();await page.getByRole('button',{name:'Sao lưu nhà xe VC',exact:true}).waitFor();
await page.locator('nav').getByRole('button',{name:'Tồn kho',exact:true}).click();await page.getByRole('button',{name:'Sao lưu tồn kho',exact:true}).waitFor();
console.log('PASS UI: per-section export, file chooser, restore preview, confirmation, refresh, carriers tab and stock page');console.log('Preview: '+path.join(out,'xem-truoc-khoi-phuc.png'));
}finally{await app.close();}})().catch(e=>{console.error(e);process.exit(1)});
