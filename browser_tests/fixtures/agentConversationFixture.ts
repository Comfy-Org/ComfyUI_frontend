import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type { GraphSnapshot, Op } from '@comfyorg/comfy-multi-player'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import {
  DOC_PROTOCOL_VERSION,
  parseServerDocFrame
} from '@/workbench/extensions/agent/crdt/docFrameClient'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import type {
  AgentConversation,
  AgentConversationTurn,
  RecordedWsEvent
} from '@e2e/fixtures/data/agent/agentConversation'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'

import { compareNodeIds, toNodeId } from '@/types/nodeId'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = 'e9a2f3d1-7c44-4b2e-9a01-5f6d8c7b3a10'
// One synthetic message id per turn; the recorded ids never reach the page.
const turnId = (turn: number): string =>
  `0c5b1e77-2d4a-4f9e-8b63-1a2c3d4e5${turn.toString(16).padStart(3, '0')}`
const SOCKET_SID = '7d1f2e3a-4b5c-4d6e-8f90-1a2b3c4d5e6f'
const PANEL_MOUNT_TIMEOUT = 30_000
const SUBSCRIBE_TIMEOUT = 15_000

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop

type NodeBody = {
  id: number | string
  type: string
  title?: string
  inputs?: Array<{ name: string; widget?: unknown }>
  outputs?: Array<{ name: string }>
}

interface RecordedToolCall {
  callId: string
  failed: boolean
}

interface RecordedConnect {
  fromNode: string
  fromSlot: number
  toNode: string
  toSlot: number
  targetWidgetBacked: boolean
}

interface RecordedWidgetValue {
  nodeId: string
  widget: string
  value: string | number
}

// Runs one recorded prompt/response through the real panel over a routed /ws socket.
class AgentConversationHarness {
  readonly postedMessages: string[] = []
  // Every cancel the panel issued, so a missing one cannot pass unnoticed.
  readonly cancelRequests: { threadId: string; messageId: string }[] = []
  // Human-op minting is observable only on the client side of the socket.
  readonly clientFrames: { type?: unknown; data?: unknown }[] = []
  readonly panel: Locator
  readonly vueNodes: VueNodeHelpers

  private readonly host: HostDoc
  private socket: WebSocketRoute | null = null
  private resolveSubscribed: (() => void) | null = null
  private readonly subscribed = new Promise<void>((resolve) => {
    this.resolveSubscribed = resolve
  })

  constructor(
    private readonly page: Page,
    readonly conversation: AgentConversation,
    readonly replayTiming: ReplayTiming
  ) {
    const { workflow } = conversation
    this.host = new HostDoc(workflow.id, workflow.seed, workflow.catalog)
    this.panel = page.locator('#agent-panel-root')
    this.vueNodes = new VueNodeHelpers(page)
  }

  async boot(agentFlag: boolean): Promise<void> {
    await this.mockAgentApi()
    // The follower re-drives a pending subscribe only on a status frame, which every real connect sends.
    await this.page.routeWebSocket(/\/ws/, (socket) => {
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
    await bootAgentApp(this.page, agentFlag, {
      // Only the Vue node renderer projects follower edits onto the canvas.
      settings: { 'Comfy.VueNodes.Enabled': true },
      // Replayed nodes materialize from registered node types; the recordings use core nodes only.
      objectInfo: 'server'
    })

    await this.page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(this.panel).toBeVisible({ timeout: PANEL_MOUNT_TIMEOUT })
  }

  async sendPrompt(turn = 0): Promise<void> {
    const { content } = this.conversation.turns[turn].request
    const composer = this.panel.getByRole('textbox', {
      name: /^Describe ideas/
    })
    await composer.fill(content)
    await this.panel.getByRole('button', { name: SEND_LABEL }).click()
    await expect.poll(() => this.postedMessages.length).toBeGreaterThan(turn)
    expect(this.postedMessages[turn]).toContain(content)
    // Replay frames are dropped until the page has applied the ack's thread id.
    // useAgentSession records the user turn straight after storing that id, so
    // the rendered turn says the ack landed without reading private storage.
    await expect(this.panel.getByText(content).first()).toBeVisible()
  }

  async replayResponse(turn = 0): Promise<void> {
    const startedAt = Date.now()
    const entries = this.conversation.turns[turn].response.entries()
    for (const [index, entry] of entries) {
      // A timer can fire a millisecond early, so wait until the offset has really passed.
      while (
        this.replayTiming === 'recorded' &&
        entry.at_ms !== undefined &&
        Date.now() - startedAt < entry.at_ms
      )
        await new Promise((resolve) =>
          setTimeout(resolve, entry.at_ms! - (Date.now() - startedAt))
        )
      if (entry.kind === 'event') this.send(this.stampTurn(entry.event, turn))
      else {
        await this.waitForSubscribe()
        this.send(this.host.apply(entry.ops))
      }
      // The recorded turn was stopped here, so the panel stops here too.
      if (index === this.conversation.turns[turn].cancel_after)
        await this.stopTurn()
    }
  }

  async runTurns(): Promise<void> {
    for (const turn of this.conversation.turns.keys()) {
      await this.sendPrompt(turn)
      await this.replayResponse(turn)
      await this.waitForTurnComplete()
    }
  }

  // Everything the recording played through the given turn (all turns by default).
  private entries(throughTurn?: number): AgentConversationTurn['response'] {
    const last = throughTurn === undefined ? undefined : throughTurn + 1
    return this.conversation.turns
      .slice(0, last)
      .flatMap((turn) => turn.response)
  }

  // The thread and message the ack handed the panel for this turn.
  cancelTarget(turn = 0): { threadId: string; messageId: string } {
    return { threadId: THREAD_ID, messageId: turnId(turn) }
  }

  async stopTurn(): Promise<void> {
    await this.panel.getByRole('button', { name: STOP_LABEL }).click()
  }

  async waitForTurnComplete(): Promise<void> {
    await expect(
      this.panel.getByRole('button', { name: SEND_LABEL })
    ).toBeVisible()
    await expect(
      this.panel.getByRole('button', { name: STOP_LABEL })
    ).toHaveCount(0)
  }

  // Doc-id filter: a stray template node must not pin the template here.
  private nodeBodies(throughTurn?: number): NodeBody[] {
    const seed = this.conversation.workflow.seed.nodes as NodeBody[]
    const added = this.entries(throughTurn).flatMap((entry) =>
      entry.kind === 'graph_ops'
        ? entry.ops.flatMap((op) =>
            op.op === 'add_node' ? [op.node as NodeBody] : []
          )
        : []
    )
    return [...seed, ...added]
  }

  // One row per recorded tool call; failed when the recording reported an
  // error status for it. The panel's own grouping and coalescing rules are the
  // thing under test, so they are not reproduced here.
  recordedToolCalls(throughTurn?: number): RecordedToolCall[] {
    const calls = new Map<string, RecordedToolCall>()
    for (const entry of this.entries(throughTurn)) {
      if (entry.kind !== 'event' || entry.event.type !== 'agent_tool_call')
        continue
      const { tool_call_id: callId, status } = entry.event.data
      const call = calls.get(callId) ?? { callId, failed: false }
      if (status === 'error') call.failed = true
      calls.set(callId, call)
    }
    return [...calls.values()]
  }

  // Last write wins per widget; the rendered control shows only the final value.
  recordedWidgetValues(throughTurn?: number): RecordedWidgetValue[] {
    const graph = this.host.graph()
    const latest = new Map<string, RecordedWidgetValue>()
    for (const entry of this.entries(throughTurn)) {
      if (entry.kind !== 'graph_ops') continue
      for (const op of entry.ops) {
        if (op.op !== 'set_widget') continue
        const nodeId = String(op.node_id)
        const widget = op.widget
        const widgets = graph.nodes[nodeId]?.widgets as
          | Record<string, unknown>
          | undefined
        const value = widgets?.[widget]
        if (typeof value === 'string' || typeof value === 'number')
          latest.set(`${nodeId}/${widget}`, { nodeId, widget, value })
      }
    }
    return [...latest.values()]
  }

  addedNodeIds(throughTurn?: number): string[] {
    const graph = this.host.graph()
    const seedIds = new Set(
      this.conversation.workflow.seed.nodes.map((node) => String(node.id))
    )
    return this.nodeBodies(throughTurn)
      .map((body) => String(body.id))
      .filter((id) => !seedIds.has(id) && id in graph.nodes)
  }

  removedNodeIds(throughTurn?: number): string[] {
    const graph = this.host.graph()
    return this.nodeBodies(throughTurn)
      .map((body) => String(body.id))
      .filter((id) => !(id in graph.nodes))
  }

  hostGraph(): GraphSnapshot {
    return this.host.graph()
  }

  documentNodeIds(): string[] {
    return Object.keys(this.host.graph().nodes).sort((a, b) =>
      compareNodeIds(toNodeId(a), toNodeId(b))
    )
  }

  // The assistant text a turn recorded, concatenated as the panel streams it.
  recordedAssistantText(turn: number): string {
    return this.conversation.turns[turn].response
      .flatMap((entry) =>
        entry.kind === 'event' && entry.event.type === 'agent_message_delta'
          ? [entry.event.data.delta]
          : []
      )
      .join('')
  }

  // Every concrete connect whose endpoints survive in the document, with the
  // target marked when it is a widget-backed input: those render no slot row
  // on an uncollapsed node (NodeSlots.vue), so only the origin can be asserted
  // for them. A grown connect names no to_slot and is skipped.
  recordedConnects(throughTurn?: number): RecordedConnect[] {
    const present = new Set(Object.keys(this.host.graph().nodes))
    const bodies = this.nodeBodies(throughTurn)
    return this.entries(throughTurn)
      .flatMap((entry) =>
        entry.kind === 'graph_ops'
          ? entry.ops.flatMap((op) =>
              op.op === 'connect' && op.grow == null
                ? [
                    {
                      fromNode: String(op.from_node),
                      fromSlot: op.from_slot,
                      toNode: String(op.to_node),
                      toSlot: op.to_slot,
                      targetWidgetBacked:
                        bodies.find(
                          (body) => String(body.id) === String(op.to_node)
                        )?.inputs?.[op.to_slot]?.widget != null
                    }
                  ]
                : []
            )
          : []
      )
      .filter(
        (connect) =>
          present.has(connect.fromNode) && present.has(connect.toNode)
      )
  }

  async renderedNodeIds(): Promise<string[]> {
    const ids = await this.page
      .locator('[data-node-id]')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-node-id') ?? '')
      )
    // Three components emit data-node-id, so one node can appear twice.
    return [...new Set(ids.filter((id) => id !== ''))].sort((a, b) =>
      compareNodeIds(toNodeId(a), toNodeId(b))
    )
  }

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute({ threads: [] }))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        this.postedMessages.push(request.postData() ?? '')
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            thread_id: THREAD_ID,
            message_id: turnId(this.postedMessages.length - 1),
            workflow_id: this.conversation.workflow.id
          })
        })
      }
      const history: AgentMessages = []
      return route.fulfill(jsonRoute(history))
    })
    await page.route('**/api/agent/threads/*/messages/*/cancel', (route) => {
      const target = /\/threads\/([^/]+)\/messages\/([^/]+)\/cancel/.exec(
        route.request().url()
      )
      if (target)
        this.cancelRequests.push({
          threadId: target[1],
          messageId: target[2]
        })
      const cancelled: AgentCancelAccepted = { status: 'cancelling' }
      return route.fulfill(jsonRoute(cancelled))
    })
    await page.route('**/api/workflows**', (route) =>
      route.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
        })
      )
    )
  }

  private stampTurn(event: RecordedWsEvent, turn: number): AgentWsEvent {
    const stamped = {
      type: event.type,
      data: { ...event.data, message_id: turnId(turn), thread_id: THREAD_ID }
    }
    const parsed = parseAgentWsEvent(stamped)
    if (!parsed.success)
      throw new Error(
        `recorded ${event.type} frame is not a valid agent event: ${parsed.error.message}`
      )
    return parsed.data
  }

  private send(frame: AgentWsEvent | HostFrame): void {
    // Every host frame must satisfy production's own parser, so a host that
    // stopped emitting a required field fails here, not silently on the client.
    if (
      (frame.type.startsWith('doc_') || frame.type === 'awareness') &&
      parseServerDocFrame(frame) === null
    )
      throw new Error(`host frame ${frame.type} is not a valid doc frame`)
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    this.socket.send(JSON.stringify(frame))
  }

  outboundOps(): { op?: unknown }[] {
    return this.clientFrames
      .filter((frame) => frame.type === 'doc_ops')
      .flatMap((frame) => {
        const ops = (frame.data as { ops?: unknown } | undefined)?.ops
        return Array.isArray(ops) ? (ops as { op?: unknown }[]) : []
      })
  }

  private onClientFrame(raw: string | Buffer): void {
    const frame: unknown = JSON.parse(raw.toString())
    if (typeof frame !== 'object' || frame === null) return
    const { type, data } = frame as { type?: unknown; data?: unknown }
    this.clientFrames.push({ type, data })
    if (type === 'doc_ops' && typeof data === 'object' && data !== null) {
      // The client keeps one op batch in flight until the host acks it.
      const { workflow_id, ops } = data as {
        workflow_id?: unknown
        ops?: unknown
      }
      if (workflow_id === this.conversation.workflow.id && Array.isArray(ops)) {
        // The applier validates each payload; the wire frame only guarantees an array.
        const { applied, update } = this.host.applyClient(ops as Op[])
        this.send({
          type: 'doc_ops_result',
          data: {
            v: DOC_PROTOCOL_VERSION,
            workflow_id,
            ok: true,
            applied,
            skipped: []
          }
        })
        // An accepted batch also reaches subscribers as an authoritative
        // doc_update. Without it the follower never sees its own ops come back,
        // and later host deltas cannot fill the gap because they are encoded
        // from a state vector that already includes them.
        this.send(update)
      }
      return
    }
    if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
      return
    const { workflow_id, state_vector_b64 } = data as {
      workflow_id?: unknown
      state_vector_b64?: unknown
    }
    if (
      workflow_id !== this.conversation.workflow.id ||
      typeof state_vector_b64 !== 'string'
    )
      return
    this.send(this.host.subscribed())
    this.send(this.host.catchUp(state_vector_b64))
    this.resolveSubscribed?.()
  }

  private async waitForSubscribe(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              'the follower never subscribed to the conversation workflow; graph_ops need an agent_active_tab (or a bound tab) first'
            )
          ),
        SUBSCRIBE_TIMEOUT
      )
    })
    try {
      await Promise.race([this.subscribed, timeout])
    } finally {
      clearTimeout(timer)
    }
  }
}

export type ReplayTiming = 'immediate' | 'recorded'

function defaultReplayTiming(): ReplayTiming {
  const value = process.env.AGENT_REPLAY_TIMING
  if (value === undefined || value === 'immediate') return 'immediate'
  if (value === 'recorded') return 'recorded'
  throw new Error(
    `AGENT_REPLAY_TIMING must be immediate or recorded, got ${value}`
  )
}

interface ConversationFixtures {
  conversationCase: string
  // 'recorded' replays the fixture's at_ms gaps; the default follows AGENT_REPLAY_TIMING.
  replayTiming: ReplayTiming
  agentConversation: AgentConversationHarness
}

// Wide enough to keep the whole seed graph beside the docked panel; the video follows the viewport instead of Playwright's 800px cap.
const VIEWPORT = { width: 2560, height: 1440 }

export const agentConversationTest = agentTest.extend<ConversationFixtures>({
  conversationCase: ['', { option: true }],
  replayTiming: [defaultReplayTiming(), { option: true }],
  viewport: VIEWPORT,
  video: {
    mode:
      process.env.PLAYWRIGHT_LOCAL || process.env.RECORD_VIDEO === 'true'
        ? 'on'
        : 'off',
    size: VIEWPORT
  },
  agentConversation: async (
    { page, agentFlagEnabled, conversationCase, replayTiming },
    use
  ) => {
    if (conversationCase.length === 0)
      throw new Error('test.use({ conversationCase }) names the conversation')
    const harness = new AgentConversationHarness(
      page,
      loadAgentConversation(conversationCase),
      replayTiming
    )
    await harness.boot(agentFlagEnabled)
    await use(harness)
  }
})
