import type { createMagicPatchClient } from '../services/magicPatchClient'
import { magicPatchResponseLimits } from '../services/magicPatchResponseLimits'
import type { MagicPatchPollState } from './magicPatchPollState'
import { reduceMagicPatchPoll } from './magicPatchPollState'

export const magicPatchTraversalLimits = {
  version: 'magic-patch-client-traversal-limits/1',
  pages: 20,
  entries: 1000,
  milliseconds: 15000,
  maximumDecodedBytes: 20 * magicPatchResponseLimits.jsonBytes
} as const

export function createMagicPatchPoller(
  client: Pick<ReturnType<typeof createMagicPatchClient>, 'list'>,
  monotonicNow: () => number = () => performance.now()
) {
  let state: MagicPatchPollState = { phase: 'disabled' }
  let sequence = 0
  let active: { scan: string; controller: AbortController } | undefined

  function stop() {
    const previous = active
    active = undefined
    previous?.controller.abort()
  }

  function setScope(scope?: string) {
    if (scope && state.phase !== 'disabled' && state.scope === scope) return
    stop()
    state = scope
      ? reduceMagicPatchPoll({ phase: 'disabled' }, { type: 'enabled', scope })
      : { phase: 'disabled' }
  }

  async function refresh(): Promise<void> {
    if (state.phase === 'disabled') return
    const scope = state.scope
    stop()
    const scan = String(++sequence)
    const controller = new AbortController()
    const deadline = monotonicNow() + magicPatchTraversalLimits.milliseconds
    active = { scan, controller }
    const current = () =>
      active?.scan === scan &&
      state.phase !== 'disabled' &&
      state.scope === scope
    state = reduceMagicPatchPoll(state, { type: 'poll_started', scope, scan })
    const fail = () => {
      if (!current()) return
      state = reduceMagicPatchPoll(state, { type: 'poll_failed', scope, scan })
      controller.abort()
    }
    const allowed = () => {
      if (!current() || controller.signal.aborted) return false
      const now = monotonicNow()
      if (
        !Number.isFinite(deadline) ||
        !Number.isFinite(now) ||
        now >= deadline
      ) {
        fail()
        return false
      }
      return true
    }
    const beforeDispatch = () => {
      if (allowed()) return
      controller.signal.throwIfAborted()
      throw new DOMException(
        'Magic Patch traversal is no longer current',
        'AbortError'
      )
    }
    let onAbort: () => void = () => {}
    const aborted = new Promise<void>((resolve) => {
      onAbort = resolve
      controller.signal.addEventListener('abort', onAbort, { once: true })
    })
    const timer = setTimeout(fail, magicPatchTraversalLimits.milliseconds)
    const traverse = async () => {
      let cursor: string | undefined
      let entries = 0
      try {
        for (let page = 0; page < magicPatchTraversalLimits.pages; page++) {
          if (!allowed()) return
          const result = await client.list(
            cursor,
            controller.signal,
            beforeDispatch
          )
          if (!allowed()) return
          if (!result.ok) return fail()
          entries += result.value.requests.length
          if (entries > magicPatchTraversalLimits.entries) return fail()
          state = reduceMagicPatchPoll(state, {
            type: 'page_received',
            scope,
            scan,
            page: result.value
          })
          if (state.phase === 'failed') return fail()
          cursor = result.value.next_cursor
          if (!cursor) return
        }
        fail()
      } catch {
        fail()
      }
    }
    try {
      await Promise.race([traverse(), aborted])
    } finally {
      clearTimeout(timer)
      controller.signal.removeEventListener('abort', onAbort)
      if (active?.scan === scan) active = undefined
    }
  }

  return { setScope, refresh, getState: () => state }
}
