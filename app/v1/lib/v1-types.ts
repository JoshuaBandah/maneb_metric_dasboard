/**
 * V1 Architecture Types
 * Traditional backend-first approach
 */

export interface V1Student {
  id: string;
  regNumber: string;
  dob: string;
  name: string;
  school: string;
  subjects: V1Subject[];
}

export interface V1Subject {
  name: string;
  grade: string;
  marks?: number;
}

export interface V1SearchRequest {
  regNumber: string;
  dob: string;
  school?: string;
}

export interface V1SearchResponse {
  success: boolean;
  data?: V1Student;
  error?: string;
}

export interface V1UploadRequest {
  school: string;
  file: File;
}

export interface V1Metrics {
  timestamp: string;
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p99ResponseTime: number;
  databaseQueryTime: number;
  backendProcessingTime: number;
}
