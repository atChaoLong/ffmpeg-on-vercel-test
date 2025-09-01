import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

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

    // 根据格式设置编码器和参数
    const videoCodec = format === "webm" ? "libvpx-vp9" : "libx264";
    const audioCodec = format === "webm" ? "libopus" : "aac";
    const fastStart = format === "webm" ? [] : ["-movflags", "+faststart"];

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
      "-preset", "medium",       // 编码预设
      "-crf", "23",              // 质量设置
      ...fastStart,              // 优化网络播放（仅MP4）
      "-f", format,              // 输出格式
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
        });

        process.on("close", (code: number | null) => {
          if (!isClosed) {
            isClosed = true;
            if (code === 0) {
              try {
                if (controller.desiredSize !== null) {
                  controller.close();
                }
              } catch (error) {
                // Controller 已被客户端关闭
              }
            } else {
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
