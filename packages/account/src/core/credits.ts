/**
 * The credits read client: an authorized balance read bound to the session
 * client, with identity-keyed in-flight dedupe and the one forced re-mint a
 * stale token is allowed. Presentation (unit conversion, chips, focus
 * triggers) stays with the host.
 */
import type { AccountCredential, SessionClient } from './session.js'

export type CreditsState =
  | { readonly status: 'unknown' }
  | { readonly status: 'ok'; readonly cents: number }
  | { readonly status: 'error'; readonly unauthorized?: boolean }

export interface BillingClientOptions {
  readonly session: Pick<SessionClient, 'getSnapshot' | 'remint'>
  readonly balanceUrl: string
  readonly fetchImpl?: typeof fetch
  readonly timeoutMs?: number
}

export interface BillingClient {
  getState: () => CreditsState
  subscribe: (listener: (state: CreditsState) => void) => () => void
  refresh: (options?: { readonly force?: boolean }) => Promise<void>
  reset: () => void
}

/** Ceiling on a balance read; a hung fetch must not pin the state stale. */
const DEFAULT_BALANCE_TIMEOUT_MS = 15_000

function readBalanceCents(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  if (
    'effective_balance_micros' in body &&
    typeof body.effective_balance_micros === 'number'
  ) {
    return body.effective_balance_micros
  }
  // Older responses carry only amount_micros.
  if ('amount_micros' in body && typeof body.amount_micros === 'number') {
    return body.amount_micros
  }
  return undefined
}

export function createBillingClient(
  options: BillingClientOptions
): BillingClient {
  const {
    session,
    balanceUrl,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_BALANCE_TIMEOUT_MS
  } = options

  let state: CreditsState = { status: 'unknown' }
  const listeners = new Set<(state: CreditsState) => void>()
  let inFlight: Promise<void> | undefined
  let inFlightUid: string | undefined
  /** Bumped by reset(): an abandoned read must not publish its late result. */
  let generation = 0

  function publish(next: CreditsState): void {
    state = next
    listeners.forEach((listener) => listener(state))
  }

  function activeCredential(): AccountCredential | undefined {
    const snapshot = session.getSnapshot()
    return snapshot.phase === 'authenticated' ? snapshot.session : undefined
  }

  async function fetchBalance(token: string): Promise<CreditsState> {
    let response: Response
    try {
      response = await fetchImpl(balanceUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(timeoutMs)
      })
    } catch {
      return { status: 'error' }
    }
    if (!response.ok) {
      return { status: 'error', unauthorized: response.status === 401 }
    }
    let body: unknown
    try {
      body = await response.json()
    } catch {
      return { status: 'error' }
    }
    const cents = readBalanceCents(body)
    if (cents === undefined) return { status: 'error' }
    return { status: 'ok', cents }
  }

  async function runRefresh(): Promise<void> {
    const startGeneration = generation
    const snapshot = session.getSnapshot()
    if (snapshot.phase !== 'authenticated') {
      publish({ status: 'unknown' })
      return
    }
    const owner = snapshot.user
    const uid = snapshot.session.uid
    let token = snapshot.session.token
    let result = await fetchBalance(token)
    // One re-mint on a stale token, mirroring the run path's single retry,
    // spent for the identity whose read failed — never whoever is signed in
    // by the time the 401 lands. Other failures are not the token's fault,
    // so no mint is spent on them.
    if (result.status === 'error' && result.unauthorized) {
      const reminted = await session.remint(owner)
      if (reminted?.status === 'ok') {
        token = reminted.session.token
        result = await fetchBalance(token)
      }
    }
    // Publish only if the same user and token are still live. A sign-out,
    // user switch, or re-mint must not publish an older read.
    const live = activeCredential()
    if (
      generation === startGeneration &&
      live?.uid === uid &&
      live.token === token
    ) {
      publish(result)
    }
  }

  const client: BillingClient = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    /**
     * Session-change and refocus can fire together; without dedupe they race
     * and the last fetch to resolve wins, so a slow earlier read can
     * overwrite a fresh later one. Concurrent callers for the same user
     * share one in-flight refresh (uid-keyed, as in production: the read's
     * own 401 re-mint rotates the token mid-flight, and a token-keyed join
     * would race a duplicate read); a different user starts their own. A
     * forced call queued behind an in-flight read inherits that
     * read's remaining time on top of its own — it never drops, but it has
     * no independent ceiling until the earlier read settles, and several
     * queued forced calls coalesce onto whichever read their predecessor
     * started rather than each fetching independently.
     */
    refresh(refreshOptions = {}) {
      const uid = activeCredential()?.uid

      if (inFlight !== undefined && inFlightUid === uid) {
        if (!refreshOptions.force) return inFlight
        // The forced re-read is a continuation on the old promise; capture
        // the generation NOW, or a reset() landing before the continuation
        // runs is invisible to it and the abandoned intent resurrects.
        const queuedGeneration = generation
        return inFlight.then(() =>
          queuedGeneration === generation ? client.refresh() : undefined
        )
      }

      inFlightUid = uid
      const refresh = runRefresh().finally(() => {
        if (inFlight === refresh) {
          inFlight = undefined
          inFlightUid = undefined
        }
      })
      inFlight = refresh
      return refresh
    },
    reset() {
      generation += 1
      inFlight = undefined
      inFlightUid = undefined
      publish({ status: 'unknown' })
    }
  }
  return client
}
