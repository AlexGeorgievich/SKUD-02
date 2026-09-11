$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot

if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    Write-Host 'Created .env from .env.example. Change POSTGRES_PASSWORD if needed.' -ForegroundColor Yellow
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop is not running. Start Docker Desktop and retry.'
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Compose failed.'
}

Write-Host 'TimeTrack Pro is running: http://127.0.0.1:8000' -ForegroundColor Green
