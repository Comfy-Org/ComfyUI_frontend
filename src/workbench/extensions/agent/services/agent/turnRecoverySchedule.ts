/**
 * After a reconnect the server may still be finishing the turn, and its
 * terminal event may or may not reach the new socket. Poll the persisted row
 * with backoff; once the schedule is exhausted the socket alone is trusted.
 */
export const TURN_RECOVERY_DELAYS_MS = [0, 1000, 2000, 4000, 8000, 16000]
