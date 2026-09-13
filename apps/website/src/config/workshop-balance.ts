/**
 * The header's balance read, owned by the site: an authorized GET with
 * identity-keyed in-flight dedupe and the one forced re-mint a stale token
 * is allowed. Billing stays outside @comfyorg/account in V1, so this is
 * the site's own copy of that rule, bound to the shared session client.
 */
import type { User } from 'firebase/auth'

import type {
  AccountCredential,
  SessionClient
} from '@comfyorg/account/session'
import { zBillingBalanceResponse } from '@comfyorg/ingest-types/zod'

export type BalanceState =
  /** Cents, as the cloud app reads it: the `_micros` fields carry cents. */
  | { readonly status: 'unknown' }
  | { readonly status: 'ok'; readonly cents: number }
  | { readonly status: 'error'; readonly unauthorized?: boolean }

export interface BalanceReader {
  getState: () => BalanceState
  subscribe: (listener: (state: BalanceState) => void) => () => void
  refresh: (options?: { readonly force?: boolean }) => Promise<void>
  reset: () => void
}

/** Ceiling on a balance read; a hung fetch must not pin the state stale. */
const BALANCE_TIMEOUT_MS = 15_000

function readBalanceCents(body: unknown): number | undefined {
  const parsed = zBillingBalanceResponse.safeParse(body)
  if (!parsed.success) return undefined
  // The schema admits infinities; a non-finite balance can never render.
  const cents =
    parsed.data.effective_balance_micros ?? parsed.data.amount_micros
  return Number.isFinite(cents) ? cents : undefined
}

export function createBalanceReader(
  session: Pick<SessionClient<User>, 'getSnapshot' | 'remint'>,
  balanceUrl: string,
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args)
): BalanceReader {
  let state: BalanceState = { status: 'unknown' }
  const listeners = new Set<(state: BalanceState) => void>()
  let inFlight: Promise<void> | undefined
  let inFlightUid: string | undefined
  /** Bumped by reset(): an abandoned read must not publish its late result. */
  let generation = 0

  function publish(next: BalanceState): void {
    state = next
    listeners.forEach((listener) => listener(state))
  }

  function activeCredential(): AccountCredential | undefined {
    const snapshot = session.getSnapshot()
    return snapshot.phase === 'authenticated' ? snapshot.session : undefined
  }

  async function fetchBalance(token: string): Promise<BalanceState> {
    let response: Response
    try {
      response = await fetchImpl(balanceUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS)
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
    // One re-mint on a stale token, spent for the identity whose read
    // failed, never whoever is signed in by the time the 401 lands.
    if (result.status === 'error' && result.unauthorized) {
      const reminted = await session.remint(owner)
      if (reminted?.status === 'ok') {
        token = reminted.session.token
        result = await fetchBalance(token)
      }
    }
    // Publish only if the same user and token are still live.
    const live = activeCredential()
    if (
      generation === startGeneration &&
      live?.uid === uid &&
      live.token === token
    ) {
      publish(result)
    }
  }

  const reader: BalanceReader = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    /**
     * Concurrent callers for the same user share one in-flight read; a
     * forced call queued behind one re-reads once it settles, so a token
     * rotation never joins a read the publish guard is about to discard.
     */
    refresh(refreshOptions = {}) {
      const uid = activeCredential()?.uid
      if (inFlight !== undefined && inFlightUid === uid) {
        if (!refreshOptions.force) return inFlight
        const queuedGeneration = generation
        return inFlight.then(() =>
          queuedGeneration === generation ? reader.refresh() : undefined
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
  return reader
}
