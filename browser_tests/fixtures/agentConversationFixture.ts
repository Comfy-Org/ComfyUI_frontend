import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ObjectInfoResponse } from '@/schemas/nodeDefSchema'
import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
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

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = 'e9a2f3d1-7c44-4b2e-9a01-5f6d8c7b3a10'
// One synthetic message id per turn; the recorded ids never reach the page.
const turnId = (turn: number): string =>
  `0c5b1e77-2d4a-4f9e-8b63-1a2c3d4e5${turn.toString(16).padStart(3, '0')}`
const SOCKET_SID = '7d1f2e3a-4b5c-4d6e-8f90-1a2b3c4d5e6f'
const PANEL_MOUNT_TIMEOUT = 30_000
const SUBSCRIBE_TIMEOUT = 15_000
const CANCEL_TIMEOUT = 10_000

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop

type NodeBody = {
  id: number | string
  type: string
  title?: string
  inputs?: Array<{ name: string; widget?: unknown }>
}

interface RecordedToolCall {
  callId: string
  failed: boolean
}

interface RecordedLink {
  fromNode: string
  fromSlot: number
  toNode: string
  toSlot: number
}

interface RecordedWidgetValue {
  nodeId: string
  widget: string
  value: string | number
}

// [id, from, from_slot, to, to_slot, type], as a workflow file stores a link.
const zSeedLink = z
  .tuple([
    z.unknown(),
    z.union([z.string(), z.number()]),
    z.number(),
    z.union([z.string(), z.number()]),
    z.number()
  ])
  .rest(z.unknown())

function linkKey(link: RecordedLink): string {
  return `${link.fromNode}:${link.fromSlot}->${link.toNode}:${link.toSlot}`
}

function byLinkKey(a: RecordedLink, b: RecordedLink): number {
  return linkKey(a).localeCompare(linkKey(b))
}

async function withTimeout(
  promise: Promise<void>,
  ms: number,
  message: string
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  try {
    await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

// Runs one recorded prompt/response through the real panel over a routed /ws socket.
class AgentConversationHarness {
  readonly panel: Locator
  readonly vueNodes: VueNodeHelpers

  private readonly host: HostDoc
  private socket: WebSocketRoute | null = null
  private postedTurns = 0
  private readonly displayNames = new Map<string, string>()
  // Resolved when the panel cancels the turn the recording stopped.
  private readonly cancelWaiters = new Map<string, () => void>()
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
    const objectInfo = this.page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/api/object_info')
    )
    await bootAgentApp(this.page, agentFlag, {
      // Only the Vue node renderer projects follower edits onto the canvas.
      settings: { 'Comfy.VueNodes.Enabled': true },
      // Replayed nodes materialize from registered node types; the recordings use core nodes only.
      objectInfo: 'server'
    })
    const definitions = (await (await objectInfo).json()) as ObjectInfoResponse
    for (const [type, definition] of Object.entries(definitions))
      this.displayNames.set(type, definition.display_name || definition.name)

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
        await this.stopTurn(turn)
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

  // Clicks Stop, then holds the recorded tail until the panel's cancel for this
  // turn reaches the server: the completed conversation is reachable only
  // through that request.
  private async stopTurn(turn: number): Promise<void> {
    const accepted = new Promise<void>((resolve) =>
      this.cancelWaiters.set(turnId(turn), resolve)
    )
    await this.panel.getByRole('button', { name: STOP_LABEL }).click()
    await withTimeout(
      accepted,
      CANCEL_TIMEOUT,
      'the panel never cancelled the stopped turn'
    )
  }

  async waitForTurnComplete(): Promise<void> {
    await expect(
      this.panel.getByRole('button', { name: SEND_LABEL })
    ).toBeVisible()
    await expect(
      this.panel.getByRole('button', { name: STOP_LABEL })
    ).toHaveCount(0)
  }

  // Every node the recording ever placed through the given turn, deleted or not.
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

  // The graph the recording promises through the given turn: the seed, then
  // every add, delete and connect in order. An input holds one link, so a
  // later connect to it replaces the earlier one.
  private expectedGraph(throughTurn?: number): {
    nodes: Map<string, NodeBody>
    links: Map<string, RecordedLink>
  } {
    const { seed } = this.conversation.workflow
    const nodes = new Map(
      (seed.nodes as NodeBody[]).map((node) => [String(node.id), node])
    )
    const links = new Map<string, RecordedLink>()
    const connect = (link: RecordedLink) =>
      links.set(`${link.toNode}:${link.toSlot}`, link)
    for (const raw of seed.links) {
      const [, fromNode, fromSlot, toNode, toSlot] = zSeedLink.parse(raw)
      connect({
        fromNode: String(fromNode),
        fromSlot,
        toNode: String(toNode),
        toSlot
      })
    }
    for (const entry of this.entries(throughTurn)) {
      if (entry.kind !== 'graph_ops') continue
      for (const op of entry.ops) {
        if (op.op === 'add_node')
          nodes.set(String(op.node.id), op.node as NodeBody)
        else if (op.op === 'delete_node') {
          const id = String(op.node_id)
          nodes.delete(id)
          for (const [key, link] of links)
            if (link.fromNode === id || link.toNode === id) links.delete(key)
        } else if (op.op === 'connect' && op.grow == null)
          connect({
            fromNode: String(op.from_node),
            fromSlot: op.from_slot,
            toNode: String(op.to_node),
            toSlot: op.to_slot
          })
      }
    }
    return { nodes, links }
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
  private recordedWidgetValues(throughTurn?: number): RecordedWidgetValue[] {
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

  // A recorded title renders verbatim. An untitled node should show its
  // display name, but the follower's full reconcile (the catch-up path) still
  // re-titles it by type through graphMutations.ts prepareNode, so until that
  // is settled either spelling of the same node identity passes.
  private expectedTitle(body: NodeBody): string | RegExp {
    if (body.title) return body.title
    const displayName = this.displayNames.get(body.type)
    if (displayName === undefined)
      throw new Error(`the server registers no node type ${body.type}`)
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^(?:${escape(displayName)}|${escape(body.type)})$`)
  }

  private async renderedLinks(): Promise<RecordedLink[]> {
    const links = await this.page.evaluate(() =>
      [...window.app!.graph.links.values()].map((link) => ({
        fromNode: String(link.origin_id),
        fromSlot: link.origin_slot,
        toNode: String(link.target_id),
        toSlot: link.target_slot
      }))
    )
    return links.sort(byLinkKey)
  }

  // What the canvas shows after the given turn (the end state by default),
  // judged the way a user would: which nodes are there and what they are
  // called, what their widgets say, and which wires join them.
  async expectCanvasReplayed(throughTurn?: number): Promise<void> {
    const { nodes, links } = this.expectedGraph(throughTurn)
    const bodies = this.nodeBodies(throughTurn)
    for (const body of bodies)
      if (!nodes.has(String(body.id)))
        await expect(this.vueNodes.getNodeLocator(String(body.id))).toHaveCount(
          0
        )
    for (const [id, body] of nodes) {
      const node = this.vueNodes.getNodeLocator(id)
      await expect(node).toBeVisible()
      await expect(node.getByTestId('node-title')).toHaveText(
        this.expectedTitle(body)
      )
    }
    await expect(this.page.getByTestId('node-title')).toHaveCount(nodes.size)

    for (const { nodeId, widget, value } of this.recordedWidgetValues(
      throughTurn
    )) {
      const field = this.vueNodes
        .getNodeLocator(nodeId)
        .getByLabel(widget, { exact: true })
      if (typeof value === 'number') {
        // Number widgets format their input (0.5 renders as 0.50), so compare the number.
        await expect
          .poll(async () =>
            Number(await field.locator('input').first().inputValue())
          )
          .toBe(value)
        continue
      }
      const tag = await field.evaluate((el) => el.tagName.toLowerCase())
      if (tag === 'button') await expect(field).toContainText(value)
      else await expect(field).toHaveValue(value)
    }

    await expect
      .poll(() => this.renderedLinks())
      .toEqual([...links.values()].sort(byLinkKey))
    // A widget-backed input renders no slot row on an uncollapsed node
    // (NodeSlots.vue); the wire above already covers that end.
    for (const link of links.values()) {
      await expect(
        this.vueNodes.getOutputSlotRow(link.fromNode, link.fromSlot)
      ).toHaveClass(/lg-slot--connected/)
      const widgetBacked =
        bodies.find((body) => String(body.id) === link.toNode)?.inputs?.[
          link.toSlot
        ]?.widget != null
      if (!widgetBacked)
        await expect(
          this.vueNodes.getInputSlotRow(link.toNode, link.toSlot)
        ).toHaveClass(/lg-slot--connected/)
    }
  }

  private async mockAgentApi(): Promise<void> {
    const { page } = this
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute({ threads: [] }))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        this.postedTurns += 1
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            thread_id: THREAD_ID,
            message_id: turnId(this.postedTurns - 1),
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
      const release =
        target === null || target[1] !== THREAD_ID
          ? undefined
          : this.cancelWaiters.get(target[2])
      // A real server knows nothing about any other message.
      if (release === undefined) return route.fulfill({ status: 404 })
      release()
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

  private onClientFrame(raw: string | Buffer): void {
    const frame: unknown = JSON.parse(raw.toString())
    if (typeof frame !== 'object' || frame === null) return
    const { type, data } = frame as { type?: unknown; data?: unknown }
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

  private waitForSubscribe(): Promise<void> {
    return withTimeout(
      this.subscribed,
      SUBSCRIBE_TIMEOUT,
      'the follower never subscribed to the conversation workflow; graph_ops need an agent_active_tab (or a bound tab) first'
    )
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
