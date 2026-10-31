Add-Type -AssemblyName System.Drawing

$brainDir = "C:\Users\infod\.gemini\antigravity\brain\b4d33797-f56f-4d10-badf-2e366dd81e66"
$uploadsDir = "c:\Users\infod\Downloads\theavigo\public\uploads"

$csharp = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class HdStudio {
    private static ImageCodecInfo GetJpegEncoder() {
        foreach (var c in ImageCodecInfo.GetImageEncoders()) {
            if (c.MimeType == "image/jpeg") return c;
        }
        return null;
    }

    public static void SaveJpegHd(Bitmap bmp, string path, long quality = 96L) {
        var enc = GetJpegEncoder();
        var ep = new EncoderParameters(1);
        ep.Param[0] = new EncoderParameter(Encoder.Quality, quality);
        bmp.Save(path, enc, ep);
    }

    public static void CopyResizeHd(string srcPath, string dstPath, int maxWidth = 1600) {
        using (var src = new Bitmap(srcPath)) {
            int w = src.Width;
            int h = src.Height;
            if (w > maxWidth) {
                h = (int)Math.Round(h * (maxWidth / (double)w));
                w = maxWidth;
            }
            using (var dst = new Bitmap(w, h, PixelFormat.Format24bppRgb)) {
                dst.SetResolution(300, 300);
                using (var g = Graphics.FromImage(dst)) {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.CompositingQuality = CompositingQuality.HighQuality;
                    g.DrawImage(src, new Rectangle(0, 0, w, h));
                }
                SaveJpegHd(dst, dstPath, 96L);
            }
        }
    }

    // Extract ultra-crisp transparent PNG logo from pure white background with smooth anti-aliased edges
    public static void ExtractTransparentLogo(string srcPath, string dstPngPath, int targetHeight = 260) {
        using (var src = new Bitmap(srcPath)) {
            int w = src.Width;
            int h = src.Height;
            var rect = new Rectangle(0, 0, w, h);
            var data = src.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
            int stride = data.Stride;
            byte[] bytes = new byte[stride * h];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
            src.UnlockBits(data);

            int minX = w, minY = h, maxX = 0, maxY = 0;
            byte[] rgba = new byte[w * h * 4];

            for (int y = 0; y < h; y++) {
                int sRow = y * stride;
                for (int x = 0; x < w; x++) {
                    int b = bytes[sRow + x * 3 + 0];
                    int g = bytes[sRow + x * 3 + 1];
                    int r = bytes[sRow + x * 3 + 2];

                    // Distance from pure white (255,255,255)
                    int maxDiff = Math.Max(255 - r, Math.Max(255 - g, 255 - b));
                    byte alpha;
                    if (maxDiff < 14) {
                        alpha = 0;
                    } else if (maxDiff > 58) {
                        alpha = 255;
                    } else {
                        alpha = (byte)Math.Min(255, (maxDiff - 14) * 255 / 44);
                    }

                    if (alpha > 0) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;

                        // Un-matte white halo on semi-transparent edge pixels
                        if (alpha < 255) {
                            double aNorm = alpha / 255.0;
                            r = (int)Math.Max(0, Math.Min(255, (r - 255 * (1.0 - aNorm)) / aNorm));
                            g = (int)Math.Max(0, Math.Min(255, (g - 255 * (1.0 - aNorm)) / aNorm));
                            b = (int)Math.Max(0, Math.Min(255, (b - 255 * (1.0 - aNorm)) / aNorm));
                        }
                    }

                    int dIdx = (y * w + x) * 4;
                    rgba[dIdx + 0] = (byte)b;
                    rgba[dIdx + 1] = (byte)g;
                    rgba[dIdx + 2] = (byte)r;
                    rgba[dIdx + 3] = alpha;
                }
            }

            int pad = 12;
            minX = Math.Max(0, minX - pad);
            minY = Math.Max(0, minY - pad);
            maxX = Math.Min(w - 1, maxX + pad);
            maxY = Math.Min(h - 1, maxY + pad);

            int cropW = maxX - minX + 1;
            int cropH = maxY - minY + 1;

            using (var cropped = new Bitmap(cropW, cropH, PixelFormat.Format32bppArgb)) {
                var cData = cropped.LockBits(new Rectangle(0, 0, cropW, cropH), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                byte[] outBytes = new byte[cData.Stride * cropH];
                for (int y = 0; y < cropH; y++) {
                    for (int x = 0; x < cropW; x++) {
                        int sIdx = ((minY + y) * w + (minX + x)) * 4;
                        int dIdx = y * cData.Stride + x * 4;
                        outBytes[dIdx + 0] = rgba[sIdx + 0];
                        outBytes[dIdx + 1] = rgba[sIdx + 1];
                        outBytes[dIdx + 2] = rgba[sIdx + 2];
                        outBytes[dIdx + 3] = rgba[sIdx + 3];
                    }
                }
                Marshal.Copy(outBytes, 0, cData.Scan0, outBytes.Length);
                cropped.UnlockBits(cData);

                int finalW = (int)Math.Round(cropW * (targetHeight / (double)cropH));
                using (var resized = new Bitmap(finalW, targetHeight, PixelFormat.Format32bppArgb)) {
                    resized.SetResolution(300, 300);
                    using (var gr = Graphics.FromImage(resized)) {
                        gr.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        gr.SmoothingMode = SmoothingMode.HighQuality;
                        gr.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        gr.DrawImage(cropped, new Rectangle(0, 0, finalW, targetHeight));
                    }
                    resized.Save(dstPngPath, ImageFormat.Png);
                }
            }
        }
    }

    // Crop + Unsharp Mask + Contrast/Clarity Enhancement for remaining photos
    public static void CropAndSharpenHd(string srcPath, string dstPath, double rx, double ry, double rw, double rh, int outWidth, double sharpAmount, double contrastBoost) {
        using (var src = new Bitmap(srcPath)) {
            int cx = (int)Math.Round(src.Width * rx);
            int cy = (int)Math.Round(src.Height * ry);
            int cw = (int)Math.Round(src.Width * rw);
            int ch = (int)Math.Round(src.Height * rh);
            if (cx + cw > src.Width) cw = src.Width - cx;
            if (cy + ch > src.Height) ch = src.Height - cy;

            int outHeight = (int)Math.Round(ch * (outWidth / (double)cw));
            using (var work = new Bitmap(outWidth, outHeight, PixelFormat.Format24bppRgb)) {
                work.SetResolution(300, 300);
                using (var g = Graphics.FromImage(work)) {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.DrawImage(src, new Rectangle(0, 0, outWidth, outHeight), cx, cy, cw, ch, GraphicsUnit.Pixel);
                }

                var rect = new Rectangle(0, 0, outWidth, outHeight);
                var bData = work.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format24bppRgb);
                int stride = bData.Stride;
                byte[] srcBuf = new byte[stride * outHeight];
                byte[] blurBuf = new byte[stride * outHeight];
                byte[] dstBuf = new byte[stride * outHeight];
                Marshal.Copy(bData.Scan0, srcBuf, 0, srcBuf.Length);

                // Fast 5x5 Separable Gaussian Blur for Unsharp Mask
                int[] kernel = new int[] { 1, 4, 6, 4, 1 };
                byte[] tmpBuf = new byte[stride * outHeight];

                for (int y = 0; y < outHeight; y++) {
                    int row = y * stride;
                    for (int x = 0; x < outWidth; x++) {
                        int sumB = 0, sumG = 0, sumR = 0;
                        for (int k = -2; k <= 2; k++) {
                            int sx = Math.Max(0, Math.Min(outWidth - 1, x + k));
                            int wgt = kernel[k + 2];
                            sumB += srcBuf[row + sx * 3 + 0] * wgt;
                            sumG += srcBuf[row + sx * 3 + 1] * wgt;
                            sumR += srcBuf[row + sx * 3 + 2] * wgt;
                        }
                        tmpBuf[row + x * 3 + 0] = (byte)(sumB >> 4);
                        tmpBuf[row + x * 3 + 1] = (byte)(sumG >> 4);
                        tmpBuf[row + x * 3 + 2] = (byte)(sumR >> 4);
                    }
                }

                for (int y = 0; y < outHeight; y++) {
                    int row = y * stride;
                    for (int x = 0; x < outWidth; x++) {
                        int sumB = 0, sumG = 0, sumR = 0;
                        for (int k = -2; k <= 2; k++) {
                            int sy = Math.Max(0, Math.Min(outHeight - 1, y + k));
                            int wgt = kernel[k + 2];
                            int sRow = sy * stride + x * 3;
                            sumB += tmpBuf[sRow + 0] * wgt;
                            sumG += tmpBuf[sRow + 1] * wgt;
                            sumR += tmpBuf[sRow + 2] * wgt;
                        }
                        blurBuf[row + x * 3 + 0] = (byte)(sumB >> 4);
                        blurBuf[row + x * 3 + 1] = (byte)(sumG >> 4);
                        blurBuf[row + x * 3 + 2] = (byte)(sumR >> 4);
                    }
                }

                for (int y = 0; y < outHeight; y++) {
                    int row = y * stride;
                    for (int x = 0; x < outWidth; x++) {
                        for (int c = 0; c < 3; c++) {
                            double orig = srcBuf[row + x * 3 + c];
                            double blur = blurBuf[row + x * 3 + c];
                            double diff = orig - blur;
                            // Edge-thresholded unsharp mask so noise isn't amplified
                            double val = Math.Abs(diff) > 3.0 ? orig + diff * sharpAmount : orig;
                            // Subtle micro-contrast S-curve around midpoint 128
                            val = 128.0 + (val - 128.0) * contrastBoost;
                            dstBuf[row + x * 3 + c] = (byte)Math.Max(0, Math.Min(255, Math.Round(val)));
                        }
                    }
                }

                Marshal.Copy(dstBuf, 0, bData.Scan0, dstBuf.Length);
                work.UnlockBits(bData);
                SaveJpegHd(work, dstPath, 96L);
            }
        }
    }
}
"@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies System.Drawing

# 1. Extract razor-sharp transparent HD Corporate Logo
[HdStudio]::ExtractTransparentLogo("$brainDir\avigo_corporate_logo_hd_refined_1793486769668.jpg", "$uploadsDir\logo.png", 260)

# 2. Install all AI Super-Resolution HD Industrial Photographs
[HdStudio]::CopyResizeHd("$brainDir\hd_page01_hero_pipeline_1793486657272.jpg", "$uploadsDir\page01-hero-pipeline.jpg", 1600)
[HdStudio]::CopyResizeHd("$brainDir\hd_page02_gas_manifold_1793486690713.jpg", "$uploadsDir\page02-gas-manifold.jpg", 1600)
[HdStudio]::CopyResizeHd("$brainDir\hd_page03_intro_banner_1793486732971.jpg", "$uploadsDir\page03-intro-banner.jpg", 1600)
[HdStudio]::CopyResizeHd("$brainDir\hd_logistics_cranes_1793486678293.jpg", "$uploadsDir\page06-logistics-cranes.jpg", 1600)
[HdStudio]::CopyResizeHd("$brainDir\hd_engineering_blueprint_1793486722134.jpg", "$uploadsDir\page06-engineering-blueprint.jpg", 1600)
[HdStudio]::CopyResizeHd("$brainDir\hd_construction_desk_1793486778303.jpg", "$uploadsDir\page07-construction-desk.jpg", 1600)
[HdStudio]::CopyResizeHd("$brainDir\page07_solar_wind_hd_1793486690829.jpg", "$uploadsDir\page07-solar-wind.jpg", 1600)
[HdStudio]::CopyResizeHd("$brainDir\page08_petrochemical_plant_hd_1793486750901.jpg", "$uploadsDir\page08-petrochemical-plant.jpg", 1600)
[HdStudio]::CopyResizeHd("$brainDir\refinery_technicians_grating_hd_1793486802117.jpg", "$uploadsDir\page12-people-grating.jpg", 1600)

# 3. Cleanly crop out PDF polygon/green-bar overlays on Corporate Towers & enhance all remaining photos with Unsharp Mask + Clarity
[HdStudio]::CropAndSharpenHd("$uploadsDir\page10-corporate-towers.jpg", "$uploadsDir\page10-corporate-towers-clean.jpg", 0.0, 0.0, 0.67, 0.70, 1440, 1.35, 1.08)
Move-Item "$uploadsDir\page10-corporate-towers-clean.jpg" "$uploadsDir\page10-corporate-towers.jpg" -Force

[HdStudio]::CropAndSharpenHd("$uploadsDir\page13-storage-vessel.jpg", "$uploadsDir\page13-storage-vessel-hd.jpg", 0.0, 0.0, 1.0, 1.0, 1600, 1.25, 1.06)
Move-Item "$uploadsDir\page13-storage-vessel-hd.jpg" "$uploadsDir\page13-storage-vessel.jpg" -Force

[HdStudio]::CropAndSharpenHd("$uploadsDir\page07-oilfield-drilling.jpg", "$uploadsDir\page07-oilfield-drilling-hd.jpg", 0.0, 0.0, 1.0, 1.0, 1280, 1.35, 1.07)
Move-Item "$uploadsDir\page07-oilfield-drilling-hd.jpg" "$uploadsDir\page07-oilfield-drilling.jpg" -Force

[HdStudio]::CropAndSharpenHd("$uploadsDir\page12-people-specialist.jpg", "$uploadsDir\page12-people-specialist-hd.jpg", 0.0, 0.04, 1.0, 0.94, 960, 1.25, 1.06)
Move-Item "$uploadsDir\page12-people-specialist-hd.jpg" "$uploadsDir\page12-people-specialist.jpg" -Force

# For Energy Gauge (Core Service 1), use clean cropped & sharpened version AND we also have HD pipeline/manifold
[HdStudio]::CropAndSharpenHd("$uploadsDir\page01-hero-pipeline.jpg", "$uploadsDir\page05-energy-gauge.jpg", 0.12, 0.05, 0.88, 0.78, 1600, 0.4, 1.02)

Write-Host "ALL HD ASSETS PROCESSED AND INSTALLED SUCCESSFULLY!"
