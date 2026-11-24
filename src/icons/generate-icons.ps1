# 統合版のアイコンを生成する。
# 青い角丸の下地に白いチェックを描き、16pxでも判別できる形にしている。
# 実行: pwsh -NoProfile -File src/icons/generate-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$blue = [System.Drawing.ColorTranslator]::FromHtml('#1A73E8')
$white = [System.Drawing.Color]::White

foreach ($size in @(16, 32, 48, 128)) {
    $renderSize = $size * 4
    $canvas = [System.Drawing.Bitmap]::new($renderSize, $renderSize)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform($renderSize / 32.0, $renderSize / 32.0)

    # 角丸の下地（32x32の座標系で2..30、角の半径7）
    $radius = 7
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc(2, 2, $radius * 2, $radius * 2, 180, 90)
    $path.AddArc(30 - $radius * 2, 2, $radius * 2, $radius * 2, 270, 90)
    $path.AddArc(30 - $radius * 2, 30 - $radius * 2, $radius * 2, $radius * 2, 0, 90)
    $path.AddArc(2, 30 - $radius * 2, $radius * 2, $radius * 2, 90, 90)
    $path.CloseFigure()

    $brush = [System.Drawing.SolidBrush]::new($blue)
    $graphics.FillPath($brush, $path)

    # 白いチェックマーク
    $pen = [System.Drawing.Pen]::new($white, 3.2)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(8.5, 16.5),
        [System.Drawing.PointF]::new(13.5, 21.5),
        [System.Drawing.PointF]::new(23.5, 10.5)
    ))

    # 高解像度で描いてから目的のサイズへ縮小する
    $output = [System.Drawing.Bitmap]::new($size, $size)
    $resize = [System.Drawing.Graphics]::FromImage($output)
    $resize.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $resize.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $resize.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $resize.DrawImage($canvas, 0, 0, $size, $size)
    $output.Save((Join-Path $PSScriptRoot "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)

    $resize.Dispose()
    $output.Dispose()
    $pen.Dispose()
    $brush.Dispose()
    $path.Dispose()
    $graphics.Dispose()
    $canvas.Dispose()
}

Write-Output "アイコンを生成しました: $PSScriptRoot"
