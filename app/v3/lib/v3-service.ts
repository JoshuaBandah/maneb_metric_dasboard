/**
 * V3 Service Layer
 * Business logic for CDN-based edge architecture
 */

import { V3SearchRequest, V3SearchResponse, V3SchoolFile } from './v3-types';
import { searchInSchoolFile } from './index-generator';

/**
 * Search for student in CDN-hosted school file
 * V3: Load from CDN, search in frontend memory
 */
export async function searchStudentV3(
  request: V3SearchRequest,
  cdnUrl: string
): Promise<V3SearchResponse> {
  const startTime = performance.now();

  try {
    const { regNumber, dob, school } = request;

    // Load school file from CDN
    const schoolFileUrl = `${cdnUrl}/${school}.json`;
    const response = await fetch(schoolFileUrl);

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to load school file from CDN: ${response.statusText}`,
        source: 'error',
        responseTime: performance.now() - startTime,
      };
    }

    const schoolFile: V3SchoolFile = await response.json();

    // Search within file using index
    const student = searchInSchoolFile(schoolFile, regNumber, dob);

    if (!student) {
      return {
        success: false,
        error: 'Student not found in school file',
        source: 'cdn',
        responseTime: performance.now() - startTime,
      };
    }

    return {
      success: true,
      data: student,
      source: 'cdn',
      responseTime: performance.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'error',
      responseTime: performance.now() - startTime,
    };
  }
}

/**
 * Upload CSV file for V3
 * V3: Backend processes, generates index, uploads to CDN
 */
export async function uploadCSVV3(
  school: string,
  file: File,
  apiUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    const formData = new FormData();
    formData.append('school', school);
    formData.append('file', file);

    const response = await fetch(`${apiUrl}/api/v3/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Upload failed: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: data.message || 'CSV processed and uploaded to CDN',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get V3 metrics
 */
export async function getV3Metrics(apiUrl: string) {
  try {
    const response = await fetch(`${apiUrl}/api/v3/metrics`);
    if (!response.ok) {
      throw new Error('Failed to fetch metrics');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching V3 metrics:', error);
    return null;
  }
}
