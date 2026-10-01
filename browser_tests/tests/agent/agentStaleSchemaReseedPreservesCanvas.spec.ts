import type { Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
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
  readonly resetSubscribeReceived = deferred()
  readonly releaseCatchUp = deferred()
  subscribeCount = 0
  reseedCount = 0
  private readonly host = new HostDoc(
    WORKFLOW_ID,
    CANVAS as WorkflowJSON,
    CATALOG
  )
  private socket: WebSocketRoute | null = null

  async install(page: Page): Promise<void> {
    await page.routeWebSocket(/\/ws/, (socket) => {
      this.socket = socket
      socket.onMessage((raw) => this.onMessage(raw))
    })
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

  private onSubscribe(data: Record<string, unknown>): void {
    this.subscribeCount++
    if (this.subscribeCount < 3) {
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
      return
    }
    const stateVector = data.state_vector_b64
    if (typeof stateVector !== 'string')
      throw new Error('reset subscribe omitted its state vector')
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
    void this.releaseReseedResult.promise.then(() =>
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
    )
  }
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
      await expect(visibleNodes[0]).toBeVisible()
      await expect(visibleNodes[1]).toBeVisible()
      expect(host.reseedCount).toBe(1)
      expect(host.subscribeCount).toBe(3)
    })
  }
)
