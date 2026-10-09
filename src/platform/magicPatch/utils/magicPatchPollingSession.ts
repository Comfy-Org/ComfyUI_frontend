import type { createMagicPatchClient } from '../services/magicPatchClient'
import { createMagicPatchPoller } from './magicPatchPoller'

export type MagicPatchPollingContext = {
  scope?: string
  ready: boolean
  online: boolean
  visible: boolean
}

export const magicPatchPollingSchedule = {
  version: 'magic-patch-client-polling-schedule/1',
  intervalMilliseconds: 5000,
  maximumFailureDelayMilliseconds: 30000
} as const

type SchedulingState =
  | { phase: 'stopped' }
  | { phase: 'scheduled'; timer: ReturnType<typeof setTimeout> }
  | { phase: 'running'; rerun: boolean }
  | { phase: 'disposed' }

export function createMagicPatchPollingSession(
  client: Pick<ReturnType<typeof createMagicPatchClient>, 'list'>,
  monotonicNow: () => number = () => performance.now()
) {
  const poller = createMagicPatchPoller(client, monotonicNow)
  let context: MagicPatchPollingContext = {
    ready: false,
    online: false,
    visible: false
  }
  let scheduling: SchedulingState = { phase: 'stopped' }
  let failureDelay: number = magicPatchPollingSchedule.intervalMilliseconds
  const allowed = () =>
    Boolean(context.scope && context.ready && context.online && context.visible)

  function clearScheduled() {
    if (scheduling.phase !== 'scheduled') return
    clearTimeout(scheduling.timer)
    scheduling = { phase: 'stopped' }
  }

  function schedule(delay: number) {
    if (scheduling.phase === 'disposed' || !allowed()) return
    scheduling = {
      phase: 'scheduled',
      timer: setTimeout(() => {
        scheduling = { phase: 'stopped' }
        void run()
      }, delay)
    }
  }

  async function run() {
    if (scheduling.phase === 'disposed' || !allowed()) return
    if (scheduling.phase === 'running') {
      scheduling.rerun = true
      return
    }
    clearScheduled()
    const running: SchedulingState & { phase: 'running' } = {
      phase: 'running',
      rerun: false
    }
    scheduling = running
    try {
      await poller.refresh()
    } catch {
      poller.cancelRefresh()
    }
    {
      if (scheduling !== running) return
      scheduling = { phase: 'stopped' }
      if (!allowed()) return
      if (running.rerun) {
        schedule(0)
      } else if (poller.getState().phase === 'failed') {
        schedule(failureDelay)
        failureDelay = Math.min(
          failureDelay * 2,
          magicPatchPollingSchedule.maximumFailureDelayMilliseconds
        )
      } else {
        failureDelay = magicPatchPollingSchedule.intervalMilliseconds
        schedule(failureDelay)
      }
    }
  }

  function update(next: MagicPatchPollingContext) {
    if (scheduling.phase === 'disposed') return
    if (
      context.scope === next.scope &&
      context.ready === next.ready &&
      context.online === next.online &&
      context.visible === next.visible
    )
      return
    const previousScope = context.ready ? context.scope : undefined
    const nextScope = next.ready ? next.scope : undefined
    context = { ...next }
    clearScheduled()
    poller.cancelRefresh()
    poller.setScope(nextScope)
    if (previousScope !== nextScope) {
      failureDelay = magicPatchPollingSchedule.intervalMilliseconds
    }
    if (scheduling.phase === 'running') {
      scheduling.rerun = allowed()
    } else if (allowed()) {
      void run()
    }
  }

  function refreshNow() {
    if (scheduling.phase === 'disposed' || !allowed()) return
    void run()
  }

  function dispose() {
    clearScheduled()
    scheduling = { phase: 'disposed' }
    poller.setScope()
  }

  return { update, refreshNow, dispose, getState: poller.getState }
}
