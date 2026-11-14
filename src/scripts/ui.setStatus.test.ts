import { describe, expect, it, onTestFinished, vi } from 'vitest'

import type { StatusWsMessageStatus } from '@comfyorg/api-client/executionTypes'

import { setupLegacyAutoQueue } from '@/platform/queue/runtime/legacyAutoQueue'
import { api } from './api'
import { app } from './app'
import { ComfyUI } from './ui'

vi.mock(import('./app'))
vi.mock(import('./api'))

type SetStatusHost = {
  app: typeof app
  queueSize: { textContent: string }
  lastQueueSize: number
  batchCount: number
  autoQueueEnabled: boolean
  autoQueueMode: string
  graphHasChanged: boolean
  setStatus: (status: StatusWsMessageStatus | null) => void
}

function createHost(overrides: Partial<SetStatusHost> = {}): SetStatusHost {
  return {
    app,
    queueSize: { textContent: '' },
    lastQueueSize: 0,
    batchCount: 1,
    autoQueueEnabled: false,
    autoQueueMode: 'instant',
    graphHasChanged: false,
    setStatus: ComfyUI.prototype.setStatus,
    ...overrides
  }
}

describe('ComfyUI.setStatus', () => {
  it('renders the queue size when exec_info is present', () => {
    const host = createHost()
    host.setStatus({ exec_info: { queue_remaining: 3 } })

    expect(host.queueSize.textContent).toBe('Queue size: 3')
    expect(host.lastQueueSize).toBe(3)
  })

  it('does not throw or update when exec_info is missing', () => {
    const host = createHost({ lastQueueSize: 5 })

    expect(() => host.setStatus({})).not.toThrow()
    expect(host.queueSize.textContent).toBe('')
    expect(host.lastQueueSize).toBe(5)
    expect(app.queuePrompt).not.toHaveBeenCalled()
  })

  it('does not update or auto-queue on a null status (disconnect)', () => {
    const host = createHost({ lastQueueSize: 2, autoQueueEnabled: true })
    host.setStatus(null)

    expect(host.queueSize.textContent).toBe('')
    expect(host.lastQueueSize).toBe(2)
    expect(app.queuePrompt).not.toHaveBeenCalled()
  })

  it('auto-queues when the queue drains to zero', () => {
    const host = createHost({
      lastQueueSize: 2,
      batchCount: 4,
      autoQueueEnabled: true,
      autoQueueMode: 'instant'
    })
    host.setStatus({ exec_info: { queue_remaining: 0 } })

    expect(app.queuePrompt).toHaveBeenCalledWith(0, 4, {
      intent: { trigger_source: 'auto_queue' }
    })
    expect(host.lastQueueSize).toBe(4)
    expect(host.graphHasChanged).toBe(false)
  })

  it.for([
    {
      mode: 'instant',
      previous: 0,
      changed: false,
      submissions: 0,
      remaining: 0
    },
    {
      mode: 'change',
      previous: 2,
      changed: false,
      submissions: 0,
      remaining: 0
    },
    {
      mode: 'change',
      previous: 2,
      changed: true,
      submissions: 1,
      remaining: 3
    },
    {
      mode: 'instant-running',
      previous: 2,
      changed: false,
      submissions: 0,
      remaining: 0
    }
  ])(
    'retains legacy drain behavior for $mode with previous=$previous and changed=$changed',
    ({ mode, previous, changed, submissions, remaining }) => {
      const host = createHost({
        lastQueueSize: previous,
        batchCount: 3,
        autoQueueEnabled: true,
        autoQueueMode: mode,
        graphHasChanged: changed
      })

      host.setStatus({ exec_info: { queue_remaining: 0 } })

      expect(app.queuePrompt).toHaveBeenCalledTimes(submissions)
      expect(host.lastQueueSize).toBe(remaining)
      expect(host.graphHasChanged).toBe(false)
    }
  )

  it('defers a legacy graph change until a nonempty queue drains', () => {
    const host = createHost({
      lastQueueSize: 2,
      autoQueueEnabled: true,
      autoQueueMode: 'change'
    })
    const lifetime = new AbortController()
    onTestFinished(() => lifetime.abort())
    setupLegacyAutoQueue(host, lifetime.signal)

    api.dispatchCustomEvent('autoQueueGraphChanged')

    expect(host.graphHasChanged).toBe(true)
    expect(app.queuePrompt).not.toHaveBeenCalled()
    host.setStatus({ exec_info: { queue_remaining: 0 } })

    expect(app.queuePrompt).toHaveBeenCalledExactlyOnceWith(0, 1, {
      intent: { trigger_source: 'auto_queue' }
    })
    expect(host.graphHasChanged).toBe(false)
  })

  it('keeps legacy graph changes immediately eligible until a status update', () => {
    const host = createHost({
      autoQueueEnabled: true,
      autoQueueMode: 'change'
    })
    const lifetime = new AbortController()
    onTestFinished(() => lifetime.abort())
    setupLegacyAutoQueue(host, lifetime.signal)

    api.dispatchCustomEvent('autoQueueGraphChanged')
    api.dispatchCustomEvent('autoQueueGraphChanged')

    expect(app.queuePrompt).toHaveBeenCalledTimes(2)
    expect(host.lastQueueSize).toBe(0)
  })

  it('blocks legacy drain requeue after an execution error without blocking an idle graph change', () => {
    vi.spyOn(app, 'lastExecutionError', 'get').mockReturnValue({
      prompt_id: 'job-1',
      node_id: '1',
      node_type: 'TestNode',
      executed: [],
      exception_message: 'execution failed',
      exception_type: 'Error',
      traceback: [],
      current_inputs: {},
      current_outputs: {},
      timestamp: 1
    })
    const host = createHost({
      lastQueueSize: 2,
      autoQueueEnabled: true,
      autoQueueMode: 'change',
      graphHasChanged: true
    })
    const lifetime = new AbortController()
    onTestFinished(() => lifetime.abort())
    setupLegacyAutoQueue(host, lifetime.signal)

    host.setStatus({ exec_info: { queue_remaining: 0 } })

    expect(app.queuePrompt).not.toHaveBeenCalled()
    expect(host.graphHasChanged).toBe(true)
    api.dispatchCustomEvent('autoQueueGraphChanged')

    expect(app.queuePrompt).toHaveBeenCalledExactlyOnceWith(0, 1, {
      intent: { trigger_source: 'auto_queue' }
    })
    expect(host.graphHasChanged).toBe(false)
  })

  it('stops legacy graph-change submissions when its lifetime ends', () => {
    const host = createHost({
      autoQueueEnabled: true,
      autoQueueMode: 'change'
    })
    const lifetime = new AbortController()
    onTestFinished(() => lifetime.abort())
    setupLegacyAutoQueue(host, lifetime.signal)
    lifetime.abort()

    api.dispatchCustomEvent('autoQueueGraphChanged')

    expect(app.queuePrompt).not.toHaveBeenCalled()
  })
})
