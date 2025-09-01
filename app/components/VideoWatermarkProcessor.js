'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

// 水印类型配置
const WATERMARK_TYPES = [
    { value: 'kling', label: 'Kling AI', preview: '/image/watermark/kling.png' },
    { value: 'runway', label: 'Runway', preview: '/image/watermark/runway.png' },
    { value: 'pika', label: 'Pika', preview: '/image/watermark/pika.png' },
    { value: 'vidu', label: 'Vidu', preview: '/image/watermark/vidu.png' },
    { value: 'veo', label: 'Veo', preview: '/image/watermark/veo.png' },
    { value: 'luma', label: 'Luma', preview: '/image/watermark/luma.png' },
    { value: 'stability', label: 'Stability AI', preview: '/image/watermark/stability.png' }
];

export default function VideoWatermarkProcessor() {
    const [videos, setVideos] = useState([]);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [watermarkType, setWatermarkType] = useState('kling');
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    // 获取视频列表
    const fetchVideos = async () => {
        try {
            const response = await fetch('/api/videos');
            if (response.ok) {
                const data = await response.json();
                setVideos(data.videos || []);
            }
        } catch (err) {
            console.error('Error fetching videos:', err);
        } finally {
            setLoading(false);
        }
    };

    // 流式水印处理
    const handleWatermarkProcessing = async () => {
        if (!selectedVideo) {
            setError('请先选择一个视频');
            return;
        }

        setProcessing(true);
        setError(null);
        setResult(null);
        setProgress(0);
        setProgressText('正在启动处理...');

        try {
            // 构建流式水印API URL
            const apiUrl = `/api/video/watermark?videoUrl=${encodeURIComponent(selectedVideo.video_url)}&watermarkType=${watermarkType}`;
            
            setProgress(10);
            setProgressText('正在连接处理服务...');
            
            // 直接获取流式视频
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '水印处理失败');
            }

            setProgress(30);
            setProgressText('正在处理视频...');

            // 创建视频URL用于预览
            const videoBlob = await response.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            
            setProgress(100);
            setProgressText('处理完成！');
            
            setResult({
                message: '水印处理完成！',
                watermarkedVideoUrl: videoUrl,
                originalVideo: selectedVideo.video_url,
                watermarkType: watermarkType
            });

        } catch (err) {
            setError(err.message || '处理失败，请重试');
            setProgress(0);
            setProgressText('');
        } finally {
            setProcessing(false);
        }
    };

    // 组件加载时获取视频列表
    useEffect(() => {
        fetchVideos();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="text-gray-600">加载中...</div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto">
            <div className="bg-white shadow-lg rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                        视频水印处理
                    </h2>
                    <button
                        onClick={fetchVideos}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        刷新列表
                    </button>
                </div>

                {/* 视频选择 */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择视频
                    </label>
                    <select
                        value={selectedVideo?.id || ''}
                        onChange={(e) => {
                            const video = videos.find(v => v.id === parseInt(e.target.value));
                            setSelectedVideo(video);
                        }}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">请选择视频</option>
                        {videos.map((video) => (
                            <option key={video.id} value={video.id}>
                                {video.video_url ? `视频 ${video.id}` : '未命名视频'}
                            </option>
                        ))}
                    </select>
                    
                    {selectedVideo && (
                        <div className="mt-2 p-2 bg-gray-50 rounded">
                            <p className="text-sm text-gray-600">
                                已选择: 视频 {selectedVideo.id}
                            </p>
                            {selectedVideo.video_url && (
                                <video
                                    controls
                                    className="w-full mt-2 rounded"
                                    src={selectedVideo.video_url}
                                >
                                    您的浏览器不支持视频播放
                                </video>
                            )}
                        </div>
                    )}
                </div>

                {/* 水印类型选择 */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择水印类型
                    </label>
                    <select
                        value={watermarkType}
                        onChange={(e) => setWatermarkType(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                        {WATERMARK_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                    
                    {/* 水印预览 */}
                    <div className="mt-2 p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600 mb-2">水印预览:</p>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Image
                                    src={WATERMARK_TYPES.find(t => t.value === watermarkType)?.preview || ''}
                                    alt="水印预览"
                                    width={120}
                                    height={120}
                                    className="object-contain border border-gray-300 rounded bg-white p-2"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'block';
                                    }}
                                />
                                <div 
                                    className="hidden w-[120px] h-[120px] border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500"
                                >
                                    图片加载失败
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">
                                    {WATERMARK_TYPES.find(t => t.value === watermarkType)?.label}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    水印将添加到视频右下角
                                </p>
                            </div>
                        </div>
                        
                        {/* 效果预览 */}
                        {selectedVideo?.video_url && (
                            <div className="mt-3">
                                <p className="text-sm text-gray-600 mb-2">效果预览:</p>
                                <div className="relative w-full h-32 bg-black rounded overflow-hidden">
                                    <video
                                        className="w-full h-full object-cover"
                                        src={selectedVideo.video_url}
                                        muted
                                        loop
                                        autoPlay
                                    />
                                    <div className="absolute bottom-2 right-2">
                                        <Image
                                            src={WATERMARK_TYPES.find(t => t.value === watermarkType)?.preview || ''}
                                            alt="水印效果"
                                            width={40}
                                            height={40}
                                            className="object-contain opacity-80"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 text-center">
                                    水印将显示在视频右下角（如预览所示）
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 处理按钮 */}
                <button
                    onClick={handleWatermarkProcessing}
                    disabled={!selectedVideo || processing}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {processing ? '处理中...' : '开始添加水印'}
                </button>

                {/* 进度条 */}
                {processing && (
                    <div className="mt-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>{progressText}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className="bg-green-600 h-2 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* 错误信息 */}
                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* 处理结果 */}
                {result && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                        <h3 className="text-sm font-medium text-green-800 mb-2">
                            {result.message}
                        </h3>
                        
                        {/* 水印视频预览 */}
                        <div className="mt-4">
                            <video
                                controls
                                className="w-full rounded-md"
                                src={result.watermarkedVideoUrl}
                            >
                                您的浏览器不支持视频播放
                            </video>
                        </div>
                        
                        {/* 下载按钮 */}
                        <div className="mt-3">
                            <a
                                href={result.watermarkedVideoUrl}
                                download={`watermarked_${watermarkType}_video.mp4`}
                                className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                            >
                                下载水印视频
                            </a>
                        </div>
                    </div>
                )}

                {/* 重要提示 */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">
                        ℹ️ 处理说明
                    </h3>
                    <ul className="text-xs text-blue-700 space-y-1">
                        <li>• 处理方式：流式处理，实时返回结果</li>
                        <li>• 处理时间：通常需要30秒-2分钟</li>
                        <li>• 水印位置：视频右下角</li>
                        <li>• 支持格式：MP4, AVI, MOV等</li>
                    </ul>
                </div>

                {/* 接口信息 */}
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <h3 className="text-sm font-medium text-gray-800 mb-2">
                        接口信息
                    </h3>
                    <ul className="text-xs text-gray-600 space-y-1">
                        <li>• 接口地址: GET /api/video/watermark</li>
                        <li>• 参数: videoUrl, watermarkType</li>
                        <li>• 处理: 流式FFmpeg处理</li>
                        <li>• 返回: 直接返回视频流</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}