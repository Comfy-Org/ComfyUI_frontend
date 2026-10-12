import { expect, mergeTests } from '@playwright/test'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import subgraphAsset from '@e2e/assets/subgraphs/agent-subgraph-with-two-promoted-widgets.json' with { type: 'json' }
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

// This spec closes the gap `agentSubgraphFollower.spec.ts` and
// `agentTemplatePlacement.spec.ts` leave open: both drive the real CRDT
// follower onto a real canvas, but neither one exercises the `insert_workflow`
// op itself -- one seeds its document directly from a workflow JSON and
// layers plain `add_node`/`connect` ops on top, the other only ever sends
// `add_node` batches. This test sends a single `insert_workflow` op, the way
// the cloud agent's `insert_workflow` tool call actually lands mid-turn, and
// checks the one representative case the unit-level `agentInsertWorkflow.*`
// suites (`src/workbench/extensions/agent/crdt/`) cannot: that a widget
// value, a cross-node link, and a subgraph all read back correctly on the
// live, user-visible canvas afterward -- not just in the projected graph
// snapshot a Vitest test inspects.

const WORKFLOW_ID = 'a2f6c8b0-0000-4000-8000-000000000010'
const MESSAGE_ID = 'a2f6c8b0-0000-4000-8000-000000000011'
const THREAD_ID = 'a2f6c8b0-0000-4000-8000-000000000012'

// Reuses the exact subgraph definition (two promoted widgets, `text` and
// `seed`) already proven to materialize correctly in
// `agentSubgraphFollower.spec.ts` -- there it arrives baked into the CRDT
// doc's initial mint; here it arrives as part of a live `insert_workflow`
// tool call instead.
const SUBGRAPH_DEFINITION = subgraphAsset.definitions.subgraphs[0]
const PROMPT_TEXT = 'a photo of a pier'
const SEED_VALUE = 918273

// Ids as they appear INSIDE the insert_workflow payload only. The applier
// mints fresh ids for everything an insert_workflow op carries (comfy-multi-
// player's `remapInsertedWorkflowIds`), so these never appear on the live
// canvas -- the test reads the materialized ids back off `window.app!.graph`
// instead of assuming they survive.
const SOURCE_NODE_ID = 20
const HOST_NODE_ID = 11
const CLIP_LINK_ID = 21

const nodeDefs: Record<string, ComfyNodeDef> = {
  AgentClipSource: {
    name: 'AgentClipSource',
    display_name: 'Agent Clip Source',
    description: '',
    category: 'testing',
    python_module: 'testing',
    output_node: false,
    input: { required: {} },
    output: ['CLIP'],
    output_is_list: [false],
    output_name: ['CLIP']
  },
  CLIPTextEncode: {
    name: 'CLIPTextEncode',
    display_name: 'CLIP Text Encode',
    description: '',
    category: 'conditioning',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: {
        clip: ['CLIP', { forceInput: true }],
        text: ['STRING', { default: '', multiline: true }]
      }
    },
    output: ['CONDITIONING'],
    output_is_list: [false],
    output_name: ['CONDITIONING']
  },
  KSampler: {
    name: 'KSampler',
    display_name: 'KSampler',
    description: '',
    category: 'sampling',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: {
        model: ['MODEL', { forceInput: true }],
        positive: ['CONDITIONING', { forceInput: true }],
        negative: ['CONDITIONING', { forceInput: true }],
        latent_image: ['LATENT', { forceInput: true }],
        seed: ['INT', { default: 0, min: 0, max: 2147483647 }],
        control_after_generate: [
          ['fixed', 'increment', 'decrement', 'randomize'],
          { default: 'randomize' }
        ],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        cfg: ['FLOAT', { default: 8, min: 0, max: 100 }],
        sampler_name: [['euler'], { default: 'euler' }],
        scheduler: [['simple'], { default: 'simple' }],
        denoise: ['FLOAT', { default: 1, min: 0, max: 1 }]
      }
    },
    output: ['LATENT'],
    output_is_list: [false],
    output_name: ['LATENT']
  }
}

const catalog: WidgetCatalog = {
  types: {
    AgentClipSource: { widget_order: [] },
    CLIPTextEncode: { widget_order: ['text'] },
    KSampler: {
      widget_order: [
        'seed',
        'control_after_generate',
        'steps',
        'cfg',
        'sampler_name',
        'scheduler',
        'denoise'
      ]
    }
  }
}

function insertWorkflowOps() {
  return [
    {
      op_id: 'agent-insert-workflow-canvas-result-op-000'.padEnd(32, '0'),
      actor: 'agent:e2e',
      base_version: 1,
      stamp: [1, 'agent:e2e'],
      op: 'insert_workflow',
      workflow: {
        nodes: [
          {
            id: SOURCE_NODE_ID,
            type: 'AgentClipSource',
            pos: [40, 300],
            size: [180, 80],
            inputs: [],
            outputs: [{ name: 'CLIP', type: 'CLIP', links: [CLIP_LINK_ID] }]
          },
          {
            id: HOST_NODE_ID,
            type: SUBGRAPH_DEFINITION.id,
            pos: [400, 300],
            size: [210, 168],
            inputs: [
              { name: 'clip', type: 'CLIP', link: CLIP_LINK_ID },
              { name: 'model', type: 'MODEL', link: null },
              { name: 'positive', type: 'CONDITIONING', link: null },
              { name: 'negative', type: 'CONDITIONING', link: null },
              { name: 'latent_image', type: 'LATENT', link: null },
              {
                name: 'seed',
                type: 'INT',
                widget: { name: 'seed' },
                link: null
              }
            ],
            outputs: [],
            widgets_values: [PROMPT_TEXT, SEED_VALUE]
          }
        ],
        links: [[CLIP_LINK_ID, SOURCE_NODE_ID, 0, HOST_NODE_ID, 0, 'CLIP']],
        definitions: { subgraphs: [SUBGRAPH_DEFINITION] }
      }
    }
  ] satisfies Op[]
}

test.describe(
  'Agent insert_workflow canvas materialization',
  { tag: ['@cloud', '@agent', '@canvas', '@node', '@widget', '@subgraph'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('renders a promoted widget, a cross-node link, and a subgraph from one insert_workflow tool call', async ({
      page,
      getWebSocket
    }, testInfo) => {
      test.setTimeout(60_000)
      await page.setViewportSize({ width: 1920, height: 1280 })
      await bootAgentApp(page, true, {
        settings: { 'Comfy.VueNodes.Enabled': true },
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

      // Drive the turn through the real, public Agent panel -- not a raw
      // CRDT call -- exactly as a user would trigger the tool.
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage(
        'Insert the CLIP-conditioned sampler subgraph onto this canvas'
      )

      await expect
        .poll(() => outboundFrames, { timeout: 15_000 })
        .toContainEqual(
          expect.stringMatching(
            new RegExp(
              `doc_subscribe.*${WORKFLOW_ID}|${WORKFLOW_ID}.*doc_subscribe`
            )
          )
        )

      // The fake host: an empty document, matching the follower's own empty
      // starting state, so the canvas is genuinely blank before the tool runs.
      const host = new HostDoc(WORKFLOW_ID, { nodes: [], links: [] }, catalog)
      for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))

      await expect
        .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
        .toBe(0)

      // The tool call executes: `insert_workflow` lands as a live doc_update,
      // the same delta shape a real turn's CRDT broadcast carries.
      const applied = host.apply(insertWorkflowOps())
      socket.send(JSON.stringify(applied))

      await expect
        .poll(() =>
          page.evaluate(() => {
            const graph = window.app!.graph
            const host = graph.nodes.find(
              (node) =>
                typeof node.type === 'string' && graph.subgraphs.has(node.type)
            )
            return host?.widgets?.length ?? 0
          })
        )
        .toBe(2)

      const canvasState = await page.evaluate(() => {
        const graph = window.app!.graph
        const host = graph.nodes.find(
          (node) =>
            typeof node.type === 'string' && graph.subgraphs.has(node.type)
        )!
        const source = graph.nodes.find(
          (node) => node.type === 'AgentClipSource'
        )!
        const linkId = source.outputs[0]?.links?.[0]
        const link =
          linkId != null
            ? [...graph.links.values()].find(
                (candidate) => candidate.id === linkId
              )
            : undefined
        return {
          hostId: String(host.id),
          sourceId: String(source.id),
          widgets: host.widgets?.map(({ name, value }) => ({ name, value })),
          linkOriginId: link ? String(link.origin_id) : null,
          linkTargetId: link ? String(link.target_id) : null,
          linkType: link?.type ?? null
        }
      })

      // Widget: the promoted `text`/`seed` values from the inserted subgraph
      // read back correctly on the live node.
      expect(canvasState.widgets).toEqual([
        { name: 'text', value: PROMPT_TEXT },
        { name: 'seed', value: SEED_VALUE }
      ])
      // Link: the freshly-inserted source connects to the freshly-inserted
      // subgraph instance's promoted `clip` input, not to nothing / itself.
      expect(canvasState.linkOriginId).toBe(canvasState.sourceId)
      expect(canvasState.linkTargetId).toBe(canvasState.hostId)
      expect(canvasState.linkType).toBe('CLIP')

      await page
        .getByRole('button', { name: 'Fit View (.)', exact: true })
        .click()

      // Same widget values, now asserted against the rendered Vue node DOM --
      // the user-visible surface Christian's review asked for, not just the
      // graph model.
      const hostNode = new VueNodeHelpers(page).getNodeLocator(
        canvasState.hostId
      )
      await expect(hostNode.getByRole('textbox')).toHaveValue(PROMPT_TEXT)
      await expect(
        hostNode.getByLabel('seed', { exact: true }).getByRole('spinbutton')
      ).toHaveValue(String(SEED_VALUE))

      await testInfo.attach('insert-workflow-result.png', {
        body: await page.screenshot(),
        contentType: 'image/png'
      })
    })
  }
)
