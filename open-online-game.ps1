$root = $PSScriptRoot
Set-Location $root

$node = $null
if (Get-Command node -ErrorAction SilentlyContinue) {
  $node = 'node'
} elseif (Test-Path "$env:ProgramFiles\nodejs\node.exe") {
  $node = "$env:ProgramFiles\nodejs\node.exe"
} else {
  Write-Host ''
  Write-Host 'ERROR: Node.js is not installed or not on PATH.'
  Write-Host 'Install Node.js LTS from https://nodejs.org/'
  Write-Host ''
  exit 1
}

if (-not (Test-Path "$root\server\node_modules")) {
  Write-Host 'Installing server dependencies - first time only...'
  Push-Location "$root\server"
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host 'ERROR: npm install failed.'
    exit 1
  }
  Pop-Location
}

Write-Host ''
Write-Host 'Stopping any old server on port 3001...'
& "$root\stop-online-server.ps1"
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Could not free port 3001.'
  Write-Host 'Run STOP ONLINE SERVER.bat, close other server windows, then try again.'
  Write-Host ''
  exit 1
}

Start-Sleep -Seconds 2

& "$root\show-phone-link.ps1"

# Pass Wi-Fi IP to Node so the in-game "Copy link" never falls back to 127.0.0.1
$lanIp = $null
foreach ($pattern in @('192.168.*', '10.*', '172.*')) {
  $lanIp = (
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -like $pattern -and
      $_.IPAddress -ne '127.0.0.1' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Select-Object -First 1
  ).IPAddress
  if ($lanIp) { break }
}
if ($lanIp -and $lanIp -notmatch '^10\.(5\.0\.|8\.)') {
  $env:QWERTY_LAN_IP = $lanIp
  Write-Host "Network IP for Blake: http://$lanIp`:3001/?guest"
  Write-Host ''
}

Write-Host 'Starting server...'
Write-Host 'Browser opens automatically AFTER the server is ready.'
Write-Host 'Keep this window OPEN while you play.'
Write-Host ''

$env:QWERTY_OPEN_BROWSER = '1'
& $node "$root\server\index.js"
exit $LASTEXITCODE
