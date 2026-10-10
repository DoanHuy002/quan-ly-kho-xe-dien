param([Parameter(Mandatory=$true)][string]$RepositoryUrl)
$ErrorActionPreference='Stop'
$vkUrl=$RepositoryUrl.Trim().TrimEnd('/') -replace '\.git$',''
if($vkUrl -notmatch '^https://github\.com/([A-Za-z0-9][A-Za-z0-9-]{0,38})/([A-Za-z0-9_.-]{1,100})$'){throw 'Link phải là https://github.com/tai-khoan/ten-kho'}
$vkOwner=$Matches[1]; $vkRepo=$Matches[2]
if($vkRepo -in @('.','..')){throw 'Tên kho không hợp lệ'}
$vkConfig=@{url=$vkUrl}
$vkUtf8=New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText("$PSScriptRoot\desktop\release-channel.json",($vkConfig | ConvertTo-Json),$vkUtf8)
$vkPackage=Get-Content -LiteralPath "$PSScriptRoot\package.json" -Raw | ConvertFrom-Json
$vkPublish=@{provider='github';owner=$vkOwner;repo=$vkRepo;releaseType='release';private=$false}
$vkPackage.build | Add-Member -MemberType NoteProperty -Name publish -Value @($vkPublish) -Force
[System.IO.File]::WriteAllText("$PSScriptRoot\package.json",($vkPackage | ConvertTo-Json -Depth 20),$vkUtf8)
Write-Output "Đã gắn nơi phát hành: $vkUrl"
Write-Output 'Chạy Build-Installer.ps1 để tạo bộ cài và latest.yml đúng cấu hình. Chỉ tải lên bộ cài, .blockmap và latest.yml; không tải mã nguồn hoặc data.'
