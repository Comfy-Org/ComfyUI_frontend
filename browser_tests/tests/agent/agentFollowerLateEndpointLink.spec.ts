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
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

/**
 * A link can reach the follower before the node it names. The follower
 * correctly declines to connect it -- `connectLink` answers `unresolved`
 * rather than inventing an endpoint -- and, as the first step below pins,
 * declining one link does not cost the rest of the frame.
 *
 * The question this spec asks is what happens on the NEXT frame, when the
 * missing endpoint finally arrives: the follower sweeps the document's links
 * incident to a node it has just materialized, and if that sweep only runs for
 * a node it is RE-creating, a first-time arrival leaves the link permanently
 * unconnected. The document says the two nodes are wired; the canvas shows no
 * wire; nothing ever retries. That is canvas divergence that outlives the
 * frame, not a cosmetic miss.
 *
 * The unit suite (`liveGraphApplier.test.ts`, "connects a dangling link when
 * its endpoint arrives in a later frame") pins the applier's own answer. This
 * spec is the black-box half required by `docs/harness-first-qa.md`: it drives
 * the two frames through the real follower transport onto the real canvas and
 * asserts the wire the user is supposed to see, on the rendered Vue node's own
 * input slot as well as in the live graph's link table.
 *
 * Invariants this exercises, all of which hold in both the red and green runs:
 * the follower never writes the shared document (KEEP-ALIVE #6) -- every
 * mutation here originates at the host; and an unresolvable link is answered
 * by declining that one link, never by wiping or re-seeding the follower
 * document (KEEP-ALIVE #13 / FORECLOSE #11) -- the good nodes sharing the
 * frame with it land anyway, which is what the first assertion step pins.
 *
 * Carrier: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16554
 */

const WORKFLOW_ID = 'c1d4e7fa-0000-4000-8000-000000000020'
const MESSAGE_ID = 'c1d4e7fa-0000-4000-8000-000000000021'
const THREAD_ID = 'c1d4e7fa-0000-4000-8000-000000000022'

const SOURCE_TYPE = 'AgentLateEndpointSource'
const SINK_TYPE = 'AgentLateEndpointSink'

// The link's target: present from the first frame.
const SINK_NODE_ID = 2
// Rides the same frame as the dangling link and has nothing to do with it.
// Its arrival is what proves the frame was not dropped wholesale.
const BYSTANDER_NODE_ID = 4
// Named by the link in frame A and only materialized by frame B.
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

/** The endpoint frame A's link named, arriving for the FIRST time. */
function lateSourceAdd(): RecordedGraphOperation {
  return {
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
}

test.describe(
  'Agent follower on a link whose endpoint arrives in a later frame',
  { tag: ['@cloud', '@agent', '@canvas', '@node'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('connects the wire once the missing endpoint node materializes', async ({
      page,
      getWebSocket
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

      const socket = await getWebSocket()
      const outboundFrames: string[] = []
      socket.onMessage((message) => outboundFrames.push(String(message)))

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)

      await test.step('bind the workflow so the follower subscribes', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.sendMessage('wire the source into the sink')
        await expect
          .poll(() => outboundFrames, { timeout: 15_000 })
          .toContainEqual(expect.stringContaining('doc_subscribe'))
      })

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      // Written into the host document BEFORE the first frame is cut and the
      // returned frame deliberately discarded, so the dangling link rides the
      // very same delta as the two good nodes instead of arriving alone. That
      // is the frame shape the fix is about: one bad link in company.
      host.replaceLink([
        LINK_ID,
        LATE_SOURCE_NODE_ID,
        0,
        SINK_NODE_ID,
        0,
        'IMAGE'
      ])

      const sink = vueNodes.getNodeLocator(String(SINK_NODE_ID))

      await test.step('frame A carries one unresolvable link alongside good nodes: the good nodes still arrive', async () => {
        for (const frame of host.initialSync())
          socket.send(JSON.stringify(frame))

        await expect(sink).toBeVisible({ timeout: 30_000 })
        await expect(
          vueNodes.getNodeLocator(String(BYSTANDER_NODE_ID))
        ).toBeVisible({ timeout: 30_000 })

        // The link naming an absent node is declined on its own terms. Not a
        // wipe, not a re-seed, not an invented endpoint -- just that one link
        // missing, which is the defined partial-apply state.
        await expect
          .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
          .toBe(2)
        expect(await page.evaluate(() => window.app!.graph.links.size)).toBe(0)
      })

      await test.step('frame B materializes the missing endpoint for the first time', async () => {
        socket.send(JSON.stringify(host.apply([lateSourceAdd()])))
        await expect(
          vueNodes.getNodeLocator(String(LATE_SOURCE_NODE_ID))
        ).toBeVisible({ timeout: 30_000 })
      })

      await test.step("the host's document says the two nodes are wired", () => {
        // Read off `linksMap` rather than `project()`: the projection walks
        // every map in the document and is not what is in question here.
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
        // The rendered Vue node's own input slot, read through the shared
        // helper the link specs use.
        await expect
          .poll(
            () =>
              vueNodes.isSlotConnected(
                vueNodes.getInputSlotRow(String(SINK_NODE_ID), 0)
              ),
            { timeout: 30_000 }
          )
          .toBe(true)

        // ...and the live graph's own link table agrees on both endpoints,
        // so this is a real connection rather than a stale slot flag.
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
