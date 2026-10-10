const {_electron}=require('C:/Users/Doan Huy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),fs=require('fs'),assert=require('assert/strict');
const root='D:/Codex/Projects/vinhkhang_QLK';
async function test(usb,port){
 let executablePath=root+'/releases/0.6.7/win-unpacked/Vĩnh Khang Warehouse.exe';
 if(usb){const folder=root+'/work/USB-live-066-'+Date.now();fs.cpSync(root+'/releases/USB-0.6.7/win-unpacked',folder,{recursive:true});executablePath=folder+'/QLK VK USB.exe';}
 const app=await _electron.launch({executablePath,env:{...process.env,VK_DATA_DIR:root+'/work/live-066-'+port+'-'+Date.now(),VK_UPDATE_AUTO_CHECK:'false',VK_BACKEND_PORT:String(port)},timeout:60000});
 try{const page=await app.firstWindow();await page.locator('.login h2').waitFor({timeout:60000});const result=await app.evaluate(async({app})=>{const req=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),m=req(app.getAppPath()+'/desktop/main.cjs').getUpdateManager();await m.check(null,true);return {state:m.snapshot(),sha:m.manifest?.sha256};});assert.equal(result.state.status,'available',JSON.stringify(result));assert.equal(result.state.version,'0.6.8');assert.equal(result.state.backupReady,false);if(usb)assert.equal(result.sha,JSON.parse(fs.readFileSync(root+'/outputs/QLK-VK-USB-0.6.8/usb-update.json')).sha256);console.log('PASS live GitHub '+(usb?'USB 0.6.7':'Windows 0.6.7')+': receives correct 0.6.8 channel, backup required.');}finally{await app.close();}
}
Promise.all([test(false,18961),test(true,18962)]).catch(e=>{console.error(e);process.exitCode=1});
