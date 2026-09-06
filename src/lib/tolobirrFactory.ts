/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-side ToloBirr account factory.
//
// Ports the account lifecycle from the ToloBirr extension bot
// (public/tolobirr-content.js): register an Ethiopian phone via the ToloBirr
// auth API to obtain an auth_token (== gateway WS token), then run the crypto
// spin (up to two spins) and claim any reward. Every created account carries a
// base playable balance of 2 Birr regardless of the visual reward label.
//
// All outbound calls can route through the rotating proxy pool (Track 3) by
// passing a ProxyConfig per operation; when no proxy is supplied the calls go
// out directly.

import { proxiedFetch, proxiedFetchRaw, ProxyConfig } from './proxyFetch';

const API = {
  REGISTER: 'https://api.tolobirr.com/api/v1/tolobet/auth/phone/login',
  SPIN: 'https://api.tolobirr.com/api/v1/crypto-spin/play',
  CLAIM: 'https://api.tolobirr.com/api/v1/crypto-spin/claim',
  BALANCE: 'https://api.tolobirr.com/api/v1/crypto-wallet/balance',
};

const DEFAULT_PASSWORD = '122333';

function generateEthiopianPhone(): string {
  const prefixes = ['9', '7'];
  let number = '251' + prefixes[Math.floor(Math.random() * prefixes.length)];
  for (let i = 0; i < 8; i++) number += Math.floor(Math.random() * 10).toString();
  return number;
}

export interface CreatedAccount {
  phone: string;
  password: string;
  token: string;
  reward: string | null;
  claimed: boolean;
}

export interface ToloBirrSpinResult {
  success?: boolean;
  can_claim: boolean;
  spin_id?: string;
  message?: string;
  remaining_spins?: number;
  reward?: any;
}

async function tolobirrApi<T>(url: string, payload: any, token?: string, proxy?: ProxyConfig | null, timeoutMs = 15000): Promise<T | null> {
  const headers: Record<string, string> = { 'Accept': '*/*', 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const route = url.split('/').pop() || url;
  const via = proxy ? `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}` : 'direct(no proxy)';
  try {
    const result = await proxiedFetch(url, proxy ?? null, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload || {}),
      timeoutMs,
    });
    console.log(`[ToloBirr] ${route} via ${via}: ${result == null ? 'null' : (Buffer.isBuffer(result) ? '<buffer>' : JSON.stringify(result).slice(0, 500))}`);
    if (result && typeof result === 'object' && Buffer.isBuffer(result)) {
      return JSON.parse(result.toString('utf8'));
    }
    return result as T;
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.log(`[ToloBirr] ${route} via ${via} FAILED: ${msg}`);
    throw new Error('ToloBirr API ' + url.split('/').pop() + ' failed: ' + msg);
  }
}

// Run one full register -> spin -> claim cycle, mirroring the ToloBirr API bot
// (public reference / Tampermonkey script). An account is only returned ("kept")
// when a spin reward is successfully CLAIMED — accounts that register but fail to
// claim a reward are discarded, exactly like the reference bot.
//
// Flow: register {phone,password} -> auth_token; spin(); if can_claim -> claim()
// else if remaining_spins>0 -> spin() again then claim(). Returns the created
// account, or null if registration yielded no token or no claim succeeded.
export async function spinNewAccount(proxy?: ProxyConfig | null): Promise<CreatedAccount | null> {
  const phone = generateEthiopianPhone();
  const password = DEFAULT_PASSWORD;

  const reg = await tolobirrApi<any>(API.REGISTER, { phone, password }, undefined, proxy);
  const token = reg && reg.auth_token; // reference reads auth_token only
  if (!token) {
    // Duplicate or blocked phone; allow caller to retry with a fresh number.
    return null;
  }

  let reward: string | null = null;
  let claimed = false;

  const spin1 = await tolobirrApi<ToloBirrSpinResult>(API.SPIN, {}, token, proxy);
  if (spin1 && spin1.success) {
    if (spin1.can_claim && spin1.spin_id) {
      const claim1 = await tolobirrApi<any>(API.CLAIM, { spin_id: spin1.spin_id }, token, proxy);
      if (claim1 && claim1.success) { claimed = true; reward = rewardLabel(claim1.reward); }
    } else if ((spin1.remaining_spins || 0) > 0) {
      const spin2 = await tolobirrApi<ToloBirrSpinResult>(API.SPIN, {}, token, proxy);
      if (spin2 && spin2.success && spin2.can_claim && spin2.spin_id) {
        const claim2 = await tolobirrApi<any>(API.CLAIM, { spin_id: spin2.spin_id }, token, proxy);
        if (claim2 && claim2.success) { claimed = true; reward = rewardLabel(claim2.reward); }
      }
    }
  }

  // Reference behavior: only accounts that successfully claimed a reward are kept.
  if (!claimed) return null;

  return { phone, password, token, reward, claimed };
}

function rewardLabel(reward: any): string | null {
  if (reward == null) return null;
  if (typeof reward === 'string') return reward;
  if (typeof reward === 'number') return String(reward);
  if (typeof reward === 'object') {
    return reward.label ?? reward.name ?? reward.amount ?? JSON.stringify(reward);
  }
  return null;
}

export interface CreatedAccountOnly {
  phone: string;
  password: string;
  token: string;
}

// Register a brand-new ToloBirr account WITHOUT spinning/claiming. Mirrors the
// register step of the reference bot (public/tolobirr-content.js): generate a
// random Ethiopian phone, POST {phone,password} to the ToloBirr auth endpoint,
// and read the returned auth_token. The token is stored as the account's
// access_token so it can be used later by the autoplay engine / token refresher.
//
// Returns null when registration yields no token (duplicate or blocked phone).
export async function createAccount(proxy?: ProxyConfig | null): Promise<CreatedAccountOnly | null> {
  const phone = generateEthiopianPhone();
  const password = DEFAULT_PASSWORD;
  console.log(`[Accounts] createAccount: registering phone=${phone} password=${password}`);
  const reg: any = await tolobirrApi<any>(API.REGISTER, { phone, password }, undefined, proxy);
  if (reg == null) {
    console.log('[Accounts] createAccount: register returned null');
    return null;
  }
  const keys = Object.keys(reg);
  console.log(`[Accounts] createAccount: register response keys=${keys.join(',')} auth_token=${reg.auth_token != null} token=${reg.token != null}`);
  const token = reg.auth_token || reg.token;
  if (!token) return null;
  return { phone, password, token };
}

// Refresh the gateway auth token for an existing account by logging in through
// the same ToloBirr auth endpoint. Returns the new token, or null on failure.
export async function refreshAccountToken(phone: string, password: string, proxy?: ProxyConfig | null): Promise<string | null> {
  const reg = await tolobirrApi<any>(API.REGISTER, { phone, password }, undefined, proxy);
  const token = reg && (reg.auth_token || reg.token);
  return token || null;
}

export interface AccountBalance {
  balance: number | null;
  totalBalance: number | null;
  bonusBalance: number | null;
  lockedBalance: number | null;
  withdrawableBalance: number | null;
  userID: string | null;
}

// Query an account's crypto-wallet balance using its access token on the
// Authorization header (GET https://api.tolobirr.com/api/v1/crypto-wallet/balance?currency=ETB).
// Returns the parsed balance, or null when the token is invalid / the call fails.
export interface BalanceFetchOutcome {
  data: AccountBalance | null;
  rawStatus: number | null;
  rawBody: string | null;
}
export async function getAccountBalance(token: string, proxy?: ProxyConfig | null, timeoutMs = 15000): Promise<BalanceFetchOutcome> {
  const headers: Record<string, string> = { 'Accept': '*/*' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const url = API.BALANCE + '?currency=ETB';

  // Try the direct request first (native fetch — simple and reliable). If a
  // proxy was requested and the direct call fails, retry once through it.
  const attempts: Array<{ label: string; method: () => Promise<BalanceFetchOutcome> }> = [
    { label: 'direct', method: () => balanceDirect(url, headers, timeoutMs) },
  ];
  if (proxy) attempts.push({ label: `proxy ${proxy.host}:${proxy.port}`, method: () => balanceViaProxy(url, proxy!, headers, timeoutMs) });

  let last: BalanceFetchOutcome = { data: null, rawStatus: null, rawBody: null };
  for (const a of attempts) {
    try {
      const out = await a.method();
      last = out;
      // A 2xx with a parsed `data` object is the success path; otherwise keep
      // trying the next egress route (e.g. direct blocked but proxy works).
      if (out.data) return out;
      console.log(`[ToloBirr] balance via ${a.label}: HTTP ${out.rawStatus} body=${String(out.rawBody).slice(0, 200)}`);
    } catch (e) {
      console.log(`[ToloBirr] balance via ${a.label} FAILED: ${(e as Error).message || String(e)}`);
    }
  }
  return last;
}

async function balanceDirect(url: string, headers: Record<string, string>, timeoutMs: number): Promise<BalanceFetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    const body = await resp.text();
    return parseBalanceBody(resp.status, body);
  } finally {
    clearTimeout(timer);
  }
}

async function balanceViaProxy(url: string, proxy: ProxyConfig, headers: Record<string, string>, timeoutMs: number): Promise<BalanceFetchOutcome> {
  const { status, body } = await proxiedFetchRaw(url, proxy, { method: 'GET', headers, timeoutMs });
  return parseBalanceBody(status, body);
}

function parseBalanceBody(status: number, body: string | null): BalanceFetchOutcome {
  if (body == null || body.trim() === '') {
    return { data: null, rawStatus: status, rawBody: null };
  }
  let json: any = null;
  try { json = JSON.parse(body); } catch { json = null; }
  const data = json && json.data;
  if (!data) {
    // Any non-2xx or a 2xx body without `data` means the token is rejected.
    return { data: null, rawStatus: status, rawBody: body.slice(0, 400) };
  }
  const toNum = (v: any): number | null => (v == null ? null : Number(v));
  const b = data.balanceBreakdown || {};
  return {
    data: {
      balance: toNum(data.balance),
      totalBalance: toNum(b.totalBalance),
      bonusBalance: toNum(b.bonusBalance),
      lockedBalance: toNum(b.lockedBalance),
      withdrawableBalance: toNum(b.withdrawableBalance),
      userID: data.userID ?? data.user_id ?? null,
    },
    rawStatus: status,
    rawBody: null,
  };
}

// Round-robin single-writer selection over the active proxy pool so each spun
// account / refresh cycles to a different egress IP when proxies are present.
let rrIndex = 0;
export function pickProxy(proxies: any[]): ProxyConfig | null {
  if (!proxies || proxies.length === 0) return null;
  const active = proxies.filter((p) => p.is_active !== false);
  if (active.length === 0) return null;
  const p = active[rrIndex % active.length];
  rrIndex = (rrIndex + 1) % active.length;
  return { host: p.host, port: p.port, username: p.username, password: p.password, protocol: p.protocol };
}

export type { ProxyConfig };
export { DEFAULT_PASSWORD, generateEthiopianPhone };
