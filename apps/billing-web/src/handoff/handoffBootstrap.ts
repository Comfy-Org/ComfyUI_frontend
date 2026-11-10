import type {
  HandoffEnding,
  HandoffState,
  TabStorage
} from '@/handoff/handoffTab'
import type { HandoffCapture } from '@/handoff/captureHandoffToken'
import {
  handoffSessionFrom,
  handoffTab,
  readHandoffState,
  writeHandoffState
} from '@/handoff/handoffTab'

export interface HandoffBootEnv {
  readonly capture: Extract<HandoffCapture, { kind: 'captured' }>
  readonly storage: TabStorage
  readonly fetchImpl: typeof fetch
  readonly cloudBaseUrl: string
  readonly now: () => number
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
  if (writeHandoffState(env.storage, state) || state.kind === 'ended') {
    handoffTab.value = state
    return 'handoff'
  }
  const unavailable: HandoffState = {
    kind: 'ended',
    ending: 'storage_unavailable'
  }
  writeHandoffState(env.storage, unavailable)
  handoffTab.value = unavailable
  return 'handoff'
}

function restored(env: HandoffBootEnv, state: HandoffState): HandoffState {
  return state.kind === 'session' && state.session.expiresAt <= env.now()
    ? { kind: 'ended', ending: 'session_ended' }
    : state
}

/** Exchanges a captured `/handoff` token, or restores this tab's handoff, before the app and its telemetry load. */
export async function runHandoffBootstrap(
  env: HandoffBootEnv
): Promise<HandoffBootOutcome> {
  const stored = readHandoffState(env.storage)
  const { onHandoffPath, token } = env.capture
  if (!onHandoffPath) {
    if (!stored) return 'not-handoff'
    return settle(env, restored(env, stored))
  }
  if (token === undefined)
    return settle(
      env,
      stored
        ? restored(env, stored)
        : { kind: 'ended', ending: 'link_unavailable' }
    )
  if (
    !storageWorks(env.storage) ||
    !writeHandoffState(env.storage, { kind: 'ended', ending: 'exchange_lost' })
  ) {
    handoffTab.value = { kind: 'ended', ending: 'storage_unavailable' }
    return 'handoff'
  }
  return settle(env, await exchange(env, token))
}
