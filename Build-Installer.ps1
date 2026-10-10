$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$env:Path="$PSScriptRoot\tools;"+'C:\Users\Doan Huy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;D:\Codex\Tools\npm\package\bin;'+$env:Path
$env:ELECTRON_BUILDER_CACHE='D:\Codex\Tools\electron-builder-cache'
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
if(!(Test-Path 'runtime\bin\java.exe')){& 'D:\Codex\Tools\java\jdk-21.0.12.1+1\bin\jlink.exe' --add-modules java.se,jdk.unsupported,jdk.crypto.ec,jdk.zipfs --strip-debug --no-header-files --no-man-pages --compress=2 --output runtime; if($LASTEXITCODE -ne 0){throw 'Runtime build failed'}}
& node 'D:\Codex\Tools\npm\package\bin\npm-cli.js' run package
if($LASTEXITCODE -ne 0){throw 'Installer build failed'}


