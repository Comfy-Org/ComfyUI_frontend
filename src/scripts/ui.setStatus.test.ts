import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StatusWsMessageStatus } from '@/schemas/apiSchema'

import { app } from './app'
import { ComfyUI } from './ui'

vi.mock('./app', () => ({
  app: { lastExecutionError: null, queuePrompt: vi.fn() },
  ComfyApp: class {}
}))

type SetStatusHost = {
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
  beforeEach(() => {
    vi.mocked(app.queuePrompt).mockClear()
  })

  it('renders the queue size when exec_info is present', () => {
    const host = createHost()
    host.setStatus({ exec_info: { queue_remaining: 3 } })

    expect(host.queueSize.textContent).toBe('Queue size: 3')
    expect(host.lastQueueSize).toBe(3)
  })

  it('does not throw and shows ERR when exec_info is missing', () => {
    const host = createHost({ lastQueueSize: 5 })

    expect(() => host.setStatus({} as StatusWsMessageStatus)).not.toThrow()
    expect(host.queueSize.textContent).toBe('Queue size: ERR')
    expect(host.lastQueueSize).toBe(5)
    expect(app.queuePrompt).not.toHaveBeenCalled()
  })

  it('shows ERR for a null status', () => {
    const host = createHost({ lastQueueSize: 5 })
    host.setStatus(null)

    expect(host.queueSize.textContent).toBe('Queue size: ERR')
    expect(host.lastQueueSize).toBe(5)
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
})
