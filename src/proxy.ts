import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE } from '@/lib/config';

// Client-side guard (Next 16 renamed middleware -> proxy). If no admin session
// cookie is present, bounce to /login. The cookie is HttpOnly and only set after
// a successful proxied /api/admin/login.
const PUBLIC = new Set(['/login']);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.has(pathname)) {
    if (req.cookies.has(AUTH_COOKIE)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!req.cookies.has(AUTH_COOKIE)) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp|gif)).*)'],
};
