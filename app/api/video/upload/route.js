import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { supabase } from "../../../lib/supabase";
import { v4 as uuidv4 } from 'uuid';

const R2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    }
})

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file) {
            return NextResponse({
                status: 400,
                body: { error: "File is required" }
            })
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 处理文件名：uuid_原文件名.后缀名
        const fileExtension = file.name.split('.').pop();
        const fileNameWithoutExt = file.name.replace(`.${fileExtension}`, '');
        const uuid = uuidv4();
        const newFileName = `${uuid}_${fileNameWithoutExt}.${fileExtension}`;
        const key = `videos/${newFileName}`;

        await R2.send(
            new PutObjectCommand({
                Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: file.type,
            })
        );

        const url = `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/${key}`;
        
        // 将视频URL存储到Supabase数据库
        const { data: dbData, error: dbError } = await supabase
            .from('ffmpeg_on_vercel_test')
            .insert([
                {
                    video_url: url,
                    watermark_video_url: null,
                }
            ])
            .select();

        if (dbError) {
            console.error("Error saving to database:", dbError);
            return NextResponse.json(
                { error: "Failed to save video URL to database" },
                { status: 500 }
            );
        }

        return NextResponse.json({ 
            url,
            id: dbData[0].id,
            message: "Video uploaded and saved to database successfully"
        });
    } catch (error) {
        console.error("Error uploading video to R2:", error);
        return NextResponse.json(
            { error: "Failed to upload video" },
            { status: 500 }
        );
    }
}