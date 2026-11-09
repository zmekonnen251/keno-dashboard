import type { RainFreeBet } from './types';

/** A free bet is playable only while it is unplayed (available, or failed =
 *  retryable), has never closed a bet, and has not expired. Mirrors the
 *  server's listEligibleFreeBets so the ledger never offers a row the engine
 *  will reject. */
export function isPlayableFreeBet(
  b: Pick<RainFreeBet, 'status' | 'closed_bet_count' | 'expires_at'>,
  now = Date.now(),
): boolean {
  if (b.status !== 'available' && b.status !== 'failed') return false;
  if ((b.closed_bet_count ?? 0) >= 1) return false;
  if (b.expires_at && new Date(b.expires_at).getTime() <= now) return false;
  return true;
}
