import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import { applyOps, mint, readGraph } from '@comfyorg/comfy-multi-player'
import type { GraphSnapshot,WidgetCatalog,WorkflowJSON } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'
import type {
  AgentCancelAccepted,
  AgentMessages,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseAgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest, bootAgentApp } from '@e2e/fixtures/agentPanelFixture'
import type {
  AgentConversation,
  RecordedWsEvent
} from '@e2e/fixtures/data/agent/agentConversation'
import { loadAgentConversation } from '@e2e/fixtures/data/agent/agentConversation'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const THREAD_ID = 'e9a2f3d1-7c44-4b2e-9a01-5f6d8c7b3a10'
const TURN_ID = '0c5b1e77-2d4a-4f9e-8b63-1a2c3d4e5f60'
// useAgentSession.ts keeps THREAD_STORAGE_KEY module-private.
const THREAD_STORAGE_KEY = 'Comfy.Agent.ThreadId'
const SOCKET_SID = '7d1f2e3a-4b5c-4d6e-8f90-1a2b3c4d5e6f'
const HOST_ACTOR = 'agent:comfy'
const DOC_PROTOCOL_VERSION = 1
const PANEL_MOUNT_TIMEOUT = 30_000
const SUBSCRIBE_TIMEOUT = 15_000

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop

interface DocFrame {
  type: 'doc_subscribed' | 'doc_update' | 'doc_ops_result'
  data: Record<string, unknown>
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'))
}

class HostDoc {
  private readonly doc: Y.Doc
  private seq = 1

  constructor(
    private readonly workflowId: string,
    seed: WorkflowJSON,
    private readonly catalog: WidgetCatalog
  ) {
    this.doc = mint(seed, catalog)
  }

  graph(): GraphSnapshot {
    return readGraph(this.doc)
  }

  subscribed(): DocFrame {
    return {
      type: 'doc_subscribed',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        ok: true,
        seq: this.seq
      }
    }
  }

  catchUp(stateVectorB64: string): DocFrame {
    const update = Y.encodeStateAsUpdate(this.doc, fromBase64(stateVectorB64))
    return this.updateFrame(update, HOST_ACTOR, [])
  }

  apply(operations: GraphOperation[]): DocFrame {
    const before = Y.encodeStateVector(this.doc)
    const ops = mintWireOps(operations, {
      actor: HOST_ACTOR,
      baseVersion: this.seq
    })
    const result = applyOps(this.doc, ops, this.catalog)
    const rejected = result.outcomes.filter((o) => o.outcome !== 'applied')
    if (rejected.length > 0)
      throw new Error(
        `conversation graph_ops did not apply: ${JSON.stringify(rejected)}`
      )
    this.seq += 1
    return this.updateFrame(
      Y.encodeStateAsUpdate(this.doc, before),
      HOST_ACTOR,
      ops.map((op) => op.op_id)
    )
  }

  private updateFrame(
    update: Uint8Array,
    actor: string,
    opIds: string[]
  ): DocFrame {
    return {
      type: 'doc_update',
      data: {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: this.workflowId,
        seq: this.seq,
        update_b64: toBase64(update),
        actor,
        op_ids: opIds
      }
    }
  }
}

interface GraphNodeSnapshot {
  id: string
  title: string
  inputs: boolean[]
  outputs: boolean[]
}

// Runs one recorded prompt/response through the real panel over a routed /ws socket.
class AgentConversationHarness {
  readonly postedMessages: string[] = []
  // Human-op minting is observable only on the client side of the socket.
  readonly clientFrames: { type?: unknown; data?: unknown }[] = []
  readonly panel: Locator
  readonly ack: AgentTurnAccepted

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
    this.ack = {
      thread_id: THREAD_ID,
      message_id: TURN_ID,
      workflow_id: workflow.id
    }
    this.panel = page.locator('#agent-panel-root')
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
      settings: { 'Comfy.VueNodes.Enabled': true }
    })

    await this.page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(this.panel).toBeVisible({ timeout: PANEL_MOUNT_TIMEOUT })
  }

  async sendPrompt(): Promise<void> {
    const { content } = this.conversation.request
    const composer = this.panel.getByRole('textbox', {
      name: /^Describe ideas/
    })
    await composer.fill(content)
    await this.panel.getByRole('button', { name: SEND_LABEL }).click()
    await expect.poll(() => this.postedMessages.length).toBeGreaterThan(0)
    expect(this.postedMessages[0]).toContain(content)
    // Replay frames are dropped until the page has applied the ack's thread id.
    await expect
      .poll(() =>
        this.page.evaluate(
          (key) => localStorage.getItem(key),
          THREAD_STORAGE_KEY
        )
      )
      .toBe(THREAD_ID)
  }

  async replayResponse(): Promise<void> {
    const startedAt = Date.now()
    for (const entry of this.conversation.response) {
      if (this.replayTiming === 'recorded' && entry.at_ms !== undefined) {
        const wait = entry.at_ms - (Date.now() - startedAt)
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      }
      if (entry.kind === 'event') {
        this.send(this.stampTurn(entry.event))
        continue
      }
      await this.waitForSubscribe()
      this.send(this.host.apply(entry.ops))
    }
    this.replayElapsedMs = Date.now() - startedAt
  }

  replayElapsedMs = 0

  async waitForTurnComplete(): Promise<void> {
    await expect(
      this.panel.getByRole('button', { name: SEND_LABEL })
    ).toBeVisible()
    await expect(
      this.panel.getByRole('button', { name: STOP_LABEL })
    ).toHaveCount(0)
  }

  // Doc-id filter: a stray template node must not pin the template here.
  hostGraph(): GraphSnapshot {
    return this.host.graph()
  }

  async graphSnapshot(): Promise<GraphNodeSnapshot[]> {
    const docNodeIds = new Set(Object.keys(this.host.graph().nodes))
    const snapshot = await this.page
      .locator('[data-node-id]')
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const connected = (selector: string) =>
            Array.from(node.querySelectorAll(selector)).map((slot) =>
              slot.classList.contains('lg-slot--connected')
            )
          return {
            id: node.getAttribute('data-node-id') ?? '',
            title:
              node
                .querySelector('[data-testid="node-title"]')
                ?.textContent?.trim() ?? '',
            inputs: connected('.lg-slot--input'),
            outputs: connected('.lg-slot--output')
          }
        })
      )
    return snapshot
      .filter((node) => docNodeIds.has(node.id))
      .sort((a, b) => Number(a.id) - Number(b.id))
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
          body: JSON.stringify(this.ack)
        })
      }
      const history: AgentMessages = []
      return route.fulfill(jsonRoute(history))
    })
    await page.route('**/api/agent/threads/*/messages/*/cancel', (route) => {
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

  private stampTurn(event: RecordedWsEvent): AgentWsEvent {
    const stamped = {
      type: event.type,
      data: { ...event.data, message_id: TURN_ID, thread_id: THREAD_ID }
    }
    const parsed = parseAgentWsEvent(stamped)
    if (!parsed.success)
      throw new Error(
        `recorded ${event.type} frame is not a valid agent event: ${parsed.error.message}`
      )
    return parsed.data
  }

  private send(frame: AgentWsEvent | DocFrame): void {
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
        const applied = ops
          .map((op) => (op as { op_id?: unknown }).op_id)
          .filter((id): id is string => typeof id === 'string')
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

export const agentConversationTest = agentTest.extend<ConversationFixtures>({
  conversationCase: ['', { option: true }],
  replayTiming: [defaultReplayTiming(), { option: true }],
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
