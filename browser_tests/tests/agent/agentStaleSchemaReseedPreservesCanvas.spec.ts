import type { Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  agentTest as test,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

const WORKFLOW_ID = 'c9a1e5c2-4f3b-4a8e-9d2f-6b7a8c9d0e2f'
const THREAD_ID = 'e2b3c4d5-6f7a-4b8c-9d0e-1f2a3b4c5d7e'
const MESSAGE_ID = 'f3c4d5e6-7a8b-4c9d-0e1f-2a3b4c5d7e8f'
const NODE_IDS = [601, 602]
/**
 * A node the re-minted document holds and this tab's canvas never had, added
 * by the host between the reseed and the catch-up.
 *
 * It exists to make the catch-up leg falsifiable. Without it the final
 * assertions only re-assert the two nodes that were already on screen before
 * the round trip, and `toBeVisible()` resolves on its first poll against
 * them — so the test passed unchanged when the host was mutated to never send
 * the catch-up frame at all. Waiting for THIS node is a barrier that cannot
 * be crossed until the catch-up has arrived and been projected, which is what
 * lets the two surviving-node assertions after it mean anything.
 */
const CATCH_UP_NODE_ID = 603

const CANVAS: ComfyWorkflowJSON = {
  last_node_id: NODE_IDS[1],
  last_link_id: 0,
  nodes: NODE_IDS.map((id, order) => ({
    id,
    type: 'MarkdownNote',
    pos: [order * 300, 0],
    size: [200, 100],
    flags: {},
    order,
    mode: 0,
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: [`visible node ${order + 1}`]
  })),
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

const CATALOG: WidgetCatalog = { types: {} }

const CATCH_UP_ADD: RecordedGraphOperation = {
  op: 'add_node',
  node_id: CATCH_UP_NODE_ID,
  class_type: 'MarkdownNote',
  pos: [0, 240],
  node: {
    id: CATCH_UP_NODE_ID,
    type: 'MarkdownNote',
    pos: [0, 240],
    size: [200, 100],
    flags: {},
    order: NODE_IDS.length,
    mode: 0,
    inputs: [],
    outputs: [],
    properties: {},
    widgets_values: ['arrived with the catch-up']
  }
}

interface ClientFrame {
  type: string
  data: Record<string, unknown>
}

function parseClientFrame(raw: Buffer | string): ClientFrame | null {
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
  return { type, data: data as Record<string, unknown> }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

class StaleSchemaHost {
  readonly reseedReceived = deferred()
  readonly releaseReseedResult = deferred()
  readonly repeatRefusalSent = deferred()
  readonly resetSubscribeReceived = deferred()
  readonly releaseCatchUp = deferred()
  subscribeCount = 0
  reseedCount = 0
  private reseedAnswered = false
  private readonly host = new HostDoc(
    WORKFLOW_ID,
    CANVAS as WorkflowJSON,
    CATALOG
  )
  private socket: WebSocketRoute | null = null

  /**
   * `refuseUntilReseedAnswered` models a host that keeps refusing for as long
   * as the stored document is unreadable, rather than for a fixed number of
   * subscribes. That is what lets a test drive a SECOND subscribe while the
   * first `doc_reseed` is still in flight — the window a follower must not
   * send a second whole canvas in.
   */
  constructor(private readonly refuseUntilReseedAnswered = false) {}

  async install(page: Page): Promise<void> {
    await page.routeWebSocket(/\/ws/, (socket) => {
      this.socket = socket
      socket.onMessage((raw) => this.onMessage(raw))
    })
  }

  /**
   * Any socket activity re-drives subscription intent. A stale-schema refusal
   * nulls the bridge's send REALITY, so this alone is enough to put another
   * `doc_subscribe` on the wire — no ack timeout needed.
   */
  sendStatus(): void {
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    this.socket.send(
      JSON.stringify({
        type: 'status',
        data: { status: { exec_info: { queue_remaining: 0 } } }
      })
    )
  }

  private send(frame: AgentWsEvent | HostFrame): void {
    if (
      (frame.type.startsWith('doc_') || frame.type === 'awareness') &&
      parseServerDocFrame(frame) === null
    )
      throw new Error(`frame ${frame.type} is not a valid doc frame`)
    if (!this.socket) throw new Error('the app has not opened /ws yet')
    this.socket.send(JSON.stringify(frame))
  }

  private onMessage(raw: Buffer | string): void {
    const frame = parseClientFrame(raw)
    if (frame?.data.workflow_id !== WORKFLOW_ID) return
    if (frame.type === 'doc_subscribe') this.onSubscribe(frame.data)
    if (frame.type === 'doc_reseed') this.onReseed(frame.data)
  }

  private stillRefusing(): boolean {
    return this.refuseUntilReseedAnswered
      ? !this.reseedAnswered
      : this.subscribeCount < 3
  }

  private onSubscribe(data: Record<string, unknown>): void {
    this.subscribeCount++
    if (this.stillRefusing()) {
      this.send({
        type: 'doc_subscribed',
        data: {
          v: 1,
          workflow_id: WORKFLOW_ID,
          ok: false,
          code: 'stale_schema_reseed_required',
          expected_seq: 7
        }
      })
      if (this.subscribeCount >= 2) this.repeatRefusalSent.resolve()
      return
    }
    const stateVector = data.state_vector_b64
    if (typeof stateVector !== 'string')
      throw new Error('reset subscribe omitted its state vector')
    // Applied BEFORE the ack so the ack's seq matches the single catch-up
    // frame that follows, which is what makes that frame the subscribe's own
    // catch-up rather than a live update arriving behind it.
    this.host.apply([CATCH_UP_ADD])
    this.send(this.host.subscribed())
    this.resetSubscribeReceived.resolve()
    void this.releaseCatchUp.promise.then(() =>
      this.send(this.host.catchUp(stateVector))
    )
  }

  private onReseed(data: Record<string, unknown>): void {
    this.reseedCount++
    if (this.reseedCount > 1)
      throw new Error('one stale-schema refusal triggered multiple reseeds')
    const workflow = data.workflow
    if (typeof workflow !== 'object' || workflow === null)
      throw new Error('doc_reseed omitted its workflow')
    const nodes = (workflow as { nodes?: unknown }).nodes
    expect(Array.isArray(nodes) ? nodes.map((node) => node.id) : []).toEqual(
      NODE_IDS
    )
    this.reseedReceived.resolve()
    void this.releaseReseedResult.promise.then(() => {
      this.reseedAnswered = true
      this.send({
        type: 'doc_reseed_result',
        data: {
          v: 1,
          workflow_id: WORKFLOW_ID,
          ok: true,
          seq: 8,
          outcome: 'reseeded'
        }
      })
    })
  }
}

async function bootWithHost(page: Page, host: StaleSchemaHost): Promise<void> {
  await host.install(page)
  await bootAgentApp(page, true, {
    settings: {
      'Comfy.VueNodes.Enabled': true,
      'Comfy.Graph.CanvasInfo': false
    },
    beforeNavigate: async (page) => {
      await mockAgentTurnApi(page, {
        message_id: MESSAGE_ID,
        thread_id: THREAD_ID,
        workflow_id: WORKFLOW_ID
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)
    }
  })
  await loadIntoBootWorkflow(page, CANVAS)
}

test.describe(
  'Agent stale-schema recovery',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('keeps the visible canvas through refusal, reseed, reset and catch-up', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const host = new StaleSchemaHost()
      const vueNodes = new VueNodeHelpers(page)
      await bootWithHost(page, host)

      const visibleNodes = NODE_IDS.map((id) =>
        vueNodes.getNodeLocator(String(id))
      )
      await expect(visibleNodes[0]).toBeVisible()
      await expect(visibleNodes[1]).toBeVisible()

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Check the workflow.')

      await host.reseedReceived.promise
      await expect(visibleNodes[0]).toBeVisible()
      await expect(visibleNodes[1]).toBeVisible()

      host.releaseReseedResult.resolve()
      await host.resetSubscribeReceived.promise
      await expect(visibleNodes[0]).toBeVisible()
      await expect(visibleNodes[1]).toBeVisible()

      host.releaseCatchUp.resolve()
      // The barrier: this node exists only in the re-minted document, so it
      // cannot appear until the catch-up has been applied. Asserting the two
      // original nodes before it would have proved nothing — they were
      // already on screen.
      await expect(
        vueNodes.getNodeLocator(String(CATCH_UP_NODE_ID))
      ).toBeVisible()
      await expect(visibleNodes[0]).toBeVisible()
      await expect(visibleNodes[1]).toBeVisible()
      expect(host.reseedCount).toBe(1)
      expect(host.subscribeCount).toBe(3)
    })

    // The window the case above never opens. A stale-schema refusal clears the
    // bridge's send REALITY, so ANY socket activity re-drives the subscribe
    // and the host — which is still holding the same unreadable document —
    // refuses it again while the first `doc_reseed` is unanswered. Treating
    // that repeat as a fresh authorization put a second whole canvas on the
    // wire against a different `expected_seq`.
    test('a repeat refusal while the reseed is unanswered sends no second canvas', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const host = new StaleSchemaHost(true)
      const vueNodes = new VueNodeHelpers(page)
      await bootWithHost(page, host)

      const visibleNodes = NODE_IDS.map((id) =>
        vueNodes.getNodeLocator(String(id))
      )
      await expect(visibleNodes[0]).toBeVisible()

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Check the workflow.')

      await host.reseedReceived.promise
      host.sendStatus()
      await host.repeatRefusalSent.promise

      host.releaseReseedResult.resolve()
      await host.resetSubscribeReceived.promise
      host.releaseCatchUp.resolve()
      await expect(
        vueNodes.getNodeLocator(String(CATCH_UP_NODE_ID))
      ).toBeVisible()
      await expect(visibleNodes[0]).toBeVisible()
      await expect(visibleNodes[1]).toBeVisible()
      // The host throws on a second `doc_reseed`, so this is belt and braces
      // for a reader; the discriminating assertion is that throw.
      expect(host.reseedCount).toBe(1)
      expect(host.subscribeCount).toBeGreaterThanOrEqual(3)
    })
  }
)
