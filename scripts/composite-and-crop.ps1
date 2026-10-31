Add-Type -AssemblyName System.Drawing

$tmpDir = "c:\Users\infod\Downloads\theavigo\data\tmp_pdf"
$outDir = "c:\Users\infod\Downloads\theavigo\public\uploads"

$pairs = Get-Content "$tmpDir\pairs.json" | ConvertFrom-Json

$code = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.IO;

public class HighQualityImageProcessor {
    private static ImageCodecInfo GetJpegCodec() {
        foreach (ImageCodecInfo codec in ImageCodecInfo.GetImageEncoders()) {
            if (codec.MimeType == "image/jpeg") return codec;
        }
        return null;
    }

    public static void ApplyMask(string jpgPath, string maskPath, string outPath, bool whiteBg) {
        using (Bitmap src = new Bitmap(jpgPath)) {
            int w = src.Width;
            int h = src.Height;
            byte[] mask = File.ReadAllBytes(maskPath);
            using (Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                Rectangle rect = new Rectangle(0, 0, w, h);
                BitmapData srcData = src.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
                BitmapData dstData = dst.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                int srcStride = srcData.Stride;
                int dstStride = dstData.Stride;
                byte[] srcBytes = new byte[srcStride * h];
                byte[] dstBytes = new byte[dstStride * h];
                Marshal.Copy(srcData.Scan0, srcBytes, 0, srcBytes.Length);
                src.UnlockBits(srcData);

                for (int y = 0; y < h; y++) {
                    int sRow = y * srcStride;
                    int dRow = y * dstStride;
                    int mRow = y * w;
                    for (int x = 0; x < w; x++) {
                        byte b = srcBytes[sRow + x * 3 + 0];
                        byte g = srcBytes[sRow + x * 3 + 1];
                        byte r = srcBytes[sRow + x * 3 + 2];
                        byte a = mask[mRow + x];
                        if (whiteBg) {
                            int inv = 255 - a;
                            dstBytes[dRow + x * 4 + 0] = (byte)((b * a + 255 * inv) / 255);
                            dstBytes[dRow + x * 4 + 1] = (byte)((g * a + 255 * inv) / 255);
                            dstBytes[dRow + x * 4 + 2] = (byte)((r * a + 255 * inv) / 255);
                            dstBytes[dRow + x * 4 + 3] = 255;
                        } else {
                            dstBytes[dRow + x * 4 + 0] = b;
                            dstBytes[dRow + x * 4 + 1] = g;
                            dstBytes[dRow + x * 4 + 2] = r;
                            dstBytes[dRow + x * 4 + 3] = a;
                        }
                    }
                }
                Marshal.Copy(dstBytes, 0, dstData.Scan0, dstBytes.Length);
                dst.UnlockBits(dstData);
                dst.Save(outPath, ImageFormat.Png);
            }
        }
    }

    public static void CropAndEnhance(string srcPath, string outPath, int x, int y, int w, int h, double scale, bool asJpg) {
        using (Bitmap src = new Bitmap(srcPath)) {
            if (x < 0) x = 0;
            if (y < 0) y = 0;
            if (x + w > src.Width) w = src.Width - x;
            if (y + h > src.Height) h = src.Height - y;

            int targetW = (int)Math.Round(w * scale);
            int targetH = (int)Math.Round(h * scale);

            using (Bitmap dst = new Bitmap(targetW, targetH, asJpg ? PixelFormat.Format24bppRgb : PixelFormat.Format32bppArgb)) {
                dst.SetResolution(300, 300);
                using (Graphics g = Graphics.FromImage(dst)) {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.CompositingQuality = CompositingQuality.HighQuality;

                    Rectangle destRect = new Rectangle(0, 0, targetW, targetH);
                    g.DrawImage(src, destRect, x, y, w, h, GraphicsUnit.Pixel);
                }

                if (asJpg) {
                    ImageCodecInfo jpgCodec = GetJpegCodec();
                    EncoderParameters ep = new EncoderParameters(1);
                    ep.Param[0] = new EncoderParameter(Encoder.Quality, 98L);
                    dst.Save(outPath, jpgCodec, ep);
                } else {
                    dst.Save(outPath, ImageFormat.Png);
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

foreach ($p in $pairs) {
    if ($p.maskPath -and (Test-Path $p.maskPath)) {
        $isLogo = ($p.objNum -eq 114)
        $outPng = "$tmpDir\comp_obj$($p.objNum).png"
        [HighQualityImageProcessor]::ApplyMask($p.jpgPath, $p.maskPath, $outPng, (-not $isLogo))
    }
}

# 2x High-Res Transparent Logo (490x190 at 300 DPI)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj114.png", "$outDir\logo.png", 0, 0, 245, 95, 2.0, $false)

# Page 13 Storage Vessel (2x High-Res 1586x1190 at 98% Quality)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\obj252.jpg", "$outDir\page13-storage-vessel.jpg", 0, 0, 793, 595, 2.0, $true)
Copy-Item "$tmpDir\obj253.jpg" "$outDir\logo-footer-green.jpg" -Force

# Page 1: Hero Refinery Pipeline (Clean crop without side borders, 2x High-Res 1416x1148 at 98% Quality)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj108.png", "$outDir\page01-hero-pipeline.jpg", 0, 400, 708, 572, 2.0, $true)

# Page 2: Industrial Gas Manifold (Clean crop above footer watermark, 2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj131.png", "$outDir\page02-gas-manifold.jpg", 0, 682, 793, 355, 2.0, $true)

# Page 3: Introduction Banner (2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj155.png", "$outDir\page03-intro-banner.jpg", 0, 0, 766, 610, 2.0, $true)

# Page 5: Energy Gauge & Piping (Clean crop above the bottom avigo line, 2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj175.png", "$outDir\page05-energy-gauge.jpg", 0, 758, 793, 270, 2.0, $true)

# Page 6:
# 1) Logistics Tower Cranes (2x High-Res 1406x706 at 98% Quality)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj178.png", "$outDir\page06-logistics-cranes.jpg", 90, 282, 703, 353, 2.0, $true)
# 2) Engineering Blueprint Hand (Clean crop above the bottom avigo watermark, 2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj178.png", "$outDir\page06-engineering-blueprint.jpg", 0, 708, 373, 315, 2.0, $true)

# Page 7:
# 1) Construction Site Desk with Tablet & Hardhat (2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj181.png", "$outDir\page07-construction-desk.jpg", 0, 0, 793, 475, 2.0, $true)
# 2) Oilfield Roughnecks Drilling Rig (2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj181.png", "$outDir\page07-oilfield-drilling.jpg", 0, 732, 416, 296, 2.0, $true)
# 3) Solar Panels & Wind Turbines (2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj181.png", "$outDir\page07-solar-wind.jpg", 418, 732, 375, 296, 2.0, $true)

# Page 8: Petrochemical Refinery Plant (2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj191.png", "$outDir\page08-petrochemical-plant.jpg", 0, 792, 793, 236, 2.0, $true)

# Page 10:
# 1) Corporate Skyscraper Banner (2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj197.png", "$outDir\page10-corporate-towers.jpg", 0, 0, 794, 432, 2.0, $true)
# 2) Original Organization Chart Graphic (2x High-Res PNG)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj197.png", "$outDir\page10-org-chart-original.png", 50, 440, 700, 595, 2.0, $false)

# Page 12:
# 1) Left Construction Specialist (Clean crop above the bottom avigo watermark, 2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj224.png", "$outDir\page12-people-specialist.jpg", 0, 136, 285, 885, 2.0, $true)
# 2) Bottom Right Industrial Grating Worker (Clean crop, 2x High-Res)
[HighQualityImageProcessor]::CropAndEnhance("$tmpDir\comp_obj224.png", "$outDir\page12-people-grating.jpg", 608, 800, 186, 230, 2.0, $true)

Write-Host "All 2x High-Definition 98%-Quality assets generated!"
