'use client';

// Thin client-side wrapper around the dashboard's own /api proxy. Every call is
// same-origin (same site as the dashboard), so the HttpOnly admin cookie is sent
// automatically. Responses are the keno-server's JSON, passed through verbatim.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function hasContentType(headers: HeadersInit | undefined): boolean {
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has('Content-Type');
  if (Array.isArray(headers)) return headers.some(([k]) => k.toLowerCase() === 'content-type');
  return Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  // Only default to JSON for non-FormData bodies. For FormData (file uploads)
  // the browser must set its own multipart Content-Type (with the boundary) —
  // overriding it with application/json corrupts the upload.
  const isFormBody = init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
    ...(init?.body && !hasContentType(init.headers) && !isFormBody ? { 'Content-Type': 'application/json' } : {}),
  };

  const res = await fetch(`/api/${path.replace(/^\//, '').replace(/^api\//, '')}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const record =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    const msg =
      record && typeof record.error === 'string'
        ? record.error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}
