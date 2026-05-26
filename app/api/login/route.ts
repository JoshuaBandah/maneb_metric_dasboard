/**
 * API Route: POST /api/login
 * Handles user authentication
 * 
 * This is a placeholder implementation
 * In production, you would:
 * 1. Validate credentials against a database
 * 2. Generate a JWT token
 * 3. Set an httpOnly cookie with the token
 * 4. Return user information
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
 * Validate credentials (placeholder)
 * TODO: Replace with actual database validation
 */
function validateCredentials(email: string, password: string): boolean {
  // This is a placeholder - in production, validate against your database
  // For now, accept any email/password combination for testing
  
  // Example: Only allow specific test credentials
  const testCredentials = [
    { email: 'admin@maneb.com', password: 'password123' },
    { email: 'test@example.com', password: 'test123456' },
  ];

  return testCredentials.some(
    cred => cred.email === email && cred.password === password
  );
}

/**
 * Generate JWT token (placeholder)
 * TODO: Replace with actual JWT generation
 */
function generateToken(email: string): string {
  // This is a placeholder - in production, use a proper JWT library
  // For now, return a simple token
  const payload = {
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  };

  // In production: use jsonwebtoken library
  // return jwt.sign(payload, process.env.JWT_SECRET);
  
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * POST /api/login
 * Authenticate user and return token
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

    // Validate credentials
    if (!validateCredentials(body.email, body.password)) {
      console.warn(`[Login] Failed login attempt for email: ${body.email}`);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate token
    const token = generateToken(body.email);

    // Create response
    const response = NextResponse.json(
      {
        token,
        user: {
          id: '1', // TODO: Get from database
          email: body.email,
          name: 'User', // TODO: Get from database
        },
      } as LoginResponse,
      { status: 200 }
    );

    // Set httpOnly cookie (more secure than localStorage)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
    });

    console.log(`[Login] Successful login for email: ${body.email}`);

    return response;
  } catch (error) {
    console.error('[Login] Error:', error);
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
