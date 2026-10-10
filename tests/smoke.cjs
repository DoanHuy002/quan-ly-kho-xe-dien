const {spawn}=require('child_process'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');const java=fs.readdirSync('D:/Codex/Tools/java').map(n=>path.join('D:/Codex/Tools/java',n,'bin/java.exe')).find(fs.existsSync);const data=path.join(root,'work','test-'+Date.now());fs.mkdirSync(data,{recursive:true});let child,token;const password='Test!'+require('crypto').randomBytes(15).toString('hex');
async function start(){const fd=fs.openSync(path.join(data,'server.log'),'a');child=spawn(java,['-Djdk.net.unixdomain.tmpdir=D:/Codex/Tools/java/sockets','-jar',path.join(root,'backend/target/warehouse-0.4.0.jar')],{windowsHide:true,env:{...process.env,VK_DATA_DIR:data,VK_ADMIN_PASSWORD:password,SERVER_PORT:'18766'},stdio:['ignore',fd,fd]});for(let i=0;i<120;i++){try{if((await (await fetch('http://127.0.0.1:18766/api/health')).json()).status==='UP')return}catch{}if(child.exitCode!==null)throw Error('Server exited. '+fs.readFileSync(path.join(data,'server.log'),'utf8'));await new Promise(r=>setTimeout(r,300))}throw Error('Backend startup timeout');}
async function stop(){await new Promise(r=>{child.once('exit',r);child.kill()})}
async function req(route,method='GET',body,expected=200,auth=token){const r=await fetch('http://127.0.0.1:18766/api/'+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();assert.equal(r.status,expected,route+': '+text);return text?JSON.parse(text):null}
(async()=>{try{await start();await req('parts','GET',null,401,null);await req('login','POST',{username:'admin',password:'wrong'},401,null);token=(await req('login','POST',{username:'admin',password},200,null)).token;
const a=(await req('parts','POST',{code:'A',name:'Động cơ',unit:'cái',minimum:2})).id;const b=(await req('parts','POST',{code:'B',name:'Khung',unit:'cái',minimum:1})).id;
await req('parts','POST',{code:'A',name:'Trùng',unit:'cái'},409);
const supplier=(await req('suppliers','POST',{code:'S1',name:'NCC kiểm thử'})).id;
const doc=(await req('documents/draft','POST',{code:'IN1',type:'IN',supplier_id:supplier,lines:[{part_id:a,quantity:10},{part_id:b,quantity:5}]})).id;
await req('documents/'+doc+'/post','POST');await req('documents/'+doc+'/post','POST',null,409);
const out=(await req('documents/draft','POST',{code:'OUT-BAD',type:'OUT',lines:[{part_id:a,quantity:1},{part_id:b,quantity:100}]})).id;await req('documents/'+out+'/post','POST',null,409);
let stock=await req('stock');assert.equal(stock.find(x=>x.ID===a).QUANTITY,10);assert.equal(stock.find(x=>x.ID===b).QUANTITY,5);
const goodOut=(await req('documents/draft','POST',{code:'OUT-GOOD',type:'OUT',lines:[{part_id:a,quantity:1}]})).id;await req('documents/'+goodOut+'/post','POST');assert.equal((await req('stock')).find(x=>x.ID===a).QUANTITY,9);const refill=(await req('documents/draft','POST',{code:'IN-REFILL',type:'IN',lines:[{part_id:a,quantity:1}]})).id;await req('documents/'+refill+'/post','POST');
const model=(await req('models','POST',{code:'M1',name:'VK Test'})).id;const bom=(await req('bom/version','POST',{model_id:model,version:1,lines:[{part_id:a,quantity:2},{part_id:b,quantity:1}]})).id;
const order=(await req('production/draft','POST',{code:'SX1',bom_id:bom,quantity:2,color:'Đen'})).id;
await req('production/'+order+'/complete','POST',{vehicles:[{frame_number:'F1',motor_number:'M1'}]},400);
await req('production/'+order+'/complete','POST',{vehicles:[{frame_number:'F1',motor_number:'M1'},{frame_number:'F1',motor_number:'M2'}]},409);
assert.equal((await req('vehicles')).length,0);assert.equal((await req('stock')).find(x=>x.ID===a).QUANTITY,10);
await req('production/'+order+'/complete','POST',{vehicles:[{frame_number:'F1',motor_number:'M1'},{frame_number:'F2',motor_number:'M2'}]});await req('production/'+order+'/complete','POST',{vehicles:[{frame_number:'F3',motor_number:'M3'},{frame_number:'F4',motor_number:'M4'}]},409);
stock=await req('stock');assert.equal(stock.find(x=>x.ID===a).QUANTITY,6);assert.equal(stock.find(x=>x.ID===b).QUANTITY,3);const vehicles=await req('vehicles');assert.equal(vehicles.length,2);
await req('shipments/post','POST',{code:'XE1',customer:'Đại lý Test',vehicles:[{id:vehicles[0].ID}]});await req('shipments/post','POST',{code:'XE2',customer:'Đại lý Test',vehicles:[{id:vehicles[0].ID}]},409);assert.equal((await req('shipments')).length,1);
await req('users','POST',{username:'viewer',password,display_name:'Người xem',role:'VIEWER'});const viewer=(await req('login','POST',{username:'viewer',password},200,null)).token;await req('stock','GET',null,200,viewer);await req('parts','POST',{code:'NO',name:'Cấm',unit:'cái'},403,viewer);await req('users','GET',null,403,viewer);
await req('users','POST',{username:'warehouse',password,display_name:'Thủ kho',role:'WAREHOUSE'});const wh=(await req('login','POST',{username:'warehouse',password},200,null)).token;await req('bom/version','POST',{model_id:model,version:2,lines:[{part_id:a,quantity:1}]},403,wh);await req('backup','POST',null,403,wh);
const report=await req('reports');assert.equal(report.find(x=>x.CODE==='A').BALANCE,6);const backup=await req('backup','POST');assert.ok(fs.existsSync(backup.file));assert.ok((await req('audit')).some(x=>x.ACTION==='COMPLETE'));
await stop();await start();token=(await req('login','POST',{username:'admin',password},200,null)).token;assert.equal((await req('stock')).find(x=>x.ID===a).QUANTITY,6);assert.equal((await req('vehicles')).length,2);
await req('logout','POST');await req('stock','GET',null,401);console.log('PASS: migration, authentication, roles, IN/OUT posting, rollback, BOM production, serial uniqueness, shipping, reports, backup and restart persistence.');
}finally{if(child&&child.exitCode===null)await stop()}})().catch(e=>{console.error(e);process.exitCode=1});


