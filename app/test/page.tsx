"use client";

import { useState } from "react";
import Navigation from "../components/Navigation";

export default function TestPage() {
  const [testResult, setTestResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const testWatermarkAPI = async () => {
    setLoading(true);
    setTestResult("测试中...");
    
    try {
      const response = await fetch("/api/video/watermark?watermark=kling.png&position=bottom-right&opacity=0.8&scale=0.1&format=mp4");
      
      if (response.ok) {
        setTestResult("✅ 水印API测试成功！");
      } else {
        const error = await response.text();
        setTestResult(`❌ 水印API测试失败: ${error}`);
      }
    } catch (error) {
      setTestResult(`❌ 水印API测试错误: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testSupabase = async () => {
    setLoading(true);
    setTestResult("测试中...");
    
    try {
      const response = await fetch("/api/video/status?videoId=1");
      
      if (response.ok) {
        setTestResult("✅ Supabase连接测试成功！");
      } else {
        const error = await response.text();
        setTestResult(`❌ Supabase连接测试失败: ${error}`);
      }
    } catch (error) {
      setTestResult(`❌ Supabase连接测试错误: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="py-8">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
            API 测试页面
          </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">功能测试</h2>
          
          <div className="space-y-4">
            <button
              onClick={testWatermarkAPI}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              测试水印API
            </button>
            
            <button
              onClick={testSupabase}
              disabled={loading}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              测试Supabase连接
            </button>
          </div>
          
          {testResult && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <p className="text-gray-800">{testResult}</p>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">测试说明</h2>
          <ul className="space-y-2 text-gray-700">
            <li>• <strong>测试水印API</strong>: 测试FFmpeg水印处理功能（使用示例视频）</li>
            <li>• <strong>测试Supabase连接</strong>: 测试数据库连接是否正常</li>
            <li>• 这些测试可以帮助诊断系统配置问题</li>
          </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
