import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    // 从Supabase获取视频状态
    const { data, error } = await supabase
      .from('ffmpeg_on_vercel_test')
      .select('*')
      .eq('id', videoId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error("Video status query error:", error);
    return NextResponse.json(
      { error: "Failed to query video status" },
      { status: 500 }
    );
  }
}
