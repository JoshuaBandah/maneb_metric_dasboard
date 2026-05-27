/**
 * V1 Service Layer
 * Business logic for traditional backend-first architecture
 */

import { V1Student, V1SearchRequest, V1SearchResponse } from './v1-types';

/**
 * Search for student in database
 * V1: Direct database query via backend
 */
export async function searchStudentV1(
  request: V1SearchRequest,
  apiUrl: string
): Promise<V1SearchResponse> {
  try {
    const response = await fetch(`${apiUrl}/api/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Search failed: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload CSV file for V1
 * V1: Backend processes and stores in database
 */
export async function uploadCSVV1(
  school: string,
  file: File,
  apiUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    const formData = new FormData();
    formData.append('school', school);
    formData.append('file', file);

    const response = await fetch(`${apiUrl}/api/v1/upload`, {
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
      message: data.message || 'Upload successful',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get V1 metrics
 */
export async function getV1Metrics(apiUrl: string) {
  try {
    const response = await fetch(`${apiUrl}/api/v1/metrics`);
    if (!response.ok) {
      throw new Error('Failed to fetch metrics');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching V1 metrics:', error);
    return null;
  }
}
