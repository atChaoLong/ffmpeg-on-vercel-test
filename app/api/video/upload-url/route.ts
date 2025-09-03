import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { fileName, contentType } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json({ error: "fileName 和 contentType 必填" }, { status: 400 });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `videos/${uuidv4()}_${safeName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 * 10 }); // 10分钟

    const publicUrl = `https://pub-c05ff69f643944b3a4d9afdc221b3fad.r2.dev/${key}`;

    return NextResponse.json({
      success: true,
      key,
      uploadUrl,
      publicUrl,
    });
  } catch (error) {
    console.error("presign error:", error);
    return NextResponse.json({ error: "获取上传URL失败" }, { status: 500 });
  }
}
