import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  AgentMessages,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  DOC_PROTOCOL_VERSION,
  parseServerDocFrame
} from '@/workbench/extensions/agent/crdt/docFrameClient'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { isValidDocOpsBatch, parseWireOps } from '@e2e/fixtures/agentWireFrame'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { TestIds } from '@e2e/fixtures/selectors'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// A seed workflow with a KSampler whose numeric widgets make a doc edit
// observable on the canvas. Borrowed from a recorded conversation so the
// seed and its widget catalog are the shapes the production library mints.
const TEMPLATE_CASE = 'agent-rec-set-widget-existing'
/** The document an "Unsaved Workflow" tab is bound to before anything edits it. */
export const emptySeed = (): WorkflowJSON => ({ nodes: [], links: [] })
const SOCKET_SID = 'b6f0a2c1-8e34-4d21-9c07-2a1b3c4d5e60'
const PANEL_MOUNT_TIMEOUT = 30_000
const SUBSCRIBE_TIMEOUT = 15_000

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop
const NEW_CHAT_LABEL = enMessages.agent.newChat
const SWITCH_WORKFLOW_LABEL = enMessages.agent.switchWorkflow
// The cloud id the boot tab ("Unsaved Workflow") receives when the composer
// pins it as the first target. The composer refuses to send without a target
// (useAgentDraftSubmission), so every thread starts here before the agent's
// `agent_active_tab` moves it onto Alpha or Bravo. Distinct from both.
const HOME_WORKFLOW_ID = '00000000-0000-4000-8000-000000000000'

// One agent-bound workflow, its doc held by the shared library stand-in. Two
// of these describe the two-session scenario under test: two agent threads
// targeting two workflows in one running app.
export interface AgentBoundWorkflow {
  workflowId: string
  name: string
  host: HostDoc
}

/**
 * One agent thread the harness opened through the real composer. Its ids are
 * the ones the mocked POST ack handed the page, so frames stamped with them
 * are routed by `useAgentSession` exactly as the real agent's would be: only
 * the thread on screen may move the user's tabs.
 */
interface AgentThread {
  threadId: string
  messageId: string
}

interface OutboundDocOps {
  workflowId: string
  ops: { op?: unknown; node_id?: unknown }[]
}

interface ClientDocFrame {
  type: string
  workflowId?: string
  stateVectorB64?: string
  ops: unknown
}

/**
 * A single cloud app whose one CRDT follower must track whichever workflow tab
 * is active across two agent-bound workflows. The follower's subscribe target
 * is the session's `boundWorkflowId`, which only moves on a turn ack, an
 * `agent_active_tab`, `loadThread`, or `newChat` — never when the user simply
 * clicks back to an earlier tab. This harness opens two real agent threads
 * (composer, POST ack, `agent_active_tab` stamped with the thread's ids,
 * `agent_message_done`, New chat), then drives tab switches, so a test can
 * observe what the follower does (or fails to do) on return.
 *
 * Human `doc_ops` the page mints are judged by the real applier through
 * `HostDoc.applyWire` and answered with `doc_ops_result` (and the resulting
 * `doc_update`), as the relay does, so the sender settles each batch instead
 * of retrying it.
 */
export class AgentTwoSessionCrdtHarness {
  readonly panel: Locator
  readonly vueNodes: VueNodeHelpers
  readonly topbar: Topbar

  private readonly hosts = new Map<string, HostDoc>()
  private readonly names = new Map<string, string>()
  private readonly subscribes = new Map<string, number>()
  private readonly template: ReturnType<
    typeof loadAgentConversation
  >['workflow']
  private socket: WebSocketRoute | null = null
  private threadCounter = 0
  // Every doc_ops frame the client put on the wire, addressed workflow first.
  readonly outboundDocOps: OutboundDocOps[] = []
  private readonly subscribeWaiters = new Map<string, Array<() => void>>()
  // Why a `doc_subscribe` went unanswered, oldest first, so a subscribe
  // timeout names its real cause instead of "never subscribed".
  private readonly droppedSubscribes: string[] = []

  constructor(private readonly page: Page) {
    this.template = loadAgentConversation(TEMPLATE_CASE).workflow
    this.panel = page.locator('#agent-panel-root')
    this.vueNodes = new VueNodeHelpers(page)
    this.topbar = new Topbar(page)
  }

  /**
   * Register a workflow the shared doc host will answer subscribes for. The
   * seed defaults to the template's five wired nodes; pass `emptySeed()` for
   * the unsaved, never-edited workflow an agent thread builds from scratch.
   */
  addWorkflow(
    workflowId: string,
    name: string,
    seed: WorkflowJSON = this.template.seed
  ): AgentBoundWorkflow {
    const host = new HostDoc(workflowId, seed, this.template.catalog)
    this.hosts.set(workflowId, host)
    this.names.set(workflowId, name)
    this.subscribes.set(workflowId, 0)
    return { workflowId, name, host }
  }

  async boot(): Promise<void> {
    await this.mockAgentApi()
    await this.page.routeWebSocket(/\/ws(\?|$)/, (socket) => {
      this.socket = socket
      socket.onMessage((raw) => this.onClientFrame(raw))
      socket.send(
        JSON.stringify({
          type: 'status',
          data: {
            status: { exec_info: { queue_remaining: 0 } },
            sid: SOCKET_SID
          }
        })
      )
    })
    const objectInfo = this.page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/api/object_info')
    )
    await bootAgentApp(this.page, true, {
      settings: {
        'Comfy.VueNodes.Enabled': true,
        'Comfy.Graph.CanvasInfo': false
      },
      objectInfo: 'server'
    })
    // Await object_info so the replayed node types are registered before the
    // first catch-up materializes them.
    await objectInfo
    await this.page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(this.panel).toBeVisible({ timeout: PANEL_MOUNT_TIMEOUT })
    await this.selectHomeTarget()
  }

  /**
   * Pin the boot tab as the composer's target, the way
   * `agentConversationFixture` does. Pinning a temporary tab saves it and
   * looks its cloud id up; `mockWorkflowPersistence` answers both with
   * `HOME_WORKFLOW_ID`. Without a target the Send button opens this same
   * picker instead of posting, and no thread ever exists to route frames to.
   */
  private async selectHomeTarget(): Promise<void> {
    await mockWorkflowPersistence(this.page, HOME_WORKFLOW_ID)
    const picker = this.panel.getByRole('button', {
      name: SWITCH_WORKFLOW_LABEL
    })
    await picker.click()
    await this.page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect(picker).toHaveText('Unsaved Workflow')
  }

  /**
   * Start an agent thread the way a user does: type a prompt and send it. The
   * ids come from the mocked POST's own ack, so a thread only exists here once
   * the page really posted; the rendered user turn then says the page stored
   * that thread id (useAgentSession records the turn straight after).
   */
  async startThread(prompt: string): Promise<AgentThread> {
    const posted = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/agent\/threads\/[^/]+\/messages$/.test(
          new URL(response.url()).pathname
        )
    )
    await this.panel.getByRole('textbox').fill(prompt)
    await this.panel.getByRole('button', { name: SEND_LABEL }).click()
    const ack: { thread_id: string; message_id: string } = await (
      await posted
    ).json()
    await expect(this.panel.getByText(prompt).first()).toBeVisible()
    return { threadId: ack.thread_id, messageId: ack.message_id }
  }

  /**
   * Bind a workflow the way the agent does when it moves the user's canvas:
   * an `agent_active_tab` frame stamped with the thread that is speaking. The
   * panel opens (or creates) that workflow's tab, binds the session to it, and
   * the follower subscribes — at which point the shared host answers with the
   * workflow's catch-up.
   */
  async bindViaActiveTab(
    thread: AgentThread,
    bound: AgentBoundWorkflow
  ): Promise<void> {
    const before = this.subscribeCount(bound.workflowId)
    this.send(
      this.stamp({
        type: 'agent_active_tab',
        data: {
          workflow_id: bound.workflowId,
          name: bound.name,
          thread_id: thread.threadId,
          message_id: thread.messageId
        }
      })
    )
    await this.waitForSubscribe(bound.workflowId, before + 1)
  }

  /** End the thread's turn and wait for the composer to offer Send again. */
  async finishTurn(thread: AgentThread): Promise<void> {
    this.send(
      this.stamp({
        type: 'agent_message_done',
        data: { message_id: thread.messageId, thread_id: thread.threadId }
      })
    )
    await expect(
      this.panel.getByRole('button', { name: SEND_LABEL })
    ).toBeVisible()
    await expect(
      this.panel.getByRole('button', { name: STOP_LABEL })
    ).toHaveCount(0)
  }

  /**
   * One whole agent turn: open a thread through the composer, let the agent
   * move the user onto `bound`'s tab, and end the turn. This is the lifecycle
   * that binds the session — the tab click a user makes later does not — so
   * every test that needs a workflow bound starts here.
   */
  async runBoundTurn(
    prompt: string,
    bound: AgentBoundWorkflow
  ): Promise<AgentThread> {
    const thread = await this.startThread(prompt)
    await this.bindViaActiveTab(thread, bound)
    await expect(this.topbar.getActiveTab()).toContainText(bound.name)
    await this.finishTurn(thread)
    return thread
  }

  /**
   * Reload the page the way the user's refresh does, and wait for the app and
   * the agent panel to come back. The mocked routes, the `/ws` route and the
   * host documents all outlive the navigation, so the reloaded app meets the
   * same backend state the first one left. The composer's target does not
   * survive, though: a caller that wants `startThread` after this has to
   * re-pin one the way `boot()` does.
   */
  async reload(): Promise<void> {
    const socket = this.socket
    const objectInfo = this.page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/api/object_info')
    )
    await this.page.reload()
    await waitForCloudApp(this.page)
    // Startup restores the workflow tabs after extensionManager exists, so
    // the overlay is the boundary for "the tabs are back".
    const loadingOverlay = this.page.getByTestId(TestIds.app.loadingOverlay)
    await loadingOverlay.waitFor({
      state: 'attached',
      timeout: PANEL_MOUNT_TIMEOUT
    })
    await loadingOverlay.waitFor({
      state: 'hidden',
      timeout: PANEL_MOUNT_TIMEOUT
    })
    // The same two boundaries `boot()` waits on, for the same reasons: node
    // types registered before any catch-up materializes them, and the socket
    // this harness sends on replaced by the reloaded page's own.
    await objectInfo
    await expect(this.panel).toBeVisible({ timeout: PANEL_MOUNT_TIMEOUT })
    await expect
      .poll(() => this.socket !== socket, { timeout: SUBSCRIBE_TIMEOUT })
      .toBe(true)
  }

  /** Leave the current thread through the panel's own New chat button. */
  async newChat(): Promise<void> {
    await this.panel.getByRole('button', { name: NEW_CHAT_LABEL }).click()
    await expect(this.panel.getByRole('textbox')).toHaveText('')
  }

  /** Apply ops to a workflow's doc host and broadcast the effect frame. */
  hostEdit(bound: AgentBoundWorkflow, ops: RecordedGraphOperation[]): void {
    this.send(bound.host.apply(ops))
  }

  /** The widget value a workflow's host doc currently holds. */
  hostWidgetValue(
    bound: AgentBoundWorkflow,
    nodeId: string,
    widget: string
  ): unknown {
    const widgets = bound.host.graph().nodes[nodeId]?.widgets
    return typeof widgets === 'object' && widgets !== null
      ? (widgets as Record<string, unknown>)[widget]
      : undefined
  }

  /** The node ids a workflow's host doc currently holds, ascending. */
  hostNodeIds(bound: AgentBoundWorkflow): string[] {
    return Object.keys(bound.host.graph().nodes).sort()
  }

  /** How many times the client has subscribed this workflow's doc. */
  subscribeCount(workflowId: string): number {
    return this.subscribes.get(workflowId) ?? 0
  }

  /** Outbound `doc_ops` frames addressed to a workflow that carry the given op. */
  docOpsCount(workflowId: string, op: string): number {
    return this.outboundDocOps.filter(
      (frame) =>
        frame.workflowId === workflowId &&
        frame.ops.some((entry) => entry.op === op)
    ).length
  }

  private waitForSubscribe(workflowId: string, target: number): Promise<void> {
    if (this.subscribeCount(workflowId) >= target) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      const waiters = this.subscribeWaiters.get(workflowId) ?? []
      this.subscribeWaiters.set(workflowId, waiters)
      const forget = (): void => {
        const at = waiters.indexOf(waiter)
        if (at !== -1) waiters.splice(at, 1)
      }
      const timer = setTimeout(() => {
        forget()
        const label = `${this.names.get(workflowId)} (${workflowId})`
        const dropped = this.droppedSubscribes.length
          ? `; dropped: ${this.droppedSubscribes.join('; ')}`
          : ''
        reject(new Error(`follower never subscribed ${label}${dropped}`))
      }, SUBSCRIBE_TIMEOUT)
      const waiter = (): void => {
        if (this.subscribeCount(workflowId) < target) return
        clearTimeout(timer)
        forget()
        resolve()
      }
      waiters.push(waiter)
    })
  }

  private send(frame: AgentWsEvent | HostFrame): void {
    if (
      (frame.type.startsWith('doc_') || frame.type === 'awareness') &&
      parseServerDocFrame(frame) === null
    )
      throw new Error(`host frame ${frame.type} is not a valid doc frame`)
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    this.socket.send(JSON.stringify(frame))
  }

  private stamp(event: {
    type: string
    data: Record<string, unknown>
  }): AgentWsEvent {
    const parsed = parseAgentWsEvent(event)
    if (!parsed.success)
      throw new Error(
        `harness frame ${event.type} is not a valid agent event: ${parsed.error.message}`
      )
    return parsed.data
  }

  private onClientFrame(raw: string | Buffer): void {
    const parsed = AgentTwoSessionCrdtHarness.parseClientFrame(raw)
    if (parsed === null) return
    const { type, workflowId, stateVectorB64, ops } = parsed
    if (type === 'doc_ops' && workflowId !== undefined) {
      this.recordOutboundDocOps(workflowId, ops)
      this.judgeClientOps(workflowId, ops)
      return
    }
    if (type === 'doc_subscribe') {
      this.handleDocSubscribe(workflowId, stateVectorB64)
    }
  }

  private static parseClientFrame(raw: string | Buffer): ClientDocFrame | null {
    let frame: unknown
    try {
      frame = JSON.parse(raw.toString())
    } catch {
      return null
    }
    if (typeof frame !== 'object' || frame === null) return null
    const { type, data } = frame as { type?: unknown; data?: unknown }
    if (typeof type !== 'string' || typeof data !== 'object' || data === null)
      return null
    const { workflow_id, state_vector_b64, ops } = data as {
      workflow_id?: unknown
      state_vector_b64?: unknown
      ops?: unknown
    }
    return {
      type,
      workflowId: typeof workflow_id === 'string' ? workflow_id : undefined,
      stateVectorB64:
        typeof state_vector_b64 === 'string' ? state_vector_b64 : undefined,
      ops
    }
  }

  private recordOutboundDocOps(workflowId: string, ops: unknown): void {
    this.outboundDocOps.push({
      workflowId,
      ops: Array.isArray(ops) ? (ops as OutboundDocOps['ops']) : []
    })
  }

  // The applier is the only judge of a structurally valid human batch. A
  // batch for a workflow no host serves fails as `unknown_workflow`; one that
  // is malformed, empty, or repeats an `op_id` fails as `invalid_frame` —
  // both as the relay answers, so the sender settles instead of retrying.
  private judgeClientOps(workflowId: string, ops: unknown): void {
    const host = this.hosts.get(workflowId)
    if (host === undefined) {
      this.send(
        this.failedOpsResult(
          workflowId,
          'unknown_workflow',
          'the harness serves no such workflow'
        )
      )
      return
    }
    const parsed = parseWireOps(ops)
    if (!parsed.ok || !isValidDocOpsBatch(parsed.ops)) {
      this.send(
        this.failedOpsResult(
          workflowId,
          'invalid_frame',
          'doc_ops frame was not structurally valid'
        )
      )
      return
    }
    const { result, update } = host.applyWire(parsed.ops)
    this.send(result)
    if (update) this.send(update)
  }

  private failedOpsResult(
    workflowId: string,
    code: 'unknown_workflow' | 'invalid_frame',
    message: string
  ): HostFrame {
    return {
      type: 'doc_ops_result',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: workflowId,
        ok: false,
        applied: [],
        skipped: [],
        code,
        message
      }
    }
  }

  private handleDocSubscribe(
    workflowId: string | undefined,
    stateVectorB64: string | undefined
  ): void {
    if (workflowId === undefined) {
      this.droppedSubscribes.push('doc_subscribe carried no workflow_id')
      return
    }
    if (stateVectorB64 === undefined) {
      this.droppedSubscribes.push(
        `doc_subscribe for ${workflowId} carried no state_vector_b64`
      )
      return
    }
    const host = this.hosts.get(workflowId)
    if (host === undefined) {
      this.droppedSubscribes.push(
        `doc_subscribe for ${workflowId}, which no host serves`
      )
      return
    }
    try {
      this.send(host.subscribed())
      this.send(host.catchUp(stateVectorB64))
    } catch (error) {
      // Surface a bad state vector or a closed socket in the waiter's error
      // instead of letting it escape the socket callback half-way through.
      this.droppedSubscribes.push(
        `doc_subscribe for ${workflowId} failed to answer: ${String(error)}`
      )
      return
    }
    this.subscribes.set(workflowId, this.subscribeCount(workflowId) + 1)
    for (const waiter of [...(this.subscribeWaiters.get(workflowId) ?? [])])
      waiter()
  }

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute({ threads: [] }))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        this.threadCounter += 1
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            thread_id: `thread-${this.threadCounter}`,
            message_id: `msg-${this.threadCounter}`
          })
        })
      }
      const history: AgentMessages = []
      return route.fulfill(jsonRoute(history))
    })
    await page.route('**/api/agent/threads/*/messages/*/cancel', (route) =>
      route.fulfill(jsonRoute({ status: 'cancelling' }))
    )
    // Neither bound workflow is a saved cloud workflow. This empty list is the
    // default until `boot()` pins the home tab, whose `mockWorkflowPersistence`
    // routes are registered later and therefore win; Alpha and Bravo still
    // resolve through the session binding under test.
    await page.route('**/api/workflows**', (route) =>
      route.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
        } satisfies WorkflowListResponse)
      )
    )
  }
}

interface TwoSessionFixtures {
  twoSessionCrdt: AgentTwoSessionCrdtHarness
}

const VIEWPORT = { width: 2560, height: 1440 }

export const agentTwoSessionCrdtTest = agentTest.extend<TwoSessionFixtures>({
  viewport: VIEWPORT,
  twoSessionCrdt: async ({ page }, use) => {
    const harness = new AgentTwoSessionCrdtHarness(page)
    await use(harness)
  }
})
