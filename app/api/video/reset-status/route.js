import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

// 重置卡住的处理状态
export async function POST(request) {
    try {
        const { videoId } = await request.json();

        if (!videoId) {
            return NextResponse.json(
                { error: "videoId is required" },
                { status: 400 }
            );
        }

        // 重置状态为pending
        const { error } = await supabase
            .from('ffmpeg_on_vercel_test')
            .update({ 
                status: 'pending',
                error_message: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', videoId);

        if (error) {
            return NextResponse.json(
                { error: "Failed to reset status" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Status reset successfully"
        });

    } catch (error) {
        console.error("Error resetting status:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
