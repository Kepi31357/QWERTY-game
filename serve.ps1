$root = $PSScriptRoot
$portCandidates = @(18432, 18433, 18434, 18435, 18436, 8766, 8767)

function Stop-PortListeners {
  param([int]$Port)
  try {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
      }
  } catch {}
}

function Get-MimeType {
  param([string]$Path)
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.js' { return 'application/javascript; charset=utf-8' }
    '.css' { return 'text/css; charset=utf-8' }
    '.mp3' { return 'audio/mpeg' }
    '.jpg' { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.png' { return 'image/png' }
    '.svg' { return 'image/svg+xml' }
    default { return 'application/octet-stream' }
  }
}

function Send-HttpResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body,
    [hashtable]$ExtraHeaders
  )

  $writer = New-Object System.IO.StreamWriter($Stream, [Text.Encoding]::ASCII)
  $writer.NewLine = "`r`n"
  $writer.WriteLine("HTTP/1.1 $StatusCode $StatusText")
  if ($ContentType) {
    $writer.WriteLine("Content-Type: $ContentType")
  }
  $writer.WriteLine('Cache-Control: no-cache, no-store, must-revalidate')
  $writer.WriteLine('Pragma: no-cache')
  $writer.WriteLine('Expires: 0')
  $writer.WriteLine('Connection: close')
  if ($ExtraHeaders) {
    foreach ($key in $ExtraHeaders.Keys) {
      $writer.WriteLine("$key`: $($ExtraHeaders[$key])")
    }
  }
  if ($Body) {
    $writer.WriteLine("Content-Length: $($Body.Length)")
  } else {
    $writer.WriteLine('Content-Length: 0')
  }
  $writer.WriteLine()
  $writer.Flush()
  if ($Body -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
  $Stream.Flush()
}

function Handle-Client {
  param(
    [System.Net.Sockets.TcpClient]$Client,
    [string]$Root
  )

  $stream = $null
  try {
    $stream = $Client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { return }

    while ($true) {
      $headerLine = $reader.ReadLine()
      if ($null -eq $headerLine -or $headerLine -eq '') { break }
    }

    $parts = $requestLine -split '\s+', 3
    if ($parts.Length -lt 2) { return }
    $method = $parts[0].ToUpperInvariant()
    $rawPath = $parts[1]

    if ($method -ne 'GET' -and $method -ne 'HEAD') {
      Send-HttpResponse -Stream $stream -StatusCode 405 -StatusText 'Method Not Allowed' -ContentType 'text/plain; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes('Method not allowed')) -ExtraHeaders $null
      return
    }

    $pathOnly = ($rawPath -split '\?', 2)[0]
    $relative = [Uri]::UnescapeDataString($pathOnly).TrimStart('/')
    if ($relative -eq '' -or $relative.EndsWith('/')) {
      $relative = 'index.html'
    }
    if ($relative -eq 'favicon.ico') {
      $relative = 'favicon.svg'
    }

    $file = Join-Path $Root ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
    $file = [IO.Path]::GetFullPath($file)
    $rootFull = [IO.Path]::GetFullPath($Root)
    if (-not $file.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
      Send-HttpResponse -Stream $stream -StatusCode 403 -StatusText 'Forbidden' -ContentType 'text/plain; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes('Forbidden')) -ExtraHeaders $null
      return
    }

    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
      Send-HttpResponse -Stream $stream -StatusCode 404 -StatusText 'Not Found' -ContentType 'text/plain; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes('Not found')) -ExtraHeaders $null
      return
    }

    $mime = Get-MimeType -Path $file
    $content = if ($method -eq 'HEAD') { $null } else { [IO.File]::ReadAllBytes($file) }
    Send-HttpResponse -Stream $stream -StatusCode 200 -StatusText 'OK' -ContentType $mime -Body $content -ExtraHeaders $null
  } catch {
    Write-Host "Client error: $($_.Exception.Message)"
  } finally {
    if ($stream) {
      try { $stream.Close() } catch {}
    }
    try { $Client.Close() } catch {}
  }
}

foreach ($candidate in $portCandidates) {
  Stop-PortListeners -Port $candidate
}
Start-Sleep -Milliseconds 400

$listener = $null
$port = $null
$lastError = $null

foreach ($candidate in $portCandidates) {
  try {
    $endpoint = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Loopback), $candidate
    $listener = New-Object System.Net.Sockets.TcpListener $endpoint
    $listener.Start()
    $port = $candidate
    break
  } catch {
    $lastError = $_.Exception.Message
    if ($listener) {
      try { $listener.Stop() } catch {}
      $listener = $null
    }
  }
}

if (-not $listener) {
  Write-Host ""
  Write-Host "ERROR: Could not start the game server."
  Write-Host $lastError
  Write-Host ""
  Write-Host "Try closing all PowerShell windows and run OPEN GAME.bat again."
  Write-Host ""
  exit 1
}

$portFile = Join-Path $root 'server-port.txt'
Set-Content -Path $portFile -Value $port -Encoding ASCII

Start-Process "http://127.0.0.1:$port/"

Write-Host ""
Write-Host "QWERTY game running at http://127.0.0.1:$port/"
Write-Host "Leave this window open while you play. Press Ctrl+C to stop."
Write-Host ""

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    Handle-Client -Client $client -Root $root
  }
} finally {
  try { $listener.Stop() } catch {}
}
