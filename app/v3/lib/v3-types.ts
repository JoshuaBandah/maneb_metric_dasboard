/**
 * V3 Architecture Types
 * CDN-based edge distribution approach for MANEB JCE results
 */

export interface V3Student {
  regNumber: string; // e.g. J0282/098
  dob: string;       // e.g. 1990-05-15
  name: string;
  subjects: V3Subject[];
}

export interface V3Subject {
  name: string;
  grade: string;
  marks?: number;
}

/**
 * School file stored on R2 CDN
 * Named by centre number: 0282.json
 */
export interface V3SchoolFile {
  centre: string;        // e.g. "0282"
  school: string;        // e.g. "Zomba Secondary"
  exam: string;          // e.g. "JCE 2024"
  publishedAt: string;   // ISO timestamp
  totalStudents: number;
  students: V3Student[];
  /**
   * index maps "J0282/098_1990-05-15" → array position in students[]
   * Enables O(1) lookup without looping
   */
  index: Record<string, number>;
}

export interface V3SearchRequest {
  examNumber: string; // e.g. J0282/098
  dob: string;        // e.g. 1990-05-15
}

export interface V3SearchResponse {
  success: boolean;
  data?: V3Student;
  error?: string;
  source: 'cdn' | 'error';
  responseTime: number;
}

export interface V3UploadRequest {
  file: File;
  examYear: string; // e.g. "2024"
  schoolName: string;
}

export interface V3UploadResult {
  success: boolean;
  centre: string;
  school: string;
  totalStudents: number;
  r2Key: string;       // path in R2 bucket e.g. jce/2024/0282.json
  publicUrl: string;   // Cloudflare public URL
  uploadedAt: string;
}

export interface V3Metrics {
  timestamp: string;
  cdnRequests: number;
  cdnCacheHitRate: number;
  cdnResponseTime: number;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  uploads: V3UploadRecord[];
}

export interface V3UploadRecord {
  centre: string;
  school: string;
  examYear: string;
  totalStudents: number;
  uploadedAt: string;
  publicUrl: string;
}
