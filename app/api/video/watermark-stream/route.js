import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { supabase } from "../../../lib/supabase";
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60;

// R2客户端配置
const R2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    }
});

// 水印图片URL配置
const WATERMARK_URLS = {
    kling: 'https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/kling.png',
    pika: 'https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/pika.png',
    runway: 'https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/runway.png',
    stability: 'https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/stability.png',
    vidu: 'https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/vidu.png',
    veo: 'https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/veo.png',
    luma: 'https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/images/watermark/luma.png'
};

// 下载文件到临时目录
async function downloadFile(url, filename) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${url}`);
    }
    
    const buffer = await response.arrayBuffer();
    
    // 使用系统临时目录
    const tempDir = process.platform === 'win32' ? process.env.TEMP || process.env.TMP || 'C:\\temp' : '/tmp';
    
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempPath = path.join(tempDir, filename);
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    return tempPath;
}

// 上传文件到R2
async function uploadToR2(filePath, key) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        
        const command = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: 'video/mp4'
        });
        
        await R2.send(command);
        
        // 返回公开URL
        return `https://${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
    } catch (error) {
        console.error('Error uploading to R2:', error);
        throw new Error('Failed to upload to R2');
    }
}

export async function POST(request) {
    try {
        const { videoId, watermarkType } = await request.json();

        if (!videoId || !watermarkType) {
            return NextResponse.json(
                { error: "videoId and watermarkType are required" },
                { status: 400 }
            );
        }

        // 获取视频信息
        const { data: video, error: videoError } = await supabase
            .from('ffmpeg_on_vercel_test')
            .select('*')
            .eq('id', videoId)
            .single();

        if (videoError || !video) {
            return NextResponse.json(
                { error: "Video not found" },
                { status: 404 }
            );
        }

        if (!video.video_url) {
            return NextResponse.json(
                { error: "Video URL not found" },
                { status: 400 }
            );
        }

        // 更新状态为处理中
        await supabase
            .from('ffmpeg_on_vercel_test')
            .update({ 
                status: 'processing',
                watermark_url: WATERMARK_URLS[watermarkType],
                updated_at: new Date().toISOString()
            })
            .eq('id', videoId);

        // 下载视频和水印到临时文件
        const videoPath = await downloadFile(video.video_url, `video_${videoId}.mp4`);
        const watermarkPath = await downloadFile(WATERMARK_URLS[watermarkType], `watermark_${watermarkType}.png`);

        // 生成输出文件路径
        const tempDir = process.platform === 'win32' ? process.env.TEMP || process.env.TMP || 'C:\\temp' : '/tmp';
        const outputPath = path.join(tempDir, `watermarked_${videoId}_${uuidv4()}.mp4`);

        try {
            // 使用FFmpeg处理视频
            await new Promise((resolve, reject) => {
                if (!ffmpeg) {
                    reject(new Error("FFmpeg binary not found"));
                    return;
                }

                // FFmpeg参数：添加水印到右下角
                const ffmpegArgs = [
                    '-i', videoPath, // 输入视频文件
                    '-i', watermarkPath, // 输入水印文件
                    '-filter_complex', '[1:v]scale=120:120[wm];[0:v][wm]overlay=W-w-10:H-h-10', // 水印滤镜
                    '-c:a', 'copy', // 复制音频流
                    '-f', 'mp4',
                    outputPath // 输出到文件
                ];

                console.log('Starting FFmpeg process with args:', ffmpegArgs);

                const process = spawn(ffmpegPath, ffmpegArgs, { stdio: 'pipe' });

                let stderr = "";

                process.stderr.on("data", (data) => {
                    stderr += data.toString();
                });

                process.on("close", (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
                    }
                });

                process.on("error", (error) => {
                    reject(error);
                });
            });

            // 上传处理后的视频到R2
            const outputKey = `video/watermarked/${uuidv4()}_${videoId}.mp4`;
            const watermarkedVideoUrl = await uploadToR2(outputPath, outputKey);

            // 更新数据库
            const { error: updateError } = await supabase
                .from('ffmpeg_on_vercel_test')
                .update({
                    watermark_video_url: watermarkedVideoUrl,
                    status: 'completed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', videoId);

            if (updateError) {
                throw new Error(`Database update failed: ${updateError.message}`);
            }

            // 清理临时文件
            try {
                fs.unlinkSync(videoPath);
                fs.unlinkSync(watermarkPath);
                fs.unlinkSync(outputPath);
            } catch (cleanupError) {
                console.error('Error cleaning up temp files:', cleanupError);
            }

            // 返回成功响应
            return NextResponse.json({
                success: true,
                message: 'Video watermarked successfully',
                watermarkedVideoUrl: watermarkedVideoUrl,
                videoId: videoId
            });

        } catch (error) {
            // 更新状态为失败
            await supabase
                .from('ffmpeg_on_vercel_test')
                .update({
                    status: 'failed',
                    error_message: error.message,
                    updated_at: new Date().toISOString()
                })
                .eq('id', videoId);

            // 清理临时文件
            try {
                fs.unlinkSync(videoPath);
                fs.unlinkSync(watermarkPath);
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            } catch (cleanupError) {
                console.error('Error cleaning up temp files:', cleanupError);
            }

            throw error;
        }

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
