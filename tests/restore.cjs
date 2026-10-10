const {_electron}=require('C:/Users/Doan Huy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('assert/strict'),root='D:/Codex/Projects/vinhkhang_QLK',base=root+'/work/restore-test-'+Date.now();
async function launch(name,fn){const data=base+'/'+name;const app=await _electron.launch({executablePath:root+'/releases/win-unpacked/Vĩnh Khang Warehouse.exe',env:{...process.env,VK_DATA_DIR:data,VK_BACKEND_PORT:'18794',VK_UPDATE_AUTO_CHECK:'false',VK_TEST_EXPORT_DIR:data+'/exports'},timeout:60000});try{const page=await app.firstWindow();await page.locator('.login h2').waitFor({timeout:60000});let token;
const req=async(route,method='GET',body,status=200)=>{const r=await page.evaluate(r=>window.warehouse.api(r),{route:'/api/'+route,method,body,token});assert.equal(r.status,status,route+': '+JSON.stringify(r.data));return r.data;};const login=async(username)=>{token=(await req('login','POST',{username,password:'RestorePassword2026!'})).token;return token;};const setup=async(username)=>{await req('setup','POST',{username,display_name:username,password:'RestorePassword2026!',confirm_password:'RestorePassword2026!'});await login(username)};
await fn({app,page,data,req,login,setup,backup:()=>page.evaluate(token=>window.warehouse.backups({action:'create',token}),token),restore:()=>page.evaluate(token=>window.warehouse.backups({action:'restore',token}),token)});
}finally{await app.close();}}
(async()=>{let zip;
await launch('source',async t=>{await t.setup('sourceowner');await t.req('parts','POST',{code:'SOURCE',name:'Dữ liệu máy cũ',unit:'Chiếc',minimum:1});zip=(await t.backup()).exported;assert.ok(fs.existsSync(zip));});
await launch('target',async t=>{await t.setup('targetowner');await t.req('parts','POST',{code:'TARGET',name:'Dữ liệu máy mới',unit:'Chiếc',minimum:1});
const dialogs=async(file,response=0,canceled=false)=>t.app.evaluate(({dialog},args)=>{dialog.showOpenDialog=async()=>({canceled:args.canceled,filePaths:[args.file]});dialog.showMessageBox=async()=>({response:args.response});},{file,response,canceled});
await dialogs(zip,0,true);assert.equal((await t.restore()).canceled,true);assert.equal((await t.req('parts'))[0].CODE,'TARGET');
const bad=t.data+'/bad.zip';fs.writeFileSync(bad,'not a backup');await dialogs(bad);await assert.rejects(t.restore(),/sao lưu|khôi phục/);assert.equal((await t.req('parts'))[0].CODE,'TARGET');
await dialogs(zip,1);assert.equal((await t.restore()).canceled,true);assert.equal((await t.req('parts'))[0].CODE,'TARGET');
await dialogs(zip);assert.equal((await t.restore()).restored,true);await t.page.locator('.login h2').waitFor({timeout:60000});await t.login('sourceowner');assert.equal((await t.req('parts'))[0].CODE,'SOURCE');await t.req('login','POST',{username:'targetowner',password:'RestorePassword2026!'},401);const saved=fs.readdirSync(t.data+'/backups').filter(n=>n.startsWith('before-restore-'));assert.equal(saved.length,1);assert.ok(fs.statSync(t.data+'/backups/'+saved[0]).size>0);assert.equal(fs.existsSync(t.data+'/restore-pending.json'),false);
await t.page.getByLabel('Tên đăng nhập',{exact:true}).fill('sourceowner');await t.page.getByLabel('Mật khẩu',{exact:true}).fill('RestorePassword2026!');await t.page.getByRole('button',{name:/Đăng nhập/}).click();await t.page.getByRole('button',{name:/Sao lưu/}).click();await t.page.getByRole('button',{name:'Khôi phục dữ liệu',exact:true}).waitFor();const out=root+'/outputs/Cap-nhat-0.5.9';fs.mkdirSync(out,{recursive:true});await t.page.screenshot({path:out+'/Sao-luu-khoi-phuc.png'});
// A simulated interrupted restore must roll back to the target machine on next launch.
fs.writeFileSync(t.data+'/restore-pending.json',JSON.stringify({previous:t.data+'/backups/'+saved[0]}));
});
await launch('target',async t=>{await t.login('targetowner');assert.equal((await t.req('parts'))[0].CODE,'TARGET');assert.equal(fs.existsSync(t.data+'/restore-pending.json'),false);});
console.log('PASS: cross-machine restore, transferred accounts/data, cancel, corrupt ZIP, safety backup, interrupted-restore rollback, visible restore button');
})().catch(e=>{console.error(e);process.exitCode=1});
