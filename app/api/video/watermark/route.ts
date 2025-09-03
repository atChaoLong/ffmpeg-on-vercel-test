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
  try {
    const body = await request.json();
    const { videoId, watermarkFile, position, opacity, scale, format } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    // 从Supabase获取视频信息
    const { data: videoData, error: fetchError } = await supabase
      .from('ffmpeg_on_vercel_test')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError || !videoData) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    if (!videoData.video_url) {
      return NextResponse.json(
        { error: "Video URL not found" },
        { status: 400 }
      );
    }

    // 更新状态为处理中
    await supabase
      .from('ffmpeg_on_vercel_test')
      .update({ status: 'processing' })
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

    // 生成输出文件名（Vercel 仅允许 /tmp 写入）
    const tmpDir = "/tmp";
    const outputFileName = `watermark_${uuidv4()}.${formatFinal}`;
    const outputPath = path.join(tmpDir, outputFileName);
    const watermarkPath = path.join(process.cwd(), "public", "images", "watermark", watermarkFileFinal);

    // 确保 /tmp 目录存在（在大多数环境已存在，但加上更稳妥）
    try {
      await fs.mkdir(tmpDir, { recursive: true });
    } catch {}

    // 检查水印文件是否存在
    try {
      await fs.access(watermarkPath);
    } catch {
      return NextResponse.json(
        { error: "Watermark file not found" },
        { status: 404 }
      );
    }

    // FFmpeg 参数用于添加水印
    const ffmpegArgs = [
      "-i", videoData.video_url,
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
    return new Promise((resolve, reject) => {
      if (!ffmpeg) {
        reject(NextResponse.json(
          { error: "FFmpeg binary not found" },
          { status: 500 }
        ));
        return;
      }

      const ffmpegPath = ffmpeg as string;
      const processRef = spawn(ffmpegPath, ffmpegArgs, { stdio: 'pipe' });

      let stderr = "";
      let isClosed = false;
      
      console.log("FFmpeg watermark command:", ffmpegPath, ffmpegArgs.join(" "));
      
      processRef.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
        console.log("FFmpeg watermark stderr:", data.toString());
      });

      processRef.on("close", async (code: number | null) => {
        if (!isClosed) {
          isClosed = true;
          console.log(`FFmpeg watermark process closed with code: ${code}`);
          
          if (code === 0) {
            try {
              // 读取处理后的视频文件
              const videoBuffer = await fs.readFile(outputPath);
              
              // 上传到R2
              const key = `videos/${outputFileName}`;
              const uploadCommand = new PutObjectCommand({
                Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
                Key: key,
                Body: videoBuffer,
                ContentType: `video/${formatFinal}`,
              });

              await r2Client.send(uploadCommand);

              // 生成访问URL
              const watermarkVideoUrl = `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/${key}`;

              // 更新Supabase
              await supabase
                .from('ffmpeg_on_vercel_test')
                .update({
                  watermark_video_url: watermarkVideoUrl,
                  status: 'completed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', videoId);

              // 删除临时文件
              try {
                await fs.unlink(outputPath);
              } catch (error) {
                console.log("Failed to delete temp file:", error);
              }

              resolve(NextResponse.json({
                success: true,
                watermarkVideoUrl: watermarkVideoUrl,
                message: "Watermark added successfully"
              }));

            } catch (error) {
              console.error("Error processing watermark result:", error);
              
              await supabase
                .from('ffmpeg_on_vercel_test')
                .update({
                  status: 'failed',
                  error_message: error instanceof Error ? error.message : 'Unknown error'
                })
                .eq('id', videoId);

              reject(NextResponse.json(
                { error: "Failed to process watermark result" },
                { status: 500 }
              ));
            }
          } else {
            console.error(`FFmpeg watermark failed with code ${code}:`, stderr);
            
            await supabase
              .from('ffmpeg_on_vercel_test')
              .update({
                status: 'failed',
                error_message: `FFmpeg failed with code ${code}: ${stderr}`
              })
              .eq('id', videoId);

            reject(NextResponse.json(
              { error: `FFmpeg failed with code ${code}` },
              { status: 500 }
            ));
          }
        }
      });

      processRef.on("error", async (processError: Error) => {
        if (!isClosed) {
          isClosed = true;
          
          await supabase
            .from('ffmpeg_on_vercel_test')
            .update({
              status: 'failed',
              error_message: processError.message
            })
            .eq('id', videoId);

        reject(NextResponse.json(
            { error: processError.message },
            { status: 500 }
          ));
        }
      });
    });

  } catch (error) {
    console.error("Video watermark error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Video watermark failed",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
