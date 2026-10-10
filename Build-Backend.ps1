$ErrorActionPreference='Stop'
$env:JAVA_HOME=(Get-ChildItem 'D:\Codex\Tools\java' -Directory | Select-Object -First 1).FullName
$env:Path=$env:JAVA_HOME+'\bin;'+$env:Path
Set-Location "$PSScriptRoot\backend"
& 'D:\Codex\Tools\maven\apache-maven-3.9.11\bin\mvn.cmd' '-Dmaven.repo.local=D:\Codex\Tools\maven\repository' clean verify
if($LASTEXITCODE -ne 0){throw 'Backend build failed'}
