import ffmpeg from "ffmpeg-static";
import { spawn } from "child_process";
import { NextResponse } from "next/server";

export const maxDuration = 300; // Pro用户最大5分钟

// 水印图片URL映射
const WATERMARK_URLS = {
    kling: "https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/kling.png",
    pika: "https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/pika.png",
    runway: "https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/runway.png",
    stability: "https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/stability.png",
    vidu: "https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/vidu.png",
    veo: "https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/veo.png",
    luma: "https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/luma.png"
};

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get("videoUrl");
    const watermarkType = searchParams.get("watermarkType") || "kling";

    if (!videoUrl) {
        return NextResponse.json(
            { error: "videoUrl parameter is required" },
            { status: 400 }
        );
    }

    if (!WATERMARK_URLS[watermarkType]) {
        return NextResponse.json(
            { error: "Invalid watermark type" },
            { status: 400 }
        );
    }

    try {
        const watermarkUrl = WATERMARK_URLS[watermarkType];

        // FFmpeg参数：添加水印到右下角
        const ffmpegArgs = [
            "-i", videoUrl,           // 输入视频
            "-i", watermarkUrl,       // 输入水印图片
            "-filter_complex", 
            "[1:v]scale=120:120[wm];[0:v][wm]overlay=W-w-10:H-h-10", // 水印缩放并放置到右下角
            "-c:a", "copy",           // 音频直接复制
            "-f", "mp4",              // 输出格式
            "pipe:1"                  // 输出到stdout
        ];

        // 创建流式响应
        const readableStream = new ReadableStream({
            start(controller) {
                if (!ffmpeg) {
                    controller.error(new Error("FFmpeg binary not found"));
                    return;
                }

                console.log("Starting FFmpeg process with args:", ffmpegArgs);

                const process = spawn("./node_modules/ffmpeg-static/ffmpeg", ffmpegArgs, { 
                    stdio: 'pipe'
                });

                let stderr = "";
                let isClosed = false;
                
                process.stdout.on("data", (data) => {
                    if (!isClosed) {
                        try {
                            controller.enqueue(new Uint8Array(data));
                        } catch (error) {
                            // Controller might be closed, ignore the error
                        }
                    }
                });
                
                process.stderr.on("data", (data) => {
                    stderr += data.toString();
                });

                process.on("close", (code) => {
                    if (!isClosed) {
                        isClosed = true;
                        if (code === 0) {
                            try {
                                if (controller.desiredSize !== null) {
                                    controller.close();
                                }
                            } catch (error) {
                                // Controller already closed by client
                            }
                        } else {
                            try {
                                if (controller.desiredSize !== null) {
                                    controller.error(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
                                }
                            } catch (error) {
                                // Controller already closed by client
                            }
                        }
                    }
                });

                process.on("error", (error) => {
                    if (!isClosed) {
                        isClosed = true;
                        try {
                            if (controller.desiredSize !== null) {
                                controller.error(error);
                            }
                        } catch (error) {
                            // Controller already closed by client
                        }
                    }
                });
            }
        });

        // 设置响应头
        const headers = new Headers();
        headers.set("Content-Type", "video/mp4");
        headers.set("Cache-Control", "no-cache");

        return new NextResponse(readableStream, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error("Watermark processing error:", error);

        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        return NextResponse.json(
            {
                error: "Watermark processing failed",
                details: errorMessage,
            },
            { status: 500 }
        );
    }
}
