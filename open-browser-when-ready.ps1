$Port = 3001
$url = "http://127.0.0.1:$Port/"
$deadline = (Get-Date).AddSeconds(60)

while ((Get-Date) -lt $deadline) {
  $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listening) {
    Start-Process $url
    exit 0
  }
  Start-Sleep -Milliseconds 400
}

Write-Host "Server did not start in time. Open $url in your browser manually."
