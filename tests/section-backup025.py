import os,json,sys,time,pathlib,subprocess,urllib.request,urllib.error,copy
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path(r'D:\Codex\Projects\vinhkhang_QLK');out=pathlib.Path(r'D:\Codex\Projects\Kiem-thu-sao-luu-tung-muc-2026-10-12')/str(int(time.time()));out.mkdir(parents=True)
java=r'D:\Codex\Tools\java\jdk-21.0.12.1+1\bin\java.exe'
processes=[]
def start(name,port):
 d=out/name;d.mkdir();log=(d/'server.log').open('wb');env={**os.environ,'VK_DATA_DIR':str(d),'SERVER_PORT':str(port),'VK_DESKTOP':'true'}
 p=subprocess.Popen([java,'-Djdk.net.unixdomain.tmpdir=D:/Codex/Tools/warehouse-sockets','-jar',str(root/'backend/target/warehouse-0.0.25.jar')],env=env,stdin=subprocess.PIPE,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW);processes.append(p)
 def req(route,body=None,token=None,status=200):
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  try:
   r=urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}/api/'+route,data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),headers=headers),timeout=30)
   code=r.status;raw=r.read()
  except urllib.error.HTTPError as e:code=e.code;raw=e.read()
  assert code==status,(route,code,raw.decode())
  return json.loads(raw) if raw else None
 for i in range(100):
  try:
   if req('health')['status']=='UP':break
  except Exception:pass
  assert p.poll() is None,(d/'server.log').read_text(errors='replace')[-3000:]
  time.sleep(.4)
 else:raise Exception('startup timeout')
 req('setup',{'username':name,'display_name':name,'password':'1','confirm_password':'1','account_kind':'STORE'})
 t=req('login',{'username':name,'password':'1'})['token']
 return lambda route,body=None,status=200:req(route,body,t,status),req,t
try:
 source,source_raw,_=start('source',18770);target,raw,token=start('target',18771)
 source('dealers',{'code':'DL-A','name':'Đại lý A','phone':'0123456789','address':'Hà Nội','province':'Hà Nội','note':'Chủ đại lý: Anh A'})
 source('dealers',{'code':'DL-B','name':'Đại lý B','phone':'0987654321','address':'Bắc Ninh','province':'Bắc Ninh','note':'Ghi chú'})
 target('dealers',{'code':'DL-LOCAL','name':'Đại lý riêng'})
 packet=source('section-backup/dealers');assert set(packet['data'])=={'dealers'}
 preview=target('section-backup/dealers/preview',packet);assert preview['added']==2
 assert len(target('dealers'))==1,'Preview wrote data'
 result=target('section-backup/dealers/restore',{'packet':packet,'fingerprint':preview['fingerprint'],'confirmation':'KHOI PHUC'});assert result['added']==2
 rows=target('dealers');assert len(rows)==3 and next(r for r in rows if r['CODE']=='DL-A')['PHONE']=='0123456789'
 assert pathlib.Path(result['backup']).is_file()
 assert target('section-backup/dealers/preview',packet)['added']==0
 wrong=copy.deepcopy(packet);wrong['section']='carriers';target('section-backup/dealers/preview',wrong,400)
 corrupt=copy.deepcopy(packet);corrupt['data']['dealers'].append({**corrupt['data']['dealers'][0],'ID':999,'CODE':'NEW','NAME':'x'*201});target('section-backup/dealers/preview',corrupt,409);assert len(target('dealers'))==3
 changed=target('section-backup/dealers/preview',packet);target('dealers',{'code':'DL-CHANGED','name':'Thay đổi sau khi xem'})
 target('section-backup/dealers/restore',{'packet':packet,'fingerprint':changed['fingerprint'],'confirmation':'KHOI PHUC'},409)
 raw('section-backup/dealers',status=401)
 source('users',{'username':'viewer','password':'1','display_name':'viewer','role':'VIEWER','account_kind':'FACTORY'})
 viewer=source_raw('login',{'username':'viewer','password':'1'})['token'];source_raw('section-backup/dealers',token=viewer,status=403)
 # Advance recipient identity counters: restoration must map IDs rather than reuse them.
 target('models',{'code':'LOCAL-M','name':'Mẫu xe riêng'})
 source('models',{'code':'MODEL','name':'Mẫu xe A'})
 source('parts',{'code':'LK-A','name':'Linh kiện A','unit':'Cái','material_group':'METAL'})
 part=next(p for p in source('parts') if p['CODE']=='LK-A')['ID']
 doc=source('documents/draft',{'code':'IN-TEST','type':'IN','lines':[{'part_id':part,'quantity':10,'unit_cost':100000}]})['id'];source(f'documents/{doc}/post',{})
 sold=source('documents/draft',{'code':'SALE-TEST','type':'OUT','sales_purpose':'SALE','sale_channel':'DEALER','party_code':'DL-A','party_name':'Đại lý A','sale_date':'2026-10-12','lines':[{'part_id':part,'quantity':2,'sale_unit_price':150000}]})['id'];source(f'documents/{sold}/post',{})
 operational=source('section-backup/documents');preview=target('section-backup/documents/preview',operational)
 assert len(target('documents'))==0
 restore=target('section-backup/documents/restore',{'packet':operational,'fingerprint':preview['fingerprint'],'confirmation':'KHOI PHUC'})
 stock=target('stock');assert next(r for r in stock if r['CODE']=='LK-A')['QUANTITY']==8
 restored_packet=target('section-backup/documents');assert len(restored_packet['data']['revenue_sales'])==1 and len(restored_packet['data']['revenue_lines'])==1
 sale=restored_packet['data']['revenue_sales'][0];line=restored_packet['data']['revenue_lines'][0]
 source_doc=next(r for r in restored_packet['data']['stock_documents'] if r['CODE']=='SALE-TEST');assert sale['SOURCE_ID']==source_doc['ID']
 source_line=next(r for r in restored_packet['data']['stock_document_lines'] if r['DOCUMENT_ID']==source_doc['ID']);assert line['MEMBERS']==str(source_line['ID'])
 target('section-backup/documents/preview',operational,409)
 print('PASS: dealers transferred with different IDs, phones preserved, existing data kept, repeat deduplicated, preview rollback, wrong file and bad row rejected, stale preview blocked, anonymous blocked, linked stock restored, existing transactional stock protected')
 (out/'result.json').write_text(json.dumps({'passed':True,'catalog_restore':result,'transaction_restore':restore},ensure_ascii=False,indent=2),encoding='utf-8')
finally:
 for p in processes:
  if p.poll() is None:
   p.stdin.close()
   try:p.wait(timeout=20)
   except subprocess.TimeoutExpired:p.terminate();p.wait()
