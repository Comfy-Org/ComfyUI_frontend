import type { APIRequestContext, Locator, Page } from '@playwright/test'

import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  AGENT_NODE_IDS,
  emptySeed
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockSavedWorkflowPersistence } from '@e2e/fixtures/utils/savedWorkflowPersistence'

const WORKFLOW_ID = '5a41f0b2-9c6e-4a71-8f03-2b6de4c10001'
const THREAD_ID = '5a41f0b2-9c6e-4a71-8f03-2b6de4c10002'
const FIRST_MESSAGE_ID = '5a41f0b2-9c6e-4a71-8f03-2b6de4c10003'
const SECOND_MESSAGE_ID = '5a41f0b2-9c6e-4a71-8f03-2b6de4c10004'
const NODE_IDS = [AGENT_NODE_IDS[0], AGENT_NODE_IDS[1]] as const
const AGENT_PROMPTS = ['agent prompt one', 'agent prompt two'] as const
const HUMAN_PROMPTS = ['human prompt one', 'human prompt two'] as const
const CLASS_TYPE = 'CLIPTextEncode'
const SAVED_NAME = 'pm-2392-offline-edit'

const catalog: WidgetCatalog = {
  types: { [CLASS_TYPE]: { widget_order: ['text'] } }
}

type SavedWorkflow = Awaited<ReturnType<typeof mockSavedWorkflowPersistence>>

class AgentOfflineEditScenario {
  public readonly agentPrompts = AGENT_PROMPTS
  public readonly humanPrompts = HUMAN_PROMPTS

  private readonly comfyPage: ComfyPage
  private readonly panel: AgentPanel
  private readonly topbar: Topbar

  constructor(
    private readonly page: Page,
    request: APIRequestContext,
    private readonly host: HostDoc,
    private readonly hostSocket: AgentFollowerHostSocket,
    private readonly saved: SavedWorkflow,
    private readonly posts: AgentPostMessageRequest[]
  ) {
    this.comfyPage = new ComfyPage(page, request)
    this.panel = new AgentPanel(page)
    this.topbar = new Topbar(page)
  }

  addPromptNode(nodeId: number, index: number): RecordedGraphOperation {
    const pos = [120 + index * 320, 140]
    return {
      op: 'add_node',
      pos,
      node: {
        id: nodeId,
        pos,
        mode: 0,
        size: [300, 200],
        type: CLASS_TYPE,
        flags: {},
        order: index,
        inputs: [],
        outputs: [],
        properties: {},
        widgets_values: [AGENT_PROMPTS[index]]
      },
      node_id: nodeId,
      class_type: CLASS_TYPE
    }
  }

  done(messageId: string): AgentWsEvent {
    return {
      type: 'agent_message_done',
      data: { thread_id: THREAD_ID, message_id: messageId, usage: null }
    }
  }

  promptField(index: number): Locator {
    return this.comfyPage.vueNodes
      .getNodeLocator(String(NODE_IDS[index]))
      .getByLabel('text', { exact: true })
  }

  async canvasPromptValues(): Promise<string[]> {
    return await Promise.all(
      NODE_IDS.map((_, index) => this.promptField(index).inputValue())
    )
  }

  documentPromptValues(): unknown[] {
    return NODE_IDS.map((nodeId) => {
      const widgets = this.host.graph().nodes[String(nodeId)]?.widgets as
        | Record<string, unknown>
        | undefined
      return widgets?.text
    })
  }

  subscribeCount(): number {
    return this.hostSocket.subscribeCount()
  }

  refusedConnectionCount(): number {
    return this.hostSocket.refusedConnectionCount()
  }

  postCount(): number {
    return this.posts.length
  }

  draftAt(index: number): string {
    return JSON.stringify(this.posts[index]?.draft ?? {})
  }

  savedContent(): string {
    return this.saved.savedContent() ?? ''
  }

  async buildAgentPromptNodes(): Promise<void> {
    await this.panel.open()
    await this.panel.selectWorkflow()
    await this.panel.sendMessage('Add two prompt nodes.')
    await this.hostSocket.waitForSubscribe()
    this.hostSocket.send(
      this.host.apply([
        this.addPromptNode(NODE_IDS[0], 0),
        this.addPromptNode(NODE_IDS[1], 1)
      ])
    )
    this.hostSocket.send(this.done(FIRST_MESSAGE_ID))
  }

  async beginOutageAndRetype(): Promise<void> {
    await this.hostSocket.beginAgentOutage()
    for (const [index, value] of HUMAN_PROMPTS.entries()) {
      await this.promptField(index).fill(value)
      await this.promptField(index).press('Tab')
    }
  }

  agentRewritesFirstPrompt(): void {
    for (const revision of [1, 2, 3]) {
      this.host.apply([
        {
          op: 'set_widget',
          node_id: NODE_IDS[0],
          widget: 'text',
          value: `agent prompt written during the outage ${revision}`
        }
      ])
    }
  }

  restoreAgent(): void {
    this.hostSocket.answerSubscribesWith(() => this.host.initialSync())
    this.hostSocket.endAgentOutage()
  }

  async saveWorkflow(): Promise<void> {
    await this.topbar.saveWorkflowAs(SAVED_NAME)
  }

  async reloadSavedWorkflow(): Promise<boolean> {
    const restored = this.page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        decodeURIComponent(new URL(response.url()).pathname) ===
          `/api/userdata/workflows/${SAVED_NAME}.json`,
      { timeout: 90_000 }
    )
    await this.page.reload({ waitUntil: 'domcontentloaded' })
    await this.panel.open()
    await this.panel.selectWorkflow(SAVED_NAME)
    return (await restored).ok()
  }

  async askNextTurn(): Promise<void> {
    await this.panel.sendMessage('Which prompts am I using?')
  }
}

type AgentOfflineEditFixtures = {
  offlineEdit: AgentOfflineEditScenario
}

export const agentOfflineEditTest = agentTest.extend<AgentOfflineEditFixtures>({
  offlineEdit: async ({ page, request, agentFlagEnabled }, use) => {
    const host = new HostDoc(WORKFLOW_ID, emptySeed, catalog)
    const hostSocket = new AgentFollowerHostSocket(
      page,
      WORKFLOW_ID,
      host,
      'apply'
    )
    await page.route('**/api/object_info', (route) =>
      route.fulfill(jsonRoute(agentReplayNodeDefs))
    )
    await hostSocket.install()
    await mockAgentTurnApi(page, {
      thread_id: THREAD_ID,
      message_id: FIRST_MESSAGE_ID,
      workflow_id: WORKFLOW_ID
    })

    const posts: AgentPostMessageRequest[] = []
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      const parsed: unknown = JSON.parse(route.request().postData() ?? '{}')
      posts.push(zAgentPostMessageRequest.parse(parsed))
      return route.fulfill(
        jsonRoute({
          thread_id: THREAD_ID,
          message_id: posts.length === 1 ? FIRST_MESSAGE_ID : SECOND_MESSAGE_ID,
          workflow_id: WORKFLOW_ID
        })
      )
    })
    await bootAgentApp(page, agentFlagEnabled, {
      objectInfo: 'server',
      settings: { 'Comfy.Graph.CanvasInfo': false }
    })
    const saved = await mockSavedWorkflowPersistence(page, WORKFLOW_ID)
    const scenario = new AgentOfflineEditScenario(
      page,
      request,
      host,
      hostSocket,
      saved,
      posts
    )
    await use(scenario)
  }
})
