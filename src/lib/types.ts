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
	offset: number;
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

// A betting ticket generated per the site's ticket plan.
export interface PredictionTicket {
	digits: number;
	numbers: number[];
	// null until the prediction is evaluated against a real draw; true only on
	// a full match (every ticket number landed on the draw).
	won: boolean | null;
}

// How many tickets of each digit-count to generate per prediction:
// e.g. {2:3, 3:3, 4:1} = 3 two-digit, 3 three-digit, 1 four-digit ticket.
export type TicketPlan = Record<number, number>;

// A prediction as returned by predictionEngine.getLatestPrediction.
export interface Prediction {
	siteId: string;
	numbers: number[];
	// Small betting-ticket pick (top 3).
	ticket?: number[];
	// Predicted whole draw (top 20).
	fullDraw?: number[];
	// Digit-based betting tickets from the site's ticket plan.
	tickets: PredictionTicket[];
	confidence: number;
	reasoning: string[];
	timeContext: string | null;
	sources: Record<string, unknown>;
	generatedAt: string;
	// Sequence matching data when using the historical look-ahead engine
	sequenceMatch?: SequenceMatchData | null;
	useSequenceMatch?: boolean;
	// Enhanced ML predictions with trigger reasons
	numberPredictions?: NumberPrediction[];
}

// Number prediction with trigger reason from enhanced ML model
export interface NumberPrediction {
	number: number;
	probability: number;
	trigger_reason: string;
}

// Sequence matching data from the ML service
export interface SequenceMatchData {
	site_id: string;
	numbers: number[];
	tickets: Record<string, number[][]>;
	confidence: number;
	detected_mode: string;
	reasoning: string[];
	similarity_details: {
		matches_count: number;
		lookback_n: number;
		historical_analyzed: number;
		top_matches: Array<{
			similarity: number;
			continuation: number[];
			time_delta_hours: number;
		}>;
		time_loops: Array<{
			loop_pattern: string;
			occurrences: number;
			avg_similarity: number;
		}>;
	};
	generated_at: number;
	draws_used: number;
}

// Recent prediction row (predictionEngine.getRecentPredictions).
export interface RecentPrediction {
	id: number;
	type: string;
	numbers: number[];
	ticket?: number[];
	fullDraw?: number[];
	tickets: PredictionTicket[];
	confidence: number;
	reasoning: string[];
	timeContext: string | null;
	createdAt: string;
	hit: number | null;
	// The actual draw results the prediction was checked against (set with hit).
	evaluatedDraw?: number[];
}

export interface AccuracyStats {
	total: number;
	wins: number;
	winRate: number;
	// Full-match accuracy broken down by ticket digit-count (e.g. 2/3/4).
	tickets?: Record<string, { total: number; wins: number; winRate: number }>;
}

export interface MlTrainMetrics {
	holdout_samples: number;
	mean_pick10_hits: number;
	mean_ticket3_hits: number;
	mean_full20_hits: number;
	pick10_win_rate_ge4: number;
	pick10_win_rate_ge3: number;
	pick10_win_rate_ge2: number;
	pick10_win_rate_ge1: number;
	top_k?: number;
}

export interface MlStatus {
	configured: boolean;
	reachable: boolean | null;
	trainedRows: number | null;
	metrics: { [siteId: string]: MlTrainMetrics };
	lastTrainAt: { [siteId: string]: string };
}

// Live ML predictor output (GET /api/ml/live/:siteId) — recurrence_v1.
// Honest insight telemetry (see RECURRENCE_MODEL.md): recurrence averages and
// the model's own output, not a claim of an edge.
export interface MlNumberRecurrence {
	count: number;
	freq: number;
	avg_gap_draws: number | null;
	top_hour: number | null;
	top_hour_lift: number | null;
}

export interface MlRunRecurrence {
	run: number[];
	type: string;
	obs: number;
	lift: number;
	avg_gap_min: number | null;
	median_gap_min: number | null;
	last_epoch: number;
	top_hour: number | null;
	top_hour_share: number;
}

export interface MlIndicator {
	pair: number[];
	triplet: number[];
	count: number;
	cond_rate: number;
	base_rate: number;
	lift: number;
}

export interface MlInsights {
	available: boolean;
	model?: string;
	n_draws?: number;
	metrics?: MlTrainMetrics | null;
	numbers?: Record<string, MlNumberRecurrence>;
	runs?: MlRunRecurrence[];
	indicators?: MlIndicator[];
}

export interface MlLivePrediction {
	numbers: number[];
	ticket: number[];
	fullDraw: number[];
	confidence: number;
	numberPredictions: NumberPrediction[];
	reasoning: string[];
	disclaimer: string | null;
}

export interface MlLiveResponse {
	siteId: string;
	generatedAt?: number;
	status: 'ok' | 'unavailable' | 'no_draws' | 'error';
	message?: string;
	prediction?: MlLivePrediction | null;
	insights?: MlInsights | null;
}

// Two-digit (2-spot) dynamic tickets generated from the last 1–3 draws
// (repeat/carryover) + recurrence patterns. Mirrors the server's
// twoDigitPredictor.ts output.
export interface TwoDigitTicket {
	numbers: [number, number];
	score: number;
	reasons: string[];
	source: 'repeat' | 'pattern';
}

export interface TwoDigitPoolEntry {
	number: number;
	score: number;
	reasons: string[];
	source: 'repeat' | 'pattern';
}

export interface TwoDigitTicketsResponse {
	siteId: string;
	generatedAt: string;
	draws: Array<{ roundId: string; roundNo: number; results: number[]; drawnAt: string }>;
	pool: TwoDigitPoolEntry[];
	tickets: TwoDigitTicket[];
}

export interface PredictionsResponse {
	siteId: string;
	prediction: Prediction | null;
	recent: RecentPrediction[];
	accuracy: AccuracyStats | null;
	// The most recently completed draw recorded for the site, so the UI can
	// show a prediction next to its ground-truth context.
	currentDraw: number[] | null;
	currentDrawAt: string | null;
	mlStatus?: MlStatus | null;
	// Per-site ticket generation plan ({digits -> count}).
	ticketPlan?: TicketPlan;
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
	mlStatus?: MlStatus | null;
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
	// Auto-bet the generated prediction tickets each round (0 = all of them).
	prediction_ticket_betting: boolean;
	prediction_tickets_per_round: number;
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
	balanceLive?: boolean;
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
	durationMs?: number;
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

// An ML triplet alert (repetitive sequential grouping like 1,2,3 detected by
// the Python service, POSTed to the server and polled by the dashboard).
export interface MlAlert {
	id: number;
	draw: number[];
	summary: { draw: number[]; has_triplet: boolean };
	source: string;
	timestamp: number;
	receivedAt: string;
}

export interface MlAlertsResponse {
	count: number;
	alerts: MlAlert[];
}

// ---- Ticket strategy types (mirrors extension BotTicket) ----

export interface BotTicket {
	id: string;
	spots: number;
	strategy: 'cluster' | 'standard' | 'pattern' | 'manual';
	stake: number;
	enabled: boolean;
	staticTicket?: boolean;
	numbers?: number[];
	useFreeBet?: boolean;
}

export interface RainTicketConfig {
	tickets: BotTicket[];
	enabled: boolean;
	tickets_per_round: number;
	round_interval: number;
	provider: string;
	updated_at: string;
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

// Rain (free-bet) claiming accounts. Mirrors server/src/api/rainRoutes.ts
// toApiAccount(): the ws_token is never echoed back, only masked. Rain
// accounts play the shamo-hosted fungames game, so the plain 'fungames'
// (draws/autoplay/tolobirr) id never appears here.
export type RainProvider = 'fungames_shamo' | 'phoenixbet';

export interface RainAccount {
	id: number;
	name: string;
	provider: RainProvider;
	gateway_host: string;
	ws_token_masked: string | null;
	access_token_masked: string | null;
	has_access_token: boolean;
	// Shamo.bet login password stored for this account (never echoed back —
	// only the has_password flag; raw password is admin-only via
	// GET /api/rain/accounts/credentials for the mobile login flow).
	has_password: boolean;
	is_enabled: boolean;
	// Per-account autoplay opt-out: false keeps claiming rain (is_enabled) but
	// excludes this account's free bets + wallet from the autoplay engine.
	autoplay_enabled: boolean;
	status: string;
	connected: boolean;
	lastError: string | null;
	connectedAt: number | null;
	claimedThisSession: number;
	lastRainId: string | null;
	lastSlot: number | null;
	lastWager: number | null;
	lastRainAt: number | null;
	// Live wallet balance (BALANCE frames) merged over the persisted value.
	balance: number;
	balanceLive: boolean;
	rain_count: number;
	last_claimed_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface RainAccountsResponse {
	ok: boolean;
	count: number;
	accounts: RainAccount[];
}

export interface RainClaimRecord {
	id: number;
	account_id: number;
	rain_id: string;
	message_id: string;
	slot_index: number;
	wager_amount: number;
	created_at: string;
}

export interface RainClaimsResponse {
	ok: boolean;
	accountId: number;
	count: number;
	claims: RainClaimRecord[];
}

// One rain free-bet in the ledger (server rain_free_bets). status evolves:
// available → claiming → bet_placed → won/lost (or failed/expired).
export type RainFreeBetStatus =
	| 'available'
	| 'claiming'
	| 'bet_placed'
	| 'won'
	| 'lost'
	| 'failed'
	| 'expired';

export interface RainFreeBet {
	id: number;
	account_id: number;
	account_name?: string;
	account_enabled?: boolean;
	free_bet_id: string;
	player_id: string | null;
	wager_amount: number;
	won_amount: number;
	given_count: number;
	pending_bet_count: number;
	closed_bet_count: number;
	min_cashout_odd: number | null;
	granted_at: string | null;
	expires_at: string | null;
	source_kind: 'campaign' | 'p2p_rain' | null;
	campaign_id: string | null;
	giver_player_id: string | null;
	rain_id: string | null;
	slot_index: number | null;
	status: RainFreeBetStatus;
	request_id: string | null;
	chosen_spots: number[] | null;
	bet_placed_at: string | null;
	drawn_spots: number[] | null;
	matched_spots: number[] | null;
	error: string | null;
	last_seen_at: string | null;
	created_at: string;
	updated_at: string;
	bet_type?: 'free_bet' | 'cash';
}

export interface RainFreeBetsResponse {
	ok: boolean;
	count: number;
	bets: RainFreeBet[];
}

export interface RainAutoplayConfig {
	id: 1;
	enabled: boolean;
	provider: RainProvider;
	tickets_per_round: number;
	spots_mode: 'prediction' | 'prediction_tickets' | 'manual';
	manual_spots: number[];
	round_interval: number;
	use_cash_after_free_bets: boolean;
	cash_stake: number;
	updated_at: string;
}

export interface RainAutoplayConfigResponse {
	ok: boolean;
	config: RainAutoplayConfig;
}

export interface RainAutoplayStatus {
	running: boolean;
	intervalMs: number;
	lastRoundAt: number | null;
	lastRoundDurationMs: number | null;
	lastRoundPlayed: number;
	totalPlayed: number;
	lastError: string | null;
	pendingAcks: number;
	freeBetsPlayed: number;
	cashBetsPlayed: number;
}

export interface RainAutoplayStatusResponse {
	ok: boolean;
	status: RainAutoplayStatus;
	config: RainAutoplayConfig;
}

export interface PlayRainFreeBetResponse {
	ok: boolean;
	result: { ok: boolean; found: boolean; request_id?: string; error?: string };
}

// A manual CASH wager placed through a rain account (server Mirrors
// server/src/rain/rainClaimer.ts RainCashBet). `status` is one of
// won / lost / failed; `winAmount` is null while pending and on failed bets.
export type RainCashBetStatus = 'won' | 'lost' | 'failed';

export interface RainCashBet {
	accountId: number;
	phone: string;
	accountName: string;
	spots: number[];
	stake: number;
	requestId: string;
	status: RainCashBetStatus;
	winAmount: number | null;
	matched: number | null;
	drawnSpots: number[];
	failReason?: string;
	placedAt: number;
	settledAt: number;
}

export interface RainCashBetsResponse {
	ok: boolean;
	count: number;
	bets: RainCashBet[];
}

export interface RainManualBetResponse {
	ok: boolean;
	accountId?: number;
	picked?: {
		accountId: number;
		phone: string;
		balance: number | null;
	} | null;
	result: {
		ok: boolean;
		requestId: string;
		balance: number | null;
		error?: string;
	};
}

export interface RainTestRoundResponse {
	ok: boolean;
	result: {
		ok: boolean;
		played: number;
		bets: { accountId: number; freeBetId: string; requestId: string }[];
	};
}

// Raw (unmasked) ws_tokens for enabled rain accounts — used only by the
// live-drawing observer, never displayed.
export interface RainWsToken {
	id: number;
	name: string;
	phone: string;
	provider: RainProvider;
	gateway_host: string;
	ws_token: string | null;
}

export interface RainWsTokensResponse {
	ok: boolean;
	count: number;
	tokens: RainWsToken[];
}

// Rain prediction response from the new predictor
export interface RainPredictionResponse {
	ok: boolean;
	prediction?: {
		picks: number[];
		strategy: 'cluster' | 'standard' | 'pattern';
		difficulty: { level: string; confidence: number; recommendedSpotRange: { min: number; max: number }; recommendedStrategy: string; dominantPattern: string };
		repetitivePatterns: any[];
		clusters: any[];
		metrics: any[];
		volatility: any;
	};
}

// Chicken Road (free-bet) claiming accounts - similar to rain but for chicken road game
export type ChickenRoadProvider = 'chicken_road';

export interface ChickenRoadAccount {
	id: number;
	name: string;
	provider: ChickenRoadProvider;
	gateway_host: string;
	ws_token_masked: string | null;
	access_token_masked: string | null;
	has_access_token: boolean;
	is_enabled: boolean;
	status: string;
	connected: boolean;
	lastError: string | null;
	connectedAt: number | null;
	claimedThisSession: number;
	lastRainId: string | null;
	lastSlot: number | null;
	lastWager: number | null;
	lastRainAt: number | null;
	balance: number;
	balanceLive: boolean;
	rain_count: number;
	last_claimed_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface ChickenRoadAccountsResponse {
	ok: boolean;
	count: number;
	accounts: ChickenRoadAccount[];
}

export interface ChickenRoadClaimRecord {
	id: number;
	account_id: number;
	rain_id: string;
	message_id: string;
	slot_index: number;
	wager_amount: number;
	created_at: string;
}

export interface ChickenRoadClaimsResponse {
	ok: boolean;
	accountId: number;
	count: number;
	claims: ChickenRoadClaimRecord[];
}

export type ChickenRoadFreeBetStatus =
	| 'available'
	| 'claiming'
	| 'bet_placed'
	| 'won'
	| 'lost'
	| 'failed'
	| 'expired';

export interface ChickenRoadFreeBet {
	id: number;
	account_id: number;
	account_name?: string;
	account_enabled?: boolean;
	free_bet_id: string;
	player_id: string | null;
	wager_amount: number;
	won_amount: number;
	given_count: number;
	pending_bet_count: number;
	closed_bet_count: number;
	min_cashout_odd: number | null;
	granted_at: string | null;
	expires_at: string | null;
	source_kind: 'campaign' | 'p2p_rain' | null;
	campaign_id: string | null;
	giver_player_id: string | null;
	rain_id: string | null;
	slot_index: number | null;
	status: ChickenRoadFreeBetStatus;
	request_id: string | null;
	chosen_spots: number[] | null;
	bet_placed_at: string | null;
	drawn_spots: number[] | null;
	matched_spots: number[] | null;
	error: string | null;
	last_seen_at: string | null;
	created_at: string;
	updated_at: string;
	bet_type?: 'free_bet' | 'cash';
}

export interface ChickenRoadFreeBetsResponse {
	ok: boolean;
	count: number;
	bets: ChickenRoadFreeBet[];
}

export interface ChickenRoadAutoplayConfig {
	id: 1;
	enabled: boolean;
	provider: ChickenRoadProvider;
	tickets_per_round: number;
	spots_mode: 'prediction' | 'prediction_tickets' | 'manual';
	manual_spots: number[];
	round_interval: number;
	use_cash_after_free_bets: boolean;
	cash_stake: number;
	updated_at: string;
}

export interface ChickenRoadAutoplayConfigResponse {
	ok: boolean;
	config: ChickenRoadAutoplayConfig;
}

export interface ChickenRoadAutoplayStatus {
	running: boolean;
	intervalMs: number;
	lastRoundAt: number | null;
	lastRoundDurationMs: number | null;
	lastRoundPlayed: number;
	totalPlayed: number;
	lastError: string | null;
	pendingAcks: number;
	freeBetsPlayed: number;
	cashBetsPlayed: number;
}

export interface ChickenRoadAutoplayStatusResponse {
	ok: boolean;
	status: ChickenRoadAutoplayStatus;
	config: ChickenRoadAutoplayConfig;
}

export interface PlayChickenRoadFreeBetResponse {
	ok: boolean;
	result: { ok: boolean; found: boolean; request_id?: string; error?: string };
}

export type ChickenRoadCashBetStatus = 'won' | 'lost' | 'failed';

export interface ChickenRoadCashBet {
	accountId: number;
	phone: string;
	accountName: string;
	spots: number[];
	stake: number;
	requestId: string;
	status: ChickenRoadCashBetStatus;
	winAmount: number | null;
	matched: number | null;
	drawnSpots: number[];
	failReason?: string;
	placedAt: number;
	settledAt: number;
}

export interface ChickenRoadCashBetsResponse {
	ok: boolean;
	count: number;
	bets: ChickenRoadCashBet[];
}

export interface ChickenRoadManualBetResponse {
	ok: boolean;
	result: {
		ok: boolean;
		requestId: string;
		balance: number | null;
		error?: string;
	};
}

export interface ChickenRoadTestRoundResponse {
	ok: boolean;
	result: {
		ok: boolean;
		played: number;
		bets: { accountId: number; freeBetId: string; requestId: string }[];
	};
}

export interface ChickenRoadWsToken {
	id: number;
	name: string;
	phone: string;
	provider: ChickenRoadProvider;
	gateway_host: string;
	ws_token: string | null;
}

export interface ChickenRoadWsTokensResponse {
	ok: boolean;
	count: number;
	tokens: ChickenRoadWsToken[];
}

export interface ChickenRoadPredictionResponse {
	ok: boolean;
	prediction?: {
		picks: number[];
		strategy: 'cluster' | 'standard' | 'pattern';
		difficulty: { level: string; confidence: number; recommendedSpotRange: { min: number; max: number }; recommendedStrategy: string; dominantPattern: string };
		repetitivePatterns: any[];
		clusters: any[];
		metrics: any[];
		volatility: any;
	};
}

// ---- Odds drop monitor + soccer suggester (mirrors server/src/odds/types.ts) ----
// The watcher polls melbet (drops signal) + shamo (counterpart price the user
// bets on), persists snapshots/drops/suggestions, and pushes drop alerts to
// every browser push subscriber.

export interface OddsDrop {
	id?: number;
	source: 'melbet' | 'shamo';
	externalId: string;
	eventId?: number | null;
	home: string;
	away: string;
	league: string;
	country?: string;
	sport: string;
	/** Deep link to the event on the source site (melbet for drop signals). */
	url?: string | null;
	marketKey: string;
	marketLabel?: string | null;
	outcome: string;
	outcomeLabel?: string | null;
	prevOdd: number;
	newOdd: number;
	pctChange: number;
	absChange: number;
	steam: boolean;
	createdAt: string;
}

export interface OddsWatcherConfig {
	enabled: boolean;
	pollIntervalMs: number;
	dropPct: number;
	steamWindowMin: number;
	dropWindowMin: number;
	matchToleranceMin: number;
	maxSuggestions: number;
	pushEnabled: boolean;
	updatedAt?: string;
}

export interface OddsWatcherStatus {
	configured: boolean;
	melbetUrl: string | null;
	shamoUrl: string | null;
	enabled: boolean;
	running: boolean;
	lastPollAt: string | null;
	lastPollOk: boolean;
	lastError: string | null;
	lastMelbetAt: string | null;
	lastShamoAt: string | null;
	melbetEvents: number;
	shamoEvents: number;
	melbetFootball: number;
	shamoFootball: number;
	matchedFootball: number;
	/** Number of shamo leagues resolved to names via the coredata dictionary. */
	shamoLeagueCount: number;
	config: OddsWatcherConfig;
}

export interface OddsSuggestion {
	id: number;
	melbetEventId: number | null;
	shamoEventId: number | null;
	home: string;
	away: string;
	league: string;
	country?: string;
	sport: string;
	/** Melbet event deep link (where the drop was seen). */
	melbetUrl?: string | null;
	/** Shamo match deep link (where the bet lands). */
	shamoUrl?: string | null;
	marketKey: string;
	outcome: string;
	outcomeLabel: string | null;
	melbetOdd: number;
	melbetCurrent: number;
	shamoOdd: number | null;
	dropPct: number;
	steam: boolean;
	score: number;
	reason: string;
	startTs: string | null;
	expiresAt: string | null;
	createdAt: string;
}

export interface OddsLiveResponse {
	status: OddsWatcherStatus;
	drops: OddsDrop[];
	suggestions: OddsSuggestion[];
	now: string;
}

// ---- Shamo sports bet slips (extension-assisted; mirrors server/src/odds/betTypes.ts) ----
// Suggestions become shamo_bet_orders (edge/cap/cooldown rules run server-side).
// The Chrome extension claims an order, the user confirms on shamo.bet, the
// extension places it (POST platform.shamo.bet/sport-data/bet.place/) and the
// audit log lands in shamo_bets.

export type ShamoBetMode = 'confirm' | 'auto' | 'dry-run';
export type BetOrderAction = 'confirm' | 'auto';
export type BetOrderStatus =
	| 'pending'
	| 'claimed'
	| 'placed'
	| 'rejected'
	| 'failed'
	| 'expired'
	| 'cancelled';

export interface ShamoBetConfig {
	enabled: boolean;
	mode: ShamoBetMode;
	stakePerBet: number;
	minEdgePct: number;
	maxDayStake: number;
	maxBetsPerDay: number;
	cooldownMin: number;
	orderTtlMin: number;
	maxOddDriftPct: number;
	botToken: string;
	updatedAt?: string;
}

export interface ShamoBetOrderDraft {
	suggestionId: number;
	shamoExternalId: string;
	shamoUrl: string | null;
	home: string;
	away: string;
	league: string;
	country: string;
	sport: string;
	marketKey: string;
	outcome: string;
	outcomeLabel: string | null;
	betGroup: number | null;
	betType: number | null;
	quotedOdd: number;
	melbetCurrent: number;
	edgePct: number;
	stake: number;
}

export interface ShamoBetOrder {
	id: number;
	suggestionId: number | null;
	shamoExternalId: string;
	shamoUrl: string | null;
	home: string;
	away: string;
	league: string;
	country: string;
	sport: string;
	marketKey: string;
	outcome: string;
	outcomeLabel: string | null;
	betGroup: number | null;
	betType: number | null;
	quotedOdd: number;
	melbetCurrent: number;
	edgePct: number;
	stake: number;
	action: BetOrderAction;
	status: BetOrderStatus;
	ticketId: string | null;
	actualOdd: number | null;
	error: string | null;
	claimedAt: string | null;
	placedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
}

export interface ShamoBetRecord {
	id: number;
	orderId: number;
	ticketId: string | null;
	stake: number;
	quotedOdd: number | null;
	actualOdd: number | null;
	state: string;
	message: string | null;
	createdAt: string;
}

export interface ShamoBetStatus {
	config: ShamoBetConfig;
	engine: {
		running: boolean;
		lastTickAt: string | null;
		dryRun: ShamoBetOrderDraft[];
	};
	pending: number;
	claimed: number;
	placedToday: number;
	stakeUsedToday: number;
	botTokenSet: boolean;
}
