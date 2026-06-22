# refresh_rasters_loop.ps1
# مُشغّل مستمرّ يعيد توليد كل نُسج الطقس باستمرار من أحدث دورة GFS.
# كل تمريرة تنزّل وتحوّل (المتغيّرات × الساعات)؛ ثم ينام فترة قصيرة ويكرّر.
#
# ملاحظة: GFS نفسه يصدر دورة جديدة كل 6 ساعات فقط (00/06/12/18 UTC)، فالتمريرات
# بينها تلتقط نفس الدورة — لكن السكربت يلتقط الدورة الأحدث فور توفّرها تلقائياً.
#
# التشغيل:
#   pwsh scripts/refresh_rasters_loop.ps1                 # حلقة لا نهائية، نوم 300ث بين التمريرات
#   pwsh scripts/refresh_rasters_loop.ps1 -SleepSeconds 900 -Hours 0-48
#   pwsh scripts/refresh_rasters_loop.ps1 -Once           # تمريرة واحدة فقط

param(
    [int]$SleepSeconds = 300,
    [string]$Hours = '0-24',
    [string]$Vars = '',
    [switch]$Once
)

$ErrorActionPreference = 'Continue'
$root   = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root 'backend/scripts/refresh_all.py'

$argsList = @($script, '--hours', $Hours)
if ($Vars -ne '') { $argsList += @('--vars', $Vars) }

while ($true) {
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$stamp] بدء تمريرة تحديث النُسج..." -ForegroundColor Cyan
    & python @argsList
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$stamp] انتهت التمريرة." -ForegroundColor Green

    if ($Once) { break }
    Write-Host "نوم $SleepSeconds ثانية قبل التمريرة التالية..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $SleepSeconds
}
