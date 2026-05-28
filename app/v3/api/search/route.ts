/**
 * V3 Search API Route
 * CDN-based: fetches school file from CDN, does O(1) index lookup.
 * Records search metrics to the CDN server for dashboard display.
 *
 * POST /v3/api/search
 * Body: { examNumber: string, dob: string, examYear?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractCentreNumber, buildIndexKey } from '../../lib/index-generator';
import { getCDNBaseUrl } from '../../lib/r2-client';
import type { V3SchoolFile } from '../../lib/v3-types';

const CDN_SERVER_URL  = process.env.CDN_SERVER_URL  || 'http://localhost:4000';

async function recordToCDNServer(result: {
  success: boolean;
  fetchMs: number;
  lookupMs: number;
  centre: string;
  examYear: string;
}) {
  try {
    await fetch(`${CDN_SERVER_URL}/k6/vu-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vu:       'portal',
        source:   'student-portal',
        stage:    result.success ? 'completed' : 'lookup_failed',
        success:  result.success,
        fetchMs:  result.fetchMs,
        lookupMs: result.lookupMs,
        waitTime: result.fetchMs + result.lookupMs,
        centre:   result.centre,
      }),
      signal: AbortSignal.timeout(1000),
    });
  } catch {
    // Non-critical — don't fail the search if metrics recording fails
  }
}

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body = await request.json();
    const { examNumber, dob, examYear } = body;

    if (!examNumber || !dob) {
      return NextResponse.json(
        { error: 'Missing required fields: examNumber, dob' },
        { status: 400 }
      );
    }

    const exam   = examNumber.trim().toUpperCase();
    const year   = examYear || process.env.NEXT_PUBLIC_EXAM_YEAR || '2024';
    const centre = extractCentreNumber(exam);

    if (!centre) {
      return NextResponse.json(
        { error: 'Invalid exam number format. Expected: J0282/001' },
        { status: 400 }
      );
    }

    const cdnBase  = getCDNBaseUrl();
    const fileUrl  = `${cdnBase}/jce/${year}/${centre}.json`;
    const fetchStart = Date.now();

    // Fetch school file from CDN
    let schoolFile: V3SchoolFile;
    try {
      const res = await fetch(fileUrl, { signal: AbortSignal.timeout(10000) });
      const fetchMs = Date.now() - fetchStart;

      if (!res.ok) {
        await recordToCDNServer({ success: false, fetchMs, lookupMs: 0, centre, examYear: year });
        return NextResponse.json(
          {
            error: res.status === 404
              ? `Results for centre ${centre} not yet published`
              : `CDN fetch failed: ${res.statusText}`,
            responseTime: Date.now() - start,
            source: 'cdn',
          },
          { status: res.status === 404 ? 404 : 502 }
        );
      }

      schoolFile = await res.json();
      const fetchMs2 = Date.now() - fetchStart;

      // O(1) index lookup
      const lookupStart = Date.now();
      const key      = buildIndexKey(exam, dob.trim());
      const position = schoolFile.index[key];
      const lookupMs = Date.now() - lookupStart;

      if (position === undefined) {
        await recordToCDNServer({ success: false, fetchMs: fetchMs2, lookupMs, centre, examYear: year });
        return NextResponse.json(
          {
            error: 'Student not found. Check exam number and date of birth.',
            responseTime: Date.now() - start,
            source: 'cdn',
          },
          { status: 404 }
        );
      }

      const student = schoolFile.students[position];
      await recordToCDNServer({ success: true, fetchMs: fetchMs2, lookupMs, centre, examYear: year });

      return NextResponse.json({
        success:      true,
        data:         student,
        source:       'cdn',
        responseTime: Date.now() - start,
        fetchMs:      fetchMs2,
        lookupMs,
        centre,
        school:       schoolFile.school,
        exam:         schoolFile.exam,
      });
    } catch (fetchErr) {
      const fetchMs = Date.now() - fetchStart;
      await recordToCDNServer({ success: false, fetchMs, lookupMs: 0, centre, examYear: year });
      throw fetchErr;
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Search failed',
        responseTime: Date.now() - start,
        source: 'cdn',
      },
      { status: 500 }
    );
  }
}
