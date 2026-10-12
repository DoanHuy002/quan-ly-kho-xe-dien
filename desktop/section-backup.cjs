const fs=require('fs'),path=require('path');
function installSectionBackup({ipcMain,dialog,mainWindow,authorize,transport,baseUrl,saveFile,maintenance,active}){
 let pending=null;
 const call=async(section,action,token,body)=>{const r=await transport(baseUrl()+'/api/section-backup/'+section+(action?'/'+action:''),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.message||'Không xử lý được bản sao lưu');return data;};
 ipcMain.handle('sectionBackup',async(_e,{action,section,token,fingerprint})=>{
  if(!['parts','suppliers','dealers','carriers','models','bom','documents','stock','production','receipts','shipments','reports','salesreport'].includes(section))throw Error('Mục sao lưu không hợp lệ');
  await authorize(token,true);if(maintenance())throw Error('App đang xử lý dữ liệu');active(1);
  try{
   if(action==='export'){const packet=await call(section,'',token);return saveFile(Buffer.from(JSON.stringify(packet,null,2),'utf8'),'Kho-'+section+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.vkbackup',[{name:'Sao lưu từng mục Kho',extensions:['vkbackup']}]);}
   if(action==='cancel'){pending=null;return {};}
   if(action==='preview'){
    pending=null;const choice=await dialog.showOpenDialog(mainWindow(),{title:'Chọn bản sao lưu của mục đang mở',defaultPath:fs.existsSync('D:/Codex/Downloads')?'D:/Codex/Downloads':undefined,properties:['openFile'],filters:[{name:'Sao lưu từng mục Kho',extensions:['vkbackup']}]});
    if(choice.canceled)return {canceled:true};const file=choice.filePaths[0];const stat=fs.statSync(file);if(!stat.isFile()||stat.size>32*1024*1024)throw Error('File không hợp lệ hoặc lớn hơn 32 MB');
    let packet;try{packet=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('Không đọc được bản sao lưu. Anh chọn file .vkbackup do app Kho tạo.');}
    const summary=await call(section,'preview',token,packet);pending={section,token,packet,fingerprint:summary.fingerprint};return {...summary,file:path.basename(file)};
   }
   if(action==='restore'){if(!pending||pending.section!==section||pending.token!==token||pending.fingerprint!==fingerprint)throw Error('Anh chọn file và xem lại dữ liệu trước khi khôi phục');const selected=pending;pending=null;return await call(section,'restore',token,{packet:selected.packet,fingerprint,confirmation:'KHOI PHUC'});}
   throw Error('Thao tác sao lưu không hợp lệ');
  }finally{active(-1);}
 });
}
module.exports={installSectionBackup};
