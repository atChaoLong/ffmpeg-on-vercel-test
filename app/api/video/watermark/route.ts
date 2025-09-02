import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

// 添加运行时配置
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WatermarkPosition {
  [key: string]: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const inputFile = "sample.mp4";
  const watermarkFile = searchParams.get("watermark") || "kling.png";
  const position = searchParams.get("position") || "bottom-right";
  const opacity = searchParams.get("opacity") || "0.8";
  const scale = searchParams.get("scale") || "0.1";
  const format = searchParams.get("format") || "mp4";

  if (!inputFile) {
    return NextResponse.json(
      { error: "Input file parameter required" },
      { status: 400 }
    );
  }

  try {
    // 定义路径 - 假设文件在 public/videos/ 和 public/images/watermark/
    const inputPath = path.join(process.cwd(), "public", "videos", inputFile);
    const watermarkPath = path.join(process.cwd(), "public", "images", "watermark", watermarkFile);

    // 检查输入文件是否存在
    try {
      await fs.access(inputPath);
    } catch {
      return NextResponse.json(
        { error: "Input file not found" },
        { status: 404 }
      );
    }

    // 检查水印文件是否存在
    try {
      await fs.access(watermarkPath);
    } catch {
      return NextResponse.json(
        { error: "Watermark file not found" },
        { status: 404 }
      );
    }

    // 设置水印位置映射
    const positionSettings: WatermarkPosition = {
      "top-left": "10:10",
      "top-right": "W-w-10:10",
      "bottom-left": "10:H-h-10",
      "bottom-right": "W-w-10:H-h-10",
      "center": "(W-w)/2:(H-h)/2",
    };

    const watermarkPosition = positionSettings[position] || positionSettings["bottom-right"];

    // 根据格式设置编码器和参数 - 优化版本
    const videoCodec = format === "webm" ? "libvpx-vp9" : "libx264";
    const audioCodec = format === "webm" ? "libopus" : "aac";
    const fastStart = format === "webm" ? [] : ["-movflags", "+faststart"];
    
    // MP4 特定的编码参数 - 优化质量
    const mp4SpecificArgs = format === "mp4" ? [
      "-pix_fmt", "yuv420p",           // 确保兼容性
      "-profile:v", "high",            // 使用 high 配置文件，质量更好
      "-level", "4.1",                 // 支持更高分辨率和比特率
      "-x264-params", "ref=4:bframes=3:me=umh:subme=9", // 高级编码参数
      "-b:v", "0",                     // 使用 CRF 模式，自动比特率
      "-maxrate", "10M",               // 最大比特率限制
      "-bufsize", "20M"                // 缓冲区大小
    ] : [];

    // WebM 特定的编码参数 - 优化质量
    const webmSpecificArgs = format === "webm" ? [
      "-b:v", "0",                     // 使用 CRF 模式
      "-crf", "30",                    // WebM 的 CRF 范围是 0-63，30 是好的质量
      "-b:a", "128k",                  // 音频比特率
      "-deadline", "good",             // 编码质量设置
      "-cpu-used", "2"                 // CPU 使用优化
    ] : [];

    // 通用质量参数
    const qualityArgs = [
      "-preset", format === "webm" ? "good" : "medium",  // 编码预设
      "-crf", format === "webm" ? "30" : "23",           // 质量设置（MP4用23，WebM用30）
    ];

    // FFmpeg 参数用于添加水印
    const ffmpegArgs = [
      "-i", inputPath,           // 输入视频文件
      "-i", watermarkPath,       // 输入水印图片
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

    // 运行 FFmpeg 水印处理
    const readableStream = new ReadableStream({
      start(controller) {
        if (!ffmpeg) {
          controller.error(new Error("FFmpeg binary not found"));
          return;
        }

        const process = spawn("./node_modules/ffmpeg-static/ffmpeg", ffmpegArgs, { stdio: 'pipe'});

        let stderr = "";
        let isClosed = false;
        
        // 添加调试信息
        console.log("FFmpeg watermark command:", "./node_modules/ffmpeg-static/ffmpeg", ffmpegArgs.join(" "));
        
        process.stdout.on("data", (data: Buffer) => {
          if (!isClosed) {
            try {
              controller.enqueue(new Uint8Array(data));
            } catch (error) {
              // Controller 可能已关闭，忽略错误
            }
          }
        });
        
        process.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
          console.log("FFmpeg watermark stderr:", data.toString());
        });

        process.on("close", (code: number | null) => {
          if (!isClosed) {
            isClosed = true;
            console.log(`FFmpeg watermark process closed with code: ${code}`);
            if (code === 0) {
              try {
                if (controller.desiredSize !== null) {
                  controller.close();
                }
              } catch (error) {
                // Controller 已被客户端关闭
              }
            } else {
              console.error(`FFmpeg watermark failed with code ${code}:`, stderr);
              try {
                if (controller.desiredSize !== null) {
                  controller.error(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
                }
              } catch (error) {
                // Controller 已被客户端关闭
              }
            }
          }
        });

        process.on("error", (error: Error) => {
          if (!isClosed) {
            isClosed = true;
            try {
              if (controller.desiredSize !== null) {
                controller.error(error);
              }
            } catch (error) {
              // Controller 已被客户端关闭
            }
          }
        });
      }
    });

    // 设置流式传输的适当头部
    const headers = new Headers();
    headers.set("Content-Type", `video/${format}`);

    return new NextResponse(readableStream, {
      status: 200,
      headers,
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
