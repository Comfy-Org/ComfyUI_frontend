import { expect, mergeTests } from '@playwright/test'
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import fs from 'node:fs'
import path from 'node:path'
import * as Y from 'yjs'

import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import { webSocketFixture } from '@e2e/fixtures/ws'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'
import type { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeId } from '@/types/nodeId'

const test = mergeTests(agentTest, webSocketFixture)

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const ASSET_PATH = path.resolve(
  import.meta.dirname,
  '../../assets/subgraphs/nested-pack-promoted-values.json'
)
const SUBGRAPH_TYPE = 'f2fdebf6-dfaf-43b6-9eb2-7f70613cfdc1'
const HOST_NODE_ID = '57'

// Catalog widget order for the node types present in the asset. Mirrors what
// the cloud materializer feeds to mint() so widgets_values map onto names.
const CATALOG: WidgetCatalog = {
  types: {
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
    },
    CLIPLoader: { widget_order: ['clip_name', 'type', 'device'] },
    VAELoader: { widget_order: ['vae_name'] },
    UNETLoader: { widget_order: ['unet_name', 'weight_dtype'] },
    EmptySD3LatentImage: { widget_order: ['width', 'height', 'batch_size'] },
    ModelSamplingAuraFlow: { widget_order: ['shift'] },
    SaveImage: { widget_order: ['filename_prefix'] },
    MarkdownNote: { widget_order: ['text'] },
    ConditioningZeroOut: { widget_order: [] },
    VAEDecode: { widget_order: [] },
    [SUBGRAPH_TYPE]: {
      widget_order: [
        'text',
        'width',
        'height',
        'unet_name',
        'clip_name',
        'vae_name',
        'steps'
      ]
    }
  }
}

const NEW_PROMPT = 'NEW PROMPT'
const NEW_STEPS = 12

function b64(u8: Uint8Array): string {
  return Buffer.from(u8).toString('base64')
}

/**
 * Build the two doc_update payloads the follower would receive when the agent
 * writes promoted widgets on subgraph host node 57:
 *   seq 0: full mint state (system:mint)
 *   seq 1: delta with two set_widget ops on the host (agent:test:1)
 */
type SubgraphDefinitions = {
  subgraphs: { nodes: { id: number; widgets_values: unknown[] }[] }[]
}

function buildFrames(asset: WorkflowJSON) {
  const doc = mint(asset, CATALOG)
  const fullState = Y.encodeStateAsUpdate(doc)
  const vectorBefore = Y.encodeStateVector(doc)

  const defs = asset.definitions as SubgraphDefinitions
  const interiorPrompt = defs.subgraphs[0].nodes.find((n) => n.id === 27)
    ?.widgets_values[0]
  const hostValues = [
    interiorPrompt,
    1024,
    1024,
    'z_image_turbo_bf16.safetensors',
    'qwen_3_4b.safetensors',
    'ae.safetensors',
    8
  ]

  const ops: Op[] = [
    {
      op_id: 'op-1',
      actor: 'agent:test:1',
      base_version: 1,
      stamp: [1, 'agent:test:1'],
      op: 'set_widget',
      node_id: HOST_NODE_ID,
      widget: 'text',
      value: NEW_PROMPT,
      promoted: {
        instance_path: [HOST_NODE_ID],
        value_index: 0,
        host_widgets_values: hostValues
      }
    },
    {
      op_id: 'op-2',
      actor: 'agent:test:1',
      base_version: 1,
      stamp: [2, 'agent:test:1'],
      op: 'set_widget',
      node_id: HOST_NODE_ID,
      widget: 'steps',
      value: NEW_STEPS,
      promoted: {
        instance_path: [HOST_NODE_ID],
        value_index: 6,
        host_widgets_values: hostValues
      }
    }
  ]
  applyOps(doc, ops, CATALOG)
  const delta = Y.encodeStateAsUpdate(doc, vectorBefore)

  return { fullState, delta }
}

test.describe(
  'Agent promoted widget write (QAF-36 / gm-34)',
  { tag: '@cloud' },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('set_widget on a subgraph host node updates promoted widgets', async ({
      comfyPage,
      postedMessages,
      getWebSocket
    }) => {
      test.setTimeout(60_000)
      const page = comfyPage.page

      const rawAsset: unknown = JSON.parse(fs.readFileSync(ASSET_PATH, 'utf8'))
      const { fullState, delta } = buildFrames(
        structuredClone(rawAsset) as WorkflowJSON
      )

      // agentPanelMocks stubs `/api/object_info` with `{}`. Routes match
      // last-registered-first, so registering the setup-API object_info route
      // here (after the fixture) wins and serves real node defs; without them
      // the subgraph host never materializes its promoted widgets.
      const unrouteObjectInfo = await routeObjectInfoFromSetupApi(page)
      try {
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.workflow.loadGraphData(rawAsset as ComfyWorkflowJSON)

        // Precondition: the host node exposes its promoted widgets before any
        // follower frame arrives. Guards against a silently-broken fixture load.
        const hostWidgetsBefore = await page.evaluate((id) => {
          const host = window.app!.graph.getNodeById(id as NodeId) as
            | SubgraphNode
            | undefined
          return (host?.widgets ?? []).map((w) => [w.name, w.value])
        }, HOST_NODE_ID)
        expect(hostWidgetsBefore).toEqual(
          expect.arrayContaining([['steps', 8]])
        )
        expect(hostWidgetsBefore.length).toBeGreaterThanOrEqual(7)

        const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
        await expect(openButton).toBeVisible()
        await openButton.click()

        const panel = page.locator('#agent-panel-root')
        await expect(panel).toBeVisible()

        const ws = await getWebSocket()
        const subscribeFrame = new Promise<{
          type: string
          data: { workflow_id: string }
        }>((resolve) => {
          ws.onMessage((msg) => {
            if (typeof msg !== 'string') return
            try {
              const parsed = JSON.parse(msg)
              if (parsed?.type === 'doc_subscribe') resolve(parsed)
            } catch {
              // not JSON, ignore
            }
          })
        })

        const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
        await composer.fill('set the prompt and steps')
        await panel.getByRole('button', { name: 'Send' }).click()
        await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

        const sub = await subscribeFrame
        const workflowId: string = sub.data.workflow_id
        expect(typeof workflowId).toBe('string')

        ws.send(
          JSON.stringify({
            type: 'doc_subscribed',
            data: { v: 1, workflow_id: workflowId, ok: true, seq: 0 }
          })
        )
        ws.send(
          JSON.stringify({
            type: 'doc_update',
            data: {
              v: 1,
              workflow_id: workflowId,
              seq: 0,
              actor: 'system:mint',
              update_b64: b64(fullState)
            }
          })
        )
        ws.send(
          JSON.stringify({
            type: 'doc_update',
            data: {
              v: 1,
              workflow_id: workflowId,
              seq: 1,
              actor: 'agent:test:1',
              op_ids: ['op-1', 'op-2'],
              update_b64: b64(delta)
            }
          })
        )

        const readState = () =>
          page.evaluate((id) => {
            const host = window.app!.graph.getNodeById(id as NodeId) as
              | SubgraphNode
              | undefined
            const hostWidgets = (host?.widgets ?? []).map((w) => [
              w.name,
              w.value
            ])
            return { hostWidgets }
          }, HOST_NODE_ID)

        // Host promoted widgets should reflect the agent write.
        await expect
          .poll(async () => {
            const s = await readState()
            return s.hostWidgets.map((w) => w[1])
          })
          .toEqual(expect.arrayContaining([NEW_PROMPT, NEW_STEPS]))
      } finally {
        await unrouteObjectInfo()
      }
    })
  }
)
