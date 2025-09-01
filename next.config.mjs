/** @type {import('next').NextConfig} */
const nextConfig = {
  // 确保FFmpeg二进制文件被包含在构建中
  experimental: {
    serverComponentsExternalPackages: ['ffmpeg-static']
  },
  // 配置webpack以包含FFmpeg二进制文件
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('ffmpeg-static');
    }
    return config;
  }
};

export default nextConfig;
