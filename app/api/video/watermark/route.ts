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
  const watermark = searchParams.get("watermark") || "kling";
  const position = searchParams.get("position") || "bottom-right";
  const opacity = searchParams.get("opacity") || "0.7";
  const size = searchParams.get("size") || "small";

  if (!inputFile) {
    return NextResponse.json(
      { error: "Input file parameter required" },
      { status: 400 }
    );
  }

  // 验证水印文件是否存在
  const watermarkPath = path.join(process.cwd(), "public", "images", "watermark", `${watermark}.png`);
  try {
    await fs.access(watermarkPath);
  } catch {
    return NextResponse.json(
      { error: `Watermark file ${watermark}.png not found` },
      { status: 404 }
    );
  }

  try {
    // Define paths
    const inputPath = path.join(process.cwd(), "public", "videos", inputFile);

    // Check if input file exists
    try {
      await fs.access(inputPath);
    } catch {
      return NextResponse.json(
        { error: "Input file not found" },
        { status: 404 }
      );
    }

    // 水印位置设置
    const positionSettings: WatermarkPosition = {
      "top-left": "10:10",
      "top-right": "W-w-10:10", 
      "bottom-left": "10:H-h-10",
      "bottom-right": "W-w-10:H-h-10",
      "center": "(W-w)/2:(H-h)/2"
    };

    // 水印大小设置
    const sizeSettings: { [key: string]: string } = {
      "small": "iw*0.1:ih*0.1",
      "medium": "iw*0.15:ih*0.15", 
      "large": "iw*0.2:ih*0.2"
    };

    const watermarkPosition = positionSettings[position] || positionSettings["bottom-right"];
    const watermarkSize = sizeSettings[size] || sizeSettings["small"];

    // FFmpeg arguments for watermarking
    const ffmpegArgs = [
      "-i", inputPath,
      "-i", watermarkPath,
      "-filter_complex", 
      `[1:v]scale=${watermarkSize},format=rgba,colorchannelmixer=aa=${opacity}[watermark];[0:v][watermark]overlay=${watermarkPosition}`,
      "-c:a", "copy",
      "-f", "mp4",
      "pipe:1" // pipe to stdout
    ];

    // Run FFmpeg watermarking
    const readableStream = new ReadableStream({
      start(controller) {
        if (!ffmpeg) {
          controller.error(new Error("FFmpeg binary not found"));
          return;
        }

        const process = spawn("./node_modules/ffmpeg-static/ffmpeg.exe", ffmpegArgs, { stdio: 'pipe'});

        let stderr = "";
        let isClosed = false;
        
        process.stdout.on("data", (data: Buffer) => {
          if (!isClosed) {
            try {
              controller.enqueue(new Uint8Array(data));
            } catch {
              // Controller might be closed, ignore the error
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
              } catch {
                // Controller already closed by client
              }
            } else {
              try {
                if (controller.desiredSize !== null) {
                  controller.error(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
                }
              } catch {
                // Controller already closed by client
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
            } catch {
              // Controller already closed by client
            }
          }
        });
      }
    });

    // Set appropriate headers for streaming
    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    headers.set("Content-Disposition", `attachment; filename="watermarked_${watermark}.mp4"`);

    return new NextResponse(readableStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Video watermarking error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Video watermarking failed",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
