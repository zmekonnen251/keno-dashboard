import { NextRequest, NextResponse } from 'next/server';
import { apiBase, AUTH_COOKIE } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-Sent Events proxy for the keno-server's live game state. The generic
// /api/[...path] proxy buffers whole responses, which would never deliver an
// event stream; this dedicated route pipes the upstream body straight through.
// EventSource is same-origin, so the dashboard's HttpOnly session cookie is
// forwarded upstream like every other API call.
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const upstream = await fetch(`${apiBase()}/api/live/stream${req.nextUrl.search}`, {
    headers: cookie ? { cookie } : {},
    cache: 'no-store',
    signal: req.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      // nginx buffers proxied responses by default, which stalls SSE.
      'x-accel-buffering': 'no',
    },
  });
}
