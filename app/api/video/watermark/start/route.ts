import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StartBody {
  videoId: number;
  watermarkFile?: string; // e.g., kling.png
  position?: string;      // e.g., bottom-right
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as StartBody;
    const { videoId, watermarkFile, position } = body;

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ffmpeg_on_vercel_test')
      .update({
        status: 'queued',
        watermark_url: watermarkFile || null,
        watermark_location: position || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to queue task" }, { status: 500 });
    }

    return NextResponse.json({ success: true, videoId: data.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
