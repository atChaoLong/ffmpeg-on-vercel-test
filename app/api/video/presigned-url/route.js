import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60;

// R2客户端配置
const R2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    }
});

export async function POST(request) {
    try {
        const { fileName, fileType } = await request.json();

        if (!fileName || !fileType) {
            return NextResponse.json(
                { error: "fileName and fileType are required" },
                { status: 400 }
            );
        }

        // 生成唯一的文件名
        const fileExtension = fileName.split('.').pop();
        const uniqueFileName = `${uuidv4()}_${fileName}`;
        const key = `videos/${uniqueFileName}`;

        // 创建预签名URL
        const command = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            Key: key,
            ContentType: fileType,
        });

        const presignedUrl = await getSignedUrl(R2, command, { expiresIn: 3600 }); // 1小时有效期

        // 返回预签名URL和文件信息
        return NextResponse.json({
            success: true,
            presignedUrl: presignedUrl,
            key: key,
            publicUrl: `https://${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`,
            fileName: uniqueFileName
        });

    } catch (error) {
        console.error("Error generating presigned URL:", error);
        return NextResponse.json(
            { error: "Failed to generate presigned URL" },
            { status: 500 }
        );
    }
}
