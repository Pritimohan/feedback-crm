import { type NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth/middleware';

export async function middleware(request: NextRequest) {
  const { user, userRole } = await getAuthFromRequest(request);
  const { pathname } = request.nextUrl;

  const publicPrefixes = [
    '/login',
    '/api/auth',
    '/api/health',
    '/api/webhooks',
    '/api/cron',
    '/api/customers/warranty',
    '/api/customers/dietplan',
    '/api/customers/feedback',
  ];
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

  if (pathname.startsWith('/admin') && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/dt/followups', request.url));
  }

  if (
    userRole === 'admin' &&
    (pathname === '/admin/dashboard' ||
      pathname === '/admin/config' ||
      pathname === '/admin/test-call')
  ) {
    return NextResponse.redirect(new URL('/admin/users', request.url));
  }

  if (pathname.startsWith('/dt') && userRole !== 'dt' && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
};
