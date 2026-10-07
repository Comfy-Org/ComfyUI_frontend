import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type {
  AgentMessages,
  AgentTurnAccepted,
  AgentWsEvent
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import {
  parseAgentWsEvent,
  zAgentTurnAccepted
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const SOCKET_SID = 'b6f0a2c1-8e34-4d21-9c07-2a1b3c4d5e60'
const SUBSCRIBE_TIMEOUT = 15_000
const EMPTY_SEED: WorkflowJSON = { nodes: [], links: [] }

const SEND_LABEL = enMessages.agent.send
const STOP_LABEL = enMessages.agent.stop
const NEW_CHAT_LABEL = enMessages.agent.newChat
const SWITCH_WORKFLOW_LABEL = enMessages.agent.switchWorkflow
const HOME_WORKFLOW_ID = '00000000-0000-4000-8000-000000000000'

export interface AgentBoundWorkflow {
  workflowId: string
  name: string
  host: HostDoc
}

interface AgentThread {
  threadId: string
  messageId: string
}

const zDocSubscribe = z.object({
  type: z.literal('doc_subscribe'),
  data: z.object({ workflow_id: z.string(), state_vector_b64: z.string() })
})

export class AgentTwoSessionCrdtHarness {
  readonly topbar: Topbar
  private readonly panel: Locator
  private readonly agentPanel: AgentPanel
  private readonly vueNodes: VueNodeHelpers

  private readonly hosts = new Map<string, HostDoc>()
  private readonly subscribes = new Map<string, number>()
  private socket: WebSocketRoute | null = null
  private threadCounter = 0
  private readonly droppedSubscribes: string[] = []

  constructor(private readonly page: Page) {
    this.agentPanel = new AgentPanel(page)
    this.panel = this.agentPanel.root
    this.vueNodes = new VueNodeHelpers(page)
    this.topbar = new Topbar(page)
  }

  addEmptyWorkflow(
    workflowId: string,
    name: string,
    catalog: WidgetCatalog
  ): AgentBoundWorkflow {
    const host = new HostDoc(workflowId, EMPTY_SEED, catalog)
    this.hosts.set(workflowId, host)
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
    const objectInfoLoaded = this.page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/api/object_info')
    )
    await Promise.all([
      objectInfoLoaded,
      bootAgentApp(this.page, true, {
        settings: { 'Comfy.Graph.CanvasInfo': false },
        objectInfo: 'server'
      })
    ])
    await this.agentPanel.open()
    await this.selectHomeTarget()
  }

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

  private async startThread(prompt: string): Promise<AgentThread> {
    const posted = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/agent\/threads\/[^/]+\/messages$/.test(
          new URL(response.url()).pathname
        )
    )
    await this.panel.getByRole('textbox').fill(prompt)
    await this.panel.getByRole('button', { name: SEND_LABEL }).click()
    const ack = zAgentTurnAccepted.parse(await (await posted).json())
    await expect(this.panel.getByText(prompt).first()).toBeVisible()
    return { threadId: ack.thread_id, messageId: ack.message_id }
  }

  private async bindViaActiveTab(
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
    await this.waitForSubscribe(bound, before + 1)
  }

  private async finishTurn(thread: AgentThread): Promise<void> {
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

  async newChat(): Promise<void> {
    await this.panel.getByRole('button', { name: NEW_CHAT_LABEL }).click()
    await expect(this.panel.getByRole('textbox')).toHaveText('')
  }

  hostEdit(bound: AgentBoundWorkflow, ops: RecordedGraphOperation[]): void {
    this.send(bound.host.apply(ops))
  }

  async canvasNodeIds(): Promise<string[]> {
    return (await this.vueNodes.getNodeIds()).sort(
      (left, right) => Number(left) - Number(right)
    )
  }

  async canvasNodeIdsWhenSettled(
    expected: readonly string[],
    timeout: number
  ): Promise<string[]> {
    let observed: string[] | undefined
    try {
      await expect
        .poll(
          async () => {
            observed = await this.canvasNodeIds()
            return observed
          },
          { timeout }
        )
        .toEqual(expected)
    } catch (error) {
      if (observed === undefined) throw error
    }
    return observed ?? []
  }

  private subscribeCount(workflowId: string): number {
    return this.subscribes.get(workflowId) ?? 0
  }

  private async waitForSubscribe(
    { workflowId, name }: AgentBoundWorkflow,
    target: number
  ): Promise<void> {
    try {
      await expect
        .poll(() => this.subscribeCount(workflowId), {
          timeout: SUBSCRIBE_TIMEOUT
        })
        .toBeGreaterThanOrEqual(target)
    } catch {
      const label = `${name} (${workflowId})`
      const dropped = this.droppedSubscribes.length
        ? `; dropped: ${this.droppedSubscribes.join('; ')}`
        : ''
      throw new Error(`follower never subscribed ${label}${dropped}`)
    }
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
    const subscribe = zDocSubscribe.safeParse(JSON.parse(raw.toString()))
    if (!subscribe.success) return
    const { workflow_id: workflowId, state_vector_b64: stateVector } =
      subscribe.data.data
    const host = this.hosts.get(workflowId)
    if (host === undefined) {
      this.droppedSubscribes.push(
        `doc_subscribe for ${workflowId}, which no host serves`
      )
      return
    }
    try {
      this.send(host.subscribed())
      this.send(host.catchUp(stateVector))
    } catch (error) {
      this.droppedSubscribes.push(
        `doc_subscribe for ${workflowId} failed to answer: ${String(error)}`
      )
      return
    }
    this.subscribes.set(workflowId, this.subscribeCount(workflowId) + 1)
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
        const accepted: AgentTurnAccepted = {
          thread_id: `thread-${this.threadCounter}`,
          message_id: `msg-${this.threadCounter}`
        }
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify(accepted)
        })
      }
      const history: AgentMessages = []
      return route.fulfill(jsonRoute(history))
    })
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
