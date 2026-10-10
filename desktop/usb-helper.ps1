param([Parameter(Mandatory=$true)][string]$JobFile,[ValidateSet('Stage','Install','Recover')][string]$Phase)
$ErrorActionPreference='Stop'
$allowed=@('QLK VK USB.exe','resources','locales','chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','dxcompiler.dll','dxil.dll','ffmpeg.dll','icudtl.dat','LICENSE.electron.txt','LICENSES.chromium.html','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','vk_swiftshader_icd.json','vk_swiftshader.dll','vulkan-1.dll','HUONG-DAN.txt')
$jobPath=[IO.Path]::GetFullPath($JobFile)
$folder=[IO.Path]::GetDirectoryName($jobPath)
$updates=[IO.Path]::GetDirectoryName($folder)
$root=[IO.Path]::GetDirectoryName($updates)
if((Split-Path $updates -Leaf) -ne '.usb-updates' -or (Split-Path $jobPath -Leaf) -ne 'job.json'){throw 'Invalid job path'}
$job=Get-Content -LiteralPath $jobPath -Raw -Encoding UTF8 | ConvertFrom-Json
if($job.id -notmatch '^[a-f0-9-]{36}$' -or (Split-Path $folder -Leaf) -ne $job.id){throw 'Invalid job id'}
$names=@($job.files)
if($names.Count -lt 3 -or @($names|Select-Object -Unique).Count -ne $names.Count -or @($names|Where-Object {$_ -cnotin $allowed}).Count){throw 'Invalid program files'}
foreach($required in @('QLK VK USB.exe','resources','locales')){if($required -cnotin $names){throw 'Missing program file'}}
$stage=Join-Path $folder 'stage';$backup=Join-Path $folder 'old-program';$pending=Join-Path $updates 'pending.json';$transaction=Join-Path $folder 'transaction.json'
function Assert-Plain([string]$p){if(Test-Path -LiteralPath $p){if((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked paths are not allowed'}}}
foreach($p in @($root,$updates,$folder)){Assert-Plain $p}
function Write-Json([string]$p,$value){$text=$value|ConvertTo-Json -Depth 8 -Compress;[IO.File]::WriteAllText($p,$text,[Text.UTF8Encoding]::new($false))}
function Set-Result([string]$status,[string]$message){Write-Json (Join-Path $updates 'result.json') @{status=$status;message=$message;version=$job.version;at=[DateTime]::UtcNow.ToString('o')}}
function Wait-Parent {for($i=0;$i -lt 120;$i++){if(-not(Get-Process -Id $job.parentPid -ErrorAction SilentlyContinue)){return};Start-Sleep -Milliseconds 500};throw 'App has not closed'}
function Restore-Previous {
  if(-not(Test-Path -LiteralPath $transaction)){return}
  $plan=Get-Content -LiteralPath $transaction -Raw -Encoding UTF8|ConvertFrom-Json
  $failed=Join-Path $folder 'failed-program';[IO.Directory]::CreateDirectory($failed)|Out-Null
  foreach($entry in $plan){
    if($entry.name -cnotin $names){throw 'Invalid rollback entry'}
    $old=Join-Path $backup $entry.name;$target=Join-Path $root $entry.name;$source=Join-Path $stage $entry.name
    foreach($p in @($old,$target,$source)){Assert-Plain $p}
    if(Test-Path -LiteralPath $old){if(Test-Path -LiteralPath $target){Move-Item -LiteralPath $target -Destination (Join-Path $failed $entry.name)};Move-Item -LiteralPath $old -Destination $target}
    elseif(-not $entry.hadOld -and -not(Test-Path -LiteralPath $source) -and (Test-Path -LiteralPath $target)){Move-Item -LiteralPath $target -Destination (Join-Path $failed $entry.name)}
  }
  if($job.databaseBackup -notmatch '^Du-lieu[\\/]backups[\\/]before-update-\d+\.mv\.db$'){throw 'Invalid database backup'}
  $saved=Join-Path $root $job.databaseBackup;$db=Join-Path $root 'Du-lieu/warehouse.mv.db';Assert-Plain $saved;Assert-Plain $db
  if(-not(Test-Path -LiteralPath $saved) -or (Get-Item -LiteralPath $saved).Length -le 0){throw 'Database backup missing'}
  Copy-Item -LiteralPath $saved -Destination $db -Force
  if(Test-Path -LiteralPath $pending){Remove-Item -LiteralPath $pending}
}
function Open-App {
  $env:VK_USB_UPDATE_JOB=$null
  Start-Process -FilePath (Join-Path $root 'QLK VK USB.exe') -WorkingDirectory $root -WindowStyle Hidden
}
try {
  if($Phase -eq 'Stage'){
    $archive=Join-Path $folder 'update.zip';Assert-Plain $archive;Assert-Plain $stage
    $stream=[IO.File]::OpenRead($archive);$sha=[Security.Cryptography.SHA256]::Create();try{$digest=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$sha.Dispose()};if($digest -ne $job.sha256){throw 'ZIP checksum mismatch'}
    # The only recursive deletion is a verified staging folder within this job.
    if([IO.Path]::GetFullPath($stage) -ne [IO.Path]::Combine($folder,'stage')){throw 'Invalid staging path'}
    if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force}
    [IO.Directory]::CreateDirectory($stage)|Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::OpenRead($archive);$total=0;$seen=@{}
    try{
      if($zip.Entries.Count -gt 50000){throw 'Too many files'}
      foreach($entry in $zip.Entries){
        $name=$entry.FullName
        if(-not $name.StartsWith('QLK VK USB/',[StringComparison]::Ordinal) -or $name.Contains('\') -or $name.Contains(':')){throw 'Invalid ZIP entry'}
        $relative=$name.Substring(11);if(-not $relative){continue}
        $pieces=$relative.TrimEnd('/').Split('/')
        if(@($pieces|Where-Object {$_ -eq '..' -or $_ -eq '.' -or $_ -eq '' -or $_.TrimEnd(' ','.') -ne $_}).Count -or $pieces[0] -cnotin $names){throw 'Unsafe ZIP entry'}
        if((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000){throw 'Linked ZIP entry'}
        $target=[IO.Path]::GetFullPath((Join-Path $stage $relative))
        if(-not $target.StartsWith($stage+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or $seen.ContainsKey($target)){throw 'Duplicate or invalid ZIP path'}
        $seen[$target]=$true;$total+=$entry.Length;if($total -gt $job.unpackedBytes){throw 'ZIP exceeds size limit'}
        if($name.EndsWith('/')){[IO.Directory]::CreateDirectory($target)|Out-Null;continue}
        [IO.Directory]::CreateDirectory(([IO.Path]::GetDirectoryName($target)))|Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$false)
      }
      if($total -ne $job.unpackedBytes){throw 'Incomplete archive'}
    }finally{$zip.Dispose()}
    foreach($n in $names){if(-not(Test-Path -LiteralPath (Join-Path $stage $n))){throw 'Missing ZIP content'}}
    foreach($f in @('resources/app.asar','resources/backend.jar','resources/runtime/bin/java.exe')){if(-not(Test-Path -LiteralPath (Join-Path $stage $f))){throw 'Incomplete USB program'}}
    Write-Json (Join-Path $folder 'staged.json') @{sha256=$job.sha256};exit 0
  }
  Write-Json (Join-Path $folder 'helper-started.json') @{phase=$Phase}
  Wait-Parent
  if($Phase -eq 'Recover'){
    Restore-Previous;Set-Result 'rolled-back' 'Lần cập nhật USB trước chưa hoàn tất. App đã quay lại bản trước và dữ liệu trước cập nhật.';Open-App;exit 0
  }
  if(Test-Path -LiteralPath $pending){throw 'Another update is pending'}
  $validated=Get-Content -LiteralPath (Join-Path $folder 'staged.json') -Raw -Encoding UTF8|ConvertFrom-Json
  if($validated.sha256 -ne $job.sha256){throw 'Invalid staged package'}
  $plan=@();foreach($n in $names){$target=Join-Path $root $n;Assert-Plain $target;Assert-Plain (Join-Path $stage $n);if(-not(Test-Path -LiteralPath (Join-Path $stage $n))){throw 'Staging missing'};$plan+=@{name=$n;hadOld=(Test-Path -LiteralPath $target)}}
  Write-Json $transaction $plan;Write-Json $pending @{id=$job.id};[IO.Directory]::CreateDirectory($backup)|Out-Null
  foreach($entry in $plan){$target=Join-Path $root $entry.name;if($entry.hadOld){Move-Item -LiteralPath $target -Destination (Join-Path $backup $entry.name)};Move-Item -LiteralPath (Join-Path $stage $entry.name) -Destination $target}
  $env:VK_USB_UPDATE_JOB=$jobPath
  $newApp=Start-Process -FilePath (Join-Path $root 'QLK VK USB.exe') -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $ready=Join-Path $folder 'ready.json';$ok=$false
  for($i=0;$i -lt 180;$i++){
    if(Test-Path -LiteralPath $ready){$ack=Get-Content -LiteralPath $ready -Raw -Encoding UTF8|ConvertFrom-Json;if($ack.version -eq $job.version){$ok=$true;break}}
    if($newApp.HasExited){break};Start-Sleep -Milliseconds 500
  }
  if(-not $ok){throw 'New USB app did not start'}
  Set-Result 'success' 'Đã cập nhật USB thành công. Tài khoản và dữ liệu được giữ nguyên.'
  Remove-Item -LiteralPath $pending
}catch{
  $failure=$_.Exception.Message
  if($Phase -eq 'Stage'){Write-Error $failure;exit 1}
  try{
    if($newApp -and -not $newApp.HasExited){Stop-Process -Id $newApp.Id -ErrorAction SilentlyContinue;Start-Sleep -Seconds 2}
    Restore-Previous;Set-Result 'rolled-back' ('Cập nhật USB chưa thành công. App đã quay lại bản trước. '+$failure);Open-App
  }catch{
    Set-Result 'error' ('Chưa khôi phục xong bản cũ. Giữ nguyên USB và mở lại app để thử khôi phục. '+$failure)
    Add-Type -AssemblyName PresentationFramework
    [Windows.MessageBox]::Show('Cập nhật USB chưa hoàn tất. Anh giữ nguyên USB, mở lại app để khôi phục hoặc liên hệ hỗ trợ.','QLK VK USB')|Out-Null
  }
  exit 1
}


