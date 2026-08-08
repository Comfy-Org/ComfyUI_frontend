/**
 * @fileoverview Client-side circuit breaker for the jobs poller.
 * @module platform/remote/comfyui/jobs/jobsAuthBackoff
 *
 * The jobs poller re-fetches `/jobs` on every WebSocket `status` frame and on a
 * timer. On sessions the backend never authorizes (401 = unresolved
 * token/workspace membership, 403 = email-not-verified), this produced tens of
 * thousands of rejected requests — and `console.error` logs ingested by RUM —
 * per session, because nothing backed off after a permanent auth failure.
 *
 * This gate applies exponential backoff keyed on consecutive auth failures:
 * after the first rejection it suppresses most poll-driven fetches, probing
 * only occasionally, and clears instantly on the first successful response
 * (e.g. once the user verifies their email or the workspace resolves). The
 * backoff is counter-based (not wall-clock) so it is fully deterministic.
 */

/** Suppression window caps at 2^5 = 32 skipped calls between probes. */
const MAX_BACKOFF_EXPONENT = 5

export interface JobsAuthBackoff {
  /**
   * Whether the current fetch should skip the network while backing off.
   * Advances the internal skip counter as a side effect.
   */
  shouldSkip: () => boolean
  /**
   * Records an auth failure (401/403) and widens the backoff window.
   * @returns true if this failure starts a new failure episode (i.e. the
   * caller should log), false while an episode is ongoing.
   */
  recordAuthFailure: () => boolean
  /** Clears all backoff state after a successful response. */
  recordSuccess: () => void
  /**
   * Clears all backoff state after any non-auth outcome — a non-401/403 HTTP
   * error or a thrown request. The episode only holds while auth keeps failing,
   * so a probe that reaches the server (even to a 5xx) or fails the network
   * ends it; those failures then log every poll as they did before the backoff.
   */
  recordNonAuthFailure: () => void
}

export function createJobsAuthBackoff(): JobsAuthBackoff {
  let failureStreak = 0
  let callsSinceProbe = 0

  const suppressionWindow = () =>
    1 << Math.min(failureStreak, MAX_BACKOFF_EXPONENT)

  const reset = () => {
    failureStreak = 0
    callsSinceProbe = 0
  }

  return {
    shouldSkip() {
      if (failureStreak === 0) return false
      if (callsSinceProbe < suppressionWindow()) {
        callsSinceProbe++
        return true
      }
      callsSinceProbe = 0
      return false
    },
    recordAuthFailure() {
      const startsEpisode = failureStreak === 0
      failureStreak++
      return startsEpisode
    },
    recordSuccess: reset,
    recordNonAuthFailure: reset
  }
}
