/**
 * V1 Search API Route
 * Traditional backend-first: Query database directly
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { regNumber, dob, school } = body;

    // Validate input
    if (!regNumber || !dob) {
      return NextResponse.json(
        { error: 'Missing required fields: regNumber, dob' },
        { status: 400 }
      );
    }

    // Forward to backend VPS
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/v1/search`, {
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
        { error: 'Backend search failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('V1 Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
