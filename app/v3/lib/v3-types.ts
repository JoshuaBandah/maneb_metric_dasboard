/**
 * V3 Architecture Types
 * CDN-based edge distribution approach
 */

export interface V3Student {
  regNumber: string;
  dob: string;
  name: string;
  subjects: V3Subject[];
  link: string; // Pre-generated link to student result
}

export interface V3Subject {
  name: string;
  grade: string;
  marks?: number;
}

export interface V3SchoolFile {
  school: string;
  uploadedAt: string;
  totalStudents: number;
  students: V3Student[];
  index: Record<string, number>; // Maps "regNumber_dob" to array index
}

export interface V3SearchRequest {
  regNumber: string;
  dob: string;
  school: string;
}

export interface V3SearchResponse {
  success: boolean;
  data?: V3Student;
  error?: string;
  source: 'cdn' | 'error';
  responseTime: number;
}

export interface V3UploadRequest {
  school: string;
  file: File;
}

export interface V3Metrics {
  timestamp: string;
  cdnRequests: number;
  cdnCacheHitRate: number;
  cdnResponseTime: number;
  frontendSearchTime: number;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  backendHits: number; // Should be 0 or minimal
}
