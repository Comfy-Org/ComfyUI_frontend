import { expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'

import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import {
  AGENT_NODE_IDS,
  emptySeed
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { nextFrame } from '@e2e/fixtures/utils/timing'

const WORKFLOW_ID = '3601a000-0000-4000-8000-000000000001'
const THREAD_ID = '3601a000-0000-4000-8000-000000000002'
const FIRST_MESSAGE_ID = '3601a000-0000-4000-8000-000000000003'
const SECOND_MESSAGE_ID = '3601a000-0000-4000-8000-000000000004'
const [SAMPLER_ID, LOAD_IMAGE_ID] = AGENT_NODE_IDS
const QUESTION = 'What did I change?'

const SAMPLER_WIDGETS = [
  'seed',
  'control_after_generate',
  'steps',
  'cfg',
  'sampler_name',
  'scheduler',
  'denoise'
]
const LOAD_IMAGE_WIDGETS = ['image', 'upload']
const AGENT_IMAGE = 'agent-1.png'

interface HandSetValues {
  cfg: unknown
  steps: unknown
}

const AGENT_SET: HandSetValues = { cfg: 8, steps: 20 }
export const HAND_SET: HandSetValues = { cfg: 4.5, steps: 33 }

const catalog: WidgetCatalog = {
  types: {
    KSampler: { widget_order: SAMPLER_WIDGETS },
    LoadImage: { widget_order: LOAD_IMAGE_WIDGETS }
  }
}

const nodeDefs = {
  ...agentReplayNodeDefs,
  LoadImage: {
    ...agentReplayNodeDefs.LoadImage,
    input: {
      required: {
        image: [[AGENT_IMAGE], { image_upload: true }],
        upload: ['IMAGEUPLOAD', {}]
      }
    }
  }
}

function addSamplerNode(nodeId: number): RecordedGraphOperation {
  const pos = [700, 460]
  return {
    op: 'add_node',
    pos,
    node: {
      id: nodeId,
      pos,
      mode: 0,
      size: [320, 360],
      type: 'KSampler',
      flags: {},
      order: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: [
        0,
        'fixed',
        AGENT_SET.steps,
        AGENT_SET.cfg,
        'euler',
        'normal',
        1
      ]
    },
    node_id: nodeId,
    class_type: 'KSampler'
  }
}

function addLoadImage(nodeId: number): RecordedGraphOperation {
  const pos = [700, 880]
  return {
    op: 'add_node',
    pos,
    node: {
      id: nodeId,
      pos,
      mode: 0,
      size: [220, 300],
      type: 'LoadImage',
      flags: {},
      order: 1,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: [AGENT_IMAGE, 'image']
    },
    node_id: nodeId,
    class_type: 'LoadImage'
  }
}

function valuesFrom(
  nodes: ReadonlyArray<{ id: unknown; widgets_values?: unknown }>
): HandSetValues {
  const values = nodes.find(
    (node) => Number(node.id) === SAMPLER_ID
  )?.widgets_values
  const widgets: unknown[] = Array.isArray(values) ? values : []
  return {
    cfg: widgets[SAMPLER_WIDGETS.indexOf('cfg')],
    steps: widgets[SAMPLER_WIDGETS.indexOf('steps')]
  }
}

export function draftValues(
  post: AgentPostMessageRequest
): HandSetValues | null {
  const content: unknown = post.draft?.content
  if (typeof content !== 'object' || content === null) return null
  const nodes: unknown = 'nodes' in content ? content.nodes : undefined
  return Array.isArray(nodes) ? valuesFrom(nodes) : null
}

function done(messageId: string): AgentWsEvent {
  return {
    type: 'agent_message_done',
    data: { thread_id: THREAD_ID, message_id: messageId, usage: null }
  }
}

class AgentHandSetWidgetsScenario {
  private readonly comfyPage: ComfyPage
  private readonly panel: AgentPanel

  constructor(
    private readonly page: Page,
    request: APIRequestContext,
    private readonly host: HostDoc,
    public readonly hostSocket: AgentFollowerHostSocket,
    private readonly posts: AgentPostMessageRequest[]
  ) {
    this.comfyPage = new ComfyPage(page, request)
    this.panel = new AgentPanel(page)
  }

  questionMessage(): Locator {
    return this.panel.root.getByText(QUESTION)
  }

  canvasValues(): Promise<HandSetValues> {
    return this.page.evaluate(
      ({ samplerId }) => {
        const widget = (name: string) =>
          window
            .app!.graph.getNodeById(samplerId)
            ?.widgets?.find((candidate) => candidate.name === name)?.value
        return { cfg: widget('cfg'), steps: widget('steps') }
      },
      { samplerId: toNodeId(SAMPLER_ID) }
    )
  }

  documentValues(): HandSetValues {
    return valuesFrom(this.host.projection().nodes)
  }

  async agentBuildsNodes(): Promise<void> {
    await this.panel.open()
    await this.panel.selectWorkflow()
    await this.panel.sendMessage('Add a KSampler and a Load Image node.')
    await this.hostSocket.waitForSubscribe()
    this.hostSocket.send(
      this.host.apply([addSamplerNode(SAMPLER_ID), addLoadImage(LOAD_IMAGE_ID)])
    )
    this.hostSocket.send(done(FIRST_MESSAGE_ID))
    await expect.poll(() => this.canvasValues()).toEqual(AGENT_SET)
    await expect(this.panel.sendButton).toBeVisible()
  }

  async setWidgetsByHand(): Promise<void> {
    await this.panToSampler()
    const sampler = this.comfyPage.vueNodes.getNodeLocator(String(SAMPLER_ID))
    await this.comfyPage.vueNodes.setInputNumberValue(
      this.comfyPage.vueNodes.getWidgetRowByLabel(sampler, 'cfg'),
      String(HAND_SET.cfg)
    )
    await this.comfyPage.vueNodes.setInputNumberValue(
      this.comfyPage.vueNodes.getWidgetRowByLabel(sampler, 'steps'),
      String(HAND_SET.steps)
    )
    await expect.poll(() => this.canvasValues()).toEqual(HAND_SET)
  }

  holdCatchUp(): void {
    this.hostSocket.pauseSubscribes(WORKFLOW_ID)
  }

  releaseCatchUp(): void {
    this.hostSocket.resumeSubscribe(WORKFLOW_ID)
  }

  async askQuestion(): Promise<AgentPostMessageRequest> {
    await this.panel.sendMessage(QUESTION)
    await expect.poll(() => this.posts.length).toBe(2)
    return this.posts[1]
  }

  async finishQuestionTurn(): Promise<void> {
    this.hostSocket.send(done(SECOND_MESSAGE_ID))
    await expect(this.panel.sendButton).toBeVisible()
  }

  private async panToSampler(): Promise<void> {
    await this.page.evaluate((id) => {
      const app = window.app!
      const node = app.graph.getNodeById(id)
      if (!node) throw new Error(`node ${String(id)} is not on the canvas`)
      app.canvas.ds.scale = 1
      app.canvas.ds.offset = [160 - node.pos[0], 160 - node.pos[1]]
      app.canvas.setDirty(true, true)
    }, toNodeId(SAMPLER_ID))
    await nextFrame(this.page)
  }
}

type AgentHandSetWidgetsFixtures = {
  handSetWidgets: AgentHandSetWidgetsScenario
}

export const agentHandSetWidgetsTest =
  agentTest.extend<AgentHandSetWidgetsFixtures>({
    handSetWidgets: async ({ page, request }, use) => {
      const host = new HostDoc(WORKFLOW_ID, emptySeed, catalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        'apply'
      )
      const posts: AgentPostMessageRequest[] = []

      await page.route('**/api/object_info', (route) =>
        route.fulfill(jsonRoute(nodeDefs))
      )
      await hostSocket.install()
      await mockAgentTurnApi(page, {
        thread_id: THREAD_ID,
        message_id: FIRST_MESSAGE_ID,
        workflow_id: WORKFLOW_ID
      })
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        const parsed: unknown = JSON.parse(route.request().postData() ?? '{}')
        posts.push(zAgentPostMessageRequest.parse(parsed))
        return route.fulfill(
          jsonRoute({
            thread_id: THREAD_ID,
            message_id:
              posts.length === 1 ? FIRST_MESSAGE_ID : SECOND_MESSAGE_ID,
            workflow_id: WORKFLOW_ID
          })
        )
      })
      await page.setViewportSize({ width: 1920, height: 1280 })
      await bootAgentApp(page, true, {
        objectInfo: 'server',
        settings: { 'Comfy.Graph.CanvasInfo': false }
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)

      await use(
        new AgentHandSetWidgetsScenario(page, request, host, hostSocket, posts)
      )
    }
  })
