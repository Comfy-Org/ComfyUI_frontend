import { expect } from '@playwright/test'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { WidgetSelectDefaultFixture } from '@e2e/fixtures/components/WidgetSelectDefault'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

const WORKFLOW_ID = 'fe347000-0000-4000-8000-000000000001'
const MESSAGE_ID = 'fe347000-0000-4000-8000-000000000003'
const THREAD_ID = 'fe347000-0000-4000-8000-000000000004'

const ADDED_CLASS = 'DynamicModePicker'
const SEED_CLASS = 'KSampler'
const SEED_NODE_ID = 1

const nodeDefs: Record<string, ComfyNodeDef> = {
  [ADDED_CLASS]: {
    name: ADDED_CLASS,
    display_name: 'Dynamic Mode Picker',
    description: '',
    category: 'testing',
    python_module: 'custom_nodes.test',
    output_node: false,
    input: {
      required: {
        mode: [
          'COMFY_DYNAMICCOMBO_V3',
          {
            options: [
              { key: 'creative', inputs: { required: {} } },
              {
                key: 'faithful',
                inputs: {
                  required: {
                    detail: ['INT', { default: 80, min: 0, max: 100 }]
                  }
                }
              }
            ]
          }
        ]
      }
    },
    output: ['STRING'],
    output_is_list: [false],
    output_name: ['STRING']
  },
  [SEED_CLASS]: {
    name: SEED_CLASS,
    display_name: 'KSampler',
    description: '',
    category: 'sampling',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: {
        seed: ['INT', { default: 0, min: 0, max: 2147483647 }],
        steps: ['INT', { default: 20, min: 1, max: 10000 }]
      }
    },
    output: ['LATENT'],
    output_is_list: [false],
    output_name: ['LATENT']
  }
}

const catalog: WidgetCatalog = {
  types: {
    [SEED_CLASS]: { widget_order: ['seed', 'steps'] },
    [ADDED_CLASS]: {
      widget_order: ['mode'],
      dynamic_combos: {
        mode: {
          default: 'creative',
          options: {
            creative: { widgets: [], defaults: {} },
            faithful: {
              widgets: ['mode.detail'],
              defaults: { 'mode.detail': 80 }
            }
          }
        }
      }
    }
  }
}

const seedNode = {
  id: SEED_NODE_ID,
  type: SEED_CLASS,
  pos: [120, 120] as [number, number],
  size: [260, 140] as [number, number],
  inputs: [],
  outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
  widgets_values: [0, 20]
}

const hostSeed: WorkflowJSON = { nodes: [seedNode], links: [] }

const canvasSeed: ComfyWorkflowJSON = {
  last_node_id: SEED_NODE_ID,
  last_link_id: 0,
  nodes: [{ ...seedNode, flags: {}, order: 0, mode: 0, properties: {} }],
  links: [],
  version: 0.4
}

test.describe(
  'Agent edits on a human-added dynamic combo node',
  { tag: ['@cloud', '@agent', '@widget', '@vue-nodes'] },
  () => {
    test('keeps the newly shown child writable after the selection changes', async ({
      page,
      agentFlagEnabled
    }) => {
      test.setTimeout(90_000)

      const host = new HostDoc(WORKFLOW_ID, hostSeed, catalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        'apply'
      )
      await hostSocket.install()

      await page.setViewportSize({ width: 1920, height: 1280 })
      await bootAgentApp(page, agentFlagEnabled, {
        settings: { 'Comfy.Graph.CanvasInfo': false },
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
      await loadIntoBootWorkflow(page, canvasSeed)

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Have a look at this workflow')
      await hostSocket.waitForSubscribe()
      await expect(vueNodes.getNodeLocator(String(SEED_NODE_ID))).toBeVisible()
      await page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.scale = 1
        canvas.ds.offset = [40, 40]
        canvas.setDirty(true, true)
      })

      const hostNode = (id: string) =>
        host.projection().nodes.find((node) => String(node.id) === id)
      const appliedHumanOps = () =>
        hostSocket
          .humanOpOutcomes()
          .filter((outcome) => outcome.outcome === 'applied').length
      const rejectedHumanOps = () =>
        hostSocket
          .humanOpOutcomes()
          .filter((outcome) => outcome.outcome === 'rejected')

      const nodeId =
        await test.step('the person adds the catalogued node', async () => {
          const nodeId = await page.evaluate((type) => {
            const node = window.LiteGraph!.createNode(type)
            if (!node) throw new Error(`${type} is not a registered node type`)
            node.pos = [460, 120]
            window.app!.graph.add(node)
            return String(node.id)
          }, ADDED_CLASS)
          await expect(vueNodes.getNodeLocator(nodeId)).toBeVisible()

          await expect
            .poll(() => hostNode(nodeId))
            .toMatchObject({
              widgets_values: ['creative']
            })
          expect(hostNode(nodeId)).not.toHaveProperty('widgets_values_form')
          expect(rejectedHumanOps()).toEqual([])
          return nodeId
        })

      const node = vueNodes.getNodeLocator(nodeId)
      const detailRow = vueNodes.getWidgetRowByLabel(node, 'detail')
      const detail = detailRow.getByRole('spinbutton')

      await test.step('the person switches to the option that shows a child', async () => {
        const applied = appliedHumanOps()
        await new WidgetSelectDefaultFixture(node, 'mode').selectOption(
          'faithful'
        )
        await expect(detail).toBeVisible()
        await expect.poll(appliedHumanOps).toBeGreaterThan(applied)
        expect(rejectedHumanOps()).toEqual([])
      })

      await test.step('the person edits the newly shown child and the host keeps it', async () => {
        const applied = appliedHumanOps()
        await vueNodes.setInputNumberValue(detailRow, '42')
        await expect.poll(appliedHumanOps).toBeGreaterThan(applied)
        await expect
          .poll(() => hostNode(nodeId)?.widgets_values)
          .toEqual(['faithful', 42])
        expect(rejectedHumanOps()).toEqual([])
        await expect(detail).toHaveValue('42')
      })
    })
  }
)
