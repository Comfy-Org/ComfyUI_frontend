import type {
  HandoffEnding,
  HandoffState,
  TabMarker,
  TabStorage
} from '@/handoff/handoffTab'
import type { HandoffCapture } from '@/handoff/captureHandoffToken'
import {
  handoffSessionFrom,
  handoffTab,
  readHandoffState,
  readTabMarker,
  writeHandoffState,
  writeTabMarker
} from '@/handoff/handoffTab'

export interface HandoffBootEnv {
  readonly capture: Extract<HandoffCapture, { kind: 'captured' }>
  readonly storage: TabStorage
  readonly marker: TabMarker
  readonly fetchImpl: typeof fetch
  readonly cloudBaseUrl: string
  readonly now: () => number
  readonly exchangeTimeoutMs: number
}

export type HandoffBootOutcome = 'handoff' | 'not-handoff'

const PROBE_KEY = 'comfy.billing-web.handoff.probe'

function storageWorks(storage: TabStorage): boolean {
  try {
    storage.setItem(PROBE_KEY, '1')
    const ok = storage.getItem(PROBE_KEY) === '1'
    storage.removeItem(PROBE_KEY)
    return ok
  } catch {
    return false
  }
}

function endingFor(status: number): HandoffEnding {
  if (status === 410) return 'link_unavailable'
  if (status === 403) return 'refused'
  return 'exchange_lost'
}

async function exchange(
  env: HandoffBootEnv,
  token: string
): Promise<HandoffState> {
  try {
    const response = await env.fetchImpl(
      `${env.cloudBaseUrl}/api/auth/handoffs/exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(env.exchangeTimeoutMs)
      }
    )
    if (!response.ok)
      return { kind: 'ended', ending: endingFor(response.status) }
    const session = handoffSessionFrom(await response.json())
    return session
      ? { kind: 'session', session }
      : { kind: 'ended', ending: 'exchange_lost' }
  } catch {
    return { kind: 'ended', ending: 'exchange_lost' }
  }
}

const STORAGE_UNAVAILABLE: HandoffState = {
  kind: 'ended',
  ending: 'storage_unavailable'
}

function settle(env: HandoffBootEnv, state: HandoffState): 'handoff' {
  const kept =
    writeHandoffState(env.storage, state) || state.kind === 'ended'
      ? state
      : STORAGE_UNAVAILABLE
  if (kept !== state) writeHandoffState(env.storage, kept)
  writeTabMarker(env.marker, kept)
  handoffTab.value = kept
  return 'handoff'
}

function fromMarker(
  env: HandoffBootEnv,
  storageUnreadable: boolean
): HandoffState | undefined {
  const marked = readTabMarker(env.marker)
  if (marked === undefined) return undefined
  if (marked !== 'live') return { kind: 'ended', ending: marked }
  return storageUnreadable
    ? STORAGE_UNAVAILABLE
    : { kind: 'ended', ending: 'session_ended' }
}

function restored(env: HandoffBootEnv, state: HandoffState): HandoffState {
  return state.kind === 'session' && state.session.expiresAt <= env.now()
    ? { kind: 'ended', ending: 'session_ended' }
    : state
}

export async function runHandoffBootstrap(
  env: HandoffBootEnv
): Promise<HandoffBootOutcome> {
  const read = readHandoffState(env.storage)
  const stored = read === 'unreadable' ? undefined : read
  const { onHandoffPath, token } = env.capture
  if (!onHandoffPath || token === undefined) {
    if (stored) return settle(env, restored(env, stored))
    const marked = fromMarker(env, read === 'unreadable')
    if (marked) return settle(env, marked)
    return onHandoffPath
      ? settle(env, { kind: 'ended', ending: 'link_unavailable' })
      : 'not-handoff'
  }
  const lost: HandoffState = { kind: 'ended', ending: 'exchange_lost' }
  writeTabMarker(env.marker, lost)
  if (!storageWorks(env.storage) || !writeHandoffState(env.storage, lost))
    return settle(env, STORAGE_UNAVAILABLE)
  return settle(env, await exchange(env, token))
}
