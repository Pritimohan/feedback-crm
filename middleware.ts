import { type NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth/middleware';

export async function middleware(request: NextRequest) {
  const { user } = await getAuthFromRequest(request);
  const { pathname } = request.nextUrl;

  const publicPrefixes = ['/login', '/api/auth', '/api/health'];
  const isPublic =
    pathname === '/' || publicPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isPublic) {
    return NextResponse.next();
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
};
