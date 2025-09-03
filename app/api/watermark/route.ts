import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/app/lib/r2-client';
import { supabase } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'child_process';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export const maxDuration = 300;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WatermarkPosition {
  [key: string]: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');
  const watermarkId = searchParams.get('watermark') || 'kling';
  const position = searchParams.get('position') || 'bottom-right';
  const opacity = searchParams.get('opacity') || '0.7';
  const size = searchParams.get('size') || 'small';
  const format = searchParams.get('format') || 'mp4';

  if (!recordId) {
    return NextResponse.json(
      { error: "recordId parameter required" },
      { status: 400 }
    );
  }

  try {
    // 从 Supabase 获取视频信息
    const { data: record, error: fetchError } = await supabase
      .from('ffmpeg_on_vercel_test')
      .select('*')
      .eq('id', parseInt(recordId))
      .single();

    if (fetchError || !record) {
      return NextResponse.json(
        { error: "Video record not found" },
        { status: 404 }
      );
    }

    if (!record.video_url) {
      return NextResponse.json(
        { error: "Video URL not found" },
        { status: 400 }
      );
    }

    // 更新状态为处理中
    await supabase
      .from('ffmpeg_on_vercel_test')
      .update({ status: 'processing' })
      .eq('id', parseInt(recordId));

    try {
      // 设置水印位置映射
      const positionSettings: WatermarkPosition = {
        "top-left": "10:10",
        "top-right": "W-w-10:H-h-10",
        "bottom-left": "10:H-h-10",
        "bottom-right": "W-w-10:H-h-10",
        "center": "(W-w)/2:(H-h)/2",
      };

      const watermarkPosition = positionSettings[position] || positionSettings["bottom-right"];

      // 根据大小设置缩放比例
      const sizeMap = {
        'small': '0.1',
        'medium': '0.2',
        'large': '0.3',
      };
      const scale = sizeMap[size as keyof typeof sizeMap] || '0.1';

      // 根据格式设置编码器和参数
      const videoCodec = format === "webm" ? "libvpx-vp9" : "libx264";
      const audioCodec = format === "webm" ? "libopus" : "aac";
      const fastStart = format === "webm" ? [] : ["-movflags", "+faststart"];
      
      // MP4 特定的编码参数
      const mp4SpecificArgs = format === "mp4" ? [
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level", "4.1",
        "-x264-params", "ref=4:bframes=3:me=umh:subme=9",
        "-b:v", "0",
        "-maxrate", "10M",
        "-bufsize", "20M"
      ] : [];

      // WebM 特定的编码参数
      const webmSpecificArgs = format === "webm" ? [
        "-b:v", "0",
        "-crf", "30",
        "-b:a", "128k",
        "-deadline", "good",
        "-cpu-used", "2"
      ] : [];

      // 通用质量参数
      const qualityArgs = [
        "-preset", format === "webm" ? "good" : "medium",
        "-crf", format === "webm" ? "30" : "23",
      ];

      // FFmpeg 参数用于添加水印
      const ffmpegArgs = [
        "-i", record.video_url,           // 输入视频文件（从 R2 URL）
        "-i", `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/${watermarkId}.png`, // 输入水印图片
        "-filter_complex", 
        `[1:v]scale=iw*${scale}:ih*${scale},format=rgba,colorchannelmixer=aa=${opacity}[watermark];[0:v][watermark]overlay=${watermarkPosition}[v]`,
        "-map", "[v]",             // 映射处理后的视频流
        "-map", "0:a?",            // 映射音频流（如果存在）
        "-c:v", videoCodec,        // 视频编码器
        "-c:a", audioCodec,        // 音频编码器
        ...qualityArgs,            // 通用质量参数
        ...mp4SpecificArgs,        // MP4 特定参数
        ...webmSpecificArgs,       // WebM 特定参数
        ...fastStart,              // 优化网络播放（仅MP4）
        "-f", format,              // 输出格式
        "-y",                      // 覆盖输出文件
        "pipe:1",                  // 输出到标准输出
      ];

      // 生成临时输出文件路径
      const outputPath = join(tmpdir(), `output_${recordId}.mp4`);

      // 运行 FFmpeg 水印处理并保存到临时文件
      await new Promise<void>((resolve, reject) => {
        if (!ffmpeg) {
          reject(new Error("FFmpeg binary not found"));
          return;
        }

        // 修改 FFmpeg 参数，输出到文件而不是管道
        const fileOutputArgs = [
          ...ffmpegArgs.slice(0, -1), // 移除 "pipe:1"
          outputPath // 输出到临时文件
        ];

        const process = spawn("./node_modules/ffmpeg-static/ffmpeg", fileOutputArgs, { stdio: 'pipe'});

        let stderr = "";
        
        // 添加调试信息
        console.log("FFmpeg watermark command:", "./node_modules/ffmpeg-static/ffmpeg", fileOutputArgs.join(" "));
        
        process.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
          console.log("FFmpeg watermark stderr:", data.toString());
        });

        process.on("close", (code: number | null) => {
          console.log(`FFmpeg watermark process closed with code: ${code}`);
          if (code === 0) {
            resolve();
          } else {
            console.error(`FFmpeg watermark failed with code ${code}:`, stderr);
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });

        process.on("error", (error: Error) => {
          reject(error);
        });
      });

      // 读取处理后的视频文件
      const processedVideoBuffer = await readFile(outputPath);

      // 上传到 R2
      const uniqueFileName = `${uuidv4()}_watermarked_${recordId}.mp4`;
      const key = `videos/watermarks/${uniqueFileName}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: key,
          Body: processedVideoBuffer,
          ContentType: 'video/mp4',
        })
      );

      // 构建水印视频 URL
      const watermarkedVideoUrl = `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/${key}`;

      // 更新 Supabase 记录
      await supabase
        .from('ffmpeg_on_vercel_test')
        .update({
          watermark_video_url: watermarkedVideoUrl,
          status: 'completed',
        })
        .eq('id', parseInt(recordId));

      // 清理临时文件
      await unlink(outputPath);

      // 返回成功响应
      return NextResponse.json({
        success: true,
        watermarkedVideoUrl,
        message: '水印处理完成，视频已保存到 R2',
      });

    } catch (processingError) {
      // 更新错误状态
      await supabase
        .from('ffmpeg_on_vercel_test')
        .update({
          status: 'error',
          error_message: processingError instanceof Error ? processingError.message : '未知错误',
        })
        .eq('id', parseInt(recordId));

      throw processingError;
    }

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

async function readFile(path: string): Promise<Buffer> {
  const { readFile } = await import('fs/promises');
  return readFile(path);
}

