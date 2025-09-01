import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/app/api/convert": [
      "./public/videos/sample.mp4",
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/ffmpeg.exe",
    ],
    "/app/api/video/watermark": [
      "./public/videos/sample.mp4",
      "./public/images/watermark/*.png",
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/ffmpeg.exe",
    ],
  },
};

export default nextConfig;