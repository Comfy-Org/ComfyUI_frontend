/**
 * Runtime gate for the presentation-only graph replay queue (Option B PoC,
 * default OFF). Mirrors `followerGate.ts`:
 *
 *   `?agentGraphReplay=1`  enable now and persist for this browser
 *   `?agentGraphReplay=0`  disable now and clear the persisted opt-in
 *   (no param)             persisted opt-in, else `VITE_AGENT_GRAPH_REPLAY`
 *
 * The replay queue is a pure presentation layer on top of the follower, so it
 * is only ever consulted when the follower itself is enabled.
 */

import { reportError } from '@/platform/telemetry/reportError'

export const REPLAY_STORAGE_KEY = 'Comfy.Agent.GraphReplay'
export const REPLAY_QUERY_PARAM = 'agentGraphReplay'

export interface ReplayGateInput {
  /** `import.meta.env.VITE_AGENT_GRAPH_REPLAY` (build-time). */
  buildFlag: string | undefined
  /** `window.location.search`, including the leading `?` or empty. */
  search: string
  /** `window.localStorage`, or null when storage is unavailable. */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
}

export function resolveReplayEnabled(input: ReplayGateInput): boolean {
  const param = new URLSearchParams(input.search).get(REPLAY_QUERY_PARAM)

  if (param === '1' || param === 'true') {
    trySet(input.storage, 'true')
    return true
  }
  if (param === '0' || param === 'false') {
    tryRemove(input.storage)
    return false
  }

  if (tryGet(input.storage) === 'true') return true

  return input.buildFlag === 'true'
}

const ERROR_TYPE = 'agent_graph_replay_storage_access_failed'

function tryGet(storage: ReplayGateInput['storage']): string | null {
  try {
    return storage?.getItem(REPLAY_STORAGE_KEY) ?? null
  } catch (error) {
    reportError(error, { errorType: ERROR_TYPE })
    return null
  }
}

function trySet(storage: ReplayGateInput['storage'], value: string): void {
  try {
    storage?.setItem(REPLAY_STORAGE_KEY, value)
  } catch (error) {
    reportError(error, { errorType: ERROR_TYPE })
  }
}

function tryRemove(storage: ReplayGateInput['storage']): void {
  try {
    storage?.removeItem(REPLAY_STORAGE_KEY)
  } catch (error) {
    reportError(error, { errorType: ERROR_TYPE })
  }
}
