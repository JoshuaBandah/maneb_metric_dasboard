/**
 * V1 Upload API Route
 * Traditional backend-first: Upload CSV to backend for database storage
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const school = formData.get('school') as string;
    const file = formData.get('file') as File;

    // Validate input
    if (!school || !file) {
      return NextResponse.json(
        { error: 'Missing required fields: school, file' },
        { status: 400 }
      );
    }

    // Forward to backend VPS
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const backendFormData = new FormData();
    backendFormData.append('school', school);
    backendFormData.append('file', file);

    const response = await fetch(`${backendUrl}/v1/upload`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend upload failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      message: 'CSV uploaded successfully to database',
      data,
    });
  } catch (error) {
    console.error('V1 Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
