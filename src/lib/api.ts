'use client';

import { apiFetch } from './api-client';
import type {
  ProviderSummary,
  DrawsResponse,
  StatsResponse,
  PatternsResponse,
  PredictionsResponse,
  InsightsResponse,
  MlLiveResponse,
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
  MlAlertsResponse,
  ManualBetResponse,
  EligibleAccountsResponse,
  CleanupSpentResponse,
  LiveBalancesResponse,
  RainAccountsResponse,
  RainClaimsResponse,
  RainProvider,
  RainAutoplayConfig,
  RainAutoplayConfigResponse,
  RainAutoplayStatusResponse,
  RainFreeBetsResponse,
  PlayRainFreeBetResponse,
  RainCashBetsResponse,
  RainManualBetResponse,
  RainTestRoundResponse,
  RainWsTokensResponse,
  WithdrawalConfigResponse,
  WithdrawalStatusResponse,
  WithdrawalRequestsResponse,
  TicketPlan,
  RainPredictionResponse,
  TwoDigitTicketsResponse,
  RainTicketConfig,
  BotTicket,
  ChickenRoadAccountsResponse,
  ChickenRoadClaimsResponse,
  ChickenRoadProvider,
  ChickenRoadAutoplayConfig,
  ChickenRoadAutoplayConfigResponse,
  ChickenRoadAutoplayStatusResponse,
  ChickenRoadFreeBetsResponse,
  ChickenRoadRoundsResponse,
  OddsDrop,
  OddsSuggestion,
  OddsWatcherConfig,
  OddsWatcherStatus,
  ShamoBetConfig,
  ShamoBetOrder,
  ShamoBetRecord,
  ShamoBetSessionInfo,
  ShamoBetStatus,
  ShamoPlaceResponse,
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

export async function getDraws(siteId: string, limit = 100, offset = 0): Promise<DrawsResponse> {
  return apiFetch<DrawsResponse>(`api/draws/${siteId}?limit=${limit}&offset=${offset}`);
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

// Live ML predictor output (recurrence_v1): prediction + ticket-recurrence
// averages + per-number reasons. Consumed by the autoplay-page ML card.
export async function getMlLive(siteId: string): Promise<MlLiveResponse> {
  return apiFetch<MlLiveResponse>(`api/ml/live/${siteId}`);
}

export async function getDashboard(siteId: string): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>(`api/dashboard/${siteId}`);
}

export async function generatePrediction(siteId: string, options?: { useSequenceMatch?: boolean; lookback_n?: number }) {
  return apiFetch(`api/predictions/${siteId}/generate`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export async function generateSequencePrediction(siteId: string, options?: { lookback_n?: number; similarity_threshold?: number }) {
  return apiFetch(`api/predictions/${siteId}/generate-sequence`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

export async function getClients(): Promise<ClientsResponse> {
  return apiFetch<ClientsResponse>('api/clients');
}

export async function getLogs(limit = 200): Promise<LogsResponse> {
  return apiFetch<LogsResponse>(`api/logs?limit=${limit}`);
}

export async function getMlAlerts(limit = 50): Promise<MlAlertsResponse> {
  return apiFetch<MlAlertsResponse>(`api/ml/alerts/recent?limit=${limit}`);
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
export async function getAccounts(provider = 'fungames_tolobirr'): Promise<AccountsResponse> {
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

// Enable/disable autoplay participation for one rain account. Disabled
// accounts keep claiming rain but their free bets + wallet are excluded from
// the rain autoplay engine (free-bet plays AND cash-mode betting). Mirrors the
// tolobirr accounts setAccountEnabled toggle.
export async function setRainAccountAutoplayEnabled(id: number, enabled: boolean) {
  return apiFetch<{ ok: boolean; id: number; autoplay_enabled: boolean }>(`api/rain/accounts/${id}/autoplay-enabled`, {
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
export async function getAutoplayConfig(siteId?: string): Promise<AutoplayConfig> {
  return apiFetch<AutoplayConfig>('api/accounts/autoplay/config');
}

export async function setAutoplayConfig(siteId: string, patch: Partial<AutoplayConfig>): Promise<AutoplayConfig> {
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

// Manual "Bet Prediction": the engine picks the latest prediction's preferred
// ticket and places it at the given stake (optionally on a specific account).
export async function placePredictionBet(
  stake: number,
  accountId?: number,
): Promise<ManualBetResponse> {
  return apiFetch<ManualBetResponse>('api/accounts/autoplay/manual-bet-prediction', {
    method: 'POST',
    body: JSON.stringify({ stake, accountId }),
  });
}

export async function getTicketPlan(siteId: string): Promise<{ siteId: string; ticketPlan: TicketPlan }> {
  return apiFetch<{ siteId: string; ticketPlan: TicketPlan }>(`api/predictions/${siteId}/ticket-plan`);
}

export async function setTicketPlan(siteId: string, ticketPlan: TicketPlan): Promise<{ siteId: string; ticketPlan: TicketPlan }> {
  return apiFetch<{ siteId: string; ticketPlan: TicketPlan }>(`api/predictions/${siteId}/ticket-plan`, {
    method: 'PATCH',
    body: JSON.stringify({ ticketPlan }),
  });
}

// Two-digit (2-spot) dynamic tickets generated from the last 1–3 draws
// (repeat/carryover) + recurrence patterns.
export async function getTwoDigitTickets(siteId: string, limit = 8): Promise<TwoDigitTicketsResponse> {
  return apiFetch<TwoDigitTicketsResponse>(`api/predictions/${siteId}/two-digit?limit=${limit}`);
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

// ---- rain claiming ----
export async function getRainAccounts(): Promise<RainAccountsResponse> {
  return apiFetch<RainAccountsResponse>('api/rain/accounts');
}

export async function createRainAccount(input: {
  name: string;
  ws_token: string;
  provider: RainProvider;
  access_token?: string;
  password?: string;
  withdraw_enabled?: boolean;
  payment_method?: string | null;
  payment_account_number?: string | null;
  payment_full_name?: string | null;
}) {
  return apiFetch('api/rain/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateRainAccount(
  id: number,
  patch: Partial<{
    name: string;
    ws_token: string;
    provider: RainProvider;
    is_enabled: boolean;
    access_token: string | null;
    password: string | null;
    withdraw_enabled: boolean;
    cash_suspended: boolean;
    payment_method: string | null;
    payment_account_number: string | null;
    payment_full_name: string | null;
  }>,
) {
  return apiFetch(`api/rain/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteRainAccount(id: number) {
  return apiFetch(`api/rain/accounts/${id}`, { method: 'DELETE' });
}

export async function refreshRainAccount(id: number) {
  return apiFetch(`api/rain/accounts/${id}/refresh`, { method: 'POST' });
}

export async function checkAllRainStatus(): Promise<{ ok: boolean; reconnected: number }> {
  return apiFetch<{ ok: boolean; reconnected: number }>('api/rain/accounts/check-status', { method: 'POST' });
}

export async function getRainClaims(id: number): Promise<RainClaimsResponse> {
  return apiFetch<RainClaimsResponse>(`api/rain/accounts/${id}/claims`);
}

// ---- rain autoplay (clock-driven free-bet rounds) ----
export async function getRainAutoplayConfig(): Promise<RainAutoplayConfigResponse> {
  return apiFetch<RainAutoplayConfigResponse>('api/rain/autoplay/config');
}

export async function setRainAutoplayConfig(
  patch: Partial<Pick<RainAutoplayConfig, 'enabled' | 'provider' | 'tickets_per_round' | 'spots_mode' | 'manual_spots' | 'round_interval' | 'use_cash_after_free_bets' | 'cash_stake' | 'recurrence_tickets_per_round' | 'tickets_per_account' | 'use_two_digit_tickets'>>,
): Promise<RainAutoplayConfigResponse> {
  return apiFetch<RainAutoplayConfigResponse>('api/rain/autoplay/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function rainAutoplayStart() {
  return apiFetch<{ ok: boolean; running: boolean }>('api/rain/autoplay/start', { method: 'POST' });
}

export async function rainAutoplayStop() {
  return apiFetch<{ ok: boolean; running: boolean }>('api/rain/autoplay/stop', { method: 'POST' });
}

export async function getRainAutoplayStatus(): Promise<RainAutoplayStatusResponse> {
  return apiFetch<RainAutoplayStatusResponse>('api/rain/autoplay/status');
}

export async function getRainFreeBets(): Promise<RainFreeBetsResponse> {
  return apiFetch<RainFreeBetsResponse>('api/rain/free-bets');
}

export async function playRainFreeBet(id: number, spots?: number[]): Promise<PlayRainFreeBetResponse> {
  return apiFetch<PlayRainFreeBetResponse>(`api/rain/free-bets/${id}/play`, {
    method: 'POST',
    body: spots && spots.length ? JSON.stringify({ spots }) : undefined,
  });
}

// Manual "Bet Prediction" for rain: plays the latest prediction's preferred
// ticket on one eligible free bet (wager = the free bet's own amount).
export async function rainBetPrediction(): Promise<{ ok: boolean; result: { ok: boolean; error?: string } }> {
  return apiFetch<{ ok: boolean; result: { ok: boolean; error?: string } }>('api/rain/bet-prediction', {
    method: 'POST',
  });
}

// Get AI prediction for rain autoplay (uses DB draws + extension-like logic)
export async function getRainPrediction(provider = 'fungames_shamo', k = 3) {
  return apiFetch<RainPredictionResponse>(`api/rain/prediction?provider=${encodeURIComponent(provider)}&k=${k}`);
}

// Forced test round: the engine immediately plays as many eligible free-bets
// as the current config allows, whether or not it is running.
export async function rainTestRound(): Promise<RainTestRoundResponse> {
  return apiFetch<RainTestRoundResponse>('api/rain/autoplay/test-round', { method: 'POST' });
}

// Manual CASH wager through a rain account. Spots are the keno numbers
// (1–10 of 1–80), stake is the amount to bet. accountId may be null/omitted —
// the server then auto-selects an account whose balance covers the stake.
export async function rainManualCashBet(
  accountId: number | null,
  spots: number[],
  stake: number,
): Promise<RainManualBetResponse> {
  return apiFetch<RainManualBetResponse>('api/rain/autoplay/manual-bet', {
    method: 'POST',
    body: JSON.stringify({
      account_id: accountId ?? 'auto',
      spots,
      stake,
    }),
  });
}

// Recent manual CASH wagers across all rain accounts (newest first).
export async function getRainCashBets(limit = 100): Promise<RainCashBetsResponse> {
  return apiFetch<RainCashBetsResponse>(`api/rain/cash-bets?limit=${limit}`);
}

// Raw ws_tokens for the live-drawing observer (admin-only). Never rendered.
export async function getRainWsTokens(): Promise<RainWsTokensResponse> {
  return apiFetch<RainWsTokensResponse>('api/rain/accounts/ws-tokens');
}

// Rain ticket config (multi-ticket queue like extension)
export async function getRainTicketConfig(): Promise<{ ok: boolean; config: RainTicketConfig }> {
  return apiFetch<{ ok: boolean; config: RainTicketConfig }>('api/rain/autoplay/ticket-config');
}

export async function setRainTicketConfig(patch: { tickets: BotTicket[] }): Promise<{ ok: boolean; config: RainTicketConfig }> {
  return apiFetch<{ ok: boolean; config: RainTicketConfig }>('api/rain/autoplay/ticket-config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// Generate preview picks for all tickets
export async function getRainTicketPreview(tickets: BotTicket[], provider: string, ticketsPerRound: number): Promise<{ ok: boolean; previews: Record<string, number[]> }> {
  return apiFetch<{ ok: boolean; previews: Record<string, number[]> }>('api/rain/autoplay/ticket-preview', {
    method: 'POST',
    body: JSON.stringify({ tickets, provider, tickets_per_round: ticketsPerRound }),
  });
}

// ---- rain withdrawal automation ----
// Tiered auto-withdrawal of rain-account cash winnings through a headless
// shamo.bet session, with cash-only suspension until the wallet is re-funded.
export async function getWithdrawalConfig(): Promise<WithdrawalConfigResponse> {
  return apiFetch<WithdrawalConfigResponse>('api/rain/withdrawal/config');
}

export async function setWithdrawalConfig(patch: Partial<{
  enabled: boolean;
  min_balance_to_withdraw: number;
  win_trigger: number;
  withdraw_tiers: { min_win: number; pct: number }[];
  resume_balance: number;
  default_payment_method: string;
  default_account_number: string | null;
  default_full_name: string | null;
  cooldown_seconds: number;
  daily_max_withdrawals: number;
  dry_run: boolean;
  headless: boolean;
  concurrency: number;
}>): Promise<WithdrawalConfigResponse> {
  return apiFetch<WithdrawalConfigResponse>('api/rain/withdrawal/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function getWithdrawalStatus(): Promise<WithdrawalStatusResponse> {
  return apiFetch<WithdrawalStatusResponse>('api/rain/withdrawal/status');
}

export async function getWithdrawalRequests(limit = 100, accountId?: number): Promise<WithdrawalRequestsResponse> {
  const q = accountId != null ? `?limit=${limit}&account_id=${accountId}` : `?limit=${limit}`;
  return apiFetch<WithdrawalRequestsResponse>(`api/rain/withdrawal/requests${q}`);
}

export async function withdrawalStart() {
  return apiFetch<{ ok: boolean; running: boolean }>('api/rain/withdrawal/start', { method: 'POST' });
}

export async function withdrawalStop() {
  return apiFetch<{ ok: boolean; running: boolean }>('api/rain/withdrawal/stop', { method: 'POST' });
}

export async function withdrawRainAccountNow(id: number): Promise<{ ok: boolean; result: { ok?: boolean; skipped?: string; amount?: number; tierPct?: number | null } }> {
  return apiFetch(`api/rain/withdrawal/accounts/${id}/withdraw-now`, { method: 'POST' });
}

export async function resumeRainAccountWithdrawal(id: number) {
  return apiFetch<{ ok: boolean; id: number; cash_suspended: boolean }>(`api/rain/withdrawal/accounts/${id}/resume`, { method: 'POST' });
}

// ---- chicken road claiming ----
export async function getChickenRoadAccounts(): Promise<ChickenRoadAccountsResponse> {
  return apiFetch<ChickenRoadAccountsResponse>('api/chicken-road/accounts');
}

export async function createChickenRoadAccount(input: {
  name: string;
  ws_token: string;
  provider: ChickenRoadProvider;
  access_token?: string;
}) {
  return apiFetch('api/chicken-road/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateChickenRoadAccount(
  id: number,
  patch: Partial<{
    name: string;
    ws_token: string;
    provider: ChickenRoadProvider;
    is_enabled: boolean;
    access_token: string | null;
  }>,
) {
  return apiFetch(`api/chicken-road/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteChickenRoadAccount(id: number) {
  return apiFetch(`api/chicken-road/accounts/${id}`, { method: 'DELETE' });
}

export async function refreshChickenRoadAccount(id: number) {
  return apiFetch(`api/chicken-road/accounts/${id}/refresh`, { method: 'POST' });
}

export async function checkAllChickenRoadStatus(): Promise<{ ok: boolean; reconnected: number }> {
  return apiFetch<{ ok: boolean; reconnected: number }>('api/chicken-road/accounts/check-status', { method: 'POST' });
}

export async function getChickenRoadClaims(id: number): Promise<ChickenRoadClaimsResponse> {
  return apiFetch<ChickenRoadClaimsResponse>(`api/chicken-road/accounts/${id}/claims`);
}

// ---- chicken road autoplay (lane-based crash game) ----
export async function getChickenRoadAutoplayConfig(): Promise<ChickenRoadAutoplayConfigResponse> {
  return apiFetch<ChickenRoadAutoplayConfigResponse>('api/chicken-road/autoplay/config');
}

export async function setChickenRoadAutoplayConfig(
  patch: Partial<
    Pick<
      ChickenRoadAutoplayConfig,
      | 'enabled'
      | 'provider'
      | 'difficulty'
      | 'risk_level'
      | 'base_lane'
      | 'rng_variance'
      | 'base_wager'
      | 'stake_mode'
      | 'stake_value'
      | 'max_stake'
      | 'loss_streak_stop'
      | 'daily_loss_stop'
      | 'free_bet_only'
      | 'delay_between_rounds_ms'
    >
  >,
): Promise<ChickenRoadAutoplayConfigResponse> {
  return apiFetch<ChickenRoadAutoplayConfigResponse>('api/chicken-road/autoplay/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function chickenRoadAutoplayStart() {
  return apiFetch<{ ok: boolean; running: boolean }>('api/chicken-road/autoplay/start', { method: 'POST' });
}

export async function chickenRoadAutoplayStop() {
  return apiFetch<{ ok: boolean; running: boolean }>('api/chicken-road/autoplay/stop', { method: 'POST' });
}

export async function getChickenRoadAutoplayStatus(): Promise<ChickenRoadAutoplayStatusResponse> {
  return apiFetch<ChickenRoadAutoplayStatusResponse>('api/chicken-road/autoplay/status');
}

export async function playNowChickenRoadRound(accountId: number): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  return apiFetch<{ ok: boolean; result?: unknown; error?: string }>('api/chicken-road/autoplay/play-now', {
    method: 'POST',
    body: JSON.stringify({ account_id: accountId }),
  });
}

export async function getChickenRoadFreeBets(): Promise<ChickenRoadFreeBetsResponse> {
  return apiFetch<ChickenRoadFreeBetsResponse>('api/chicken-road/free-bets');
}

// Recent lane rounds, newest first. `live` reads the claimer's in-memory ring; the
// default reads the durable ledger that survives a restart.
export async function getChickenRoadRounds(
  limit = 50,
  opts: { live?: boolean; accountId?: number } = {},
): Promise<ChickenRoadRoundsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts.live) params.set('live', '1');
  if (opts.accountId != null) params.set('account_id', String(opts.accountId));
  return apiFetch<ChickenRoadRoundsResponse>(`api/chicken-road/rounds?${params.toString()}`);
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

// ---- odds drop monitor + soccer suggester ----
// All /api/odds/* endpoints are admin-gated on the keno-server; the dashboard
// proxy relays the session cookie so these just work from the client.

export interface OddsLiveResponse {
  status: OddsWatcherStatus;
  drops: OddsDrop[];
  suggestions: OddsSuggestion[];
  now: string;
}

export async function getOddsLive(): Promise<OddsLiveResponse> {
  return apiFetch<OddsLiveResponse>('api/odds/live');
}

export async function getOddsDrops(limit = 100, minutes = 60): Promise<OddsDrop[]> {
  return apiFetch<OddsDrop[]>(`api/odds/drops?limit=${limit}&minutes=${minutes}`);
}

export async function getOddsSuggestions(limit = 50): Promise<OddsSuggestion[]> {
  return apiFetch<OddsSuggestion[]>(`api/odds/suggestions?limit=${limit}`);
}

export async function oddsPollNow(): Promise<{ ok: boolean; status: OddsWatcherStatus }> {
  return apiFetch<{ ok: boolean; status: OddsWatcherStatus }>('api/odds/poll', { method: 'POST' });
}

export async function getOddsConfig(): Promise<OddsWatcherConfig> {
  return apiFetch<OddsWatcherConfig>('api/odds/config');
}

export async function setOddsConfig(patch: Partial<OddsWatcherConfig>): Promise<OddsWatcherConfig> {
  return apiFetch<OddsWatcherConfig>('api/odds/config', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export async function oddsCalibrate(): Promise<{ ok: boolean; sides: Record<string, string>; samples: number }> {
  return apiFetch<{ ok: boolean; sides: Record<string, string>; samples: number }>('api/odds/calibrate', {
    method: 'POST',
  });
}

// ---- shamo sports bet slips ----
// Admin panel endpoints (dashboard proxy relays the session cookie). The
// extension itself talks directly to the server's /api/odds/bot/* routes with
// the X-Bot-Token shared secret.

export async function getShamoBetStatus(): Promise<ShamoBetStatus> {
  return apiFetch<ShamoBetStatus>('api/odds/bet/status');
}

export async function getShamoBetConfig(): Promise<ShamoBetConfig> {
  return apiFetch<ShamoBetConfig>('api/odds/bet/config');
}

export async function setShamoBetConfig(patch: Partial<ShamoBetConfig>): Promise<ShamoBetConfig> {
  return apiFetch<ShamoBetConfig>('api/odds/bet/config', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export async function getShamoBetOrders(limit = 50): Promise<ShamoBetOrder[]> {
  return apiFetch<ShamoBetOrder[]>(`api/odds/bet/orders?limit=${limit}`);
}

export async function createShamoBetOrder(
  suggestionId: number,
  stake?: number,
): Promise<ShamoBetOrder> {
  return apiFetch<ShamoBetOrder>('api/odds/bet/orders', {
    method: 'POST',
    body: JSON.stringify({ suggestionId, ...(stake ? { stake } : {}) }),
  });
}

export async function cancelShamoBetOrder(id: number): Promise<ShamoBetOrder> {
  return apiFetch<ShamoBetOrder>(`api/odds/bet/orders/${id}/cancel`, { method: 'POST' });
}

export async function requeueShamoBetOrder(id: number): Promise<ShamoBetOrder> {
  return apiFetch<ShamoBetOrder>(`api/odds/bet/orders/${id}/requeue`, { method: 'POST' });
}

/** Place an order server-side with the registered shamo session (no extension). */
export async function placeShamoBetOrder(id: number): Promise<ShamoPlaceResponse> {
  return apiFetch<ShamoPlaceResponse>(`api/odds/bet/orders/${id}/place`, { method: 'POST' });
}

/** Whether a shamo session is registered for server-side placement (token never returned). */
export async function getShamoBetSession(): Promise<ShamoBetSessionInfo> {
  return apiFetch<ShamoBetSessionInfo>('api/odds/bet/session');
}

/** Register the shamo `mulasport_session` token from a logged-in WebView/extension. */
export async function setShamoBetSession(token: string, tgUserId?: string): Promise<ShamoBetSessionInfo> {
  return apiFetch<ShamoBetSessionInfo>('api/odds/bet/session', {
    method: 'POST',
    body: JSON.stringify({ token, ...(tgUserId ? { tgUserId } : {}) }),
  });
}

/** Forget the stored shamo session. */
export async function clearShamoBetSession(): Promise<ShamoBetSessionInfo> {
  return apiFetch<ShamoBetSessionInfo>('api/odds/bet/session', { method: 'DELETE' });
}

export async function getShamoBets(limit = 50): Promise<ShamoBetRecord[]> {
  return apiFetch<ShamoBetRecord[]>(`api/odds/bet/bets?limit=${limit}`);
}

/** Send a browser-push test notification to every subscribed dashboard. */
export async function pushTest(): Promise<{ ok: boolean; sent: number; subscriptions: number; error?: string }> {
  try {
    return await apiFetch<{ ok: boolean; sent: number; subscriptions: number }>('api/push/test', {
      method: 'POST',
    });
  } catch (e) {
    return { ok: false, sent: 0, subscriptions: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
