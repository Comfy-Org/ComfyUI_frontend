import { expect, mergeTests } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  BLANK_WORKFLOW,
  agentTest,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

const WORKFLOW_ID = 'c1d4e7fa-0000-4000-8000-000000000020'
const MESSAGE_ID = 'c1d4e7fa-0000-4000-8000-000000000021'
const THREAD_ID = 'c1d4e7fa-0000-4000-8000-000000000022'

const SOURCE_TYPE = 'AgentLateEndpointSource'
const SINK_TYPE = 'AgentLateEndpointSink'

const SINK_NODE_ID = 2
const BYSTANDER_NODE_ID = 4
const LATE_SOURCE_NODE_ID = 3
const LINK_ID = 7

const nodeDefs: Record<string, ComfyNodeDef> = {
  [SOURCE_TYPE]: {
    name: SOURCE_TYPE,
    display_name: 'Agent Late Endpoint Source',
    description: '',
    category: 'test',
    python_module: 'test',
    output_node: false,
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE'],
    input: {},
    input_order: {}
  },
  [SINK_TYPE]: {
    name: SINK_TYPE,
    display_name: 'Agent Late Endpoint Sink',
    description: '',
    category: 'test',
    python_module: 'test',
    output_node: true,
    output: [],
    output_is_list: [],
    output_name: [],
    input: { required: { image: ['IMAGE', {}] } },
    input_order: { required: ['image'] }
  }
}

const catalog: WidgetCatalog = {
  types: {
    [SOURCE_TYPE]: { widget_order: [] },
    [SINK_TYPE]: { widget_order: [] }
  }
}

function sinkNode(id: number, y: number) {
  return {
    id,
    type: SINK_TYPE,
    pos: [520, y] as [number, number],
    size: [240, 60] as [number, number],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [{ name: 'image', type: 'IMAGE', link: null }],
    outputs: [],
    properties: {},
    widgets_values: []
  }
}

const seed: WorkflowJSON = {
  nodes: [sinkNode(SINK_NODE_ID, 120), sinkNode(BYSTANDER_NODE_ID, 320)],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

test.describe(
  'Agent follower on a link whose endpoint arrives in a later frame',
  { tag: ['@cloud', '@agent', '@canvas', '@node'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('connects the wire once the missing endpoint node materializes', async ({
      page,
      getAgentSocket
    }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width: 1920, height: 1280 })

      await bootAgentApp(page, true, {
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        },
        objectInfo: nodeDefs,
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            message_id: MESSAGE_ID,
            thread_id: THREAD_ID,
            workflow_id: WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })
      await loadIntoBootWorkflow(page, BLANK_WORKFLOW)

      const outboundFrames: string[] = []
      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)

      const socket =
        await test.step('bind the workflow so the follower subscribes', async () => {
          await agentPanel.open()
          const opened = await getAgentSocket()
          opened.onMessage((message) => outboundFrames.push(String(message)))
          await agentPanel.selectWorkflow()
          await agentPanel.sendMessage('wire the source into the sink')
          await expect
            .poll(() => outboundFrames, { timeout: 15_000 })
            .toContainEqual(expect.stringContaining('doc_subscribe'))
          return opened
        })

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      const sink = vueNodes.getNodeLocator(String(SINK_NODE_ID))

      await test.step('frame A carries one unresolvable link alongside good nodes: the good nodes still arrive', async () => {
        host.replaceLink([
          LINK_ID,
          LATE_SOURCE_NODE_ID,
          0,
          SINK_NODE_ID,
          0,
          'IMAGE'
        ])
        for (const frame of host.initialSync())
          socket.send(JSON.stringify(frame))

        await expect(sink).toBeVisible({ timeout: 30_000 })
        await expect(
          vueNodes.getNodeLocator(String(BYSTANDER_NODE_ID))
        ).toBeVisible({ timeout: 30_000 })

        await expect
          .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
          .toBe(2)
        expect(await page.evaluate(() => window.app!.graph.links.size)).toBe(0)
      })

      await test.step('frame B materializes the missing endpoint for the first time', async () => {
        socket.send(
          JSON.stringify(
            host.apply([
              {
                op: 'add_node',
                node_id: LATE_SOURCE_NODE_ID,
                class_type: SOURCE_TYPE,
                pos: [120, 120],
                node: {
                  id: LATE_SOURCE_NODE_ID,
                  type: SOURCE_TYPE,
                  pos: [120, 120],
                  size: [240, 60],
                  mode: 0,
                  flags: {},
                  order: 1,
                  inputs: [],
                  outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [LINK_ID] }],
                  properties: {},
                  widgets_values: []
                }
              }
            ])
          )
        )
        await expect(
          vueNodes.getNodeLocator(String(LATE_SOURCE_NODE_ID))
        ).toBeVisible({ timeout: 30_000 })
      })

      await test.step("the host's document says the two nodes are wired", () => {
        expect(host.link(LINK_ID)).toEqual([
          LINK_ID,
          LATE_SOURCE_NODE_ID,
          0,
          SINK_NODE_ID,
          0,
          'IMAGE'
        ])
      })

      await test.step('and so does the canvas: the wire the user is supposed to see is there', async () => {
        await expect
          .poll(
            () =>
              vueNodes.isSlotConnected(
                vueNodes.getInputSlotRow(String(SINK_NODE_ID), 0)
              ),
            { timeout: 30_000 }
          )
          .toBe(true)

        await expect
          .poll(() =>
            page.evaluate(() =>
              [...window.app!.graph.links.values()].map((link) => ({
                origin: String(link.origin_id),
                originSlot: link.origin_slot,
                target: String(link.target_id),
                targetSlot: link.target_slot,
                type: link.type
              }))
            )
          )
          .toEqual([
            {
              origin: String(LATE_SOURCE_NODE_ID),
              originSlot: 0,
              target: String(SINK_NODE_ID),
              targetSlot: 0,
              type: 'IMAGE'
            }
          ])
      })

      await test.step('the follower never wrote the shared document (KEEP-ALIVE #6)', () => {
        expect(
          outboundFrames.filter((frame) => frame.includes('doc_ops'))
        ).toEqual([])
      })
    })
  }
)
