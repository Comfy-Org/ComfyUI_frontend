import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { collectCrdtDebugReport } from './crdtDebugReport'

vi.mock(import('axios'))

describe('collectCrdtDebugReport over the real api.getLogs and a mocked transport', () => {
  it('normalizes a cloud log array instead of fencing it raw', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [{ level: 'info', message: 'System is running normally' }]
    })
    vi.spyOn(api, 'getSystemStats').mockRejectedValue(new Error('offline'))

    const report = await collectCrdtDebugReport({
      sources: { serverLogs: true, settings: false, workflow: false },
      events: [],
      crdt: {
        status: {
          enabled: true,
          connected: false,
          canvasMayBeStale: false,
          workflowId: 'doc-1',
          updatesApplied: 0,
          lastFrameType: null,
          terminal: null,
          outcomes: {
            received: 0,
            applied: 0,
            appliedLive: 0,
            skipped: 0,
            errored: 0,
            gap: 0,
            reset: 0,
            dropped: 0
          }
        },
        tabId: null,
        lastSeq: null,
        schemaError: null,
        meta: {},
        nodeIds: [],
        linkIds: [],
        appliedOpIds: [],
        stamps: {}
      }
    })

    expect(report).toContain('"message": "System is running normally"')
    expect(report).toContain('"level": "info"')
    expect(report).toContain('System stats unavailable: Error: offline')
  })
})
