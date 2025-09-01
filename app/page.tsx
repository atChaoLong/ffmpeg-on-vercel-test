"use client";

import { useState } from "react";
import Image from "next/image";

interface WatermarkOption {
  id: string;
  name: string;
  image: string;
}

const watermarkOptions: WatermarkOption[] = [
  { id: "kling", name: "Kling", image: "/images/watermark/kling.png" },
  { id: "luma", name: "Luma", image: "/images/watermark/luma.png" },
  { id: "pika", name: "Pika", image: "/images/watermark/pika.png" },
  { id: "runway", name: "Runway", image: "/images/watermark/runway.png" },
  { id: "stability", name: "Stability", image: "/images/watermark/stability.png" },
  { id: "veo", name: "Veo", image: "/images/watermark/veo.png" },
  { id: "vidu", name: "Vidu", image: "/images/watermark/vidu.png" },
];

const positionOptions = [
  { value: "top-left", label: "左上角" },
  { value: "top-right", label: "右上角" },
  { value: "bottom-left", label: "左下角" },
  { value: "bottom-right", label: "右下角" },
  { value: "center", label: "居中" },
];

const sizeOptions = [
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" },
];

export default function Home() {
  const [selectedWatermark, setSelectedWatermark] = useState("kling");
  const [position, setPosition] = useState("bottom-right");
  const [opacity, setOpacity] = useState(0.7);
  const [size, setSize] = useState("small");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWatermark = async () => {
    setIsProcessing(true);
    try {
      const params = new URLSearchParams({
        watermark: selectedWatermark,
        position: position,
        opacity: opacity.toString(),
        size: size,
      });

      const response = await fetch(`/api/video/watermark?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 创建下载链接
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watermarked_${selectedWatermark}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error processing watermark:', error);
      alert('处理水印时出错，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🎬 视频水印处理工具
          </h1>
          <p className="text-gray-600">
            为您的视频添加专业水印，支持多种AI工具品牌水印
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* 水印选择 */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              选择水印
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {watermarkOptions.map((option) => (
                <div
                  key={option.id}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedWatermark === option.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedWatermark(option.id)}
                >
                  <div className="aspect-square relative mb-2">
                    <Image
                      src={option.image}
                      alt={option.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <p className="text-center text-sm font-medium text-gray-700">
                    {option.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 设置选项 */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* 位置设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                水印位置
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                透明度: {Math.round(opacity * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* 大小设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                水印大小
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {sizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 预览区域 */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              预览设置
            </h2>
            <div className="bg-gray-100 rounded-lg p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    原始视频
                  </h3>
                  <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                    <video
                      src="/videos/sample.mp4"
                      controls
                      className="max-w-full max-h-full rounded-lg"
                    >
                      您的浏览器不支持视频播放
                    </video>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    当前设置
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>水印:</strong> {watermarkOptions.find(w => w.id === selectedWatermark)?.name}</p>
                    <p><strong>位置:</strong> {positionOptions.find(p => p.value === position)?.label}</p>
                    <p><strong>透明度:</strong> {Math.round(opacity * 100)}%</p>
                    <p><strong>大小:</strong> {sizeOptions.find(s => s.value === size)?.label}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 处理按钮 */}
          <div className="text-center">
            <button
              onClick={handleWatermark}
              disabled={isProcessing}
              className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
                isProcessing
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  处理中...
                </div>
              ) : (
                "🎬 添加水印并下载"
              )}
            </button>
          </div>
        </div>

        {/* 功能说明 */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📋 功能说明
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-800 mb-2">支持的水印</h3>
              <ul className="space-y-1">
                <li>• Kling AI 水印</li>
                <li>• Luma AI 水印</li>
                <li>• Pika AI 水印</li>
                <li>• Runway AI 水印</li>
                <li>• Stability AI 水印</li>
                <li>• Veo AI 水印</li>
                <li>• Vidu AI 水印</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-2">自定义选项</h3>
              <ul className="space-y-1">
                <li>• 5种位置选择（四角+居中）</li>
                <li>• 透明度调节（10%-100%）</li>
                <li>• 3种大小规格</li>
                <li>• 实时预览设置</li>
                <li>• 一键下载处理结果</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}