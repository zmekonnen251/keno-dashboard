/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal HTTP(S) proxy tunneling for ToloBirr API calls, with no external
// runtime dependency beyond Node's built-in http/https/tls/net modules.
//
// Requests to api.tolobirr.com are HTTPS, so we establish a CONNECT tunnel
// through the HTTP(S) proxy and perform the real request over the tunneled,
// TLS-wrapped socket. This keeps every outbound account-lifecycle call able to
// egress through a rotating proxy pool (Track 3) without dragging in extra deps.
"use server";

import http from 'http';
import https from 'https';
import tls from 'tls';
import net from 'net';

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  protocol?: string; // http | https (the proxy's own scheme)
}

export interface ProxyFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

// Thrown when the target (or upstream proxy) returns a rate-limit / temporarily
// blocked status (429, 403). The account creator catches this to rotate to the
// next proxy in the pool.
export class RateLimitError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message || `rate limited (HTTP ${status})`);
    this.name = 'RateLimitError';
    this.status = status;
  }
}

function parseJsonText(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseUrl(url: string): URL {
  return new URL(url);
}

function buildProxyConnect(proxy: ProxyConfig, targetHost: string, targetPort: number): string {
  const reqPath = `${targetHost}:${targetPort}`;
  let proxyAuth = '';
  if (proxy.username) {
    const cred = Buffer.from(`${proxy.username}:${proxy.password || ''}`).toString('base64');
    proxyAuth = `Proxy-Authorization: Basic ${cred}\r\n`;
  }
  return (
    `CONNECT ${reqPath} HTTP/1.1\r\n` +
    `Host: ${reqPath}\r\n` +
    proxyAuth +
    `Proxy-Connection: Keep-Alive\r\n\r\n`
  );
}

// Establish a TLS socket to targetHost:targetPort tunneled through the proxy.
function tunnel(proxy: ProxyConfig, targetHost: string, targetPort: number, timeoutMs: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const proxyPort = proxy.port;
    // const isHttpsProxy = (proxy.protocol || 'http').toLowerCase() === 'https';
    const socket = net.connect(proxyPort, proxy.host);

    const onError = (err: Error) => { cleanup(); reject(err); };
    const cleanup = () => { socket.removeListener('error', onError); socket.removeListener('data', onData); socket.removeListener('connect', onConnect); };

    const timer = setTimeout(() => { cleanup(); socket.destroy(); reject(new Error('proxy CONNECT timeout')); }, timeoutMs);

    const onConnect = () => {
      socket.write(buildProxyConnect(proxy, targetHost, targetPort));
    };

    let buf = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      clearTimeout(timer);
      const head = buf.slice(0, idx).toString('utf8');
      const statusLine = head.split('\r\n')[0] || '';
      const code = parseInt(statusLine.split(' ')[1] || '0', 10);
      cleanup();
      if (code >= 200 && code < 300) {
        // Upgrade the tunneled socket to TLS.
        const tlsSocket = tls.connect({
          socket,
          servername: targetHost,
          rejectUnauthorized: false,
        });
        tlsSocket.on('error', reject);
        resolve(tlsSocket);
      } else {
        socket.destroy();
        reject(new Error(`proxy CONNECT failed (${code})`));
      }
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => { cleanup(); socket.destroy(); reject(new Error('proxy CONNECT timeout')); });
    socket.on('error', onError);
    socket.on('connect', onConnect);
    socket.on('data', onData);
  });
}

interface ParsedReq {
  headers: http.IncomingHttpHeaders;
  statusCode: number;
  body: Buffer;
}

// A reliable HTTPS target used only to probe proxy connectivity. ToloBirr is the
// real destination the accounts flow uses, so a successful CONNECT here is a
// meaningful signal that the proxy can carry our traffic.
const PROBE_TARGET = { host: 'api.tolobirr.com', port: 443 };

/**
 * Test whether a proxy can establish an HTTPS CONNECT tunnel to a reachable
 * endpoint. Resolves true when the proxy is alive and can carry TLS traffic,
 * false (with a reason) when it cannot.
 */
export async function testProxyConnection(
  proxy: ProxyConfig,
  timeoutMs = 10000
): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
  const start = Date.now();
  try {
    const sock = await tunnel(proxy, PROBE_TARGET.host, PROBE_TARGET.port, timeoutMs);
    sock.destroy();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    return { ok: false, error: msg };
  }
}

function sendOverTunnel(sock: tls.TLSSocket, url: URL, opts: ProxyFetchOptions): Promise<ParsedReq> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 443,
      path: url.pathname + url.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
      createConnection: () => sock,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ headers: res.headers, statusCode: res.statusCode || 0, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * Perform an HTTPS request through an HTTP(S) proxy. Falls back to a direct
 * request when no proxy is provided. Returns parsed JSON or null on failure.
 */
export async function proxiedFetch(url: string, proxy: ProxyConfig | null | undefined, opts: ProxyFetchOptions = {}): Promise<any> {
  const u = parseUrl(url);
  const tlsPort = u.port ? parseInt(u.port, 10) : 443;

  if (!proxy) {
    // Direct request via native fetch (already used elsewhere).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 15000);
    try {
      const resp = await fetch(url, {
        method: opts.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        body: opts.body,
        signal: controller.signal,
      });
      const text = await resp.text();
      if (resp.status === 429 || resp.status === 403) throw new RateLimitError(resp.status, `rate limited (HTTP ${resp.status})`);
      return parseJsonText(text);
    } finally {
      clearTimeout(timer);
    }
  }

  const tlsSocket = await tunnel(proxy, u.hostname, tlsPort, opts.timeoutMs || 15000);
  try {
    const parsed = await sendOverTunnel(tlsSocket, u, opts);
    const text = parsed.body.toString('utf8');
    try {
      return JSON.parse(text);
    } catch {
      return parsed.body;
    }
  } finally {
    tlsSocket.destroy();
  }
}

// Like proxiedFetch but always returns the raw HTTP status + body string so
// callers (e.g. the balance endpoint) can distinguish 401/auth errors, rate
// limits, and network failures instead of a single null.
export interface RawResponse {
  status: number;
  body: string | null;
  ok: boolean;
}
export async function proxiedFetchRaw(url: string, proxy: ProxyConfig | null | undefined, opts: ProxyFetchOptions = {}): Promise<RawResponse> {
  const u = parseUrl(url);
  const tlsPort = u.port ? parseInt(u.port, 10) : 443;

  if (!proxy) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 15000);
    try {
      const resp = await fetch(url, {
        method: opts.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        body: opts.body,
        signal: controller.signal,
      });
      const text = await resp.text();
      return { status: resp.status, body: text, ok: resp.status >= 200 && resp.status < 300 };
    } catch (e) {
      return { status: 0, body: (e as Error).message || null, ok: false };
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    const tlsSocket = await tunnel(proxy, u.hostname, tlsPort, opts.timeoutMs || 15000);
    try {
      const parsed = await sendOverTunnel(tlsSocket, u, opts);
      const text = parsed.body.toString('utf8');
      return { status: parsed.statusCode, body: text, ok: parsed.statusCode >= 200 && parsed.statusCode < 300 };
    } finally {
      tlsSocket.destroy();
    }
  } catch (e) {
    return { status: 0, body: (e as Error).message || null, ok: false };
  }
}
