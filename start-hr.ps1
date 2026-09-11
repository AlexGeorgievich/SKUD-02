$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot

if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    Write-Host 'Создан .env из .env.example. При необходимости измените POSTGRES_PASSWORD.' -ForegroundColor Yellow
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop не запущен. Запустите Docker Desktop и повторите команду.'
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose завершился с ошибкой.'
}

Write-Host 'TimeTrack Pro запущен: http://127.0.0.1:8000' -ForegroundColor Green
