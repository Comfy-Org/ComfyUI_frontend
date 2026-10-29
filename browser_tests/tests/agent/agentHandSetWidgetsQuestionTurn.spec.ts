import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import {
  AGENT_NODE_IDS,
  emptySeed
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const WORKFLOW_ID = '3601a000-0000-4000-8000-000000000001'
const THREAD_ID = '3601a000-0000-4000-8000-000000000002'
const FIRST_MESSAGE_ID = '3601a000-0000-4000-8000-000000000003'
const SECOND_MESSAGE_ID = '3601a000-0000-4000-8000-000000000004'
const [SAMPLER_ID, LOAD_IMAGE_ID] = AGENT_NODE_IDS

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
const AGENT_CFG = 8
const AGENT_IMAGE = 'agent-1.png'
const HAND_CFG = 4.5
const HAND_IMAGE = 'hand-set.png'

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
        image: [[AGENT_IMAGE, HAND_IMAGE], { image_upload: true }],
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
      widgets_values: [0, 'fixed', 20, AGENT_CFG, 'euler', 'normal', 1]
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

interface HandSetValues {
  cfg: unknown
  image: unknown
}

function valuesFrom(
  nodes: ReadonlyArray<{ id: unknown; widgets_values?: unknown }>
): HandSetValues {
  const widgetsOf = (id: number): unknown[] => {
    const values = nodes.find((node) => Number(node.id) === id)?.widgets_values
    return Array.isArray(values) ? values : []
  }
  return {
    cfg: widgetsOf(SAMPLER_ID)[SAMPLER_WIDGETS.indexOf('cfg')],
    image: widgetsOf(LOAD_IMAGE_ID)[LOAD_IMAGE_WIDGETS.indexOf('image')]
  }
}

function draftValues(post: AgentPostMessageRequest): HandSetValues | null {
  const content: unknown = post.draft?.content
  if (typeof content !== 'object' || content === null) return null
  const nodes: unknown = 'nodes' in content ? content.nodes : undefined
  return Array.isArray(nodes) ? valuesFrom(nodes) : null
}

function canvasValues(page: Page): Promise<HandSetValues> {
  return page.evaluate(
    ({ samplerId, loadImageId }) => {
      const widget = (id: typeof samplerId, name: string) =>
        window
          .app!.graph.getNodeById(id)
          ?.widgets?.find((candidate) => candidate.name === name)?.value
      return {
        cfg: widget(samplerId, 'cfg'),
        image: widget(loadImageId, 'image')
      }
    },
    { samplerId: toNodeId(SAMPLER_ID), loadImageId: toNodeId(LOAD_IMAGE_ID) }
  )
}

// The canvas places agent-added nodes beside the boot workflow, often under
// the agent panel; scroll the canvas so the node sits in the open top-left.
async function panToNode(page: Page, nodeId: number): Promise<void> {
  await page.evaluate((id) => {
    const app = window.app!
    const node = app.graph.getNodeById(id)
    if (!node) throw new Error(`node ${String(id)} is not on the canvas`)
    app.canvas.ds.scale = 1
    app.canvas.ds.offset = [160 - node.pos[0], 160 - node.pos[1]]
    app.canvas.setDirty(true, true)
  }, toNodeId(nodeId))
  await nextFrame(page)
}

function parsePost(body: string | null): AgentPostMessageRequest {
  const parsed: unknown = JSON.parse(body ?? '{}')
  return zAgentPostMessageRequest.parse(parsed)
}

function done(messageId: string): AgentWsEvent {
  return {
    type: 'agent_message_done',
    data: { thread_id: THREAD_ID, message_id: messageId, usage: null }
  }
}

const handSet: HandSetValues = { cfg: HAND_CFG, image: HAND_IMAGE }

const annotation = [
  {
    type: 'issue',
    description: 'https://linear.app/comfyorg/issue/PM-2118'
  },
  {
    type: 'issue',
    description: 'https://linear.app/comfyorg/issue/FE-3601'
  }
]

test.describe(
  'Agent question-only turn after a dropped connection',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    async function setUp(page: Page, request: APIRequestContext) {
      const comfyPage = new ComfyPage(page, request)
      const host = new HostDoc(WORKFLOW_ID, emptySeed, catalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        'apply'
      )
      const panel = new AgentPanel(page)
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
        posts.push(parsePost(route.request().postData()))
        return route.fulfill(
          jsonRoute({
            thread_id: THREAD_ID,
            message_id:
              posts.length === 1 ? FIRST_MESSAGE_ID : SECOND_MESSAGE_ID,
            workflow_id: WORKFLOW_ID
          })
        )
      })
      // Room for the agent panel beside the nodes, as in the dynamic combo spec.
      await page.setViewportSize({ width: 1920, height: 1280 })
      await bootAgentApp(page, true, {
        objectInfo: 'server',
        settings: { 'Comfy.Graph.CanvasInfo': false }
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)

      const samplerNode = comfyPage.vueNodes.getNodeLocator(String(SAMPLER_ID))
      const loadImageNode = comfyPage.vueNodes.getNodeLocator(
        String(LOAD_IMAGE_ID)
      )

      async function setWidgetsByHand(): Promise<void> {
        await panToNode(page, SAMPLER_ID)
        await comfyPage.vueNodes.setInputNumberValue(
          comfyPage.vueNodes.getWidgetRowByLabel(samplerNode, 'cfg'),
          String(HAND_CFG)
        )
        await panToNode(page, LOAD_IMAGE_ID)
        await new WidgetSelectDropdownFixture(
          comfyPage.vueNodes.getWidgetRowByLabel(loadImageNode, 'image')
        ).selectOption(HAND_IMAGE)
        await expect.poll(() => canvasValues(page)).toEqual(handSet)
      }

      async function agentBuildsNodes(): Promise<void> {
        await panel.open()
        await panel.selectWorkflow()
        await panel.sendMessage('Add a KSampler and a Load Image node.')
        await hostSocket.waitForSubscribe()
        hostSocket.send(
          host.apply([addSamplerNode(SAMPLER_ID), addLoadImage(LOAD_IMAGE_ID)])
        )
        hostSocket.send(done(FIRST_MESSAGE_ID))

        await expect
          .poll(() => canvasValues(page))
          .toEqual({ cfg: AGENT_CFG, image: AGENT_IMAGE })
        await expect(panel.sendButton).toBeVisible()
      }

      async function askQuestion(): Promise<AgentPostMessageRequest> {
        await panel.sendMessage('What did I change?')
        await expect.poll(() => posts.length).toBe(2)
        return posts[1]
      }

      async function finishQuestionTurn(): Promise<void> {
        hostSocket.send(done(SECOND_MESSAGE_ID))
        await expect(panel.root.getByText('What did I change?')).toBeVisible()
        await expect(panel.sendButton).toBeVisible()
        await expect.poll(() => canvasValues(page)).toEqual(handSet)
        await expect
          .poll(() => valuesFrom(host.projection().nodes))
          .toEqual(handSet)
      }

      return {
        host,
        hostSocket,
        setWidgetsByHand,
        agentBuildsNodes,
        askQuestion,
        finishQuestionTurn
      }
    }

    test(
      'keeps widgets set by hand before the connection drops',
      { annotation },
      async ({ page, request }) => {
        test.setTimeout(60_000)
        const {
          host,
          hostSocket,
          setWidgetsByHand,
          agentBuildsNodes,
          askQuestion,
          finishQuestionTurn
        } = await setUp(page, request)

        await test.step(
          'The agent builds a KSampler and a Load Image',
          agentBuildsNodes
        )

        await test.step('The user sets cfg and the image by hand', async () => {
          await setWidgetsByHand()
          await expect
            .poll(() => valuesFrom(host.projection().nodes))
            .toEqual(handSet)
        })

        await test.step('The agent connection drops and recovers', async () => {
          const connections = hostSocket.connectionCount()
          const subscribes = hostSocket.subscribeCount()
          await hostSocket.disconnect()
          await expect
            .poll(() => hostSocket.connectionCount(), { timeout: 30_000 })
            .toBeGreaterThan(connections)
          await expect
            .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
            .toBeGreaterThan(subscribes)
          await expect
            .poll(() => valuesFrom(host.projection().nodes))
            .toEqual(handSet)
        })

        await test.step('A question-only turn sends and keeps the hand-set values', async () => {
          const post = await askQuestion()
          expect(draftValues(post)).toEqual(handSet)
          await finishQuestionTurn()
        })
      }
    )

    test(
      'keeps widgets set by hand while the agent is offline',
      { annotation },
      async ({ page, request }) => {
        test.setTimeout(90_000)
        const {
          hostSocket,
          setWidgetsByHand,
          agentBuildsNodes,
          askQuestion,
          finishQuestionTurn
        } = await setUp(page, request)

        await test.step(
          'The agent builds a KSampler and a Load Image',
          agentBuildsNodes
        )

        const connections = hostSocket.connectionCount()
        const subscribes = hostSocket.subscribeCount()

        await test.step('The user sets cfg and the image by hand while offline', async () => {
          hostSocket.pauseSubscribes(WORKFLOW_ID)
          hostSocket.holdConnections()
          await hostSocket.disconnect()
          await expect
            .poll(() => hostSocket.refusedConnectionCount(), {
              timeout: 30_000
            })
            .toBeGreaterThan(0)
          await setWidgetsByHand()
          expect(hostSocket.connectionCount()).toBe(connections)
        })

        await test.step('The socket reconnects but the document has not caught up', async () => {
          hostSocket.releaseConnections()
          await expect
            .poll(() => hostSocket.connectionCount(), { timeout: 30_000 })
            .toBeGreaterThan(connections)
        })

        await test.step('A question asked before catch-up sends no stale copy', async () => {
          const post = await askQuestion()
          expect(post.draft).toBeUndefined()
        })

        await test.step('Catch-up keeps the hand-set values', async () => {
          hostSocket.resumeSubscribe(WORKFLOW_ID)
          await expect
            .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
            .toBeGreaterThan(subscribes)
          await finishQuestionTurn()
        })
      }
    )
  }
)
