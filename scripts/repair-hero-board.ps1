Add-Type -AssemblyName System.Drawing

$inPath = Join-Path $PSScriptRoot '..\public\images\hero-board.png'
$outPng = Join-Path $PSScriptRoot '..\public\images\hero-board.png'
$outJpg = Join-Path $PSScriptRoot '..\public\images\hero-board.jpg'

$src = [System.Drawing.Image]::FromFile((Resolve-Path $inPath).Path)
$bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)
$g.Dispose()
$src.Dispose()

$w = $bmp.Width
$h = $bmp.Height
$navy = [System.Drawing.Color]::FromArgb(255, 26, 40, 69)

# Cover top-left / top-right LIVE + search ghosts
for ($y = 0; $y -lt 48; $y++) {
  for ($x = 0; $x -lt 110; $x++) { $bmp.SetPixel($x, $y, $navy) }
  for ($x = ($w - 110); $x -lt $w; $x++) { $bmp.SetPixel($x, $y, $navy) }
}

# Scrub left/right navy gutters
for ($y = 48; $y -lt [int]($h * 0.72); $y++) {
  for ($x = 0; $x -lt 18; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $d = [Math]::Abs($c.R - 27) + [Math]::Abs($c.G - 41) + [Math]::Abs($c.B - 70)
    if ($d -gt 30 -and $c.R -lt 90) { $bmp.SetPixel($x, $y, $navy) }
  }
  for ($x = ($w - 18); $x -lt $w; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $d = [Math]::Abs($c.R - 27) + [Math]::Abs($c.G - 41) + [Math]::Abs($c.B - 70)
    if ($d -gt 30 -and $c.R -lt 90) { $bmp.SetPixel($x, $y, $navy) }
  }
}

function Cover-Corner([System.Drawing.Bitmap]$b, [int]$x0, [int]$y0, [int]$x1, [int]$y1) {
  $base = $b.GetPixel([Math]::Min([int](($x0 + $x1) / 2), $b.Width - 1), [Math]::Min([int](($y0 + $y1) / 2), $b.Height - 1))
  for ($yy = $y0; $yy -lt $y1; $yy++) {
    for ($xx = $x0; $xx -lt $x1; $xx++) {
      $c = $b.GetPixel($xx, $yy)
      if ($c.R -gt 70 -and $c.B -gt 140 -and $c.R -lt 160) {
        $base = $c
        break
      }
    }
  }
  for ($y = $y0; $y -lt $y1; $y++) {
    for ($x = $x0; $x -lt $x1; $x++) {
      $c = $b.GetPixel($x, $y)
      $lum = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B
      $d = [Math]::Abs($c.R - $base.R) + [Math]::Abs($c.G - $base.G) + [Math]::Abs($c.B - $base.B)
      if ($lum -gt 95 -or ($d -gt 55 -and $lum -gt 70)) {
        $b.SetPixel($x, $y, $base)
      }
    }
  }
}

Cover-Corner $bmp 0 ($h - 90) 130 $h
Cover-Corner $bmp ($w - 130) ($h - 90) $w $h

$bmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)

$jpg = New-Object System.Drawing.Bitmap $bmp.Width, $bmp.Height
$gj = [System.Drawing.Graphics]::FromImage($jpg)
$gj.Clear([System.Drawing.Color]::FromArgb(26, 40, 69))
$gj.DrawImage($bmp, 0, 0, $bmp.Width, $bmp.Height)
$gj.Dispose()

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$enc = New-Object System.Drawing.Imaging.EncoderParameters 1
$enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]85)
$jpg.Save($outJpg, $codec, $enc)
$jpg.Dispose()
$bmp.Dispose()

Write-Host "Repaired hero-board.png and hero-board.jpg"
