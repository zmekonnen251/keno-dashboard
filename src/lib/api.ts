'use client';

import { apiFetch } from './api-client';
import type {
  ProviderSummary,
  DrawsResponse,
  StatsResponse,
  PatternsResponse,
  PredictionsResponse,
  InsightsResponse,
  DashboardResponse,
  SessionsResponse,
  AccountsResponse,
  ProxiesResponse,
  ProxyTestResponse,
  ProxyTestAllResponse,
  AutoplayConfig,
  AutoplayStatus,
  AutoplayTestRoundResponse,
  CheckBalancesResponse,
  CreateAccountsResponse,
  CreationJobStatus,
  UploadResponse,
  ClientsResponse,
  LogsResponse,
  ManualBetResponse,
  EligibleAccountsResponse,
  CleanupSpentResponse,
  LiveBalancesResponse,
} from './types';

// ---- auth ----
export async function login(password: string) {
  return apiFetch<{ ok: boolean }>('api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logout() {
  return apiFetch<{ ok: boolean }>('api/admin/logout', { method: 'POST' });
}

export async function checkAuth() {
  return apiFetch<{ authenticated: boolean }>('api/admin/check');
}

// ---- public data ----
export async function getSites(): Promise<ProviderSummary[]> {
  return apiFetch<ProviderSummary[]>('api/sites');
}

export async function getDraws(siteId: string, limit = 100): Promise<DrawsResponse> {
  return apiFetch<DrawsResponse>(`api/draws/${siteId}?limit=${limit}`);
}

export async function getStats(siteId: string): Promise<StatsResponse> {
  return apiFetch<StatsResponse>(`api/stats/${siteId}`);
}

export async function getTimeStats(siteId: string, hour: number, day: number): Promise<StatsResponse> {
  return apiFetch<StatsResponse>(`api/stats/${siteId}?hour=${hour}&day=${day}`);
}

export async function getPatterns(siteId: string): Promise<PatternsResponse> {
  return apiFetch<PatternsResponse>(`api/patterns/${siteId}`);
}

export async function getPatternsByTime(siteId: string, hour: number, day: number): Promise<PatternsResponse> {
  return apiFetch<PatternsResponse>(`api/patterns/${siteId}?hour=${hour}&day=${day}`);
}

export async function getPredictions(siteId: string): Promise<PredictionsResponse> {
  return apiFetch<PredictionsResponse>(`api/predictions/${siteId}`);
}

export async function getInsights(siteId: string): Promise<InsightsResponse> {
  return apiFetch<InsightsResponse>(`api/insights/${siteId}`);
}

export async function getDashboard(siteId: string): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>(`api/dashboard/${siteId}`);
}

export async function generatePrediction(siteId: string) {
  return apiFetch(`api/predictions/${siteId}/generate`, { method: 'POST' });
}

export async function getClients(): Promise<ClientsResponse> {
  return apiFetch<ClientsResponse>('api/clients');
}

export async function getLogs(limit = 200): Promise<LogsResponse> {
  return apiFetch<LogsResponse>(`api/logs?limit=${limit}`);
}

// ---- sessions ----
export async function getSessions(): Promise<SessionsResponse> {
  return apiFetch<SessionsResponse>('api/sessions');
}

export async function createSession(url: string) {
  return apiFetch('api/sessions', { method: 'POST', body: JSON.stringify({ url }) });
}

export async function deleteSession(id: number) {
  return apiFetch(`api/sessions/${id}`, { method: 'DELETE' });
}

export async function refreshSession(id: number) {
  return apiFetch(`api/sessions/refresh/${id}`, { method: 'POST' });
}

// ---- accounts ----
export async function getAccounts(provider = 'fungames'): Promise<AccountsResponse> {
  return apiFetch<AccountsResponse>(`api/accounts?provider=${encodeURIComponent(provider)}`);
}

export async function deleteAccount(id: number) {
  return apiFetch(`api/accounts/${id}`, { method: 'DELETE' });
}

// Enable/disable an account for autoplay. Disabled accounts are excluded from
// the active autoplay pool (and the WS-token backfill).
export async function setAccountEnabled(id: number, enabled: boolean) {
  return apiFetch<{ ok: boolean; id: number; is_enabled: boolean }>(`api/accounts/${id}/enabled`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export async function createAccounts(count: number): Promise<CreateAccountsResponse> {
  return apiFetch<CreateAccountsResponse>('api/accounts/create', {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
}

export async function creationStatus(): Promise<{ ok: boolean; job: CreationJobStatus | null }> {
  return apiFetch<{ ok: boolean; job: CreationJobStatus | null }>('api/accounts/create/status');
}

export async function stopCreation(): Promise<{ ok: boolean; stopped: boolean; job: CreationJobStatus | null }> {
  return apiFetch<{ ok: boolean; stopped: boolean; job: CreationJobStatus | null }>('api/accounts/create/stop', {
    method: 'POST',
  });
}

export async function uploadAccounts(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<UploadResponse>('api/accounts/upload', {
    method: 'POST',
    body: form,
  });
}

// ---- autoplay ----
export async function getAutoplayConfig(): Promise<AutoplayConfig> {
  return apiFetch<AutoplayConfig>('api/accounts/autoplay/config');
}

export async function setAutoplayConfig(patch: Partial<AutoplayConfig>): Promise<AutoplayConfig> {
  return apiFetch<AutoplayConfig>('api/accounts/autoplay/config', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export async function autoplayStatus(): Promise<AutoplayStatus> {
  return apiFetch<AutoplayStatus>('api/accounts/autoplay/status');
}

export async function startAutoplay() {
  return apiFetch('api/accounts/autoplay/start', { method: 'POST' });
}

export async function stopAutoplay() {
  return apiFetch('api/accounts/autoplay/stop', { method: 'POST' });
}

export async function refreshTokens(limit = 50) {
  return apiFetch('api/accounts/autoplay/refresh-tokens', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

export async function refreshWsToken(id: number) {
  return apiFetch('api/accounts/autoplay/refresh-ws-token', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function testAutoplayRound(pick?: number[]): Promise<AutoplayTestRoundResponse> {
  return apiFetch<AutoplayTestRoundResponse>('api/accounts/autoplay/test-round', {
    method: 'POST',
    body: JSON.stringify({ pick }),
  });
}

export async function placeManualBet(
  spots: number[],
  stake: number,
  accountId?: number,
): Promise<ManualBetResponse> {
  return apiFetch<ManualBetResponse>('api/accounts/autoplay/manual-bet', {
    method: 'POST',
    body: JSON.stringify({ spots, stake, accountId }),
  });
}

export async function getEligibleAccounts(stake?: number): Promise<EligibleAccountsResponse> {
  const q = stake !== undefined ? `?min_balance=${stake}` : '';
  return apiFetch<EligibleAccountsResponse>(`api/accounts/autoplay/eligible${q}`, {
    method: 'GET',
  });
}

export async function checkBalances(id?: number, forceRest = false): Promise<CheckBalancesResponse> {
  const q = typeof id === 'number' ? `?id=${id}` : '';
  return apiFetch<CheckBalancesResponse>(`api/accounts/autoplay/check-balances${q}`, {
    method: 'POST',
    body: JSON.stringify({ forceRest }),
  });
}

export async function syncBalances(): Promise<CheckBalancesResponse> {
  return apiFetch<CheckBalancesResponse>('api/accounts/autoplay/sync-balances', {
    method: 'POST',
  });
}

export async function cleanupSpentAccounts(): Promise<CleanupSpentResponse> {
  return apiFetch<CleanupSpentResponse>('api/accounts/autoplay/cleanup-spent', {
    method: 'POST',
  });
}

export async function getLiveBalances(): Promise<LiveBalancesResponse> {
  return apiFetch<LiveBalancesResponse>('api/accounts/autoplay/balances-live');
}

// ---- proxies ----
export async function getProxies(): Promise<ProxiesResponse> {
  return apiFetch<ProxiesResponse>('api/accounts/proxies');
}

export async function addProxy(entry: string) {
  return apiFetch('api/accounts/proxies', {
    method: 'POST',
    body: JSON.stringify({ entry }),
  });
}

export async function deleteProxy(id: number) {
  return apiFetch(`api/accounts/proxies/${id}`, { method: 'DELETE' });
}

export async function toggleProxy(id: number, active: boolean) {
  return apiFetch(`api/accounts/proxies/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ active }),
  });
}

export async function uploadProxies(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<UploadResponse>('api/accounts/proxies/upload', {
    method: 'POST',
    body: form,
  });
}

export async function testProxy(id: number): Promise<ProxyTestResponse> {
  return apiFetch<ProxyTestResponse>(`api/accounts/proxies/test/${id}`, { method: 'POST' });
}

export async function testAllProxies(): Promise<ProxyTestAllResponse> {
  return apiFetch<ProxyTestAllResponse>('api/accounts/proxies/test-all', { method: 'POST' });
}
