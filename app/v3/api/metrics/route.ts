/**
 * V3 Metrics API Route
 *
 * Returns upload history from R2 log + live system metrics.
 * The upload log is the source of truth for what's been published to CDN.
 *
 * GET /v3/api/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUploadLog } from '../../lib/r2-client';

export async function GET(request: NextRequest) {
  try {
    // Fetch upload history from R2
    const uploads = await getUploadLog();

    const totalStudentsPublished = uploads.reduce((sum, u) => sum + u.totalStudents, 0);
    const totalSchoolsPublished = uploads.length;
    const lastUpload = uploads.length > 0
      ? uploads.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
      : null;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalSchoolsPublished,
        totalStudentsPublished,
        lastUploadedAt: lastUpload?.uploadedAt ?? null,
        lastUploadedSchool: lastUpload?.school ?? null,
      },
      uploads,
    });
  } catch (error) {
    console.error('V3 Metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
