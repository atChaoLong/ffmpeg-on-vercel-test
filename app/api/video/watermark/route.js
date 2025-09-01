import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { supabase } from "../../../lib/supabase";
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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
    
    // 使用系统临时目录，兼容Windows和Unix系统
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
    const fileBuffer = fs.readFileSync(filePath);
    
    await R2.send(
        new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: 'video/mp4',
        })
    );

    return `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/${key}`;
}

// FFmpeg处理水印 - 使用ffmpeg-on-vercel方式
async function processWatermark(videoPath, watermarkPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`Processing video: ${videoPath}`);
        console.log(`Watermark: ${watermarkPath}`);
        console.log(`Output: ${outputPath}`);
        
        // 使用ffmpeg-static包提供的FFmpeg路径
        const ffmpegPath = ffmpeg;
        console.log(`Using FFmpeg path: ${ffmpegPath}`);
        
        const ffmpegProcess = spawn(ffmpegPath, [
            '-i', videoPath,
            '-i', watermarkPath,
            '-filter_complex', 'overlay=W-w-10:H-h-10',
            '-c:a', 'copy',
            '-y', // 覆盖输出文件
            outputPath
        ]);

        let stderr = '';
        
        ffmpegProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('FFmpeg output:', data.toString());
        });

        ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process exited with code: ${code}`);
            if (code === 0) {
                console.log('FFmpeg processing completed successfully');
                resolve(outputPath);
            } else {
                console.error('FFmpeg stderr:', stderr);
                reject(new Error(`FFmpeg process failed with code ${code}: ${stderr}`));
            }
        });

        ffmpegProcess.on('error', (error) => {
            console.error('FFmpeg spawn error:', error);
            reject(new Error(`FFmpeg process error: ${error.message}`));
        });
    });
}



// 清理临时文件
function cleanupTempFiles(files) {
    files.forEach(file => {
        try {
            if (file && fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(`Cleaned up temporary file: ${file}`);
            }
        } catch (error) {
            console.error(`Error cleaning up file ${file}:`, error);
        }
    });
}

// 后台异步处理函数
async function processWatermarkAsync(videoId, watermarkType) {
    const tempFiles = [];
    
    try {
        console.log(`Starting watermark processing for video ${videoId} with ${watermarkType} watermark`);

        // 1. 获取视频记录
        const { data: videoRecord, error: dbError } = await supabase
            .from('ffmpeg_on_vercel_test')
            .select('*')
            .eq('id', videoId)
            .single();

        if (dbError || !videoRecord) {
            throw new Error(`Video record not found: ${videoId}`);
        }

        // 2. 更新状态为处理中
        await supabase
            .from('ffmpeg_on_vercel_test')
            .update({ 
                watermark_url: WATERMARK_URLS[watermarkType],
                status: 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('id', videoId);

        // 3. 下载视频和水印
        const videoFilename = `video_${videoId}_${Date.now()}.mp4`;
        const watermarkFilename = `watermark_${watermarkType}_${Date.now()}.png`;
        
        console.log(`Downloading video from: ${videoRecord.video_url}`);
        const videoPath = await downloadFile(videoRecord.video_url, videoFilename);
        console.log(`Video downloaded to: ${videoPath}`);
        
        console.log(`Downloading watermark from: ${WATERMARK_URLS[watermarkType]}`);
        const watermarkPath = await downloadFile(WATERMARK_URLS[watermarkType], watermarkFilename);
        console.log(`Watermark downloaded to: ${watermarkPath}`);
        
        tempFiles.push(videoPath, watermarkPath);

        // 4. FFmpeg处理
        const outputFilename = `watermarked_${videoId}_${Date.now()}.mp4`;
        const tempDir = process.platform === 'win32' ? process.env.TEMP || process.env.TMP || 'C:\\temp' : '/tmp';
        const outputPath = path.join(tempDir, outputFilename);
        
        await processWatermark(videoPath, watermarkPath, outputPath);
        tempFiles.push(outputPath);

        // 5. 上传处理后的视频
        const r2Key = `watermarked/${uuidv4()}_${videoId}.mp4`;
        const processedVideoUrl = await uploadToR2(outputPath, r2Key);

        // 6. 更新数据库
        const { error: updateError } = await supabase
            .from('ffmpeg_on_vercel_test')
            .update({ 
                watermark_video_url: processedVideoUrl,
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('id', videoId);

        if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log(`Watermark processing completed for video ${videoId}`);

    } catch (error) {
        console.error(`Watermark processing failed for video ${videoId}:`, error);
        
        // 更新错误状态
        await supabase
            .from('ffmpeg_on_vercel_test')
            .update({ 
                status: 'failed',
                error_message: error.message,
                updated_at: new Date().toISOString()
            })
            .eq('id', videoId);
    } finally {
        // 清理临时文件
        cleanupTempFiles(tempFiles);
    }
}

// 主接口 - 立即响应
export async function POST(request) {
    try {
        const { videoId, watermarkType } = await request.json();

        // 验证参数
        if (!videoId || !watermarkType) {
            return NextResponse.json(
                { error: "videoId and watermarkType are required" },
                { status: 400 }
            );
        }

        if (!WATERMARK_URLS[watermarkType]) {
            return NextResponse.json(
                { error: "Invalid watermark type" },
                { status: 400 }
            );
        }

        // 检查视频是否存在
        const { data: videoRecord, error: dbError } = await supabase
            .from('ffmpeg_on_vercel_test')
            .select('*')
            .eq('id', videoId)
            .single();

        if (dbError || !videoRecord) {
            return NextResponse.json(
                { error: "Video not found" },
                { status: 404 }
            );
        }

        // 启动后台处理（不等待完成）
        processWatermarkAsync(videoId, watermarkType);

        return NextResponse.json({
            success: true,
            processingId: videoId,
            message: "Watermark processing started",
            watermarkType: watermarkType
        });

    } catch (error) {
        console.error("Error in watermark processing request:", error);
        return NextResponse.json(
            { error: "Failed to start watermark processing" },
            { status: 500 }
        );
    }
}

// 状态查询接口
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const videoId = searchParams.get('videoId');

        if (!videoId) {
            return NextResponse.json(
                { error: "videoId is required" },
                { status: 400 }
            );
        }

        const { data: videoRecord, error: dbError } = await supabase
            .from('ffmpeg_on_vercel_test')
            .select('*')
            .eq('id', videoId)
            .single();

        if (dbError || !videoRecord) {
            return NextResponse.json(
                { error: "Video not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            status: videoRecord.status || 'pending',
            data: {
                id: videoRecord.id,
                video_url: videoRecord.video_url,
                watermark_url: videoRecord.watermark_url,
                watermark_video_url: videoRecord.watermark_video_url,
                created_at: videoRecord.created_at,
                updated_at: videoRecord.updated_at
            },
            error_message: videoRecord.error_message,
            message: getStatusMessage(videoRecord.status)
        });

    } catch (error) {
        console.error("Error in status query:", error);
        return NextResponse.json(
            { error: "Failed to get processing status" },
            { status: 500 }
        );
    }
}

// 获取状态消息
function getStatusMessage(status) {
    switch (status) {
        case 'pending':
            return 'Waiting to start processing';
        case 'processing':
            return 'Processing watermark...';
        case 'completed':
            return 'Watermark processing completed';
        case 'failed':
            return 'Watermark processing failed';
        default:
            return 'Unknown status';
    }
}
