'use client';

import { useState } from 'react';

export default function ConvertTestPage() {
  const [format, setFormat] = useState('webm');
  const [quality, setQuality] = useState('medium');
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleConvert = async () => {
    setIsConverting(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const params = new URLSearchParams({
        format,
        quality,
      });

      const response = await fetch(`/api/convert?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }

      // 创建下载链接
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

    } catch (err) {
      console.error('转换错误:', err);
      setError(err instanceof Error ? err.message : '转换失败');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `converted_video.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            视频转换测试页面
          </h1>
          
          <div className="space-y-6">
            {/* 格式选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                输出格式
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConverting}
              >
                <option value="webm">WebM (VP9 + Opus)</option>
                <option value="mp4">MP4 (H.264 + AAC)</option>
              </select>
            </div>

            {/* 质量选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                视频质量
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConverting}
              >
                <option value="low">低质量 (快速编码)</option>
                <option value="medium">中等质量 (平衡)</option>
                <option value="high">高质量 (慢速编码)</option>
              </select>
            </div>

            {/* 转换按钮 */}
            <div className="text-center">
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className={`px-8 py-3 rounded-lg font-medium text-white transition-colors ${
                  isConverting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }`}
              >
                {isConverting ? '转换中...' : '开始转换'}
              </button>
            </div>

            {/* 错误信息 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">转换失败</h3>
                    <div className="mt-2 text-sm text-red-700">
                      {error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 下载按钮 */}
            {downloadUrl && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">转换成功</h3>
                      <div className="mt-1 text-sm text-green-700">
                        视频已成功转换为 {format.toUpperCase()} 格式
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="ml-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    下载视频
                  </button>
                </div>
              </div>
            )}

            {/* 说明信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">使用说明</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 当前使用示例视频文件: sample.mp4</li>
                <li>• WebM 格式使用 VP9 视频编码和 Opus 音频编码</li>
                <li>• MP4 格式使用 H.264 视频编码和 AAC 音频编码</li>
                <li>• 高质量设置需要更长的处理时间</li>
                <li>• 转换完成后可以下载处理后的视频文件</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
