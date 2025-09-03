"use client";

import { useState, useRef, useEffect } from "react";
import Navigation from "./components/Navigation";

interface VideoData {
  id: number;
  video_url: string;
  watermark_video_url: string | null;
  watermark_url: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

const watermarkOptions = [
  { value: "kling.png", label: "Kling" },
  { value: "luma.png", label: "Luma" },
  { value: "pika.png", label: "Pika" },
  { value: "runway.png", label: "Runway" },
  { value: "stability.png", label: "Stability" },
  { value: "veo.png", label: "Veo" },
  { value: "vidu.png", label: "Vidu" },
];

const positionOptions = [
  { value: "top-left", label: "左上角" },
  { value: "top-right", label: "右上角" },
  { value: "bottom-left", label: "左下角" },
  { value: "bottom-right", label: "右下角" },
  { value: "center", label: "中心" },
];

const formatOptions = [
  { value: "mp4", label: "MP4" },
  { value: "webm", label: "WebM" },
];

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentVideo, setCurrentVideo] = useState<VideoData | null>(null);
  const [watermarkFile, setWatermarkFile] = useState("kling.png");
  const [position, setPosition] = useState("bottom-right");
  const [opacity, setOpacity] = useState(0.8);
  const [scale, setScale] = useState(0.1);
  const [format, setFormat] = useState("mp4");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 轮询检查状态
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentVideo && (currentVideo.status === 'uploaded' || currentVideo.status === 'processing')) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/video/status?videoId=${currentVideo.id}`);
          const result = await response.json();
          
          if (result.success) {
            const updatedVideo = result.data;
            setCurrentVideo(updatedVideo);
            
            if (updatedVideo.status === 'completed') {
              setProcessing(false);
              setStatus("水印添加完成！");
            } else if (updatedVideo.status === 'failed') {
              setProcessing(false);
              setError(updatedVideo.error_message || "处理失败");
            }
          }
        } catch (err) {
          console.error("Status check failed:", err);
        }
      }, 2000); // 每2秒检查一次
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentVideo]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("请选择视频文件");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("文件大小不能超过100MB");
      return;
    }

    setUploading(true);
    setError("");
    setStatus("正在申请直传URL...");
    setUploadProgress(0);

    try {
      // 1) 向后端申请预签名URL
      const presignRes = await fetch("/api/video/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type })
      });
      const presignJson = await presignRes.json();
      if (!presignRes.ok || !presignJson?.uploadUrl) {
        throw new Error(presignJson?.error || "获取直传URL失败");
      }

      const { uploadUrl, publicUrl } = presignJson as { uploadUrl: string; publicUrl: string };

      setStatus("正在直传到R2...");

      // 2) 使用XHR直传到R2并跟踪进度
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.round((evt.loaded / evt.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`直传失败: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("网络错误，直传失败"));
        xhr.send(file);
      });

      setStatus("直传完成，写入数据库...");

      // 3) 通知后端注册该视频（写入Supabase）
      const registerRes = await fetch("/api/video/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicUrl })
      });
      const registerJson = await registerRes.json();
      if (!registerRes.ok || !registerJson?.success) {
        throw new Error(registerJson?.error || "注册视频失败");
      }

      setCurrentVideo({
        id: registerJson.videoId,
        video_url: registerJson.videoUrl,
        watermark_video_url: null,
        watermark_url: null,
        status: 'uploaded',
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: null
      });
      setStatus("视频上传成功！现在可以添加水印");
      setUploadProgress(100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "上传过程中发生错误";
      setError(message);
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleAddWatermark = async () => {
    if (!currentVideo) return;

    setProcessing(true);
    setError("");
    setStatus("正在添加水印...");

    try {
      const response = await fetch("/api/video/watermark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId: currentVideo.id,
          watermarkFile,
          position,
          opacity,
          scale,
          format,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus("水印添加请求已提交，正在处理中...");
      } else {
        setError(result.error || "水印添加失败");
        setProcessing(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "水印添加过程中发生错误";
      setError(message);
      setProcessing(false);
      console.error("Watermark error:", err);
    }
  };

  const resetForm = () => {
    setCurrentVideo(null);
    setWatermarkFile("kling.png");
    setPosition("bottom-right");
    setOpacity(0.8);
    setScale(0.1);
    setFormat("mp4");
    setStatus("");
    setError("");
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
            视频水印添加工具
          </h1>

          {/* 文件上传区域 */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">1. 上传视频</h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              
              {!currentVideo ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? "上传中..." : "选择视频文件"}
                </button>
              ) : (
                <div className="text-left">
                  <p className="text-green-600 font-medium">✓ 视频已上传</p>
                  <p className="text-sm text-gray-600 mt-1">
                    文件名: {currentVideo.video_url.split('/').pop()}
                  </p>
                </div>
              )}
            </div>

            {/* 上传进度条 */}
            {uploading && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-2">{uploadProgress}%</p>
              </div>
            )}
          </div>

          {/* 水印设置区域 */}
          {currentVideo && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">2. 水印设置</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择水印
                  </label>
                  <select
                    value={watermarkFile}
                    onChange={(e) => setWatermarkFile(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {watermarkOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    水印位置
                  </label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {positionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    透明度: {opacity}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    缩放比例: {scale}
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    输出格式
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {formatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleAddWatermark}
                  disabled={processing}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processing ? "处理中..." : "添加水印"}
                </button>
                
                <button
                  onClick={resetForm}
                  className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600"
                >
                  重新开始
                </button>
              </div>
            </div>
          )}

          {/* 状态显示区域 */}
          {(status || error) && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">处理状态</h2>
              
              {status && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                  <p className="text-blue-800">{status}</p>
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* 结果展示区域 */}
          {currentVideo && currentVideo.status === 'completed' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">处理结果</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">原始视频</h3>
                  <video
                    controls
                    className="w-full rounded-lg"
                    src={currentVideo.video_url}
                  >
                    您的浏览器不支持视频播放
                  </video>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">带水印视频</h3>
                  <video
                    controls
                    className="w-full rounded-lg"
                    src={currentVideo.watermark_video_url!}
                  >
                    您的浏览器不支持视频播放
                  </video>
                </div>
              </div>
              
              <div className="mt-4 flex gap-4">
                <a
                  href={currentVideo.video_url}
                  download
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  下载原视频
                </a>
                <a
                  href={currentVideo.watermark_video_url!}
                  download
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  下载带水印视频
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
