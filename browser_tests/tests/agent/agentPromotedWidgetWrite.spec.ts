import { expect, mergeTests } from '@playwright/test'
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import fs from 'node:fs'
import path from 'node:path'
import * as Y from 'yjs'

import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import { webSocketFixture } from '@e2e/fixtures/ws'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'
import type { WorkflowJSON04 } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  validateComfyWorkflow,
  zComfyWorkflow,
  zComfyWorkflow1
} from '@/platform/workflow/validation/schemas/workflowSchema'
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
function buildFrames(asset: WorkflowJSON04) {
  const definition = asset.definitions?.subgraphs.find(
    (subgraph) => subgraph.id === SUBGRAPH_TYPE
  )
  const promptValues = zComfyWorkflow1
    .parse(definition)
    .nodes.find((node) => node.id === 27)?.widgets_values
  const interiorPrompt = Array.isArray(promptValues)
    ? promptValues[0]
    : undefined
  if (typeof interiorPrompt !== 'string')
    throw new Error('Fixture must contain subgraph prompt node 27')

  const doc = mint({ ...asset, extra: asset.extra ?? undefined }, CATALOG)
  const fullState = Y.encodeStateAsUpdate(doc)
  const vectorBefore = Y.encodeStateVector(doc)

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
  expect(applyOps(doc, ops, CATALOG).outcomes).toEqual([
    { op_id: 'op-1', outcome: 'applied' },
    { op_id: 'op-2', outcome: 'applied' }
  ])
  const delta = Y.encodeStateAsUpdate(doc, vectorBefore)
  doc.destroy()

  return { fullState, delta, interiorPrompt }
}

test.describe(
  'Agent promoted widget write (QAF-36 / gm-34)',
  { tag: '@cloud' },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('set_widget persists host promotions without changing interior defaults', async ({
      comfyPage,
      postedMessages,
      getWebSocket
    }, testInfo) => {
      test.setTimeout(60_000)
      const page = comfyPage.page

      const rawAsset: unknown = JSON.parse(fs.readFileSync(ASSET_PATH, 'utf8'))
      const asset = zComfyWorkflow.parse(rawAsset)
      const { fullState, delta, interiorPrompt } = buildFrames(asset)

      // agentPanelMocks stubs `/api/object_info` with `{}`. Routes match
      // last-registered-first, so registering the setup-API object_info route
      // here (after the fixture) wins and serves real node defs; without them
      // the subgraph host never materializes its promoted widgets.
      const unrouteObjectInfo = await routeObjectInfoFromSetupApi(page)
      try {
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.workflow.loadGraphData(asset)
        await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)

        // Precondition: the host node exposes its promoted widgets before any
        // follower frame arrives. Guards against a silently-broken fixture load.
        const hostWidgetsBefore = await page.evaluate((id) => {
          const host = window.app!.graph.getNodeById(id as NodeId)
          return (host?.widgets ?? []).map((w) => [w.name, w.value])
        }, HOST_NODE_ID)
        expect(hostWidgetsBefore).toEqual(
          expect.arrayContaining([['steps', 8]])
        )
        expect(hostWidgetsBefore.length).toBeGreaterThanOrEqual(7)
        const hostNode = await comfyPage.nodeOps.getNodeRefById(HOST_NODE_ID)
        await hostNode.centerOnNode()
        await page.screenshot({ path: testInfo.outputPath('before.png') })

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
            const host = window.app!.graph.getNodeById(id as NodeId)
            if (!host?.isSubgraphNode())
              throw new Error('Missing subgraph host')
            const hostWidgets = host.widgets.map((w) => [w.name, w.value])
            const interior = host.subgraph
            const prompt = interior.getNodeById('27' as NodeId)?.widgets?.[0]
              ?.value
            const steps = interior
              .getNodeById('3' as NodeId)
              ?.widgets?.find((w) => w.name === 'steps')?.value
            return { hostWidgets, prompt, steps }
          }, HOST_NODE_ID)

        // Host promoted widgets should reflect the agent write.
        await expect
          .poll(async () => {
            const s = await readState()
            return s.hostWidgets
          })
          .toEqual(
            expect.arrayContaining([
              ['text', NEW_PROMPT],
              ['steps', NEW_STEPS],
              ['width', 1024]
            ])
          )

        const state = await readState()
        expect(state.prompt).toBe(interiorPrompt)
        expect(state.steps).toBe(8)
        const saved = await page.evaluate(() => window.app!.graph.serialize())
        const validatedSave = await validateComfyWorkflow(saved)
        if (!validatedSave) throw new Error('Invalid saved workflow')
        await comfyPage.workflow.loadGraphData(validatedSave)
        await expect.poll(readState).toEqual(state)
        await hostNode.centerOnNode()
        await page.screenshot({ path: testInfo.outputPath('after-reload.png') })
      } finally {
        await unrouteObjectInfo()
      }
    })
  }
)
