export interface VideoRecord {
  id: number;
  video_url: string | null;
  watermark_video_url: string | null;
  created_at: string;
  updated_at: string | null;
  watermark_url: string | null;
  status: string | null;
  error_message: string | null;
}

export interface WatermarkOption {
  id: string;
  name: string;
  image: string;
}

export interface UploadResponse {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

export interface WatermarkProcessResponse {
  success: boolean;
  watermarkedVideoUrl?: string;
  error?: string;
}
