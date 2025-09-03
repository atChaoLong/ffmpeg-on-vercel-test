import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/app/lib/r2-client';
import { supabase } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const watermarkId = formData.get('watermarkId') as string;
    const position = formData.get('position') as string;
    const opacity = formData.get('opacity') as string;
    const size = formData.get('size') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '没有选择文件' },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!file.type.startsWith('video/')) {
      return NextResponse.json(
        { success: false, error: '只支持视频文件' },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${uuidv4()}_${file.name}`;
    const key = `videos/${uniqueFileName}`;

    // 上传到 R2
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    // 构建视频 URL
    const videoUrl = `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/${key}`;

    // 保存到 Supabase
    const { data, error } = await supabase
      .from('ffmpeg_on_vercel_test')
      .insert({
        video_url: videoUrl,
        watermark_url: `/images/watermark/${watermarkId}.png`,
        status: 'uploaded',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: '数据库保存失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      recordId: data.id,
      watermarkId,
      position,
      opacity,
      size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: '上传失败' },
      { status: 500 }
    );
  }
}
