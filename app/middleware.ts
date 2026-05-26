import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to protect routes that require authentication
 * Currently allows all access, but structure is in place for token validation
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Protect admin dashboard routes
  if (pathname.startsWith('/adminDashBoard')) {
    // TODO: Implement token validation
    // const token = request.cookies.get('auth_token');
    // if (!token) {
    //   return NextResponse.redirect(new URL('/login', request.url));
    // }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
