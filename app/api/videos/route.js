import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function GET() {
    try {
        const { data: videos, error } = await supabase
            .from('ffmpeg_on_vercel_test')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching videos:", error);
            return NextResponse.json(
                { error: "Failed to fetch videos" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            videos: videos || []
        });

    } catch (error) {
        console.error("Error in videos API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
