/**
 * API Route: POST /api/login
 * Handles user authentication by forwarding to backend server
 * 
 * This route acts as a proxy to the real backend at http://10.10.20.52:3000
 * The backend validates credentials and returns user info + token
 */

import { NextRequest, NextResponse } from 'next/server';

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

/**
 * POST /api/login
 * Forward login request to backend server
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: LoginRequest = await request.json();

    // Validate request
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log(`[Login] Forwarding login request for email: ${body.email}`);

    // Forward request to backend server
    const backendUrl = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/login`
      : 'http://localhost:3000/login';
    
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    });

    // Check if backend response is ok
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.warn(`[Login] Backend rejected login for email: ${body.email}`, errorData);
      
      return NextResponse.json(
        { error: errorData.error || 'Invalid email or password' },
        { status: backendResponse.status }
      );
    }

    // Parse backend response
    const backendData = await backendResponse.json();

    console.log(`[Login] Successful login for email: ${body.email}`);

    // Create response with backend data
    const response = NextResponse.json(
      {
        token: backendData.token,
        user: {
          id: backendData.user?.id || backendData.userId || '1',
          email: backendData.user?.email || body.email,
          name: backendData.user?.name || backendData.userName || 'User',
        },
      } as LoginResponse,
      { status: 200 }
    );

    // Set httpOnly cookie with token from backend
    response.cookies.set('auth_token', backendData.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('[Login] Error:', error);
    
    // Check if it's a network error (backend not reachable)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Backend server is not reachable. Please try again later.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/login
 * Not allowed
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
