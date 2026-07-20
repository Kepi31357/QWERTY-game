$ip = (
  Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -like '192.168.*' } |
  Select-Object -First 1
).IPAddress

Write-Host ''
Write-Host '============================================================'
Write-Host '  PHONE LINK (share with Blake on same Wi-Fi):'
Write-Host '============================================================'
if ($ip) {
  Write-Host ''
  Write-Host "    http://$ip`:3001/?guest"
  Write-Host ''
  Write-Host '  Copy the line above EXACTLY — all digits, forward slashes /'
  Write-Host '  Do NOT type xxx or XXX — use the real numbers shown above.'
  Write-Host ''
  $readyFile = Join-Path $PSScriptRoot 'BLAKE-OPEN-THIS-LINK.txt'
  @(
    'Paste this ENTIRE line into Blake''s phone browser (Chrome or Safari):'
    ''
    "http://$ip`:3001/?guest"
    ''
    'After Deb creates a game, tap Copy link on her screen instead — it includes the friend code.'
    ''
    'WRONG (do not use):'
    '  http://127.0.0.1:3001/'
    '  http://192.168.1.xxx:3001/   (xxx is not real — use digits like 150)'
    '  http:\192.168.1.150\...     (use forward slashes / not backslash \)'
    '  C:\Users\...\http:...        (no folder path — only the http link)'
  ) | Set-Content -Path $readyFile -Encoding UTF8
  Write-Host "  Also saved to: BLAKE-OPEN-THIS-LINK.txt"
  Write-Host ''
} else {
  Write-Host ''
  Write-Host '    (Could not find 192.168.x.x - run ipconfig)'
  Write-Host ''
}
Write-Host '  Do NOT use 127.0.0.1 on the phone.'
Write-Host '  Turn OFF VPN on this PC while hosting.'
Write-Host ''
