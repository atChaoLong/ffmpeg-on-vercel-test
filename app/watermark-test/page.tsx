'use client';

import { useState } from 'react';

export default function WatermarkTestPage() {
  const [watermark, setWatermark] = useState('kling');
  const [position, setPosition] = useState('bottom-right');
  const [opacity, setOpacity] = useState('0.7');
  const [size, setSize] = useState('small');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const watermarkOptions = [
    { value: 'kling', label: 'Kling AI' },
    { value: 'luma', label: 'Luma AI' },
    { value: 'pika', label: 'Pika Labs' },
    { value: 'runway', label: 'Runway' },
    { value: 'stability', label: 'Stability AI' },
    { value: 'veo', label: 'Veo' },
    { value: 'vidu', label: 'Vidu' },
  ];

  const positionOptions = [
    { value: 'top-left', label: '左上角' },
    { value: 'top-right', label: '右上角' },
    { value: 'bottom-left', label: '左下角' },
    { value: 'bottom-right', label: '右下角' },
    { value: 'center', label: '居中' },
  ];

  const sizeOptions = [
    { value: 'small', label: '小 (10%)' },
    { value: 'medium', label: '中 (15%)' },
    { value: 'large', label: '大 (20%)' },
  ];

  const handleWatermark = async () => {
    setIsProcessing(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const params = new URLSearchParams({
        watermark,
        position,
        opacity,
        size,
      });

      const response = await fetch(`/api/video/watermark?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
      }

      // 创建下载链接
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

    } catch (err) {
      console.error('水印处理错误:', err);
      setError(err instanceof Error ? err.message : '水印处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `watermarked_${watermark}.mp4`;
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
            视频水印测试页面
          </h1>
          
          <div className="space-y-6">
            {/* 水印选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择水印
              </label>
              <select
                value={watermark}
                onChange={(e) => setWatermark(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              >
                {watermarkOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 位置选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                水印位置
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              >
                {positionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 透明度设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                透明度: {opacity}
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(e.target.value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={isProcessing}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>透明</span>
                <span>不透明</span>
              </div>
            </div>

            {/* 大小选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                水印大小
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              >
                {sizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 处理按钮 */}
            <div className="text-center">
              <button
                onClick={handleWatermark}
                disabled={isProcessing}
                className={`px-8 py-3 rounded-lg font-medium text-white transition-colors ${
                  isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }`}
              >
                {isProcessing ? '处理中...' : '添加水印'}
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
                    <h3 className="text-sm font-medium text-red-800">处理失败</h3>
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
                      <h3 className="text-sm font-medium text-green-800">水印添加成功</h3>
                      <div className="mt-1 text-sm text-green-700">
                        视频已成功添加 {watermarkOptions.find(w => w.value === watermark)?.label} 水印
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
                <li>• 支持多种AI平台水印: Kling, Luma, Pika, Runway, Stability, Veo, Vidu</li>
                <li>• 可调整水印位置: 四个角落或居中</li>
                <li>• 可调整透明度: 0.1 (透明) 到 1.0 (不透明)</li>
                <li>• 可调整大小: 小(10%), 中(15%), 大(20%)</li>
                <li>• 处理完成后可以下载带水印的视频文件</li>
              </ul>
            </div>

            {/* 预览区域 */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-gray-800 mb-2">当前设置预览</h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">水印:</span> {watermarkOptions.find(w => w.value === watermark)?.label}
                </div>
                <div>
                  <span className="font-medium">位置:</span> {positionOptions.find(p => p.value === position)?.label}
                </div>
                <div>
                  <span className="font-medium">透明度:</span> {opacity}
                </div>
                <div>
                  <span className="font-medium">大小:</span> {sizeOptions.find(s => s.value === size)?.label}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
