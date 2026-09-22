import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExtensionStore } from '@/stores/extensionStore'

import { toTurnId } from '../schemas/agentApiSchema'
import type {
  AssistantMessage,
  MessagePart,
  ToolPart
} from '../services/agent/agentMessageParts'
import { createAssistantMessage } from '../services/agent/agentMessageParts'

const { getSystemStats, getLogs, getSettings } = vi.hoisted(() => ({
  getSystemStats: vi.fn(),
  getLogs: vi.fn(),
  getSettings: vi.fn()
}))

const { reportError } = vi.hoisted(() => ({
  reportError: vi.fn()
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    getSystemStats: () => getSystemStats(),
    getLogs: () => getLogs(),
    getSettings: () => getSettings(),
    apiURL: (path: string) => `http://backend${path}`
  }
}))

beforeEach(() => {
  useExtensionStore().registerExtension({ name: 'Comfy.TestExtension' })
})

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError
}))

import type { ReportIdentifiers, ReportSources } from './crdtDebugReport'
import type { CrdtDebugSnapshot } from './crdtSnapshot'
import type { DevEvent } from './devPanelLog'
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
    lastFrameType: 'doc_update',
    outcomes: {
      received: 3,
      applied: 3,
      skipped: 0,
      errored: 0,
      gap: 0,
      reset: 0,
      dropped: 0
    }
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

const IDENTIFIERS: ReportIdentifiers = {
  userId: 'user-42',
  organizationId: 'org-3',
  workspaceId: 'workspace-7',
  agentThreadId: 'thread-12',
  activeAgentTurnId: 'turn-99',
  recentAgentTurnIds: ['turn-98', 'turn-97'],
  tabId: 'tab-1',
  activeJobId: 'prompt-99',
  recentJobIds: ['prompt-98', 'prompt-97'],
  workflowPath: 'workflows/my-flow.json',
  workflowId: 'workflow-5',
  graphId: 'graph-6',
  docId: 'doc-1',
  crdtSequence: 7,
  crdtLamport: 11,
  clientId: 'client-abc',
  deployEnv: 'test-v2',
  backendUrl: 'https://testcloud.comfy.org'
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

  it('leads with an Identifiers block carrying every ID a backend engineer searches by', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      identifiers: IDENTIFIERS
    })

    const identifiersIndex = report.indexOf('## Identifiers')
    expect(identifiersIndex).toBeGreaterThanOrEqual(0)
    // "At the TOP" means before every other section, not merely present.
    expect(report.indexOf('## CRDT state')).toBeGreaterThan(identifiersIndex)

    for (const value of [
      IDENTIFIERS.userId,
      IDENTIFIERS.organizationId,
      IDENTIFIERS.workspaceId,
      IDENTIFIERS.agentThreadId,
      IDENTIFIERS.activeAgentTurnId,
      ...IDENTIFIERS.recentAgentTurnIds,
      IDENTIFIERS.tabId,
      IDENTIFIERS.activeJobId,
      ...IDENTIFIERS.recentJobIds,
      IDENTIFIERS.workflowPath,
      IDENTIFIERS.workflowId,
      IDENTIFIERS.graphId,
      IDENTIFIERS.docId,
      IDENTIFIERS.crdtSequence,
      IDENTIFIERS.crdtLamport,
      IDENTIFIERS.clientId,
      IDENTIFIERS.deployEnv,
      IDENTIFIERS.backendUrl
    ]) {
      expect(report).toContain(String(value))
    }
    expect(report).toContain(__COMFYUI_FRONTEND_COMMIT__)
    expect(report).toContain(__COMFYUI_FRONTEND_VERSION__)
  })

  it('writes explicit "none" rows instead of omitting an unset identifier', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: []
    })

    const identifiersIndex = report.indexOf('## Identifiers')
    const nextSectionIndex = report.indexOf('##', identifiersIndex + 1)
    const identifiersBlock = report.slice(identifiersIndex, nextSectionIndex)

    expect(identifiersBlock).toContain('none')
    expect(identifiersBlock).not.toMatch(/undefined|\[object Object\]/)
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
    expect(report).toContain(
      'System details can identify your hardware, software versions and launch configuration.'
    )
  })

  it('still produces a report when the backend is the thing that is broken', async () => {
    getLogs.mockRejectedValue(new Error('backend unreachable'))
    getSystemStats.mockRejectedValue(new Error('backend unreachable'))

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).toContain('backend unreachable')
    expect(report).toContain('doc-1')
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_debug_report_source_failed',
      tags: { source: 'System stats' },
      level: 'warning'
    })
  })

  it('times out a stalled backend source', async () => {
    vi.useFakeTimers()
    getSystemStats.mockReturnValue(new Promise(() => {}))

    const reportPromise = collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })
    await vi.advanceTimersByTimeAsync(5_000)

    await expect(reportPromise).resolves.toContain('System stats timed out')
    vi.useRealTimers()
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

  it('leaves logs, settings and the workflow out when the tester turns them off', async () => {
    getSettings.mockResolvedValue({ 'Comfy.Theme': 'do-not-leak-settings' })
    getLogs.mockResolvedValue('do-not-leak-logs')

    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: { serverLogs: false, settings: false, workflow: false },
      workflow: { nodes: [{ id: 'do-not-leak-workflow' }] }
    })

    expect(report).not.toContain('do-not-leak-settings')
    expect(report).not.toContain('do-not-leak-logs')
    expect(report).not.toContain('do-not-leak-workflow')
    expect(report).toContain('Turned off by the tester')
    // The parts that are the point of the feature still ship.
    expect(report).toContain('## CRDT state')
    expect(report).toContain('## System')
  })

  it('includes all optional sources by default and records collection outcomes', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      workflow: { nodes: [{ id: 'workflow-node' }] }
    })

    expect(report).toContain('backend log line')
    expect(report).toContain('Comfy.Setting')
    expect(report).toContain('workflow-node')
    expect(report).toContain('## Collection status')
    expect(report).toContain('- System stats: collected')
    expect(report).toContain('- Server logs: collected')
    expect(report).toContain('- Settings: collected')
    expect(report).toContain('- Workflow: collected')
  })

  it('distinguishes failed, turned off and unavailable sources in collection status', async () => {
    getLogs.mockRejectedValue(new Error('offline'))
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: { serverLogs: true, settings: false, workflow: true }
    })

    expect(report).toContain('- Server logs: failed (see source section)')
    expect(report).toContain('- Settings: turned off')
    expect(report).toContain('- Workflow: unavailable')
    expect(report).toContain('Server logs unavailable: Error: offline')
  })

  it('reports unavailable tool metadata explicitly', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: []
    })

    expect(report).toContain('- Agent tool calls: unavailable')
    expect(report).toContain('Restored history may omit tool calls')
  })

  it('reports an empty retained tool-call array explicitly', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      agentMessages: []
    })

    expect(report).toContain('- Agent tool calls: no retained calls')
    const serialized = report
      .split('## Agent tool calls\n\n')[1]
      ?.match(/```json\n([\s\S]*?)\n```/)?.[1]
    assert.exists(serialized)
    expect(JSON.parse(serialized)).toEqual([])
  })

  it('correlates tool outcomes and backend durations without conversation content', async () => {
    const agentMessages: AssistantMessage[] = [
      {
        ...createAssistantMessage(toTurnId('turn-21')),
        parts: [
          { type: 'text', text: 'private assistant response', state: 'done' },
          {
            type: 'tool',
            callId: 'call-success',
            name: 'inspect_workflow',
            state: 'done',
            ok: true,
            durationMs: 137
          }
        ]
      },
      {
        ...createAssistantMessage(toTurnId('turn-43')),
        parts: [
          { type: 'thinking', text: 'private reasoning', state: 'done' },
          {
            type: 'tool',
            callId: 'call-error',
            name: 'edit_workflow',
            state: 'done',
            ok: false,
            durationMs: 294
          },
          {
            type: 'tool',
            callId: 'call-unsettled',
            name: 'run_workflow',
            state: 'streaming'
          }
        ]
      }
    ]
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      agentMessages
    })

    expect(report).toContain(
      '- Agent tool calls: collected (3/3 retained calls)'
    )
    const serialized = report
      .split('## Agent tool calls\n\n')[1]
      ?.match(/```json\n([\s\S]*?)\n```/)?.[1]
    assert.exists(serialized)
    const calls: unknown = JSON.parse(serialized)
    expect(calls).toEqual([
      {
        turnId: 'turn-21',
        callId: 'call-success',
        name: 'inspect_workflow',
        state: 'done',
        ok: true,
        durationMs: 137
      },
      {
        turnId: 'turn-43',
        callId: 'call-error',
        name: 'edit_workflow',
        state: 'done',
        ok: false,
        durationMs: 294
      },
      {
        turnId: 'turn-43',
        callId: 'call-unsettled',
        name: 'run_workflow',
        state: 'streaming'
      }
    ])
    expect(report).not.toContain('private assistant response')
    expect(report).not.toContain('private reasoning')
    expect(agentMessages.map(({ id }) => id)).toEqual(['turn-21', 'turn-43'])
    expect(
      agentMessages.map(({ parts }) => parts.map(({ type }) => type))
    ).toEqual([
      ['text', 'tool'],
      ['thinking', 'tool', 'tool']
    ])
  })

  it.for([
    {
      count: 50,
      status: 'collected (50/50 retained calls)',
      includesOldest: true,
      newest: 'call-49'
    },
    {
      count: 51,
      status: 'truncated (50/51 retained calls)',
      includesOldest: false,
      newest: 'call-50'
    }
  ])(
    'bounds $count tool calls to the most recent 50',
    async ({ count, status, includesOldest, newest }) => {
      const report = await collectCrdtDebugReport({
        crdt: SNAPSHOT,
        events: [],
        agentMessages: [
          {
            ...createAssistantMessage(toTurnId('turn-many-1')),
            parts: Array.from({ length: 30 }, (_, index) => ({
              type: 'tool',
              callId: `call-${index}`,
              name: 'inspect_workflow',
              state: 'done',
              ok: true
            }))
          },
          {
            ...createAssistantMessage(toTurnId('turn-many-2')),
            parts: [
              ...Array.from(
                { length: count - 30 },
                (_, index): ToolPart => ({
                  type: 'tool',
                  callId: `call-${index + 30}`,
                  name: 'inspect_workflow',
                  state: 'done',
                  ok: true
                })
              ),
              {
                type: 'text',
                text: 'private text after the newest tool call',
                state: 'done'
              }
            ] satisfies MessagePart[]
          }
        ]
      })

      expect(report).toContain(`- Agent tool calls: ${status}`)
      expect(report.includes('"callId": "call-0"')).toBe(includesOldest)
      expect(report).toContain(`"callId": "${newest}"`)
      expect(
        [...report.matchAll(/"callId": "(call-\d+)"/g)].map(
          ([, callId]) => callId
        )
      ).toEqual(
        Array.from(
          { length: 50 },
          (_, index) => `call-${index + Math.max(0, count - 50)}`
        )
      )
      expect(report).not.toContain('private text after the newest tool call')
    }
  )

  it('redacts credential-shaped tool metadata', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      agentMessages: [
        {
          ...createAssistantMessage(toTurnId('auth: Bearer private-turn')),
          parts: [
            {
              type: 'tool',
              callId: 'Bearer private-call',
              name: '/home/private-tool',
              state: 'done',
              ok: false
            }
          ]
        }
      ]
    })

    expect(report).not.toContain('private-turn')
    expect(report).not.toContain('private-call')
    expect(report).not.toContain('private-tool')
    expect(report).toContain('[redacted by the debug report]')
    expect(report).toContain('"ok": false')
  })

  it('bounds oversized metadata and preserves the newest call in the excerpt', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      agentMessages: [
        {
          ...createAssistantMessage(toTurnId('turn-large')),
          parts: [
            {
              type: 'tool',
              callId: 'call-oldest',
              name: 'x'.repeat(70_000),
              state: 'done'
            },
            {
              type: 'tool',
              callId: 'call-newest',
              name: 'inspect_workflow',
              state: 'done',
              ok: true,
              durationMs: 41
            }
          ]
        }
      ]
    })

    expect(report).toContain(
      '- Agent tool calls: truncated (1/2 retained calls)'
    )
    const serialized = report
      .split('## Agent tool calls\n\n')[1]
      ?.match(/```json\n([\s\S]*?)\n```/)?.[1]
    assert.exists(serialized)
    expect(JSON.parse(serialized)).toEqual([
      {
        turnId: 'turn-large',
        callId: 'call-newest',
        name: 'inspect_workflow',
        state: 'done',
        ok: true,
        durationMs: 41
      }
    ])
    expect(report.length).toBeLessThan(70_000)
  })

  it('includes the tool section wrapper in its character limit', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      agentMessages: [
        {
          ...createAssistantMessage(toTurnId('turn-boundary')),
          parts: [
            {
              type: 'tool',
              callId: 'call-boundary',
              name: 'x'.repeat(59_800),
              state: 'done'
            }
          ]
        }
      ]
    })

    expect(report).toContain(
      '- Agent tool calls: truncated (0/1 retained calls)'
    )
    const section = report
      .split('## Agent tool calls\n\n')[1]
      ?.split('\n\n## ')[0]
    assert.exists(section)
    expect(section.length).toBeLessThanOrEqual(60_000)
  })

  it.for([
    { enabled: true, status: 'failed (see source section)' },
    { enabled: false, status: 'turned off' }
  ])(
    'reports workflow serialization failure when enabled=$enabled',
    async ({ enabled, status }) => {
      const report = await collectCrdtDebugReport({
        crdt: SNAPSHOT,
        events: [],
        sources: { serverLogs: false, settings: false, workflow: enabled },
        workflowError: 'serialize failed'
      })

      expect(report).toContain(`- Workflow: ${status}`)
      expect(report.includes('serialize failed')).toBe(enabled)
    }
  )

  it('redacts and bounds a workflow serialization failure', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES,
      workflowError: `${'x'.repeat(80_000)} apiKey=do-not-leak "apiKey":"json-do-not-leak" auth: Bearer bearer-do-not-leak`
    })

    expect(report).not.toContain('do-not-leak')
    expect(report).toContain('apiKey=[redacted by the debug report]')
    expect(report).toContain('"apiKey":"[redacted by the debug report]"')
    expect(report).toContain('auth: [redacted by the debug report]')
    expect(report).toContain('earlier characters trimmed')
  })

  it.for([
    {
      case: 'escaped double-quote',
      workflowError: String.raw`"apiKey":"escaped\"double-do-not-leak"`,
      redacted: '"apiKey":"[redacted by the debug report]"'
    },
    {
      case: 'escaped single-quote',
      workflowError: String.raw`'secret':'escaped\'single-do-not-leak'`,
      redacted: "'secret':'[redacted by the debug report]'"
    },
    {
      case: 'multiline double-quote',
      workflowError: '"apiKey":"first-line\ndouble-do-not-leak"',
      redacted: '"apiKey":"[redacted by the debug report]"'
    },
    {
      case: 'multiline single-quote',
      workflowError: "'secret':'first-line\nsingle-do-not-leak'",
      redacted: "'secret':'[redacted by the debug report]'"
    }
  ])('redacts $case secrets', async ({ workflowError, redacted }) => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES,
      workflowError
    })

    expect(report).not.toContain('do-not-leak')
    expect(report).toContain(redacted)
  })

  it('reports a thrown workflow JSON conversion as failed', async () => {
    const workflow = Object.defineProperty({}, 'broken', {
      enumerable: true,
      get: () => {
        throw new Error('serialize failed')
      }
    })

    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES,
      workflow
    })

    expect(report).toContain('- Workflow: failed (see source section)')
    expect(report).toContain('## Workflow')
  })

  it('redacts widget values from outbound operation events', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [
        {
          seq: 1,
          at: 0,
          kind: 'ws_out',
          scope: 'wire',
          level: 'trace',
          detail: {
            frame: {
              type: 'doc_ops',
              data: {
                ops: [
                  {
                    op: 'set_widget',
                    op_id: 'op-safe',
                    node_id: 'A',
                    widget: 'text',
                    value: 'private prompt'
                  }
                ]
              }
            }
          }
        }
      ]
    })

    expect(report).toContain('op-safe')
    expect(report).not.toContain('private prompt')
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

  it('redacts a credential value that begins with a dash', async () => {
    getSystemStats.mockResolvedValue({
      system: {
        argv: [
          'main.py',
          '--api-token',
          '-argv-leading-dash-do-not-leak',
          '--cpu'
        ]
      },
      devices: []
    })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).not.toContain('argv-leading-dash-do-not-leak')
    expect(report).toContain('--cpu')
  })

  it('redacts a credential value that looks like another long flag', async () => {
    getSystemStats.mockResolvedValue({
      system: {
        argv: ['main.py', '--api-token', '--argv-token-do-not-leak', '--cpu']
      },
      devices: []
    })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).not.toContain('argv-token-do-not-leak')
    expect(report).toContain('--cpu')
  })

  it('redacts inline argv values containing equals signs', async () => {
    getSystemStats.mockResolvedValue({
      system: {
        argv: [
          'main.py',
          '--extra-model-paths-config=a=/home/alice/private.yaml'
        ]
      },
      devices: []
    })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).not.toContain('private.yaml')
    expect(report).toContain('--extra-model-paths-config=[redacted')
  })

  it('renders the report even when /system_stats answers with an unexpected shape', async () => {
    getSystemStats.mockResolvedValue({ system: {}, devices: undefined })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).toContain('## System')
    expect(report).toContain('doc-1')
  })

  it('keeps redacting argv when the rest of the payload is malformed', async () => {
    // A fallback that dumped the raw payload on any render error put the
    // secret back on the clipboard, and `## System` has no opt-in to catch it.
    getSystemStats.mockResolvedValue({
      system: { argv: ['main.py', '--api-token', 'argv-do-not-leak'] },
      devices: undefined
    })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).not.toContain('argv-do-not-leak')
    expect(report).toContain('## System')
  })

  it('renders the report when device entries are malformed', async () => {
    getSystemStats.mockResolvedValue({
      system: {},
      devices: [null, { index: 1, name: 'GPU', type: 'cuda' }]
    })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).toContain('Device ?:')
    expect(report).toContain('Device 1')
  })

  it('does not return a deeply nested settings object past the redaction cutoff', async () => {
    let nested: Record<string, unknown> = {
      innocuous: { apiKey: 'deep-do-not-leak' }
    }
    for (let depth = 0; depth < 13; depth++) {
      nested = { innocuous: nested }
    }
    getSettings.mockResolvedValue(nested)

    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES
    })

    expect(report).not.toContain('deep-do-not-leak')
    expect(report).toContain('redacted at depth limit')
  })

  it('redacts private path strings inside shared settings values', async () => {
    getSettings.mockResolvedValue({
      'Comfy.ModelDirectory': '/home/alice/private-models'
    })

    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES
    })

    expect(report).not.toContain('/home/alice/private-models')
  })

  it('redacts private paths without eating the argument after them', async () => {
    getSystemStats.mockResolvedValue({
      system: {
        argv: [
          'main.py',
          '--extra-model-paths-config',
          '/home/jsmith/private-do-not-leak.yaml',
          '--port',
          '8188',
          '--cpu'
        ]
      },
      devices: []
    })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).not.toContain('private-do-not-leak')
    expect(report).toContain('--port 8188')
    expect(report).toContain('--cpu')
  })

  it('redacts relative and UNC path argv values', async () => {
    getSystemStats.mockResolvedValue({
      system: {
        argv: [
          'main.py',
          '--extra-model-paths-config',
          '../private/paths.yaml',
          '--output',
          '\\\\NAS\\comfy\\out'
        ]
      },
      devices: []
    })

    const report = await collectCrdtDebugReport({ crdt: SNAPSHOT, events: [] })

    expect(report).not.toContain('../private/paths.yaml')
    expect(report).not.toContain('NAS')
  })

  it('does not let a log line close the code fence around it', async () => {
    getLogs.mockResolvedValue('traceback ``` still inside the fence')

    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES
    })

    const afterHeading = report.slice(report.indexOf('## Server logs'))
    const opener = afterHeading.slice(afterHeading.indexOf('`'))
    expect(opener.startsWith('````')).toBe(true)
  })

  it('does not spread every backtick run into Math.max', async () => {
    getLogs.mockResolvedValue('`'.repeat(70_000))

    await expect(
      collectCrdtDebugReport({
        crdt: SNAPSHOT,
        events: [],
        sources: ALL_SOURCES
      })
    ).resolves.toContain('## Server logs')
  })

  it('omits an oversized workflow rather than producing an unpasteable report', async () => {
    const report = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: [],
      sources: ALL_SOURCES,
      workflow: { nodes: Array.from({ length: 40_000 }, (_, i) => ({ id: i })) }
    })

    expect(report).toContain('workflow omitted')
    expect(report).toContain('- Workflow: omitted (over 200000 characters)')
  })

  it('deterministically caps an oversized report without dropping its contract markers', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-12T00:00:00Z'))
    const oversizedEvents: DevEvent[] = Array.from({ length: 4 }, (_, seq) => ({
      seq,
      at: seq,
      kind: 'doc_update',
      scope: 'doc',
      level: 'info',
      detail: { trace: '🧪'.repeat(80_000) }
    }))

    const first = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: oversizedEvents,
      testerNote: 'n'.repeat(300_000)
    })
    const second = await collectCrdtDebugReport({
      crdt: SNAPSHOT,
      events: oversizedEvents,
      testerNote: 'n'.repeat(300_000)
    })

    try {
      expect(first.length).toBeLessThanOrEqual(256_000)
      expect(second).toBe(first)
      expect(first).toContain('report truncated')
      expect(first).toContain(
        'Report format version: 1 · Document schema version: 1'
      )
      expect(first).toContain('Schema version:** 1')
      expect(first).toContain('[redacted by the debug report]')
      expect(first).not.toMatch(
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
