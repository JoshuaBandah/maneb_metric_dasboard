/**
 * Error Monitoring System
 * Tracks and reports errors to a monitoring service
 * Supports both Sentry and custom backend logging
 */

interface ErrorContext {
  [key: string]: any;
}

interface ErrorReport {
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: string;
  url: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Determine error severity based on error type and context
 */
function determineSeverity(error: Error, context?: ErrorContext): ErrorSeverity {
  // Authentication errors are critical
  if (error.message.includes('auth') || error.message.includes('login')) {
    return ErrorSeverity.CRITICAL;
  }

  // Connection errors are high
  if (error.message.includes('connection') || error.message.includes('network')) {
    return ErrorSeverity.HIGH;
  }

  // Validation errors are medium
  if (error.message.includes('validation') || error.message.includes('invalid')) {
    return ErrorSeverity.MEDIUM;
  }

  // Default to medium
  return ErrorSeverity.MEDIUM;
}

/**
 * Format error for reporting
 */
function formatErrorReport(
  error: Error,
  context?: ErrorContext,
  severity?: ErrorSeverity
): ErrorReport {
  return {
    message: error.message,
    stack: error.stack,
    context: context || {},
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    severity: severity || determineSeverity(error, context),
  };
}

/**
 * Send error to monitoring backend
 */
async function sendToBackend(report: ErrorReport): Promise<void> {
  try {
    const response = await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      console.error('[ErrorMonitoring] Failed to send error report:', response.statusText);
    }
  } catch (error) {
    // Silently fail - don't create infinite error loops
    console.error('[ErrorMonitoring] Failed to send error to backend:', error);
  }
}

/**
 * Send error to Sentry (if configured)
 */
function sendToSentry(error: Error, context?: ErrorContext): void {
  // Check if Sentry is available
  if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
    try {
      const Sentry = (window as any).__SENTRY__;
      Sentry.captureException(error, { extra: context });
    } catch (err) {
      console.error('[ErrorMonitoring] Failed to send to Sentry:', err);
    }
  }
}

/**
 * Main error capture function
 * Sends errors to both backend and Sentry (if available)
 */
export async function captureError(
  error: Error,
  context?: ErrorContext,
  severity?: ErrorSeverity
): Promise<void> {
  // Format the error report
  const report = formatErrorReport(error, context, severity);

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[ErrorMonitoring]', {
      message: report.message,
      severity: report.severity,
      context: report.context,
      stack: report.stack,
    });
  }

  // Send to backend
  await sendToBackend(report);

  // Send to Sentry if available
  sendToSentry(error, context);
}

/**
 * Capture a message (non-error)
 */
export async function captureMessage(
  message: string,
  context?: ErrorContext,
  severity: ErrorSeverity = ErrorSeverity.LOW
): Promise<void> {
  const report: ErrorReport = {
    message,
    context: context || {},
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    severity,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[ErrorMonitoring]', { message, severity, context });
  }

  await sendToBackend(report);
}

/**
 * Initialize error monitoring
 * Call this in your app's root layout
 */
export function initializeErrorMonitoring(): void {
  // Set up global error handler
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      captureError(event.error, {
        type: 'uncaughtError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      captureError(error, {
        type: 'unhandledRejection',
      });
    });
  }

  console.log('[ErrorMonitoring] Initialized');
}

/**
 * Create a scoped error logger for a specific feature
 */
export function createErrorLogger(feature: string) {
  return {
    error: (error: Error, context?: ErrorContext) => {
      captureError(error, { feature, ...context });
    },
    message: (message: string, context?: ErrorContext, severity?: ErrorSeverity) => {
      captureMessage(message, { feature, ...context }, severity);
    },
  };
}

export type { ErrorReport, ErrorContext };
