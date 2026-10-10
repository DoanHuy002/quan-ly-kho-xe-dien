from pathlib import Path
import json,uuid,zipfile,hashlib,subprocess,shutil
project=Path('D:/Codex/Projects/vinhkhang_QLK')
base=project/'work'/('usb-helper-tests-'+str(uuid.uuid4()));base.mkdir(parents=True)
def fixture(name):
 root=base/name;root.mkdir();folder=root/'.usb-updates'/str(uuid.uuid4());folder.mkdir(parents=True)
 shutil.copy2(project/'desktop/usb-helper.ps1',folder/'helper.ps1')
 job={'id':folder.name,'parentPid':2147483647,'version':'0.6.5','sha256':'a'*64,'files':['QLK VK USB.exe','resources','locales'],'unpackedBytes':1,'databaseBackup':'Du-lieu/backups/before-update-123.mv.db'}
 (folder/'job.json').write_text(json.dumps(job));return root,folder,job
def run(folder,phase):
 return subprocess.run(['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(folder/'helper.ps1'),'-JobFile',str(folder/'job.json'),'-Phase',phase],capture_output=True,timeout=30)
root,folder,job=fixture('bad-zip');(root/'untouched.txt').write_text('personal file')
with zipfile.ZipFile(folder/'update.zip','w') as z:z.writestr('QLK VK USB/../outside.txt','evil')
job['sha256']=hashlib.sha256((folder/'update.zip').read_bytes()).hexdigest();job['unpackedBytes']=4;(folder/'job.json').write_text(json.dumps(job))
r=run(folder,'Stage');assert r.returncode!=0;assert not (folder/'outside.txt').exists();assert (root/'untouched.txt').read_text()=='personal file'
for phase in ['Install','Recover']:
 root,folder,job=fixture(phase);stage=folder/'stage';stage.mkdir();backup=folder/'old-program';backup.mkdir()
 (root/'Du-lieu/backups').mkdir(parents=True);(root/'Du-lieu/backups/before-update-123.mv.db').write_text('database-before');(root/'Du-lieu/warehouse.mv.db').write_text('database-before')
 (root/'personal.txt').write_text('keep');plan=[]
 for name in job['files']:
  if name.endswith('.exe'):(root/name).write_text('old-program');(stage/name).write_text('invalid-new-program')
  else:(root/name).mkdir();(root/name/'old.txt').write_text('old-program');(stage/name).mkdir();(stage/name/'new.txt').write_text('new-program')
  plan.append({'name':name,'hadOld':True})
 (folder/'staged.json').write_text(json.dumps({'sha256':job['sha256']}))
 if phase=='Recover':
  (folder/'transaction.json').write_text(json.dumps(plan));(root/'.usb-updates/pending.json').write_text(json.dumps({'id':job['id']}))
  for name in job['files']:shutil.move(str(root/name),str(backup/name));shutil.move(str(stage/name),str(root/name))
  (root/'Du-lieu/warehouse.mv.db').write_text('interrupted-new-database')
 r=run(folder,phase);assert r.returncode!=0 # Dummy executable intentionally cannot launch.
 assert (root/'QLK VK USB.exe').read_text()=='old-program',(r.stdout,r.stderr)
 assert (root/'resources/old.txt').read_text()=='old-program'
 assert (root/'Du-lieu/warehouse.mv.db').read_text()=='database-before'
 assert (root/'personal.txt').read_text()=='keep'
 assert not (root/'.usb-updates/pending.json').exists()
print('PASS helper: ZIP traversal rejected; failed program launch and interrupted update restore old program/database; personal files untouched')
