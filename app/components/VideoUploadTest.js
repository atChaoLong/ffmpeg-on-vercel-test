'use client';

import { useState } from 'react';

export default function VideoUploadTest() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        setError(null);
        setResult(null);
    };

    const handleUpload = async () => {
        if (!file) {
            setError('请选择一个视频文件');
            return;
        }

        // 检查文件大小（Vercel免费版限制50MB）
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            setError(`文件太大！最大支持50MB，当前文件${(file.size / 1024 / 1024).toFixed(1)}MB`);
            return;
        }

        setUploading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

            const response = await fetch('/api/video/upload', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `上传失败 (${response.status})`);
            }

            const data = await response.json();
            setResult(data);
        } catch (err) {
            if (err.name === 'AbortError') {
                setError('上传超时，请检查网络连接或尝试较小的文件');
            } else {
                setError(err.message || '上传失败，请重试');
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto">
            <div className="bg-white shadow-lg rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
                    视频上传测试
                </h2>

                {/* 文件选择 */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择视频文件
                    </label>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {file && (
                        <div className="mt-2 p-2 bg-gray-50 rounded">
                            <p className="text-sm text-gray-600">
                                已选择: {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                                文件大小: {(file.size / 1024 / 1024).toFixed(1)} MB
                                {file.size > 50 * 1024 * 1024 && (
                                    <span className="text-red-500 ml-2">⚠️ 超过50MB限制</span>
                                )}
                            </p>
                        </div>
                    )}
                </div>

                {/* 上传按钮 */}
                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {uploading ? '上传中...' : '上传视频'}
                </button>

                {/* 错误信息 */}
                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* 成功结果 */}
                {result && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                        <h3 className="text-sm font-medium text-green-800 mb-2">
                            上传成功！
                        </h3>
                        <p className="text-sm text-green-700 mb-2">
                            数据库ID: {result.id}
                        </p>
                        <p className="text-sm text-green-700 mb-2">
                            视频 URL:
                        </p>
                        <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 break-all"
                        >
                            {result.url}
                        </a>
                        
                        {/* 视频预览 */}
                        <div className="mt-4">
                            <video
                                controls
                                className="w-full rounded-md"
                                src={result.url}
                            >
                                您的浏览器不支持视频播放
                            </video>
                        </div>
                    </div>
                )}

                                    {/* 重要提示 */}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                        <h3 className="text-sm font-medium text-blue-800 mb-2">
                            ℹ️ 上传说明
                        </h3>
                        <ul className="text-xs text-blue-700 space-y-1">
                            <li>• 文件大小限制：最大50MB</li>
                            <li>• 支持格式：MP4, AVI, MOV等常见视频格式</li>
                            <li>• 上传超时：30秒</li>
                            <li>• 存储位置：Cloudflare R2</li>
                        </ul>
                    </div>

                    {/* 接口信息 */}
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                        <h3 className="text-sm font-medium text-gray-800 mb-2">
                            接口信息
                        </h3>
                        <ul className="text-xs text-gray-600 space-y-1">
                            <li>• 接口地址: POST /api/video/upload</li>
                            <li>• 参数名: file (FormData)</li>
                            <li>• 存储: Cloudflare R2</li>
                            <li>• 返回: {`{ url: string, id: number }`}</li>
                        </ul>
                    </div>
            </div>
        </div>
    );
}
