/** @type {import('next').NextConfig} */
const nextConfig = {
  // 确保FFmpeg二进制文件被包含在构建中
  serverExternalPackages: ['ffmpeg-static'],
  // 配置webpack以包含FFmpeg二进制文件（仅在非Turbopack模式下）
  webpack: (config, { isServer, dev }) => {
    // 只在非Turbopack模式下配置webpack
    if (!dev && isServer) {
      config.externals = config.externals || [];
      config.externals.push('ffmpeg-static');
    }
    return config;
  }
};

export default nextConfig;
