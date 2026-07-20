param(
  [int]$Port = 3001
)

function Stop-NodeQwertyServers {
  $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
  foreach ($proc in $procs) {
    $cmd = $proc.CommandLine
    if ($cmd -and ($cmd -like '*server\index.js*' -or $cmd -like '*server/index.js*')) {
      try {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
        Write-Host "Stopped QWERTY server (pid $($proc.ProcessId))"
      } catch {
        Write-Host "Could not stop pid $($proc.ProcessId): $($_.Exception.Message)"
      }
    }
  }
}

Stop-NodeQwertyServers

$maxAttempts = 15
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  $pids = @(
    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
      Where-Object { $_.OwningProcess -gt 0 -and $_.State -eq 'Listen' } |
      Select-Object -ExpandProperty OwningProcess -Unique
  )

  if (-not $pids -or $pids.Count -eq 0) {
    exit 0
  }

  foreach ($procId in $pids) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Host "Stopped process $procId on port $Port"
    } catch {
      Write-Host "Could not stop process $procId : $($_.Exception.Message)"
    }
  }

  Start-Sleep -Milliseconds 600
}

Stop-NodeQwertyServers

$stillListening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($stillListening) {
  Write-Host ""
  Write-Host "ERROR: Port $Port is still in use."
  Write-Host "Close every black QWERTY server window, then run STOP ONLINE SERVER.bat"
  Write-Host ""
  exit 1
}

exit 0
