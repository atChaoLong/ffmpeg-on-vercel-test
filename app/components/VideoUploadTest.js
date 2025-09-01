'use client';

import { useState } from 'react';

export default function VideoUploadTest() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

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
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

            // 创建 XMLHttpRequest 来监控上传进度
            const xhr = new XMLHttpRequest();
            
            // 监听上传进度
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percentComplete);
                }
            });

            // 创建 Promise 来处理 XMLHttpRequest
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.onload = () => {
                    clearTimeout(timeoutId);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('响应解析失败'));
                        }
                    } else {
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            reject(new Error(errorData.error || `上传失败 (${xhr.status})`));
                        } catch (e) {
                            reject(new Error(`上传失败 (${xhr.status})`));
                        }
                    }
                };

                xhr.onerror = () => {
                    clearTimeout(timeoutId);
                    reject(new Error('网络错误，请检查连接'));
                };

                xhr.ontimeout = () => {
                    clearTimeout(timeoutId);
                    reject(new Error('上传超时，请检查网络连接或尝试较小的文件'));
                };

                xhr.onabort = () => {
                    clearTimeout(timeoutId);
                    reject(new Error('上传被取消'));
                };
            });

            // 开始上传
            xhr.open('POST', '/api/video/upload');
            xhr.timeout = 30000;
            xhr.send(formData);

            const data = await uploadPromise;
            setResult(data);
            setUploadProgress(100);
        } catch (err) {
            setError(err.message || '上传失败，请重试');
            setUploadProgress(0);
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
                    {uploading ? `上传中... ${uploadProgress}%` : '上传视频'}
                </button>

                {/* 上传进度条 */}
                {uploading && (
                    <div className="mt-3">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>上传进度</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress}%` }}
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
