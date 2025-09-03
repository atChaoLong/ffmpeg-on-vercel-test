import { useState, useEffect } from 'react';

interface VideoStatus {
  id: number;
  status: string;
  videoUrl: string;
  watermarkedVideoUrl: string | null;
  watermarkUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface UseVideoProcessingReturn {
  status: VideoStatus | null;
  isLoading: boolean;
  error: string | null;
  checkStatus: (id: number) => Promise<void>;
}

export function useVideoProcessing(): UseVideoProcessingReturn {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async (id: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/status/${id}`);
      const result = await response.json();

      if (result.success) {
        setStatus(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('查询状态失败');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    status,
    isLoading,
    error,
    checkStatus,
  };
}
