'use client';

import VideoUploadTest from './components/VideoUploadTest';
import VideoWatermarkProcessor from './components/VideoWatermarkProcessor';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          FFmpeg on Vercel 测试平台
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 视频上传测试 */}
          <div>
            <VideoUploadTest />
          </div>
          
          {/* 水印处理功能 */}
          <div>
            <VideoWatermarkProcessor />
          </div>
        </div>
      </div>
    </div>
  );
}

