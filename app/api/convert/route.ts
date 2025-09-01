import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

interface QualitySettings {
  [key: string]: string[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const inputFile = "sample.mp4";
  const format = searchParams.get("format") || "webm";
  const quality = searchParams.get("quality") || "medium";

  if (!inputFile) {
    return NextResponse.json(
      { error: "Input file parameter required" },
      { status: 400 }
    );
  }

  try {
    // Define paths - assuming file is in public/videos/
    const inputPath = path.join(process.cwd(), "public", "videos", inputFile);

    // Check if input file exists.
    try {
      await fs.access(inputPath);
    } catch {
      return NextResponse.json(
        { error: "Input file not found" },
        { status: 404 }
      );
    }

    // Set quality presets
    const qualitySettings: QualitySettings = {
      low: ["-crf", "28", "-preset", "fast"],
      medium: ["-crf", "23", "-preset", "medium"],
      high: ["-crf", "18", "-preset", "slow"],
    };

    const videoCodec = format === "webm" ? "libvpx-vp9" : "libx264";
    const audioCodec = format === "webm" ? "libopus" : "aac";
    const fastStart = format === "webm" ? [] : ["-movflags", "+faststart"];

    // FFmpeg arguments for conversion
    const ffmpegArgs = [
      "-i",
      inputPath,
      "-c:v",
      videoCodec,
      "-c:a",
      audioCodec,
      ...qualitySettings[quality],
      ...fastStart,
      "-f",
      format,
      "pipe:1", // pipe to stdout
    ];

    // Run FFmpeg conversion
    const readableStream = new ReadableStream({
      start(controller) {
        if (!ffmpeg) {
          controller.error(new Error("FFmpeg binary not found"));
          return;
        }

        // 在Vercel环境中使用正确的FFmpeg路径
        const ffmpegPath = process.platform === 'win32' 
          ? "./node_modules/ffmpeg-static/ffmpeg.exe"
          : "./node_modules/ffmpeg-static/ffmpeg";
        
        console.log("Using FFmpeg path:", ffmpegPath);
        console.log("Platform:", process.platform);
        console.log("FFmpeg args:", ffmpegArgs);
        
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, { 
          stdio: 'pipe',
          shell: false, // 在Vercel中通常不需要shell
          env: { ...process.env, PATH: process.env.PATH }
        });

        let stderr = "";
        let isClosed = false;
        
        ffmpegProcess.stdout.on("data", (data: Buffer) => {
          if (!isClosed) {
            try {
              controller.enqueue(new Uint8Array(data));
            } catch {
              // Controller might be closed, ignore the error
            }
          }
        });
        
        ffmpegProcess.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        ffmpegProcess.on("close", (code: number | null) => {
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

        ffmpegProcess.on("error", (error: Error) => {
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
    headers.set("Content-Type", `video/${format}`);

    return new NextResponse(readableStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Video conversion error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Video conversion failed",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}