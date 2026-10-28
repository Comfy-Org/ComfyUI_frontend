import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { toNodeId } from '@/types/nodeId'

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
  addLoadImageNode,
  emptySeed
} from '@e2e/fixtures/data/agent/agentRemoteApply'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
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
  const pos = [120, 460]
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

const editTimings = [
  { name: 'before the connection drops', editDuringDrop: false },
  { name: 'while the connection is down', editDuringDrop: true }
]

test.describe(
  'Agent question-only turn after a dropped connection',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    for (const { name, editDuringDrop } of editTimings) {
      test(`keeps widgets set by hand ${name}`, async ({ page, request }) => {
        test.setTimeout(60_000)
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
        await bootAgentApp(page, true, {
          objectInfo: 'server',
          settings: { 'Comfy.Graph.CanvasInfo': false }
        })
        await mockWorkflowPersistence(page, WORKFLOW_ID)

        const samplerNode = comfyPage.vueNodes.getNodeLocator(
          String(SAMPLER_ID)
        )
        const loadImageNode = comfyPage.vueNodes.getNodeLocator(
          String(LOAD_IMAGE_ID)
        )

        async function setWidgetsByHand(): Promise<void> {
          await comfyPage.vueNodes.setInputNumberValue(
            comfyPage.vueNodes.getWidgetRowByLabel(samplerNode, 'cfg'),
            String(HAND_CFG)
          )
          await new WidgetSelectDropdownFixture(
            comfyPage.vueNodes.getWidgetRowByLabel(loadImageNode, 'image')
          ).selectOption(HAND_IMAGE)
          await expect.poll(() => canvasValues(page)).toEqual(handSet)
        }

        async function dropAndRestoreConnection(): Promise<void> {
          const connections = hostSocket.connectionCount()
          const subscribes = hostSocket.subscribeCount()
          if (editDuringDrop) hostSocket.pauseSubscribes(WORKFLOW_ID)
          await hostSocket.disconnect()
          await expect
            .poll(() => hostSocket.connectionCount(), { timeout: 30_000 })
            .toBeGreaterThan(connections)
          if (editDuringDrop) {
            await setWidgetsByHand()
            hostSocket.resumeSubscribe(WORKFLOW_ID)
          }
          await expect
            .poll(() => hostSocket.subscribeCount(), { timeout: 30_000 })
            .toBeGreaterThan(subscribes)
        }

        await test.step('The agent builds a KSampler and a Load Image', async () => {
          await panel.open()
          await panel.selectWorkflow()
          await panel.sendMessage('Add a KSampler and a Load Image node.')
          await hostSocket.waitForSubscribe()
          hostSocket.send(
            host.apply([
              addSamplerNode(SAMPLER_ID),
              addLoadImageNode(LOAD_IMAGE_ID, 1)
            ])
          )
          hostSocket.send(done(FIRST_MESSAGE_ID))

          await expect
            .poll(() => canvasValues(page))
            .toEqual({ cfg: AGENT_CFG, image: AGENT_IMAGE })
          await expect(panel.sendButton).toBeVisible()
        })

        if (!editDuringDrop) {
          await test.step('The user sets cfg and the image by hand', async () => {
            await setWidgetsByHand()
            await expect
              .poll(() => valuesFrom(host.projection().nodes))
              .toEqual(handSet)
          })
        }

        await test.step('The agent connection drops and recovers', async () => {
          await dropAndRestoreConnection()
          await expect
            .poll(() => valuesFrom(host.projection().nodes))
            .toEqual(handSet)
        })

        await test.step('A question-only turn leaves the hand-set values', async () => {
          await panel.sendMessage('What did I change?')
          await expect.poll(() => posts.length).toBe(2)
          hostSocket.send(done(SECOND_MESSAGE_ID))

          const draft = draftValues(posts[1])
          if (draft !== null) expect(draft).toEqual(handSet)
          await expect(panel.root.getByText('What did I change?')).toBeVisible()
          await expect.poll(() => canvasValues(page)).toEqual(handSet)
          expect(valuesFrom(host.projection().nodes)).toEqual(handSet)
        })
      })
    }
  }
)
