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

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentVideo, setCurrentVideo] = useState<VideoData | null>(null);
  const [watermarkFile, setWatermarkFile] = useState("kling.png");
  const [position, setPosition] = useState("center");
  const [opacity, setOpacity] = useState(0.7);
  const [format, setFormat] = useState("mp4");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [tasks, setTasks] = useState<VideoData[]>([]);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleSelectTask = (task: VideoData) => {
    setCurrentVideo(task);
    setStatus("已选择任务，配置下方水印参数后开始处理");
    setError("");
    setProcessing(false);
    // 滚动到设置区
    setTimeout(() => settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

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

  // 任务列表轮询
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/video/list?limit=20`);
        const json = await res.json();
        if (json?.success) setTasks(json.items as VideoData[]);
      } catch {}
    };
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    // 基本校验
    for (const f of files) {
      if (!f.type.startsWith("video/")) {
        setError("请选择视频文件");
        return;
      }
      if (f.size > 100 * 1024 * 1024) {
        setError("文件大小不能超过100MB");
        return;
      }
    }

    setBatchUploading(true);
    setError("");
    setStatus("");
    setBatchStatus(`准备上传 ${files.length} 个文件...`);
    setUploadProgress(0);

    try {
      let done = 0;
      for (const file of files) {
        setBatchStatus(`上传中 (${done + 1}/${files.length}) - ${file.name}`);
        // 1) 申请预签名URL
        const presignRes = await fetch("/api/video/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type })
        });
        const presignJson = await presignRes.json();
        if (!presignRes.ok || !presignJson?.uploadUrl) {
          throw new Error(presignJson?.error || `获取直传URL失败: ${file.name}`);
        }
        const { uploadUrl, publicUrl } = presignJson as { uploadUrl: string; publicUrl: string };

        // 2) 直传
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
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`直传失败(${xhr.status}): ${file.name}`));
          };
          xhr.onerror = () => reject(new Error(`网络错误，直传失败: ${file.name}`));
          xhr.send(file);
        });

        // 3) 注册
        const registerRes = await fetch("/api/video/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicUrl })
        });
        const registerJson = await registerRes.json();
        if (!registerRes.ok || !registerJson?.success) {
          throw new Error(registerJson?.error || `注册视频失败: ${file.name}`);
        }

        // 将当前视频设为最新一个，便于立即操作“添加水印”
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

        done += 1;
        setBatchStatus(`已完成 ${done}/${files.length}`);
      }

      setUploadProgress(100);
      setStatus(`全部完成：共 ${files.length} 个视频`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "上传过程中发生错误";
      setError(message);
    } finally {
      setBatchUploading(false);
    }
  };

  const handleAddWatermark = async () => {
    if (!currentVideo) return;

    setProcessing(true);
    setError("");
    setStatus("任务已提交，开始排队处理...");

    try {
      // 1) 标记任务为 queued（立即返回）
      const startRes = await fetch("/api/video/watermark/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: currentVideo.id, watermarkFile, position })
      });
      const startJson = await startRes.json();
      if (!startRes.ok || !startJson?.success) {
        throw new Error(startJson?.error || "提交任务失败");
      }

      // 2) 触发后端处理（不等待返回），前端只轮询状态
      fetch("/api/video/watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: currentVideo.id,
          watermarkFile,
          position,
          opacity,
          format,
        })
      }).catch(() => {});

      setStatus("任务已开始处理，稍后自动刷新状态...");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "提交任务出错";
      setError(message);
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setCurrentVideo(null);
    setWatermarkFile("kling.png");
    setPosition("center");
    setOpacity(0.7);
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
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading || batchUploading}
              />
              
              {!currentVideo ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || batchUploading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading || batchUploading ? "上传中..." : "选择视频文件"}
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
            {batchUploading && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-2">{batchStatus}（{uploadProgress}%）</p>
              </div>
            )}
          </div>

          {/* 水印设置区域 */}
          {currentVideo && (
            <div ref={settingsRef} className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-2">2. 水印设置</h2>
              <p className="text-sm text-gray-500 mb-4">当前任务 ID：{currentVideo.id}</p>
              
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

          {/* 任务列表 */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">任务列表</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">状态</th>
                    <th className="py-2 pr-4">水印</th>
                    <th className="py-2 pr-4">位置</th>
                    <th className="py-2 pr-4">原视频</th>
                    <th className="py-2 pr-4">水印视频</th>
                    <th className="py-2 pr-4">更新时间</th>
                    <th className="py-2 pr-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="py-2 pr-4">{t.id}</td>
                      <td className="py-2 pr-4">
                        <span className={
                          t.status === 'completed' ? 'text-green-600' :
                          t.status === 'failed' ? 'text-red-600' :
                          t.status === 'processing' ? 'text-blue-600' :
                          t.status === 'queued' ? 'text-yellow-600' : 'text-gray-600'
                        }>
                          {t.status || '-'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{(() => { const w = t.watermark_url || ""; const parts = w.split('|'); const name = (parts[0] || "").replace('.png',''); return name || '-'; })()}</td>
                      <td className="py-2 pr-4">{t.watermark_location || '-'}</td>
                      <td className="py-2 pr-4">{t.watermark_url && t.watermark_url.includes('|') ? (t.watermark_url.split('|')[1] || '-') : '-'}</td>
                      <td className="py-2 pr-4 truncate max-w-[240px]">
                        {t.video_url ? <a className="text-blue-600 hover:underline" href={t.video_url} target="_blank">原视频</a> : '-'}
                      </td>
                      <td className="py-2 pr-4 truncate max-w-[240px]">
                        {t.watermark_video_url ? <a className="text-green-600 hover:underline" href={t.watermark_video_url} target="_blank">水印视频</a> : '-'}
                      </td>
                      <td className="py-2 pr-4">{t.updated_at ? new Date(t.updated_at).toLocaleString() : new Date(t.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        <button
                          onClick={() => handleSelectTask(t)}
                          disabled={t.status === 'processing' || t.status === 'queued'}
                          className={`px-3 py-1 rounded ${
                            t.status === 'processing' || t.status === 'queued'
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          配置水印
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td className="py-4 text-gray-500" colSpan={8}>暂无任务</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

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
