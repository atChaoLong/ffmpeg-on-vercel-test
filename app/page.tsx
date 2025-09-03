"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useVideoProcessing } from "./lib/hooks/useVideoProcessing";


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

const formatOptions = [
  { value: "webm", label: "WebM (VP9 + Opus)", description: "现代格式，压缩率高" },
  { value: "mp4", label: "MP4 (H.264 + AAC)", description: "兼容性最好" },
];

const qualityOptions = [
  { value: "low", label: "低质量", description: "文件小，处理快" },
  { value: "medium", label: "中等质量", description: "平衡质量和大小" },
  { value: "high", label: "高质量", description: "文件大，质量好" },
];

export default function Home() {
  // 标签页状态
  const [activeTab, setActiveTab] = useState<"upload" | "watermark" | "convert">("upload");
  
  // 文件上传相关状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(null);
  
  // 水印功能状态
  const [selectedWatermark, setSelectedWatermark] = useState("kling");
  const [position, setPosition] = useState("bottom-right");
  const [opacity, setOpacity] = useState(0.7);
  const [size, setSize] = useState("small");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 转换功能状态
  const [format, setFormat] = useState("webm");
  const [quality, setQuality] = useState("medium");
  const [isConverting, setIsConverting] = useState(false);
  
  // 使用自定义 Hook
  const { status, isLoading, error, checkStatus } = useVideoProcessing();

  // 文件选择处理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
    } else {
      alert('请选择有效的视频文件');
    }
  };

  // 文件上传处理
  const handleUpload = async () => {
    if (!selectedFile) {
      alert('请先选择视频文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('watermarkId', selectedWatermark);
      formData.append('position', position);
      formData.append('opacity', opacity.toString());
      formData.append('size', size);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setCurrentRecordId(result.recordId);
        setUploadProgress(100);
        alert('视频上传成功！正在处理水印...');
        
        // 开始水印处理
        await handleWatermarkProcessing(result.recordId);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 水印处理
  const handleWatermarkProcessing = async (recordId: number) => {
    setIsProcessing(true);
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        recordId: recordId.toString(),
        watermark: selectedWatermark,
        position: position,
        opacity: opacity.toString(),
        size: size,
        format: 'mp4', // 默认输出 MP4 格式
      });

      const response = await fetch(`/api/watermark?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        alert(`水印处理完成！视频已保存到 R2。\n下载链接: ${result.watermarkedVideoUrl}`);
        
        // 查询最新状态
        await checkStatus(recordId);
      } else {
        throw new Error(result.error || '水印处理失败');
      }
    } catch (error) {
      console.error('Watermark processing error:', error);
      alert(`水印处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWatermark = async () => {
    if (!currentRecordId) {
      alert('请先上传视频');
      return;
    }

    await handleWatermarkProcessing(currentRecordId);
  };

  const handleConvert = async () => {
    setIsConverting(true);
    try {
      const params = new URLSearchParams({
        format: format,
        quality: quality,
      });

      const response = await fetch(`/api/convert?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 创建下载链接
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `converted_${format}_${quality}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error converting video:', error);
      alert('转换视频时出错，请重试');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🎬 视频处理工具
          </h1>
          <p className="text-gray-600">
            专业的视频转换和水印处理工具
          </p>
        </div>

        {/* 标签页导航 */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "upload"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              📤 上传视频
            </button>
            <button
              onClick={() => setActiveTab("watermark")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "watermark"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              🏷️ 添加水印
            </button>
            <button
              onClick={() => setActiveTab("convert")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeTab === "convert"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              🔄 格式转换
            </button>
          </div>
        </div>

        {/* 上传功能 */}
        {activeTab === "upload" && (
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

            {/* 文件上传区域 */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                上传视频
              </h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="space-y-4">
                    <p className="text-lg font-medium text-gray-700">
                      已选择: {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      大小: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50"
                    >
                      重新选择
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-6xl">📁</div>
                    <p className="text-lg font-medium text-gray-700">
                      点击选择视频文件
                    </p>
                    <p className="text-sm text-gray-500">
                      支持 MP4, WebM, AVI 等格式
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      选择文件
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 上传进度 */}
            {isUploading && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">上传进度</span>
                  <span className="text-sm text-gray-500">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* 处理状态 */}
            {currentRecordId && (
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  处理状态
                </h2>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-medium text-gray-700">
                      记录 ID: {currentRecordId}
                    </span>
                    <button
                      onClick={() => checkStatus(currentRecordId)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                    >
                      {isLoading ? '查询中...' : '刷新状态'}
                    </button>
                  </div>
                  
                  {status && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">状态:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          status.status === 'completed' ? 'bg-green-100 text-green-800' :
                          status.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                          status.status === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {status.status === 'completed' ? '已完成' :
                           status.status === 'processing' ? '处理中' :
                           status.status === 'error' ? '出错' :
                           status.status === 'uploaded' ? '已上传' : status.status}
                        </span>
                      </div>
                      
                      {status.watermarkedVideoUrl && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">水印视频:</span>
                          <a
                            href={status.watermarkedVideoUrl}
                            download
                            className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            下载
                          </a>
                        </div>
                      )}
                      
                      {status.errorMessage && (
                        <div className="text-red-600 text-sm">
                          错误: {status.errorMessage}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {error && (
                    <div className="text-red-600 text-sm">
                      查询失败: {error}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 上传按钮 */}
            <div className="text-center">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading || isProcessing}
                className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
                  !selectedFile || isUploading || isProcessing
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                }`}
              >
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    上传中...
                  </div>
                ) : isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    处理中...
                  </div>
                ) : (
                  "🚀 上传并处理水印"
                )}
              </button>
            </div>
          </div>
        )}

        {/* 水印功能 */}
        {activeTab === "watermark" && (
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
        )}

        {/* 转换功能 */}
        {activeTab === "convert" && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            {/* 格式选择 */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                选择输出格式
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {formatOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      format === option.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setFormat(option.value)}
                  >
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {option.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {option.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 质量设置 */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                选择质量等级
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {qualityOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      quality === option.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setQuality(option.value)}
                  >
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {option.label}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {option.description}
                    </p>
                  </div>
                ))}
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
                      <p><strong>输出格式:</strong> {formatOptions.find(f => f.value === format)?.label}</p>
                      <p><strong>质量等级:</strong> {qualityOptions.find(q => q.value === quality)?.label}</p>
                      <p><strong>视频编码:</strong> {format === "webm" ? "VP9" : "H.264"}</p>
                      <p><strong>音频编码:</strong> {format === "webm" ? "Opus" : "AAC"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 转换按钮 */}
            <div className="text-center">
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
                  isConverting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl"
                }`}
              >
                {isConverting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    转换中...
                  </div>
                ) : (
                  "🔄 开始转换并下载"
                )}
              </button>
            </div>
          </div>
        )}

        {/* 功能说明 */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📋 功能说明
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-800 mb-2">上传功能</h3>
              <ul className="space-y-1">
                <li>• 支持多种视频格式</li>
                <li>• 自动上传到 Cloudflare R2</li>
                <li>• 文件重命名为 UUID 格式</li>
                <li>• 实时上传进度显示</li>
                <li>• 自动水印处理</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-2">水印功能</h3>
              <ul className="space-y-1">
                <li>• 7种AI工具品牌水印</li>
                <li>• 5种位置选择（四角+居中）</li>
                <li>• 透明度调节（10%-100%）</li>
                <li>• 3种大小规格</li>
                <li>• 实时预览设置</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-2">转换功能</h3>
              <ul className="space-y-1">
                <li>• 支持 WebM 和 MP4 格式</li>
                <li>• 3种质量等级选择</li>
                <li>• VP9/H.264 视频编码</li>
                <li>• Opus/AAC 音频编码</li>
                <li>• 流式处理，快速下载</li>
              </ul>
            </div>
          </div>
          
          {/* 测试链接 */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <a
              href="/test-watermark"
              className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🧪 测试水印功能
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}