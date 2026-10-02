import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, apiBase } from '@/lib/config';

// Server-side guard (Next 16 renamed middleware -> proxy). The home /
// draw-history page and /login are open to everyone; every other (dashboard)
// route requires an authenticated *admin*. Viewers get a valid session but may
// only see the draws page, so anything else bounces them back to `/`.

// Ask the keno-server who owns the stored session cookie. Returns the role
// (`admin`/`viewer`) for a valid session, or null when the cookie is
// missing/expired/forged or the upstream is unreachable. The server verifies the
// signed cookie, so a viewer cannot forge an admin role here.
async function sessionRole(stored: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase()}/api/auth/check`, {
      headers: { cookie: stored },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      user?: { role?: string };
    };
    return data.authenticated && data.user?.role ? data.user.role : null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const stored = req.cookies.get(AUTH_COOKIE)?.value;

  // Keep the login form reachable unless the visitor already has a valid
  // session. Checking the session (instead of just cookie presence) prevents a
  // stale cookie from trapping the user in a /login <-> / redirect loop.
  if (pathname === '/login') {
    if (stored && (await sessionRole(stored)) !== null) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // The draw-history page is public, and is the only page viewers may see.
  if (pathname === '/') return NextResponse.next();

  const url = new URL('/login', req.url);
  url.searchParams.set('next', pathname);

  if (!stored) return NextResponse.redirect(url);

  const role = await sessionRole(stored);
  if (role === null) return NextResponse.redirect(url); // expired/forged cookie
  if (role !== 'admin') return NextResponse.redirect(new URL('/', req.url)); // viewer

  return NextResponse.next();
}

export const config = {
  // Skip build assets, the dashboard's own API proxy, and any static file
  // (sw.js, manifest.json, icons, ...). Everything else is a dashboard page.
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
