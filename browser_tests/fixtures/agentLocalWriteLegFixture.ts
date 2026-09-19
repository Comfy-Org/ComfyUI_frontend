import type { Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const SEND_LABEL = enMessages.agent.send
const SUBSCRIBE_TIMEOUT = 15_000

/** One frame the client sent over `/ws`, as captured by the fake host. */
export interface CapturedClientFrame {
  type: string
  data: Record<string, unknown>
}

/**
 * Binds the agent panel's CRDT follower to a fake doc host, entirely
 * in-process (the real `@comfyorg/comfy-multi-player` library runs, only the
 * transport is faked) — the same technique `agentConversationFixture` uses to
 * replay recorded agent turns, minus the turn replay itself. This harness
 * exists only to get `isDocBound()` true (a real `doc_subscribed` + catch-up
 * round trip) so a LOCAL human structural edit can be driven through the
 * real mint-port gate afterward.
 *
 * The workflow binding only happens once the panel receives an
 * `agent_active_tab` event naming a `workflow_id` (see
 * `browser_tests/fixtures/data/agent/README.md`), which in production only
 * arrives on a turn. So this harness sends one throwaway prompt and replies
 * with a minimal `agent_active_tab` + `agent_message_done` pair — the
 * reply's content is never asserted on.
 */
export class LocalWriteLegHarness {
  readonly clientFrames: CapturedClientFrame[] = []
  private readonly host: HostDoc
  private socket: WebSocketRoute | null = null
  private resolveSubscribed: (() => void) | null = null
  private readonly subscribed = new Promise<void>((resolve) => {
    this.resolveSubscribed = resolve
  })

  constructor(
    private readonly page: Page,
    private readonly workflowId: string,
    private readonly threadId: string,
    private readonly messageId: string,
    /** The workflow-tab menu label to bind (the loaded asset's tab name). */
    private readonly tabName: string
  ) {
    this.host = new HostDoc(workflowId, { nodes: [], links: [] }, { types: {} })
  }

  /** Every `doc_ops` frame the client sent (the human write leg's wire ops). */
  docOpsSent(): Record<string, unknown>[] {
    return this.clientFrames
      .filter((frame) => frame.type === 'doc_ops')
      .flatMap((frame) =>
        Array.isArray(frame.data.ops)
          ? (frame.data.ops as Record<string, unknown>[])
          : []
      )
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

  private sendEvent(type: string, data: Record<string, unknown>): void {
    const stamped = {
      type,
      data: { ...data, message_id: this.messageId, thread_id: this.threadId }
    }
    const parsed = parseAgentWsEvent(stamped)
    if (!parsed.success)
      throw new Error(
        `constructed ${type} frame is not a valid agent event: ${parsed.error.message}`
      )
    this.send(parsed.data)
  }

  private onClientFrame(raw: string | Buffer): void {
    const frame: unknown = JSON.parse(raw.toString())
    if (typeof frame !== 'object' || frame === null) return
    const { type, data } = frame as { type?: unknown; data?: unknown }
    if (typeof type !== 'string' || typeof data !== 'object' || data === null)
      return
    this.clientFrames.push({ type, data: data as Record<string, unknown> })
    if (type === 'doc_subscribe')
      this.handleDocSubscribe(data as Record<string, unknown>)
  }

  /** Replies to a `doc_subscribe` frame for our workflow with subscribe + catch-up. */
  private handleDocSubscribe(data: Record<string, unknown>): void {
    const { workflow_id, state_vector_b64 } = data as {
      workflow_id?: unknown
      state_vector_b64?: unknown
    }
    if (workflow_id !== this.workflowId || typeof state_vector_b64 !== 'string')
      return
    this.send(this.host.subscribed())
    this.send(this.host.catchUp(state_vector_b64))
    this.resolveSubscribed?.()
  }

  private async mockAgentApi(): Promise<void> {
    const { page, workflowId, threadId, messageId } = this
    const firstMessageResponse = {
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        thread_id: threadId,
        message_id: messageId,
        workflow_id: workflowId
      })
    }
    await page.route('**/api/agent/threads', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill(firstMessageResponse)
        : route.fulfill(jsonRoute({ threads: [] }))
    )
    await page.route('**/api/agent/threads/*/messages', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill(firstMessageResponse)
        : route.fulfill(jsonRoute([]))
    )
    await page.route('**/api/agent/threads/*/messages/*/cancel', (route) =>
      route.fulfill({ status: 404 })
    )
    await page.route('**/api/workflows**', (route) =>
      route.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
        })
      )
    )
    await page.route('**/api/userdata/*', (route) => route.fallback())
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{}'
      })
    )
  }

  /**
   * Registers the WS route and API mocks (must run before `bootAgentApp`),
   * opens the panel, sends one throwaway prompt, and waits for the resulting
   * `doc_subscribe` round trip to complete — i.e. `isDocBound()` becomes true.
   */
  async bindDoc(): Promise<void> {
    const { page } = this
    await this.mockAgentApi()
    await page.routeWebSocket(/\/ws/, (socket) => {
      this.socket = socket
      socket.onMessage((raw) => this.onClientFrame(raw))
      socket.send(
        JSON.stringify({
          type: 'status',
          data: {
            status: { exec_info: { queue_remaining: 0 } },
            sid: 'e2e-local-write-leg-sid'
          }
        })
      )
    })
  }

  /** Call once `bootAgentApp` has navigated and the app is ready. */
  async openPanelAndBindWorkflow(): Promise<void> {
    const { page } = this
    const panel = page.locator('#agent-panel-root')
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(panel).toBeVisible()

    const composer = panel.getByRole('textbox').first()
    const prompt = '(e2e repro harness) bind this workflow, no-op'
    await composer.fill(prompt)
    await panel.getByRole('button', { name: SEND_LABEL }).click()
    // The ack sets conversationStore.threadId before the turn renders;
    // agent_active_tab below only takes effect once that id matches.
    await expect(panel.getByText(prompt).first()).toBeVisible()

    this.sendEvent('agent_active_tab', {
      name: this.tabName,
      workflow_id: this.workflowId
    })
    await Promise.race([
      this.subscribed,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('the follower never subscribed to the doc')),
          SUBSCRIBE_TIMEOUT
        )
      )
    ])
    this.sendEvent('agent_message_delta', { delta: 'bound.' })
    this.sendEvent('agent_message_done', {})
    await expect(panel.getByRole('button', { name: SEND_LABEL })).toBeVisible()
  }
}
