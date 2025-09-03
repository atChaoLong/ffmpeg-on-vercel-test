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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("video") as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Invalid file type. Only video files are allowed." },
        { status: 400 }
      );
    }

    // 验证文件大小 (限制为100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum size is 100MB." },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}_${file.name}`;
    const key = `videos/${fileName}`;

    // 上传到R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await r2Client.send(uploadCommand);

    // 生成访问URL
    const videoUrl = `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/${key}`;

    // 保存到Supabase
    const { data, error } = await supabase
      .from('ffmpeg_on_vercel_test')
      .insert({
        video_url: videoUrl,
        status: 'uploaded',
        watermark_url: null,
        watermark_video_url: null,
        error_message: null
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to save video info to database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      videoId: data.id,
      videoUrl: videoUrl,
      message: "Video uploaded successfully"
    });

  } catch (error) {
    console.error("Video upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}
