/**
 * Centralized API client for all server communication
 * Handles error handling, logging, and retry logic
 */

import { captureError } from './errorMonitoring';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface ApiError extends Error {
  status?: number;
  response?: Response;
}

/**
 * Make an API request with error handling and logging
 */
async function makeRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    // Use backend URL from environment
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const fullUrl = url.startsWith('http') ? url : `${backendUrl}${url}`;

    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    // Log the request
    console.log(`[API] ${options.method || 'GET'} ${fullUrl} - ${response.status}`);

    if (!response.ok) {
      const error: ApiError = new Error(`API Error: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      
      // Capture error for monitoring
      captureError(error, {
        url: fullUrl,
        method: options.method || 'GET',
        status: response.status,
      });

      throw error;
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    // Log and capture unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[API] Error: ${err.message}`);
    
    captureError(err, {
      url,
      method: options.method || 'GET',
    });

    throw err;
  }
}

/**
 * Retry logic for failed requests
 */
async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i < maxRetries - 1) {
        console.log(`[API] Retry attempt ${i + 1}/${maxRetries - 1} after ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * API Client - Centralized place for all API calls
 */
export const apiClient = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    return retryRequest(
      () =>
        makeRequest<LoginResponse>('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
      2 // Retry once for login
    );
  },

  /**
   * Logout the current user
   */
  logout: async (): Promise<void> => {
    try {
      await makeRequest('/api/logout', {
        method: 'POST',
      });
      console.log('[API] Logout successful');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureError(err, { action: 'logout' });
      throw err;
    }
  },

  /**
   * Connect to metrics stream via EventSource
   */
  connectMetricsStream: (url: string): EventSource => {
    try {
      console.log(`[API] Connecting to metrics stream: ${url}`);
      const es = new EventSource(url);

      es.onerror = (event) => {
        const error = new Error('EventSource connection error');
        captureError(error, {
          url,
          readyState: es.readyState,
          eventType: 'error',
        });
        console.error('[API] EventSource error:', event);
      };

      return es;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureError(err, { url, action: 'connectMetricsStream' });
      throw err;
    }
  },

  /**
   * Verify authentication token
   */
  verifyToken: async (token: string): Promise<boolean> => {
    try {
      const response = await makeRequest<{ valid: boolean }>('/api/verify-token', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return response.valid;
    } catch (error) {
      console.error('[API] Token verification failed');
      return false;
    }
  },

  /**
   * Refresh authentication token
   */
  refreshToken: async (): Promise<string> => {
    try {
      const response = await makeRequest<{ token: string }>('/api/refresh-token', {
        method: 'POST',
      });
      return response.token;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureError(err, { action: 'refreshToken' });
      throw err;
    }
  },

  /**
   * Get user profile
   */
  getUserProfile: async (): Promise<LoginResponse['user']> => {
    return makeRequest<LoginResponse['user']>('/api/user/profile', {
      method: 'GET',
    });
  },

  /**
   * Health check endpoint
   */
  healthCheck: async (): Promise<{ status: string }> => {
    try {
      return await makeRequest<{ status: string }>('/api/health', {
        method: 'GET',
      });
    } catch (error) {
      console.warn('[API] Health check failed');
      return { status: 'unhealthy' };
    }
  },
};

export type { ApiError, LoginResponse };
