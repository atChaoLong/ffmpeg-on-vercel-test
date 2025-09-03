import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { publicUrl } = await request.json();
    if (!publicUrl) {
      return NextResponse.json({ error: "publicUrl 必填" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ffmpeg_on_vercel_test')
      .insert({
        video_url: publicUrl,
        status: 'uploaded',
        watermark_url: null,
        watermark_video_url: null,
        error_message: null
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "保存视频信息失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, videoId: data.id, videoUrl: publicUrl });
  } catch (error) {
    console.error("register error:", error);
    return NextResponse.json({ error: "注册视频失败" }, { status: 500 });
  }
}
