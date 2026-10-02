import { NextRequest, NextResponse } from 'next/server';
import { apiBase, AUTH_COOKIE } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path: string[] }> };

// Server-side proxy to the keno-server. The dashboard and keno-server live on
// different origins, and the upstream API's CORS is credentials:false with no
// SameSite on its admin cookie — so a browser calling it directly cannot store or
// send the auth cookie. Instead we proxy here: the dashboard stores the upstream
// cookie in its own HttpOnly cookie and relays it on every upstream request.
export async function handler(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const base = apiBase();

  const pathname = Array.isArray(path) ? path.join('/') : '';
  const search = req.nextUrl.search;

  // The keno-server mounts its REST routes under /api, so re-add that prefix.
  const upstream = `${base}/api/${pathname}${search}`;

  // Carry over the dashboard's stored upstream cookie as the Authorization for
  // the keno-server admin session.
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;

  const headers: Record<string, string> = {
    'content-type': req.headers.get('content-type') || 'application/json',
  };
  if (cookie) headers['cookie'] = cookie;

  // Forward the raw request body byte-for-byte. Using arrayBuffer (not text)
  // keeps multipart file uploads (CSV/JSON imports) intact while still passing
  // JSON bodies through unchanged.
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();

  const resp = await fetch(upstream, {
    method: req.method,
    headers,
    body,
    cache: 'no-store',
  });

  // Relay the upstream response as-is (JSON passthrough), preserving status.
  const resBody = await resp.arrayBuffer();
  const out = new NextResponse(resBody, { status: resp.status });
  out.headers.set('content-type', resp.headers.get('content-type') || 'application/json');

  // On login, upstream sends Set-Cookie (keno_admin=<token> for the legacy
  // admin password, or keno_session=<token> for a username/password account).
  // Capture just the auth pair and store it in our own cookie; we relay that
  // exact pair back as the upstream "cookie" header so the keno-server's
  // requireAdmin() recognizes the session.
  const setCookie = resp.headers.get('set-cookie');
  if (setCookie && (pathname === 'admin/login' || pathname === 'auth/login')) {
    const match = setCookie.match(/keno_(?:admin|session)=[^;,]+/);
    if (match) {
      out.cookies.set(AUTH_COOKIE, match[0], {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  // On logout, clear the stored session cookie so the auth guard redirects
  // the user back to /login instead of letting them through with a stale token.
  if (pathname === 'admin/logout' || pathname === 'auth/logout') {
    out.cookies.set(AUTH_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  }

  return out;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
