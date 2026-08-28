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

import type { CrdtDebugSnapshot, ReportSources } from './crdtDebugReport'
import { collectCrdtDebugReport } from './crdtDebugReport'

const ALL_SOURCES: ReportSources = {
  serverLogs: true,
  settings: true,
  workflow: true
}

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
      sources: ALL_SOURCES,
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

  it('redacts credential-shaped setting values and says the section needs review', async () => {
    getSettings.mockResolvedValue({
      'Comfy.Theme': 'dark',
      'MyNodePack.apiKey': 'sk-live-do-not-leak',
      'Other.auth_token': 'do-not-leak-either'
    })

    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES
    })

    expect(report).not.toContain('sk-live-do-not-leak')
    expect(report).not.toContain('do-not-leak-either')
    expect(report).toContain('dark')
    expect(report).toContain('Review before sharing')
  })

  it('leaves logs, settings and the workflow out unless the tester opts in', async () => {
    getSettings.mockResolvedValue({ 'Comfy.Theme': 'do-not-leak-settings' })
    getLogs.mockResolvedValue('do-not-leak-logs')

    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      workflow: { nodes: [{ id: 'do-not-leak-workflow' }] }
    })

    expect(report).not.toContain('do-not-leak-settings')
    expect(report).not.toContain('do-not-leak-logs')
    expect(report).not.toContain('do-not-leak-workflow')
    expect(report).toContain('did not opt in')
    // The parts that are the point of the feature still ship.
    expect(report).toContain('## CRDT state')
    expect(report).toContain('## System')
  })

  it('redacts a credential nested under an innocuous key', async () => {
    getSettings.mockResolvedValue({
      'Comfy.Server.LaunchArgs': { '--api-token': 'nested-do-not-leak' },
      'Some.List': [{ password: 'listed-do-not-leak' }]
    })

    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES
    })

    expect(report).not.toContain('nested-do-not-leak')
    expect(report).not.toContain('listed-do-not-leak')
  })

  it('blanks a secret passed on the server command line', async () => {
    getSystemStats.mockResolvedValue({
      system: {
        os: 'linux',
        python_version: '3.12',
        embedded_python: false,
        comfyui_version: 'v1',
        pytorch_version: '2.4',
        argv: ['main.py', '--api-token', 'argv-do-not-leak', '--cpu'],
        ram_total: 2,
        ram_free: 1
      },
      devices: []
    })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).not.toContain('argv-do-not-leak')
    expect(report).toContain('--cpu')
  })

  it('renders the report even when /system_stats answers with an unexpected shape', async () => {
    getSystemStats.mockResolvedValue({ system: {}, devices: undefined })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).toContain('## System')
    expect(report).toContain('doc-1')
  })

  it('omits an oversized workflow rather than producing an unpasteable report', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES,
      workflow: { nodes: Array.from({ length: 5000 }, (_, i) => ({ id: i })) }
    })

    expect(report).toContain('workflow omitted')
  })
})
