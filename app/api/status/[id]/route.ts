import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recordId = parseInt(id);

    if (isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: '无效的记录 ID' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('ffmpeg_on_vercel_test')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: '找不到记录' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        status: data.status,
        videoUrl: data.video_url,
        watermarkedVideoUrl: data.watermark_video_url,
        watermarkUrl: data.watermark_url,
        errorMessage: data.error_message,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { success: false, error: '查询状态失败' },
      { status: 500 }
    );
  }
}
