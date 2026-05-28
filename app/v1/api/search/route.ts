/**
 * V1 Search API Route
 * Traditional backend-first: forwards to VPS database, records metrics.
 *
 * POST /v1/api/search
 * Body: { examNumber: string, dob: string }
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// In-process metrics store for V1 portal searches
// The SSE stream reads from this to update the dashboard in real time
export const v1SearchMetrics = {
  total:      0,
  success:    0,
  failed:     0,
  totalMs:    0,
  lastSearch: null as string | null,
};

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body = await request.json();
    const { examNumber, dob } = body;

    if (!examNumber || !dob) {
      return NextResponse.json(
        { error: 'Missing required fields: examNumber, dob' },
        { status: 400 }
      );
    }

    // Forward to VPS backend — hits the database
    const res = await fetch(`${BACKEND_URL}/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regNumber: examNumber, dob }),
      signal: AbortSignal.timeout(10000),
    });

    const elapsed = Date.now() - start;
    v1SearchMetrics.total++;
    v1SearchMetrics.totalMs += elapsed;
    v1SearchMetrics.lastSearch = new Date().toISOString();

    if (!res.ok) {
      v1SearchMetrics.failed++;
      return NextResponse.json(
        { error: `Backend search failed: ${res.statusText}`, responseTime: elapsed, source: 'v1' },
        { status: res.status }
      );
    }

    const data = await res.json();
    v1SearchMetrics.success++;

    return NextResponse.json({
      ...data,
      responseTime: elapsed,
      source: 'v1',
    });
  } catch (err) {
    const elapsed = Date.now() - start;
    v1SearchMetrics.total++;
    v1SearchMetrics.failed++;
    v1SearchMetrics.totalMs += elapsed;
    v1SearchMetrics.lastSearch = new Date().toISOString();

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Search failed',
        responseTime: elapsed,
        source: 'v1',
      },
      { status: 502 }
    );
  }
}
