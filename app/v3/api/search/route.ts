/**
 * V3 Search API Route
 * CDN-based: Frontend loads school file from CDN, searches in memory
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { regNumber, dob, school } = body;

    // Validate input
    if (!regNumber || !dob || !school) {
      return NextResponse.json(
        { error: 'Missing required fields: regNumber, dob, school' },
        { status: 400 }
      );
    }

    // Forward to backend VPS for CDN coordination
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/v3/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        regNumber,
        dob,
        school,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend search coordination failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('V3 Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
