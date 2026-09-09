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
	ws_token: string | null;
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
	ws_token?: string | null;
	reward?: number | null;
	last_spin_at?: string | null;
	last_bet_at?: string | null;
	is_deleted: boolean;
	is_enabled?: boolean;
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
	results: {
		id: number;
		host: string;
		port: number;
		works: boolean;
		error?: string | null;
		latencyMs?: number | null;
	}[];
}

export interface ProxiesResponse {
	count: number;
	proxies: Proxy[];
}

export interface AutoplayConfig {
	id: number;
	enabled: boolean;
	mode: 'A' | 'B' | 'C';
	batch_size: number;
	stake: number;
	split_ratio: 'uniform' | '1/2' | '1/3';
	digit_count: 2 | 3;
	base_tickets: number[][] | null;
	repetitive_auto_bet: boolean;
	updated_at: string;
	game_state: 'betting_open' | 'drawing' | 'settled' | 'unknown';
	signals: 'repetitive' | 'recurring' | 'hot' | 'none';
	manual_account_selection: boolean;
}

// Live recurrence / pattern-trend signal used to auto-bet recent repetitive
// tickets (mirrors server RecurrenceSignalBuilder output).
export interface RecurrenceSignal {
	siteId: string;
	computedAt: string;
	level: 'easy' | 'medium' | 'hard' | 'insufficient';
	confidence: number;
	avgRepetitive: number;
	drawCount: number;
	dominantPattern: string;
	suggestions: number[];
	chainNumbers: number[];
	recurrenceNumbers: number[];
	trendNumbers: number[];
}

export interface AutoplayStatus {
	enabled: boolean;
	running: boolean;
	workers: number;
	connectedWorkers?: number;
	freshAccounts?: number;
	config: AutoplayConfig;
	accounts: AccountGameStatus[];
	bets?: AutoplayPlacedBet[];
	recurrence?: RecurrenceSignal | null;
}

export interface AutoplayPlacedBet {
	accountId: number;
	phone: string;
	spots: number[];
	stake: number;
	requestId: string;
	ok: boolean;
	status?: 'failed' | 'pending' | 'won' | 'lost';
	failReason?: string;
	winAmount?: number | null;
	drawnSpots?: number[] | null;
	matched?: number | null;
	balanceAfter?: number | null;
	placedAt?: number;
	settledAt?: number | null;
}

export interface CheckBalanceItem {
	accountId: number;
	phone: string;
	token: boolean;
	refreshed: boolean;
	balance: number | null;
	failed: boolean;
	deleted?: boolean;
}

export interface CheckBalancesResponse {
	ok: boolean;
	count: number;
	synced?: number;
	failed?: number;
	deleted?: number;
	timedOut?: boolean;
	results: CheckBalanceItem[];
}

export interface AutoplayTestRoundResponse {
	ok: boolean;
	running: boolean;
	workers: number;
	sent?: number;
	placed: AutoplayPlacedBet[];
	bets?: AutoplayPlacedBet[];
}

// Per-account live autoplay/game status surfaced from the gateway workers.
export interface AccountGameStatus {
	accountId: number;
	phone: string;
	tokenOk: boolean;
	wsTokenOk: boolean;
	connected: boolean;
	lastStatus: string;
	lastBetAt: number | null;
	lastSpots: number[] | null;
	lastStake: number | null;
	state: 'idle' | 'betting' | 'won' | 'lost' | 'pending' | 'error';
	winAmount: number | null;
	balance: number;
	deleted: boolean;
	updatedAt: number;
	// Gateway round truth + bet-lifecycle counters (mirrors the server
	// AccountGameStatus). Optional so older cached payloads still parse.
	lastPhase?: string | null;
	lastRoundId?: string | null;
	bettingOpen?: boolean;
	sent?: number;
	acked?: number;
	failed?: number;
	settledWon?: number;
	settledLost?: number;
}

export interface AccountBalanceResult {
	balance: number | null;
	totalBalance: number | null;
	bonusBalance: number | null;
	lockedBalance: number | null;
	withdrawableBalance: number | null;
	userID: string | null;
}

export interface SpinResponse {
	requested: number;
	created: number;
	accounts: {
		phone: string;
		id: number;
		reward: number | null;
		claimed: boolean;
	}[];
	errors: string[];
}

export interface CreationJobStatus {
	running: boolean;
	target: number;
	made: number;
	attempts: number;
	errors: string[];
	startedAt: number | null;
	finishedAt: number | null;
	stopped: boolean;
	wsTokens?: number;
}

export interface CreateAccountsResponse {
	ok: boolean;
	started: boolean;
	job: CreationJobStatus | null;
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

// ---- Ticket strategy types (mirrors extension BotTicket) ----

export interface BotTicket {
	id: string;
	spots: number;
	strategy: 'cluster' | 'standard' | 'pattern';
	stake: number;
	enabled: boolean;
	staticTicket?: boolean;
	numbers?: number[];
}

export type DifficultyLevel = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';

export interface AccountTicket {
	accountId: number;
	phone: string;
	tickets: BotTicket[];
	lastDraw?: number;
	lastWin?: number;
	balanceHistory: number[];
}

export interface RoundTicket {
	accountId: number;
	spots: number[];
	stake: number;
	strategy: string;
	difficulty: DifficultyLevel;
}

export interface TicketPerformance {
	ticketId: string;
	strategy: string;
	timesPlayed: number;
	wins: number;
	totalStaked: number;
	totalWon: number;
	lastWinAt: number | null;
	avgStake: number;
}

export interface StrategyPerformance {
	[key: string]: {
		timesPlayed: number;
		wins: number;
		totalStaked: number;
		totalWon: number;
		winRate: number;
		lastResult: 'win' | 'loss' | 'pending';
	};
}

export interface DifficultyAnalysis {
	level: DifficultyLevel;
	repetitiveScore: number;
	clusterScore: number;
	patternScore: number;
	standardScore: number;
	recommendation: 'cluster' | 'standard' | 'pattern';
}

export interface RoundSummary {
	roundNo: number;
	totalTickets: number;
	totalStaked: number;
	totalWon: number;
	tickets: RoundTicket[];
}

export interface TicketGenerationResult {
	success: boolean;
	tickets: RoundTicket[];
	errors: string[];
}

export interface ManualBetResponse {
	ok: boolean;
	accountId?: number;
	phone?: string;
	balance?: number;
	stake?: number;
	message?: string;
	placed?: {
		accountId: number;
		phone: string;
		stake: number;
		requestId: string;
		status: string;
	};
	failReason?: string;
}

export interface EligibleAccount {
	accountId: number;
	phone: string;
	balance: number;
	connected: boolean;
}

export interface EligibleAccountsResponse {
	ok: boolean;
	accounts: EligibleAccount[];
}

export interface CleanupSpentResponse {
	ok: boolean;
	candidates: number;
	deleted: number;
	skippedPending: number[];
	errors?: string[];
}

export interface LiveBalanceEntry {
	accountId: number;
	phone: string;
	balance: number;
	source: 'ws' | 'stored';
	connected: boolean;
}

export interface LiveBalancesResponse {
	ok: boolean;
	count: number;
	wsHits: number;
	stored: number;
	accounts: LiveBalanceEntry[];
}
