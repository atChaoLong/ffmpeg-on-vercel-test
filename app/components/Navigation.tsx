"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link 
              href="/"
              className={`text-lg font-medium transition-colors ${
                pathname === "/" 
                  ? "text-blue-600" 
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              视频水印工具
            </Link>
            <Link 
              href="/test"
              className={`text-lg font-medium transition-colors ${
                pathname === "/test" 
                  ? "text-blue-600" 
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              API测试
            </Link>
          </div>
          
          <div className="text-sm text-gray-500">
            FFmpeg + Next.js + Vercel
          </div>
        </div>
      </div>
    </nav>
  );
}
