"use client";

import { useState } from "react";

export default function TestWatermark() {
  const [recordId, setRecordId] = useState("");
  const [watermark, setWatermark] = useState("kling");
  const [position, setPosition] = useState("bottom-right");
  const [opacity, setOpacity] = useState("0.7");
  const [size, setSize] = useState("small");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTest = async () => {
    if (!recordId) {
      alert("请输入记录 ID");
      return;
    }

    setIsProcessing(true);
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        recordId: recordId,
        watermark: watermark,
        position: position,
        opacity: opacity,
        size: size,
        format: "mp4",
      });

      const response = await fetch(`/api/watermark?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        alert(`水印处理完成！视频已保存到 R2。\n下载链接: ${result.watermarkedVideoUrl}`);
        
        // 提供下载链接
        const a = document.createElement("a");
        a.href = result.watermarkedVideoUrl;
        a.download = `test_watermarked_${watermark}.mp4`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error(result.error || '水印处理失败');
      }
    } catch (error) {
      console.error("Watermark processing error:", error);
      alert(`水印处理失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🧪 水印功能测试
          </h1>
          <p className="text-gray-600">
            测试水印处理 API 接口
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="space-y-6">
            {/* 记录 ID 输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                记录 ID
              </label>
              <input
                type="text"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                placeholder="输入 Supabase 记录 ID"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 水印选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                水印
              </label>
              <select
                value={watermark}
                onChange={(e) => setWatermark(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="kling">Kling</option>
                <option value="luma">Luma</option>
                <option value="pika">Pika</option>
                <option value="runway">Runway</option>
                <option value="stability">Stability</option>
                <option value="veo">Veo</option>
                <option value="vidu">Vidu</option>
              </select>
            </div>

            {/* 位置设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                位置
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="top-left">左上角</option>
                <option value="top-right">右上角</option>
                <option value="bottom-left">左下角</option>
                <option value="bottom-right">右下角</option>
                <option value="center">居中</option>
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
              />
            </div>

            {/* 大小设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                大小
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="small">小</option>
                <option value="medium">中</option>
                <option value="large">大</option>
              </select>
            </div>

            {/* 测试按钮 */}
            <div className="text-center">
              <button
                onClick={handleTest}
                disabled={!recordId || isProcessing}
                className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
                  !recordId || isProcessing
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
                  "🧪 测试水印处理"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📋 使用说明
          </h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>1. 首先使用上传功能上传一个视频，获得记录 ID</p>
            <p>2. 在此页面输入记录 ID 和设置水印参数</p>
            <p>3. 点击测试按钮，系统会处理视频并自动下载</p>
            <p>4. 处理完成后，视频会自动下载到本地</p>
          </div>
        </div>
      </div>
    </div>
  );
}
