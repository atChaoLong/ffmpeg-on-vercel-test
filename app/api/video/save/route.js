import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export const maxDuration = 60;

export async function POST(request) {
    try {
        const { videoUrl, fileName, fileSize, fileType } = await request.json();

        if (!videoUrl) {
            return NextResponse.json(
                { error: "videoUrl is required" },
                { status: 400 }
            );
        }

        // 保存到数据库
        const { data, error } = await supabase
            .from('ffmpeg_on_vercel_test')
            .insert({
                video_url: videoUrl,
                watermark_video_url: null,
                watermark_url: null,
                status: 'pending',
                error_message: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Error saving video to database:", error);
            return NextResponse.json(
                { error: "Failed to save video to database" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            id: data.id,
            url: videoUrl,
            message: "Video saved successfully"
        });

    } catch (error) {
        console.error("Error in save API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
