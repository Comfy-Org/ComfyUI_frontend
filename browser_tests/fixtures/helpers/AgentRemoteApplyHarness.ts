import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { AgentThreadListResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ModelFolderInfo } from '@/platform/assets/schemas/assetSchema'
import type {
  AgentRunModePreference,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { catalog, emptySeed } from '@e2e/fixtures/data/agent/agentRemoteApply'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKFLOW_ID = 'f2b4c6d8-1a3e-4b5c-9d7e-0f1a2b3c4d5e'
const THREAD_ID = '5c4b3a29-8d7e-4f60-9a1b-2c3d4e5f6a7b'
const MESSAGE_ID = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a'
const SOCKET_SID = '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d'

/**
 * Drives one agent turn that edits the canvas, with the doc host under the
 * test's control.
 *
 * The two halves of an agent turn travel separate paths and this harness keeps
 * them separate on purpose: the chat frames (`agent_tool_call`,
 * `agent_message_delta`, `agent_message_done`) are what the user reads as "the
 * agent did it", while the graph itself only moves when a `doc_update` carrying
 * the applied ops reaches the follower. `applyOnHost` records an op
 * authoritatively without broadcasting it, and `broadcast` releases it, so a
 * spec can pin what the user sees when only one of the two halves arrives.
 *
 * Every assertion built on this harness reads the canvas and the panel, never
 * the projection or the store, so it survives the graph-API remote-apply
 * pivot (FE #18700).
 */
export class AgentRemoteApplyHarness {
  private readonly host = new HostDoc(WORKFLOW_ID, emptySeed, catalog)
  readonly hostSocket: AgentFollowerHostSocket
  readonly agentPanel: AgentPanel
  readonly vueNodes: VueNodeHelpers
  readonly panel: Locator
  readonly sendButton: Locator
  readonly stopButton: Locator
  readonly workSummary: Locator

  constructor(private readonly page: Page) {
    this.hostSocket = new AgentFollowerHostSocket(
      page,
      WORKFLOW_ID,
      this.host,
      SOCKET_SID
    )
    this.agentPanel = new AgentPanel(page)
    this.vueNodes = new VueNodeHelpers(page)
    this.panel = this.agentPanel.root
    this.sendButton = this.agentPanel.sendButton
    this.stopButton = this.panel.getByRole('button', {
      name: enMessages.agent.stop,
      exact: true
    })
    // `WorkSummary.vue` renders three labels off the elapsed total, all of
    // them starting with the shared `worked` stem, so anchoring there keeps a
    // negative assertion from going vacuous when the wording or the elapsed
    // bucket changes.
    this.workSummary = this.panel.getByRole('button', {
      name: new RegExp(
        `^${enMessages.agent.worked.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
      )
    })
  }

  /**
   * Makes the host refuse `doc_subscribe`, as an overloaded one does. `times`
   * bounds it: a finite count is a transient overload the follower's own
   * retry ladder should ride out, and the default never recovers.
   */
  refuseDocSubscribes(times?: number): void {
    this.hostSocket.refuseSubscribes('overloaded', times)
  }

  /**
   * The activity row for one tool call inside the turn's work summary. The
   * summary is collapsed by default, so callers open it first with
   * {@link openWorkSummary}.
   */
  toolRow(label: string): Locator {
    return this.panel.getByRole('listitem').filter({ hasText: label })
  }

  /**
   * `agentToolGlyph.ts` gives a tool row exactly three glyphs: a spinner while
   * the call is streaming, `circle-x` when it failed, and the wrench (or a
   * per-tool icon) when it succeeded. The spinner's absence is therefore the
   * row's own readiness boundary -- it has reached a terminal state -- and the
   * wrench is how that terminal state reads as a plain success.
   */
  streamingGlyph(row: Locator): Locator {
    return row.locator('[class*="loader-circle"]')
  }

  settledSuccessGlyph(row: Locator): Locator {
    return row.locator('[class*="lucide--wrench"]')
  }

  async openWorkSummary(): Promise<void> {
    await this.workSummary.click()
    await expect(this.workSummary).toHaveAttribute('aria-expanded', 'true')
  }

  async setUp(): Promise<void> {
    const { page } = this

    // Registered before `bootAgentApp` (called with `objectInfo: 'server'`)
    // so it wins over the empty handler the boot mocks would otherwise
    // register for the same route: Playwright runs the most-recently
    // registered matching handler first.
    await page.route('**/api/object_info', (route) =>
      route.fulfill(jsonRoute(agentReplayNodeDefs))
    )
    // Neither route is part of the boot mocks: the model-folder list is read
    // while the panel chrome renders, and `queueStore` polls jobs for the
    // lifetime of every test here.
    const folders: ModelFolderInfo[] = []
    await page.route('**/api/experiment/models', (route) =>
      route.fulfill(jsonRoute(folders))
    )

    await this.hostSocket.install()

    const threads: AgentThreadListResponse = {
      threads: [],
      pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
    }
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(threads))
    )
    const runMode: AgentRunModePreference = {
      mode: 'ask_approval',
      credit_limit: null
    }
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill(jsonRoute(runMode))
    )
    // The follower binds a workflow from the turn ack's `workflow_id`
    // (`useAgentSession.bindWorkflow`), not from the target picker, so the
    // ack has to name the document this harness's host serves.
    const accepted: AgentTurnAccepted = {
      thread_id: THREAD_ID,
      message_id: MESSAGE_ID,
      workflow_id: WORKFLOW_ID
    }
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST')
        return route.fulfill(jsonRoute([]))
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(accepted)
      })
    })

    await bootAgentApp(page, true, {
      objectInfo: 'server',
      // Only the Vue node renderer projects follower edits onto the canvas as
      // DOM these specs can query.
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      }
    })

    // Registered only now: the boot mocks blanket-match `**/api/userdata**`
    // for every method, and the most-recently-registered route wins, so this
    // has to come after them to take over the workflow-save round trip.
    await mockWorkflowPersistence(page, WORKFLOW_ID)
  }

  /** Opens the panel and points the composer at the canvas tab. */
  async openAndTarget(): Promise<void> {
    await this.agentPanel.open()
    await this.agentPanel.selectWorkflow()
  }

  /**
   * Sends one prompt. Resolves once the user's own bubble is rendered, which
   * is the first point at which `agentConversationStore` holds the ack's
   * `message_id` -- a frame pushed before that is dropped with no retry.
   */
  async sendPrompt(text: string): Promise<void> {
    await this.agentPanel.sendMessage(text)
    await expect(this.panel.getByTestId('user-message-bubble')).toHaveText([
      text
    ])
  }

  /** The agent's own report that a canvas tool call succeeded. */
  reportToolCall(toolName: string, callId: string): void {
    this.hostSocket.send({
      type: 'agent_tool_call',
      data: {
        tool_call_id: callId,
        tool_name: toolName,
        status: 'success',
        duration_ms: 120,
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID
      }
    })
  }

  /**
   * Records ops on the authoritative document WITHOUT broadcasting them. The
   * returned frame is the delta a healthy host would have sent; pass it to
   * {@link broadcast} to release it.
   */
  applyOnHost(ops: RecordedGraphOperation[]): HostFrame {
    return this.host.apply(ops)
  }

  broadcast(update: HostFrame): void {
    this.hostSocket.send(update)
  }

  /** Records ops and broadcasts them in the same step, as a healthy host does. */
  applyAndBroadcast(ops: RecordedGraphOperation[]): void {
    this.broadcast(this.applyOnHost(ops))
  }

  /**
   * Drops the socket and waits for the follower to re-subscribe and be
   * answered, so the caller can assert what the recovery did to the canvas.
   */
  async reconnect(): Promise<void> {
    const before = this.hostSocket.subscribeCount()
    await this.hostSocket.disconnect()
    await expect
      .poll(() => this.hostSocket.subscribeCount(), {
        message: 'the follower never resubscribed after the socket dropped',
        timeout: 30_000
      })
      .toBeGreaterThan(before)
  }

  /** Node ids the authoritative document holds, as strings. */
  hostNodeIds(): string[] {
    return Object.keys(this.host.graph().nodes)
  }

  /** Closes the turn with the agent's written answer. */
  finishTurn(reply: string): void {
    const ids = { thread_id: THREAD_ID, message_id: MESSAGE_ID }
    const delta: AgentWsEvent = {
      type: 'agent_message_delta',
      data: { delta: reply, ...ids }
    }
    this.hostSocket.send(delta)
    this.hostSocket.send({
      type: 'agent_message_done',
      data: { ...ids, usage: null }
    })
  }

  /**
   * The panel's own "this turn is over and it went fine" state: the composer
   * is free again and the turn collapsed into its elapsed-time summary.
   */
  async expectTurnReportedFinished(): Promise<void> {
    await expect(this.sendButton).toBeVisible()
    await expect(this.stopButton).toHaveCount(0)
    await expect(this.workSummary).toBeVisible()
  }

  node(nodeId: number | string): Locator {
    return this.vueNodes.getNodeLocator(String(nodeId))
  }

  /**
   * Every node id the canvas is rendering, sorted so a comparison reads as a
   * set rather than a paint order.
   */
  async settledCanvasNodeIds(): Promise<string[]> {
    return (await this.vueNodes.getNodeIds()).sort()
  }
}
