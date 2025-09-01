'use client';

import { useState } from 'react';

export default function WatermarkTestPage() {
  const [watermark, setWatermark] = useState('kling.png');
  const [position, setPosition] = useState('bottom-right');
  const [opacity, setOpacity] = useState('0.8');
  const [scale, setScale] = useState('0.1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // 可用的水印选项
  const watermarkOptions = [
    { value: 'kling.png', label: 'Kling AI' },
    { value: 'luma.png', label: 'Luma AI' },
    { value: 'pika.png', label: 'Pika Labs' },
    { value: 'runway.png', label: 'Runway' },
    { value: 'stability.png', label: 'Stability AI' },
    { value: 'veo.png', label: 'Google Veo' },
    { value: 'vidu.png', label: 'Vidu' },
  ];

  // 位置选项
  const positionOptions = [
    { value: 'top-left', label: '左上角' },
    { value: 'top-right', label: '右上角' },
    { value: 'bottom-left', label: '左下角' },
    { value: 'bottom-right', label: '右下角' },
    { value: 'center', label: '居中' },
  ];

  const handleAddWatermark = async () => {
    setIsProcessing(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const params = new URLSearchParams({
        watermark,
        position,
        opacity,
        scale,
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
      a.download = `watermarked_video.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            视频水印添加测试页面
          </h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 左侧：控制面板 */}
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
                  透明度: {Math.round(parseFloat(opacity) * 100)}%
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
                  <span>10%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* 缩放设置 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  水印大小: {Math.round(parseFloat(scale) * 100)}%
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.3"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  disabled={isProcessing}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5%</span>
                  <span>30%</span>
                </div>
              </div>

              {/* 处理按钮 */}
              <div className="text-center">
                <button
                  onClick={handleAddWatermark}
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
                        <h3 className="text-sm font-medium text-green-800">处理成功</h3>
                        <div className="mt-1 text-sm text-green-700">
                          视频水印已成功添加
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
            </div>

            {/* 右侧：预览和说明 */}
            <div className="space-y-6">
              {/* 水印预览 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">水印预览</h3>
                <div className="relative bg-gray-100 rounded-lg p-4 h-48 flex items-center justify-center">
                  <div className="relative w-full h-full bg-white rounded border-2 border-dashed border-gray-300">
                    {/* 模拟视频区域 */}
                    <div className="absolute inset-2 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                      <span className="text-sm">视频预览区域</span>
                    </div>
                    
                    {/* 水印预览 */}
                    <div 
                      className={`absolute bg-blue-500 text-white text-xs px-2 py-1 rounded opacity-${Math.round(parseFloat(opacity) * 10)}`}
                      style={{
                        width: `${Math.round(parseFloat(scale) * 200)}px`,
                        height: `${Math.round(parseFloat(scale) * 100)}px`,
                        ...(position === 'top-left' && { top: '8px', left: '8px' }),
                        ...(position === 'top-right' && { top: '8px', right: '8px' }),
                        ...(position === 'bottom-left' && { bottom: '8px', left: '8px' }),
                        ...(position === 'bottom-right' && { bottom: '8px', right: '8px' }),
                        ...(position === 'center' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
                      }}
                    >
                      {watermarkOptions.find(opt => opt.value === watermark)?.label}
                    </div>
                  </div>
                </div>
              </div>

              {/* 使用说明 */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">使用说明</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 当前使用示例视频文件: sample.mp4</li>
                  <li>• 支持多种 AI 平台水印选择</li>
                  <li>• 可调整水印位置、透明度和大小</li>
                  <li>• 输出格式为 MP4，兼容性良好</li>
                  <li>• 处理完成后可以下载带水印的视频</li>
                  <li>• 水印会保持原始比例缩放</li>
                </ul>
              </div>

              {/* 技术说明 */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-gray-800 mb-2">技术实现</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• 使用 FFmpeg filter_complex 进行水印合成</li>
                  <li>• 支持 RGBA 格式水印图片的透明度处理</li>
                  <li>• 流式处理，避免大文件内存占用</li>
                  <li>• H.264 视频编码 + AAC 音频编码</li>
                  <li>• 优化网络播放的 faststart 标志</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
