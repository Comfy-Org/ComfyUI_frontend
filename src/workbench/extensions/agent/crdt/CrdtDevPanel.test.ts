import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'

import { toTurnId, zAgentWsEvent } from '../schemas/agentApiSchema'
import { useAgentConversationStore } from '../stores/agent/agentConversationStore'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    getSystemStats: () => Promise.reject(new Error('offline')),
    getLogs: () => Promise.reject(new Error('offline')),
    getSettings: () => Promise.reject(new Error('offline')),
    apiURL: (path: string) => `http://backend${path}`,
    clientId: 'client-test-1',
    api_host: 'localhost:8188',
    api_base: ''
  }
}))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraph: { serialize: () => ({ nodes: [], links: [] }) } }
}))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock(import('@/platform/telemetry/reportError'), () => ({ reportError }))

import { setCrdtDebugEnabled } from './crdtDebugGate'
import * as crdtDebugReport from './crdtDebugReport'
import CrdtDevPanel from './CrdtDevPanel.vue'
import { clearDevEvents, recordDevEvent } from './devPanelLog'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const STATUS: AgentCrdtStatus = {
  enabled: true,
  connected: true,
  workflowId: 'doc-1',
  updatesApplied: 4,
  lastFrameType: 'doc_update',
  outcomes: {
    received: 5,
    applied: 4,
    skipped: 1,
    errored: 0,
    gap: 0,
    reset: 0,
    dropped: 0
  }
}

function renderPanel() {
  return render(CrdtDevPanel, {
    props: { status: STATUS },
    global: { plugins: [i18n] }
  })
}

const chip = () => screen.queryByTestId('crdt-dev-panel-chip')
const sheet = () => screen.queryByTestId('crdt-dev-panel')
const restore = () => screen.queryByTestId('crdt-dev-panel-restore')

describe('CrdtDevPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    // The gate caches its value, so clearing storage behind it is not enough
    // to undo a previous test's dismissal.
    setCrdtDebugEnabled(true)
    clearDevEvents()
    reportError.mockClear()
  })

  it('starts collapsed to a chip so it cannot cover the composer', () => {
    renderPanel()

    expect(chip()).toBeTruthy()
    expect(sheet()).toBeNull()
  })

  it('smoke-renders follower and document status from a live snapshot', async () => {
    const user = userEvent.setup()
    render(CrdtDevPanel, {
      global: { plugins: [i18n] },
      props: {
        status: STATUS,
        snapshot: () => ({
          status: STATUS,
          tabId: 'tab-1',
          lastSeq: 7,
          schemaError: null,
          meta: { schema_version: 2 },
          nodeIds: ['node-1'],
          linkIds: ['link-1'],
          appliedOpIds: ['op-1'],
          stamps: { 'node:node-1': [7, 'actor-1', 'op-1'] }
        })
      }
    })

    await user.click(chip()!)

    expect(sheet()).toHaveTextContent('doc-1')
    expect(sheet()).toHaveTextContent('tab-1')
    expect(sheet()).toHaveTextContent('node-1')
    expect(sheet()).toHaveTextContent('last seq')
    expect(sheet()).toHaveTextContent('7')
  })

  it('moves focus into the panel and restores it after Escape closes', async () => {
    const user = userEvent.setup()
    renderPanel()

    const chipButton = chip()!
    await user.click(chipButton)
    expect(sheet()).toBeTruthy()
    const closeButton = screen.getByTestId('crdt-dev-panel-close')
    expect(closeButton).toHaveFocus()

    const escapedToWindow = vi.fn()
    window.addEventListener('keydown', escapedToWindow)

    const verbosity = screen.getByTestId('crdt-dev-panel-verbosity')
    await user.click(verbosity)
    await user.keyboard('{Escape}')
    expect(sheet()).toBeTruthy()
    expect(escapedToWindow).not.toHaveBeenCalled()

    verbosity.blur()

    await user.keyboard('{Escape}')
    window.removeEventListener('keydown', escapedToWindow)
    expect(chip()).toBeTruthy()
    expect(sheet()).toBeNull()
    expect(chip()).toHaveFocus()
    expect(escapedToWindow).not.toHaveBeenCalled()
  })

  it('focuses the close control when restoring an open panel', async () => {
    localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')

    renderPanel()
    await nextTick()

    expect(sheet()).toBeTruthy()
    expect(screen.getByTestId('crdt-dev-panel-close')).toHaveFocus()
  })

  it('replaces the instrument with a way to restore it when hidden', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(chip()!)

    await user.click(screen.getByTestId('crdt-dev-panel-dismiss'))

    expect(chip()).toBeNull()
    expect(sheet()).toBeNull()
    expect(restore()).toBeTruthy()
    expect(localStorage.getItem('Comfy.Agent.CrdtDevPanel.hidden')).toBe('true')
    expect(localStorage.getItem('Comfy.Agent.CrdtDebug.enabled')).toBe('true')

    await user.click(restore()!)

    expect(chip()).toBeTruthy()
    expect(restore()).toBeNull()
    expect(localStorage.getItem('Comfy.Agent.CrdtDevPanel.hidden')).toBe(
      'false'
    )
    expect(localStorage.getItem('Comfy.Agent.CrdtDebug.enabled')).toBe('true')
  })

  it('keeps the restore affordance across a remount', async () => {
    const user = userEvent.setup()
    const first = renderPanel()
    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-dismiss'))

    // The panel lives in a slot inside `v-if="!showHistory"`, so opening chat
    // history destroys and re-creates it. Per-mount state alone would bring a
    // deliberately hidden chip back with no user action.
    first.unmount()
    renderPanel()

    expect(chip()).toBeNull()
    expect(sheet()).toBeNull()
    expect(restore()).toBeTruthy()
  })

  it('filters the event log by the layer an event came from', async () => {
    const user = userEvent.setup()
    recordDevEvent('ws_out', { frame: 'a' }, { scope: 'wire' })
    recordDevEvent('doc_update', { seq: 1 }, { scope: 'doc' })
    renderPanel()

    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))
    expect(screen.getByTestId('crdt-dev-panel-log').textContent).toContain(
      'ws_out'
    )

    await user.selectOptions(
      screen.getByTestId('crdt-dev-panel-scope-filter'),
      'doc'
    )

    const log = screen.getByTestId('crdt-dev-panel-log').textContent
    expect(log).toContain('doc_update')
    expect(log).not.toContain('ws_out')
  })

  it('lists the materialization event in the kind filter and filters by it', async () => {
    const user = userEvent.setup()
    recordDevEvent('doc_update', { seq: 1 }, { scope: 'doc' })
    recordDevEvent(
      'agent_node_adapters_materialized',
      { nodeCount: 2 },
      { scope: 'doc' }
    )
    renderPanel()

    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-tab-log'))

    const kindFilter = screen.getByTestId('crdt-dev-panel-filter')
    expect(
      within(kindFilter)
        .getAllByRole<HTMLOptionElement>('option')
        .map((option) => option.value)
    ).toContain('agent_node_adapters_materialized')

    await user.selectOptions(kindFilter, 'agent_node_adapters_materialized')

    const log = screen.getByTestId('crdt-dev-panel-log')
    expect(
      within(log).getByText('agent_node_adapters_materialized')
    ).toBeInTheDocument()
    expect(within(log).queryByText('doc_update')).not.toBeInTheDocument()
  })

  it.for(['Server logs', 'Settings', 'Workflow JSON'])(
    'includes %s by default and lets it be turned off',
    async (name) => {
      const user = userEvent.setup()
      renderPanel()
      await user.click(screen.getByTestId('crdt-dev-panel-chip'))

      const toggle = screen.getByRole('switch', { name })
      expect(toggle).toBeChecked()
      await user.click(toggle)
      expect(toggle).not.toBeChecked()
    }
  )

  it('explains a merge sequence without needing a backend', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-tab-merge'))

    expect(
      screen.getByTestId('crdt-dev-panel-simulation-label')
    ).toHaveTextContent('Simulated — not this session')

    await user.click(screen.getByTestId('crdt-dev-panel-run'))

    const trace = screen.getByTestId('crdt-dev-panel-trace').textContent
    expect(trace).toContain('delete-wins')
    expect(trace).toContain('had already been deleted')
  })

  it('offers a retry when report collection rejects without showing stale report text', async () => {
    const collectSpy = vi
      .spyOn(crdtDebugReport, 'collectCrdtDebugReport')
      .mockRejectedValueOnce(new Error('snapshot unavailable'))
      .mockResolvedValueOnce('# recovered report')
    const user = userEvent.setup()
    renderPanel()
    await user.click(chip()!)

    const copyReportButton = screen.getByTestId('crdt-dev-panel-copy-report')
    await user.click(copyReportButton)

    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'crdt_dev_panel_report_copy_failed'
    })
    expect(copyReportButton).toHaveTextContent('Retry copy report')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not collect the report. Retry, or turn off optional sources and retry.'
    )
    expect(
      screen.queryByRole('textbox', { name: 'Report to copy' })
    ).not.toBeInTheDocument()

    await user.click(copyReportButton)
    expect(collectSpy).toHaveBeenCalledTimes(2)
    expect(copyReportButton).toHaveTextContent('Copied')
    expect(await navigator.clipboard.readText()).toBe('# recovered report')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    collectSpy.mockRestore()
  })

  it('passes turned-off privacy sources to the collector', async () => {
    const collectSpy = vi
      .spyOn(crdtDebugReport, 'collectCrdtDebugReport')
      .mockResolvedValueOnce('# report')
    const user = userEvent.setup()
    renderPanel()
    await user.click(chip()!)

    for (const name of ['Server logs', 'Settings', 'Workflow JSON']) {
      await user.click(screen.getByRole('switch', { name }))
    }
    await user.click(screen.getByTestId('crdt-dev-panel-copy-report'))

    expect(collectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: { serverLogs: false, settings: false, workflow: false }
      })
    )
    expect(collectSpy.mock.calls[0][0]).not.toHaveProperty('workflow')
    expect(collectSpy.mock.calls[0][0]).not.toHaveProperty('workflowError')
  })

  it('copies retained tool metadata from real conversation events without prompt content', async () => {
    const conversation = useAgentConversationStore()
    const turnId = toTurnId('turn-tool-report')
    conversation.setThreadId('thread-tool-report')
    conversation.recordUser(turnId, 'private user prompt')
    conversation.startTurn(turnId)
    conversation.ingest(
      zAgentWsEvent.parse({
        type: 'agent_tool_call',
        data: {
          thread_id: 'thread-tool-report',
          message_id: turnId,
          tool_call_id: 'call-from-event',
          tool_name: 'inspect_workflow',
          status: 'success',
          duration_ms: 73
        }
      })
    )
    conversation.ingest(
      zAgentWsEvent.parse({
        type: 'agent_message_done',
        data: { thread_id: 'thread-tool-report', message_id: turnId }
      })
    )
    const user = userEvent.setup()
    renderPanel()
    await user.click(chip()!)
    await user.click(screen.getByTestId('crdt-dev-panel-copy-report'))

    const report = await navigator.clipboard.readText()
    expect(report).toContain('"callId": "call-from-event"')
    expect(report).toContain('"turnId": "turn-tool-report"')
    expect(report).toContain('"durationMs": 73')
    expect(report).toContain('"ok": true')
    expect(report).not.toContain('private user prompt')
  })

  it('passes an identifiers block to the report collector on every copy', async () => {
    const collectSpy = vi
      .spyOn(crdtDebugReport, 'collectCrdtDebugReport')
      .mockResolvedValueOnce('# report')
    const user = userEvent.setup()
    renderPanel()
    await user.click(chip()!)

    await user.click(screen.getByTestId('crdt-dev-panel-copy-report'))

    expect(collectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        identifiers: expect.objectContaining({
          tabId: null,
          docId: 'doc-1',
          workflowId: 'doc-1',
          crdtSequence: null,
          crdtLamport: null,
          clientId: 'client-test-1',
          backendUrl: 'localhost:8188',
          recentJobIds: []
        })
      })
    )

    collectSpy.mockRestore()
  })
})
