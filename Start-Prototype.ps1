$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$env:Path='C:\Users\Doan Huy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:Path
& node 'D:\Codex\Tools\npm\package\bin\npm-cli.js' start
