import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import type { AgentPanelRenderStage } from '@/platform/telemetry/types'

import { useAgentPanelRenderStore } from './agentPanelRenderStore'
import { useAgentPanelStore } from './agentPanelStore'

vi.mock(import('@/platform/telemetry'))

type RenderStore = ReturnType<typeof useAgentPanelRenderStore>

async function setPanelOpen(open: boolean): Promise<void> {
  const panel = useAgentPanelStore()
  panel.enabled = true
  panel.isOpen = open
  await nextTick()
}

const stalled = () => useTelemetry()?.trackAgentPanelRenderStalled

describe('agentPanelRenderStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it.for<{
    name: string
    progress: (store: RenderStore) => void
    stage: AgentPanelRenderStage
  }>([
    {
      name: 'the dock chunk never resolved',
      progress: () => {},
      stage: 'dock_unresolved'
    },
    {
      name: 'the panel root chunk is still loading',
      progress: (store) => store.reach('root_unresolved'),
      stage: 'root_unresolved'
    },
    {
      name: 'the panel root resolved but never mounted',
      progress: (store) => store.reach('root_resolved_not_mounted'),
      stage: 'root_resolved_not_mounted'
    }
  ])(
    'reports a $stage stall 3s after opening when $name',
    async ({ progress, stage }) => {
      const store = useAgentPanelRenderStore()
      await setPanelOpen(true)
      progress(store)

      vi.advanceTimersByTime(2_999)
      expect(stalled()).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(stalled()).toHaveBeenCalledExactlyOnceWith({ stage })
    }
  )

  it('reports nothing when the panel content is drawn within 3s', async () => {
    const store = useAgentPanelRenderStore()
    await setPanelOpen(true)
    store.reach('root_resolved_not_mounted')
    store.reach('drawn')

    vi.advanceTimersByTime(10_000)

    expect(stalled()).not.toHaveBeenCalled()
  })

  it('cancels the watchdog on close and restarts it from the dock on reopen', async () => {
    const store = useAgentPanelRenderStore()
    await setPanelOpen(true)
    store.reach('drawn')
    vi.advanceTimersByTime(2_000)
    await setPanelOpen(false)
    vi.advanceTimersByTime(10_000)
    expect(stalled()).not.toHaveBeenCalled()

    await setPanelOpen(true)
    vi.advanceTimersByTime(3_000)

    expect(stalled()).toHaveBeenCalledExactlyOnceWith({
      stage: 'dock_unresolved'
    })
  })
})
