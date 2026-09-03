// Response shapes from the keno-server REST API (mirrors server/src/api/*).
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ProviderSummary {
  id: string;
  name: string;
  enabled: boolean;
}

// A completed draw as returned by /api/draws/:siteId (timeAnalyzer.getDraws).
export interface Draw {
  roundId: string;
  roundNo: number;
  results: number[];
  drawnAt: string;
  hourOfDay: number;
  dayOfWeek: number;
  complete: boolean;
}

export interface DrawsResponse {
  siteId: string;
  count: number;
  total: number;
  draws: Draw[];
}

export interface HourlyTrend {
  hour: number;
  avgRepetitive: number;
  avgCluster: number;
  avgSequential: number;
  drawCount: number;
  topNumbers: number[];
}

export interface TrendsResponse {
  siteId: string;
  trends: HourlyTrend[];
}

export interface NumberFrequency {
  number: number;
  frequency: number;
  count: number;
}

// Full window stats returned by /api/stats/:siteId?hour=&day= (TimeWindowStats).
export interface TimeWindowStats {
  siteId: string;
  hourOfDay: number;
  dayOfWeek: number;
  dayName: string;
  numberFrequencies: NumberFrequency[];
  avgRepetitiveCount: number;
  avgClusterScore: number;
  avgSequentialPairs: number;
  drawCount: number;
  hotNumbers: number[];
  coldNumbers: number[];
  sequentialTendency: number;
  clusterTendency: number;
}

export interface StatsResponse {
  siteId: string;
  hour?: number;
  day?: number;
  stats?: TimeWindowStats | null;
  trends?: HourlyTrend[];
}

export interface PatternBase {
  type: string;
  numbers: number[];
  description: string;
}

// A PatternSuggestion as returned by /api/patterns/:siteId and /api/insights
// (patternEngine.getOverduePatterns). The numbers live on the nested .pattern.
export interface PatternSuggestion {
  pattern: PatternBase;
  overdueScore: number;
  avgInterval: number;
  lastSeen: string;
  timeRelevance: number;
  totalOccurrences: number;
}

export interface PatternsResponse {
  siteId: string;
  count: number;
  patterns: PatternSuggestion[];
}

// A prediction as returned by predictionEngine.getLatestPrediction.
export interface Prediction {
  siteId: string;
  numbers: number[];
  confidence: number;
  reasoning: string[];
  timeContext: string | null;
  sources: Record<string, unknown>;
  generatedAt: string;
}

// Recent prediction row (predictionEngine.getRecentPredictions).
export interface RecentPrediction {
  id: number;
  type: string;
  numbers: number[];
  confidence: number;
  reasoning: string[];
  timeContext: string | null;
  createdAt: string;
  hit: number | null;
}

export interface AccuracyStats {
  total: number;
  wins: number;
  winRate: number;
}

export interface PredictionsResponse {
  siteId: string;
  prediction: Prediction | null;
  recent: RecentPrediction[];
  accuracy: AccuracyStats | null;
}

export interface RepetitiveAnalysis {
  [key: string]: any;
}

export interface InsightsResponse {
  siteId: string;
  generatedAt: string;
  prediction: Prediction | null;
  patterns: PatternSuggestion[];
  repetitive: RepetitiveAnalysis;
}

export interface DashboardResponse {
  siteId: string;
  serverTime: string;
  currentContext: { hour: number; dayOfWeek: number; dayName: string };
  totalDraws: number;
  liveRound: Draw | null;
  recentDraws: Draw[];
  currentPrediction: Prediction | null;
  overduePatterns: PatternSuggestion[];
  accuracy: AccuracyStats | null;
  hourlyTrends: HourlyTrend[];
  currentTimeStats: TimeWindowStats | null;
}

export interface Session {
  id: number;
  provider: string;
  url: string;
  base_url: string | null;
  token: string | null;
  instance_id: string | null;
  name: string | null;
  status: string;
  last_error: string | null;
  last_draw_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionsResponse {
  providers: { provider: string; name: string; sessions: Session[] }[];
  total: number;
}

export interface Account {
  id: number;
  provider: string;
  phone: string;
  password?: string;
  balance: number;
  token?: string | null;
  reward?: number | null;
  last_spin_at?: string | null;
  last_bet_at?: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountsResponse {
  total: number;
  count: number;
  accounts: Account[];
}

export interface Proxy {
  id: number;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  protocol: string;
  is_active: boolean;
  last_checked_at?: string | null;
  last_ok?: boolean | null;
  last_error?: string | null;
  created_at: string;
}

export interface ProxyTestResponse {
  ok: boolean;
  proxyId: number;
  works: boolean;
  latencyMs?: number | null;
  error?: string | null;
}

export interface ProxyTestAllResponse {
  ok: boolean;
  tested: number;
  passed: number;
  failed: number;
  results: { id: number; host: string; port: number; works: boolean; error?: string | null; latencyMs?: number | null }[];
}

export interface ProxiesResponse {
  count: number;
  proxies: Proxy[];
}

export interface AutoplayConfig {
  id: number;
  enabled: boolean;
  mode: 'A' | 'B';
  batch_size: number;
  stake: number;
  split_ratio: 'uniform' | '1/2' | '1/3';
  base_tickets: number[][] | null;
  updated_at: string;
}

export interface AutoplayStatus {
  enabled: boolean;
  running: boolean;
  workers: number;
  config: AutoplayConfig;
}

export interface AutoplayPlacedBet {
  accountId: number;
  phone: string;
  spots: number[];
  stake: number;
  requestId: string;
  ok: boolean;
}

export interface AutoplayTestRoundResponse {
  ok: boolean;
  running: boolean;
  workers: number;
  placed: AutoplayPlacedBet[];
}

export interface SpinResponse {
  requested: number;
  created: number;
  accounts: { phone: string; id: number; reward: number | null; claimed: boolean }[];
  errors: string[];
}

export interface CreateAccountsResponse {
  requested: number;
  created: number;
  accounts: { phone: string; id: number }[];
  errors: string[];
  timedOut?: boolean;
}

export interface UploadResponse {
  ok: boolean;
  provided: number;
  rejected?: number;
  inserted?: number;
  added?: number;
  tested?: number;
  passed?: number;
  failed?: number;
  file?: string;
}

export interface Client {
  id: string;
  type?: string;
  label?: string;
  connectedAt?: string;
  lastSeen?: string;
  ip?: string;
  [key: string]: any;
}

export interface ClientsResponse {
  clients: Client[];
  summary: Record<string, any>;
}

export interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

export interface LogsResponse {
  logs: LogEntry[];
}
