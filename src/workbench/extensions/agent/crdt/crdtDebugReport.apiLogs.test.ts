import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { collectCrdtDebugReport } from './crdtDebugReport'

/**
 * The #17773 regression pin: `api.getLogs()` used to hand Axios' `.data`
 * straight to the report writer, so a cloud `/api/logs` array
 * (`[{"level":"info", ...}]`) reached `fence()` unnormalized and threw
 * `body.matchAll is not a function`. Catching that requires the **real**
 * `api.getLogs()` against a mocked transport -- a string-returning
 * `api.getLogs` mock cannot fail this way.
 *
 * That is why this lives in its own file rather than in
 * `crdtDebugReport.test.ts`: that suite's `beforeEach` installs
 * `vi.spyOn(api, 'getLogs')`, which would shadow the method under test.
 * It moved here from `src/scripts/api.logs.test.ts`, where its only
 * remaining tie to that file was the mocked transport: the snapshot it has
 * to construct is an agent-owned `CrdtDebugSnapshot`, so every field added
 * to `AgentCrdtStatus` dragged an edit into a shared, non-agent file.
 */
vi.mock(import('axios'))

describe('collectCrdtDebugReport through the real api.getLogs', () => {
  it('collects a report with the cloud log response', async () => {
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
