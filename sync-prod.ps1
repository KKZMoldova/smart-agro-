# Снимает дамп боевой базы с Railway и заливает его в локальную копию.
#
# Читает боевую строку из .env.prod-source (только на чтение, только pg_dump).
# Локальная база smartagro_copy ПЕРЕСОЗДАЁТСЯ при каждом запуске — она одноразовая
# по замыслу, все локальные изменения в ней теряются. Прод не трогается.
#
# Запуск:  .\sync-prod.ps1

$ErrorActionPreference = 'Stop'

$PgBin    = 'C:\Users\alion\pgsql\bin'
$LocalDb  = 'smartagro_copy'
$DumpFile = Join-Path $PSScriptRoot 'prod-snapshot.dump'

function Get-EnvValue([string]$File, [string]$Key) {
  if (-not (Test-Path $File)) { throw "Нет файла $File" }
  $line = Get-Content $File | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { throw "В $File нет переменной $Key" }
  ($line -replace "^\s*$Key\s*=\s*", '').Trim().Trim('"').Trim("'")
}

# ── Боевая строка (источник) ───────────────────────────────────────────
$prodUrl = Get-EnvValue (Join-Path $PSScriptRoot '.env.prod-source') 'PROD_DATABASE_URL'
if ([string]::IsNullOrWhiteSpace($prodUrl)) {
  throw "PROD_DATABASE_URL пуст. Впишите строку с Railway в .env.prod-source"
}

# ── Локальная строка (приёмник) ────────────────────────────────────────
$localUrl = Get-EnvValue (Join-Path $PSScriptRoot '.env') 'DATABASE_URL'
if ($localUrl -match 'ПАРОЛЬ') { throw "В .env не заменён плейсхолдер ПАРОЛЬ" }
if ($localUrl -notmatch 'localhost|127\.0\.0\.1') {
  throw "DATABASE_URL в .env не указывает на localhost. Приложение должно работать с локальной копией."
}
if ($localUrl -notmatch '^postgresql://([^:]+):([^@]+)@') { throw "Не разобрать DATABASE_URL из .env" }
$localUser = $Matches[1]
$localPass = $Matches[2]

# ── 1. Дамп прода ──────────────────────────────────────────────────────
Write-Host "[1/3] Снимаю дамп боевой базы..." -ForegroundColor Cyan
& "$PgBin\pg_dump.exe" --dbname=$prodUrl --format=custom --no-owner --no-acl --file=$DumpFile
if ($LASTEXITCODE -ne 0) { throw "pg_dump упал (код $LASTEXITCODE)" }
Write-Host "      готово: $([math]::Round((Get-Item $DumpFile).Length / 1MB, 1)) МБ"

# ── 2. Пересоздание локальной базы ─────────────────────────────────────
Write-Host "[2/3] Пересоздаю локальную базу $LocalDb..." -ForegroundColor Cyan
$env:PGPASSWORD = $localPass
& "$PgBin\psql.exe" -U $localUser -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $LocalDb WITH (FORCE);"
if ($LASTEXITCODE -ne 0) { throw "Не удалось удалить старую копию (код $LASTEXITCODE)" }
& "$PgBin\psql.exe" -U $localUser -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $LocalDb;"
if ($LASTEXITCODE -ne 0) { throw "Не удалось создать базу (код $LASTEXITCODE)" }

# ── 3. Восстановление ──────────────────────────────────────────────────
Write-Host "[3/3] Заливаю дамп в локальную копию..." -ForegroundColor Cyan
& "$PgBin\pg_restore.exe" --dbname=$localUrl --no-owner --no-acl $DumpFile
Remove-Item Env:\PGPASSWORD

Write-Host ""
Write-Host "Готово. Локальная копия: $LocalDb" -ForegroundColor Green
Write-Host "Запуск инстанса B:  node --env-file=.env server.js   (порт 3001)"
