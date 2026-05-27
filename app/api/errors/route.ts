/**
 * API Route: POST /api/errors
 * Receives error reports from the frontend and logs them
 * 
 * This is a simple implementation that logs to console and file
 * In production, you'd send these to a service like Sentry, DataDog, or your own backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync } from 'fs';
import { join } from 'path';

interface ErrorReport {
  message: string;
  stack?: string;
  context: Record<string, any>;
  timestamp: string;
  url: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Log error to file (for development/debugging)
 */
function logErrorToFile(report: ErrorReport): void {
  try {
    const { mkdirSync } = require('fs');
    const logsDir = join(process.cwd(), 'logs');
    
    // Create logs directory if it doesn't exist
    try {
      mkdirSync(logsDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }
    
    const logFile = join(logsDir, 'errors.log');
    
    const logEntry = `[${report.timestamp}] ${report.severity.toUpperCase()}: ${report.message}\n`;
    const logDetails = `  URL: ${report.url}\n  Context: ${JSON.stringify(report.context)}\n  Stack: ${report.stack || 'N/A'}\n\n`;
    
    appendFileSync(logFile, logEntry + logDetails);
  } catch (error) {
    console.error('Failed to write error log:', error);
  }
}

/**
 * Send error to external monitoring service (Sentry, DataDog, etc.)
 * This is a placeholder - implement based on your chosen service
 */
async function sendToMonitoringService(report: ErrorReport): Promise<void> {
  // Example: Send to Sentry
  // const SENTRY_DSN = process.env.SENTRY_DSN;
  // if (SENTRY_DSN) {
  //   await fetch('https://sentry.io/api/...', {
  //     method: 'POST',
  //     body: JSON.stringify(report),
  //   });
  // }

  // Example: Send to custom backend
  // await fetch('https://your-monitoring-backend.com/errors', {
  //   method: 'POST',
  //   body: JSON.stringify(report),
  // });

  console.log('[Error Monitoring]', {
    severity: report.severity,
    message: report.message,
    context: report.context,
  });
}

/**
 * POST /api/errors
 * Receive and process error reports from frontend
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const report: ErrorReport = await request.json();

    // Validate report
    if (!report.message) {
      return NextResponse.json(
        { error: 'Missing error message' },
        { status: 400 }
      );
    }

    // Log to file (development)
    if (process.env.NODE_ENV === 'development') {
      logErrorToFile(report);
    }

    // Send to monitoring service
    await sendToMonitoringService(report);

    // Alert on critical errors
    if (report.severity === 'critical') {
      console.error('🚨 CRITICAL ERROR:', report.message);
      console.error('Context:', report.context);
      
      // TODO: Send alert (email, Slack, PagerDuty, etc.)
      // await sendAlert(report);
    }

    return NextResponse.json(
      { success: true, message: 'Error report received' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to process error report:', error);
    return NextResponse.json(
      { error: 'Failed to process error report' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/errors
 * Retrieve recent errors (for debugging)
 * TODO: Add authentication before exposing this in production
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Implement error retrieval from database or log file
    // This is a placeholder that returns a message
    
    return NextResponse.json(
      { 
        message: 'Error retrieval not yet implemented',
        note: 'Implement this endpoint to retrieve recent errors from your monitoring service'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to retrieve errors:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve errors' },
      { status: 500 }
    );
  }
}
