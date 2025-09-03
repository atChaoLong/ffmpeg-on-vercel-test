import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/app/api/**": [
      "./node_modules/ffmpeg-static/**",
    ],
    "/app/api/convert": [
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
    "/app/api/video/watermark": [
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
  },
};

export default nextConfig;