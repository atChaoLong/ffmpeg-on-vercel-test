import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/app/lib/supabase";

export const maxDuration = 300;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cloudflare R2 配置
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

interface WatermarkPosition {
  [key: string]: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tmpDir = "/tmp";
  let inputTmpPath = "";
  let outputPath = "";

  try {
    const body = await request.json();
    const { videoId, watermarkFile, position, opacity, scale, format } = body;

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    // 从Supabase获取视频信息
    const { data: videoData, error: fetchError } = await supabase
      .from('ffmpeg_on_vercel_test')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError || !videoData?.video_url) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // 更新状态为处理中
    await supabase
      .from('ffmpeg_on_vercel_test')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', videoId);

    const watermarkFileFinal = watermarkFile || "kling.png";
    const positionFinal = position || "bottom-right";
    const opacityFinal = opacity || "0.8";
    const scaleFinal = scale || "0.1";
    const formatFinal = format || "mp4";

    // 设置水印位置映射
    const positionSettings: WatermarkPosition = {
      "top-left": "10:10",
      "top-right": "W-w-10:10",
      "bottom-left": "10:H-h-10",
      "bottom-right": "W-w-10:H-h-10",
      "center": "(W-w)/2:(H-h)/2",
    };

    const watermarkPosition = positionSettings[positionFinal] || positionSettings["bottom-right"];

    // 根据格式设置编码器和参数
    const videoCodec = formatFinal === "webm" ? "libvpx-vp9" : "libx264";
    const audioCodec = formatFinal === "webm" ? "libopus" : "aac";
    const fastStart = formatFinal === "webm" ? [] : ["-movflags", "+faststart"];
    
    // MP4 特定的编码参数
    const mp4SpecificArgs = formatFinal === "mp4" ? [
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-level", "4.1",
      "-x264-params", "ref=4:bframes=3:me=umh:subme=9",
      "-b:v", "0",
      "-maxrate", "10M",
      "-bufsize", "20M"
    ] : [];

    // WebM 特定的编码参数
    const webmSpecificArgs = formatFinal === "webm" ? [
      "-b:v", "0",
      "-crf", "30",
      "-b:a", "128k",
      "-deadline", "good",
      "-cpu-used", "2"
    ] : [];

    // 通用质量参数
    const qualityArgs = [
      "-preset", formatFinal === "webm" ? "good" : "medium",
      "-crf", formatFinal === "webm" ? "30" : "23",
    ];

    // 生成路径（Vercel 仅允许 /tmp 写入）
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});

    const outputFileName = `watermark_${uuidv4()}.${formatFinal}`;
    outputPath = path.join(tmpDir, outputFileName);
    const watermarkPath = path.join(process.cwd(), "public", "images", "watermark", watermarkFileFinal);

    // 检查水印文件是否存在
    try {
      await fs.access(watermarkPath);
    } catch {
      return NextResponse.json({ error: "Watermark file not found" }, { status: 404 });
    }

    // 下载输入视频到 /tmp，避免 FFmpeg 直接拉远程URL失败
    {
      const inExt = (videoData.video_url.split(".").pop() || "mp4").toLowerCase();
      inputTmpPath = path.join(tmpDir, `input_${uuidv4()}.${inExt}`);
      const res = await fetch(videoData.video_url);
      if (!res.ok) {
        await supabase.from('ffmpeg_on_vercel_test').update({ status: 'failed', error_message: `无法下载视频: ${res.status}` }).eq('id', videoId);
        return NextResponse.json({ error: `下载视频失败(${res.status})` }, { status: 502 });
      }
      const arrayBuffer = await res.arrayBuffer();
      await fs.writeFile(inputTmpPath, Buffer.from(arrayBuffer));
    }

    // FFmpeg 参数用于添加水印（输入使用本地临时文件）
    const ffmpegArgs = [
      "-i", inputTmpPath,
      "-i", watermarkPath,
      "-filter_complex", 
      `[1:v]scale=iw*${scaleFinal}:ih*${scaleFinal},format=rgba,colorchannelmixer=aa=${opacityFinal}[watermark];[0:v][watermark]overlay=${watermarkPosition}[v]`,
      "-map", "[v]",
      "-map", "0:a?",
      "-c:v", videoCodec,
      "-c:a", audioCodec,
      ...qualityArgs,
      ...mp4SpecificArgs,
      ...webmSpecificArgs,
      ...fastStart,
      "-f", formatFinal,
      "-y",
      outputPath,
    ];

    // 运行 FFmpeg 水印处理
    const ffmpegPath = (ffmpeg as string) || "./node_modules/ffmpeg-static/ffmpeg";

    const resultJson: any = await new Promise((resolve) => {
      let stderr = "";
      const proc = spawn(ffmpegPath, ffmpegArgs, { stdio: 'pipe' });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
        console.log("FFmpeg watermark stderr:", data.toString());
      });

      proc.on("close", async (code: number | null) => {
        if (code === 0) {
          try {
            // 读取处理后的视频文件并上传到 R2
            const videoBuffer = await fs.readFile(outputPath);
            const key = `videos/${outputFileName}`;
            const uploadCommand = new PutObjectCommand({
              Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
              Key: key,
              Body: videoBuffer,
              ContentType: `video/${formatFinal}`,
            });
            await r2Client.send(uploadCommand);

            const watermarkVideoUrl = `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/${key}`;

            await supabase
              .from('ffmpeg_on_vercel_test')
              .update({
                watermark_video_url: watermarkVideoUrl,
                status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', videoId);

            resolve({ success: true, watermarkVideoUrl });
          } catch (e: any) {
            await supabase
              .from('ffmpeg_on_vercel_test')
              .update({ status: 'failed', error_message: e?.message || '上传失败' })
              .eq('id', videoId);
            resolve({ success: false, error: e?.message || '上传失败' });
          }
        } else {
          await supabase
            .from('ffmpeg_on_vercel_test')
            .update({ status: 'failed', error_message: `FFmpeg失败 code=${code}` })
            .eq('id', videoId);
          resolve({ success: false, error: `FFmpeg 失败，code=${code}`, stderr });
        }
      });

      proc.on("error", async (e: Error) => {
        await supabase
          .from('ffmpeg_on_vercel_test')
          .update({ status: 'failed', error_message: e.message })
          .eq('id', videoId);
        resolve({ success: false, error: e.message });
      });
    });

    // 清理临时文件
    try { if (inputTmpPath) await fs.unlink(inputTmpPath); } catch {}
    try { if (outputPath) await fs.unlink(outputPath); } catch {}

    if (resultJson.success) {
      return NextResponse.json(resultJson);
    }
    return NextResponse.json(resultJson, { status: 500 });

  } catch (error: any) {
    console.error("Video watermark error:", error);
    // 清理临时文件
    try { if (inputTmpPath) await fs.unlink(inputTmpPath); } catch {}
    try { if (outputPath) await fs.unlink(outputPath); } catch {}

    const errorMessage = error?.message || "Unknown error occurred";
    return NextResponse.json({ error: "Video watermark failed", details: errorMessage }, { status: 500 });
  }
}
