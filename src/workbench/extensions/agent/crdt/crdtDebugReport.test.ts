import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSystemStats = vi.fn()
const getLogs = vi.fn()
const getSettings = vi.fn()

vi.mock('@/scripts/api', () => ({
  api: {
    getSystemStats: () => getSystemStats(),
    getLogs: () => getLogs(),
    getSettings: () => getSettings(),
    apiURL: (path: string) => `http://backend${path}`
  }
}))

vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({ extensions: [{ name: 'Comfy.TestExtension' }] })
}))

import type { CrdtDebugSnapshot } from './crdtDebugReport'
import { collectCrdtDebugReport } from './crdtDebugReport'

const SNAPSHOT: CrdtDebugSnapshot = {
  status: {
    enabled: true,
    connected: true,
    workflowId: 'doc-1',
    updatesApplied: 3,
    lastFrameType: 'doc_update'
  },
  tabId: 'tab-1',
  lastSeq: 7,
  schemaError: null,
  meta: { schema_version: 1 },
  nodeIds: ['A', 'B'],
  linkIds: ['1'],
  appliedOpIds: ['op1'],
  stamps: { '["widget","A","text"]': [1, 'human:u:t', 'op1'] }
}

describe('collectCrdtDebugReport', () => {
  beforeEach(() => {
    getSystemStats.mockResolvedValue({
      system: {
        os: 'linux',
        python_version: '3.12',
        embedded_python: false,
        comfyui_version: 'v1',
        pytorch_version: '2.4',
        argv: ['main.py'],
        ram_total: 2,
        ram_free: 1
      },
      devices: []
    })
    getLogs.mockResolvedValue('backend log line')
    getSettings.mockResolvedValue({ 'Comfy.Setting': true })
  })

  it('gathers backend, frontend and CRDT context into one artifact', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [
        {
          seq: 1,
          at: 0,
          kind: 'doc_update',
          scope: 'doc',
          level: 'info',
          detail: null
        }
      ]
    })

    expect(report).toContain('backend log line')
    expect(report).toContain('Comfy.TestExtension')
    expect(report).toContain('Comfy.Setting')
    expect(report).toContain('doc-1')
    expect(report).toContain('doc_update')
    expect(report).toContain('Document stamps')
  })

  it("puts the tester's own words about expected merge behaviour first", async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      testerNote: 're-adding a node should restore my widget edit'
    })

    expect(report).toContain('re-adding a node should restore my widget edit')
    expect(report.indexOf('What the tester expected')).toBeLessThan(
      report.indexOf('## System')
    )
  })

  it('still produces a report when the backend is the thing that is broken', async () => {
    getLogs.mockRejectedValue(new Error('backend unreachable'))
    getSystemStats.mockRejectedValue(new Error('backend unreachable'))

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).toContain('backend unreachable')
    expect(report).toContain('doc-1')
  })

  it('omits an oversized workflow rather than producing an unpasteable report', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      workflow: { nodes: Array.from({ length: 5000 }, (_, i) => ({ id: i })) }
    })

    expect(report).toContain('workflow omitted')
  })
})
