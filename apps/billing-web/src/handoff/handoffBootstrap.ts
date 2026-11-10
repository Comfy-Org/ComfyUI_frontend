import type {
  HandoffEnding,
  HandoffState,
  TabStorage
} from '@/handoff/handoffTab'
import {
  HANDOFF_PATH,
  handoffSessionFrom,
  handoffTab,
  readHandoffState,
  writeHandoffState
} from '@/handoff/handoffTab'

export interface HandoffBootEnv {
  readonly pathname: string
  readonly search: string
  /** The location's fragment, read live so a strip can be confirmed. */
  readonly hash: () => string
  readonly replaceUrl: (url: string) => void
  readonly storage: TabStorage
  readonly fetchImpl: typeof fetch
  readonly cloudBaseUrl: string
  readonly now: () => number
}

/** `halt` means the token could not be removed from the URL, so nothing else may load. */
export type HandoffBootOutcome = 'handoff' | 'not-handoff' | 'halt'

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
        cache: 'no-store'
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

function settle(env: HandoffBootEnv, state: HandoffState): 'handoff' {
  writeHandoffState(env.storage, state)
  handoffTab.value = state
  return 'handoff'
}

function restored(env: HandoffBootEnv, state: HandoffState): HandoffState {
  return state.kind === 'session' && state.session.expiresAt <= env.now()
    ? { kind: 'ended', ending: 'session_ended' }
    : state
}

/** Strips and exchanges a `/handoff` token before the app and its telemetry load. */
export async function runHandoffBootstrap(
  env: HandoffBootEnv
): Promise<HandoffBootOutcome> {
  const stored = readHandoffState(env.storage)
  if (env.pathname !== HANDOFF_PATH) {
    if (!stored) return 'not-handoff'
    return settle(env, restored(env, stored))
  }

  const fragment = env.hash()
  const token =
    new URLSearchParams(fragment.replace(/^#/, '')).get('token') ?? undefined
  if (fragment !== '') {
    env.replaceUrl(`${HANDOFF_PATH}${env.search}`)
    if (env.hash() !== '') return 'halt'
  }

  if (token === undefined || token === '')
    return settle(
      env,
      stored
        ? restored(env, stored)
        : { kind: 'ended', ending: 'link_unavailable' }
    )
  if (!storageWorks(env.storage)) {
    handoffTab.value = { kind: 'ended', ending: 'storage_unavailable' }
    return 'handoff'
  }
  return settle(env, await exchange(env, token))
}
