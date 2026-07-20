# QWERTY - start local server + ngrok tunnel for remote playtesting.
# Requires: Node.js, ngrok, and: ngrok config add-authtoken YOUR_TOKEN
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root

function Find-Ngrok {
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [System.Environment]::GetEnvironmentVariable('Path', 'User')

  $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -and (Test-Path -LiteralPath $cmd.Source)) {
    return $cmd.Source
  }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\ngrok.exe'),
    (Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.exe'),
    (Join-Path $env:ProgramFiles 'ngrok\ngrok.exe')
  )
  foreach ($path in $candidates) {
    if (Test-Path -LiteralPath $path) { return $path }
  }

  $wingetRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  if (Test-Path -LiteralPath $wingetRoot) {
    $winget = Get-ChildItem -Path $wingetRoot -Filter 'ngrok.exe' -Recurse -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($winget) { return $winget.FullName }
  }
  return $null
}

function Stop-AllNgrok {
  Get-Process -Name 'ngrok' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'ngrok' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Get-NgrokPublicUrl {
  try {
    $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 2
    $https = $null
    $any = $null
    foreach ($t in @($tunnels.tunnels)) {
      if (-not $t.public_url) { continue }
      if (-not $any) { $any = $t.public_url }
      if ($t.public_url -like 'https://*') {
        $https = $t.public_url
        break
      }
    }
    $picked = if ($https) { $https } else { $any }
    if ($picked) { return $picked.TrimEnd('/') }
  } catch {}
  return $null
}

$ngrok = Find-Ngrok
if (-not $ngrok) {
  Write-Host ''
  Write-Host 'ERROR: ngrok was not found.'
  Write-Host 'Install: winget install ngrok.ngrok'
  Write-Host 'Then:    ngrok config add-authtoken YOUR_TOKEN'
  Write-Host 'See NGROK.md'
  Write-Host ''
  exit 1
}

Write-Host ('Using ngrok: ' + $ngrok)
$verText = & $ngrok version 2>&1 | Out-String
Write-Host $verText.Trim()

$node = $null
if (Get-Command node -ErrorAction SilentlyContinue) {
  $node = 'node'
} elseif (Test-Path (Join-Path $env:ProgramFiles 'nodejs\node.exe')) {
  $node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
} else {
  Write-Host 'ERROR: Node.js is not installed. Get LTS from https://nodejs.org/'
  exit 1
}

if (-not (Test-Path (Join-Path $root 'server\node_modules'))) {
  Write-Host 'Installing server dependencies (first time only)...'
  Push-Location (Join-Path $root 'server')
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host 'ERROR: npm install failed.'
    exit 1
  }
  Pop-Location
}

function Test-LocalGameServer {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/' -UseBasicParsing -TimeoutSec 2
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
  } catch {
    return $false
  }
}

Write-Host ''
Write-Host 'Stopping any old server on port 3001...'
& (Join-Path $root 'stop-online-server.ps1') | Out-Null

Write-Host 'Stopping any old ngrok processes...'
Stop-AllNgrok
Start-Sleep -Seconds 2

# Start the game server FIRST. Opening ngrok (or the browser) before Node
# listens on 3001 causes ERR_NGROK_8012: connection refused.
Write-Host 'Starting QWERTY server on http://127.0.0.1:3001 ...'
$env:QWERTY_OPEN_BROWSER = '0'
$env:PORT = '3001'
# PUBLIC_BASE_URL is filled after ngrok is up; server also auto-detects via :4040.
Remove-Item Env:PUBLIC_BASE_URL -ErrorAction SilentlyContinue

$serverOut = Join-Path $env:TEMP 'qwerty-server-out.txt'
$serverErr = Join-Path $env:TEMP 'qwerty-server-err.txt'
Remove-Item -LiteralPath $serverOut, $serverErr -ErrorAction SilentlyContinue

# Relative path avoids Start-Process splitting on the space in "QWERTY APP".
$serverProc = Start-Process -FilePath $node -ArgumentList 'server\index.js' `
  -PassThru -WindowStyle Minimized `
  -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr `
  -WorkingDirectory $root

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 250
  if ($serverProc.HasExited) {
    Write-Host ''
    Write-Host 'ERROR: game server exited before becoming ready.'
    Write-Host ('Exit code: ' + $serverProc.ExitCode)
    if (Test-Path -LiteralPath $serverErr) {
      $errText = Get-Content -LiteralPath $serverErr -Raw -ErrorAction SilentlyContinue
      if ($errText) { Write-Host $errText }
    }
    exit 1
  }
  if (Test-LocalGameServer) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Host 'ERROR: Server did not respond on http://127.0.0.1:3001'
  Write-Host 'Run STOP ONLINE SERVER.bat, then try OPEN WITH NGROK.bat again.'
  if (-not $serverProc.HasExited) {
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
  }
  exit 1
}

Write-Host 'Game server is ready.'

$ngrokOut = Join-Path $env:TEMP 'qwerty-ngrok-out.txt'
$ngrokErr = Join-Path $env:TEMP 'qwerty-ngrok-err.txt'
Remove-Item -LiteralPath $ngrokOut, $ngrokErr -ErrorAction SilentlyContinue

Write-Host 'Starting ngrok tunnel to http://127.0.0.1:3001 ...'
Write-Host '(A separate ngrok window may flash; wait for the public URL.)'
# Force IPv4 — "localhost" / bare "3001" often dials [::1] on Windows, while
# Node listens on 0.0.0.0:3001 only → ERR_NGROK_8012 connection refused.
$ngrokArgs = 'http 127.0.0.1:3001 --log=stdout --log-format=term'
$ngrokProc = Start-Process -FilePath $ngrok -ArgumentList $ngrokArgs -PassThru -WindowStyle Minimized `
  -RedirectStandardOutput $ngrokOut -RedirectStandardError $ngrokErr

$publicUrl = $null
for ($i = 0; $i -lt 50; $i++) {
  Start-Sleep -Milliseconds 400
  $publicUrl = Get-NgrokPublicUrl
  if ($publicUrl) { break }

  if ($ngrokProc.HasExited) {
    Write-Host ''
    Write-Host 'ERROR: ngrok exited early.'
    Write-Host ('Exit code: ' + $ngrokProc.ExitCode)
    if (Test-Path -LiteralPath $ngrokErr) {
      $errText = Get-Content -LiteralPath $ngrokErr -Raw -ErrorAction SilentlyContinue
      if ($errText) {
        Write-Host '--- ngrok error ---'
        Write-Host $errText
        Write-Host '-------------------'
      }
    }
    if (Test-Path -LiteralPath $ngrokOut) {
      $outText = Get-Content -LiteralPath $ngrokOut -Raw -ErrorAction SilentlyContinue
      if ($outText) {
        Write-Host '--- ngrok output ---'
        Write-Host $outText
        Write-Host '--------------------'
      }
    }
    Write-Host 'Try these in a new terminal:'
    Write-Host '  ngrok update'
    Write-Host '  ngrok http 127.0.0.1:3001'
    Write-Host 'See NGROK.md'
    if (-not $serverProc.HasExited) {
      Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
  }
}

if (-not $publicUrl) {
  Write-Host 'ERROR: Could not read ngrok public URL from http://127.0.0.1:4040'
  Write-Host 'Open http://127.0.0.1:4040 in a browser, or run: ngrok http 127.0.0.1:3001'
  if (-not $ngrokProc.HasExited) { Stop-Process -Id $ngrokProc.Id -Force -ErrorAction SilentlyContinue }
  if (-not $serverProc.HasExited) { Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue }
  exit 1
}

Write-Host ''
Write-Host 'Ngrok is up:'
Write-Host ('  ' + $publicUrl + '/')
Write-Host ''
Write-Host 'Keep this window OPEN. Share the Copy link from Create Game with remote friends.'
Write-Host 'Ngrok inspector: http://127.0.0.1:4040'
Write-Host ''

Start-Process ($publicUrl + '/')

# Keep the launcher alive while the server runs; closing this window stops both.
try {
  Wait-Process -Id $serverProc.Id
  $exitCode = $serverProc.ExitCode
} catch {
  $exitCode = 1
}

Stop-AllNgrok
if (-not $serverProc.HasExited) {
  Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
}

exit $(if ($null -eq $exitCode) { 0 } else { $exitCode })
