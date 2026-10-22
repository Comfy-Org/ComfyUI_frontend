import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { toNodeId } from '@/types/nodeId'
import type {
  AgentRunModePreference,
  AgentTurnAccepted
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const RESIZE_TYPE = 'TestResizeImageMask'
const SOURCE_TYPE = 'TestImageSource'
const RESIZE_ID = 878
const SOURCE_ID = 877
const CHILD = 'resize_type.match'
const WORKFLOW_ID = '3d1f6a2b-8c4e-4f5a-9b7d-2e6c1a0f4b38'
const THREAD_ID = '5b8e2c1d-4a7f-4e3b-9c6d-0f1a2b3c4d5e'
const MESSAGE_ID = '9c4d2e1f-6b8a-4c7d-8e9f-1a2b3c4d5e6f'

const resizeDef: ComfyNodeDef = {
  name: RESIZE_TYPE,
  display_name: 'Test Resize Image/Mask',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['IMAGE'],
  output_is_list: [false],
  output_name: ['IMAGE'],
  input: {
    required: {
      resize_type: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'keep', inputs: { required: {} } },
            {
              key: 'match size',
              inputs: { required: { match: ['IMAGE,MASK', {}] } }
            }
          ]
        }
      ]
    }
  },
  input_order: { required: ['resize_type'] }
}

const sourceDef: ComfyNodeDef = {
  name: SOURCE_TYPE,
  display_name: 'Test Image Source',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['IMAGE'],
  output_is_list: [false],
  output_name: ['IMAGE'],
  input: { required: {} }
}

const catalog: WidgetCatalog = {
  types: {
    [RESIZE_TYPE]: { widget_order: ['resize_type'] },
    [SOURCE_TYPE]: { widget_order: [] }
  }
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: SOURCE_ID,
      type: SOURCE_TYPE,
      pos: [0, 0],
      size: [220, 80],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      properties: {},
      widgets_values: []
    },
    {
      id: RESIZE_ID,
      type: RESIZE_TYPE,
      pos: [360, 0],
      size: [270, 120],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      properties: {},
      widgets_values: ['keep']
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

interface ProjectedInput {
  name: string
  link?: number | null
}

function childSlot(host: HostDoc): ProjectedInput | undefined {
  const node = host
    .projection()
    .nodes.find((candidate) => String(candidate.id) === String(RESIZE_ID))
  const inputs = (node?.inputs ?? []) as ProjectedInput[]
  return inputs.find((input) => input.name === CHILD)
}

test.describe(
  'A human link into a dynamic-combo child input the document lacks',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('reaches the document the agent reads, and so does its removal', async ({
      page
    }) => {
      test.setTimeout(60_000)

      await page.route('**/api/object_info', (route) =>
        route.fulfill(
          jsonRoute({ [RESIZE_TYPE]: resizeDef, [SOURCE_TYPE]: sourceDef })
        )
      )

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        'apply'
      )
      await hostSocket.install()

      const threadList = emptyAgentThreadList()
      await page.route('**/api/agent/threads?*', (route) =>
        route.fulfill(jsonRoute(threadList))
      )
      const runModePreference: AgentRunModePreference = {
        mode: 'ask_approval',
        credit_limit: null
      }
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute(runModePreference))
      )
      const turnAccepted: AgentTurnAccepted = {
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID,
        workflow_id: WORKFLOW_ID
      }
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() !== 'POST')
          return route.fulfill(jsonRoute([]))
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify(turnAccepted)
        })
      })

      await bootAgentApp(page, true, {
        objectInfo: 'server',
        settings: {
          'Comfy.Graph.CanvasInfo': false
        }
      })

      let savedName: string | undefined
      await page.route('**/api/userdata/*', (route) => {
        const request = route.request()
        const path = decodeURIComponent(
          new URL(request.url()).pathname.split('/userdata/')[1]
        )
        if (request.method() !== 'POST' || !path.startsWith('workflows/'))
          return route.fallback()
        savedName = path.slice('workflows/'.length, -'.json'.length)
        const saved: UserDataFullInfo = {
          path,
          modified: Date.now(),
          size: request.postDataBuffer()?.length ?? 0
        }
        return route.fulfill(jsonRoute(saved))
      })
      await page.route('**/api/workflows?*', (route) => {
        const workflows: WorkflowListResponse = {
          data:
            savedName === undefined
              ? []
              : [
                  {
                    id: WORKFLOW_ID,
                    name: savedName,
                    created_at: '2026-10-12T00:00:00Z',
                    updated_at: '2026-10-12T00:00:00Z',
                    created_by: 'test-user-e2e',
                    latest_version: 1
                  }
                ],
          pagination: {
            has_more: false,
            limit: 100,
            offset: 0,
            total: savedName === undefined ? 0 : 1
          }
        }
        return route.fulfill(jsonRoute(workflows))
      })

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root

      await test.step('bind the workflow with a turn', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.composer.fill('hello')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect(panel.getByText('hello').first()).toBeVisible()
        hostSocket.send({
          type: 'agent_message_done',
          data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
        })
        await hostSocket.waitForSubscribe()
      })

      await expect(vueNodes.getNodeLocator(String(RESIZE_ID))).toBeVisible()

      await test.step("the agent selects 'match size', growing the child on the canvas only", async () => {
        hostSocket.send(
          host.apply([
            {
              op: 'set_widget',
              node_id: RESIZE_ID,
              widget: 'resize_type',
              value: 'match size'
            }
          ])
        )
        await expect(
          vueNodes.getNodeLocator(String(RESIZE_ID)).getByText('match', {
            exact: true
          })
        ).toBeVisible()
        expect(childSlot(host)).toBeUndefined()
      })

      const childIndex = await page.evaluate(
        ({ id, name }) =>
          window.app!.graph.getNodeById(id)?.findInputSlot(name) ?? -1,
        { id: toNodeId(RESIZE_ID), name: CHILD }
      )
      expect(childIndex).toBeGreaterThanOrEqual(0)

      await test.step('the user wires the source into the child', async () => {
        const output = vueNodes.getOutputSlotConnectionDot(String(SOURCE_ID), 0)
        const input = vueNodes.getInputSlotConnectionDot(
          String(RESIZE_ID),
          childIndex
        )
        // oxlint-disable-next-line playwright/no-force-option
        await output.dragTo(input, { force: true })
      })

      const linkId = await page.evaluate(
        ({ id, slot }) =>
          window.app!.graph.getNodeById(id)?.inputs[slot]?.link ?? null,
        { id: toNodeId(RESIZE_ID), slot: childIndex }
      )
      expect(linkId).not.toBeNull()

      await expect
        .poll(() => childSlot(host))
        .toEqual(expect.objectContaining({ name: CHILD, link: linkId }))
      expect(
        host.projection().links.map((link) => (link as unknown[])[0])
      ).toEqual([linkId])

      await test.step('the user deletes the link', async () => {
        await page.evaluate((id) => window.app!.graph.removeLink(id), linkId!)
      })

      await expect
        .poll(() => childSlot(host))
        .toEqual(expect.objectContaining({ name: CHILD, link: null }))
      expect(host.projection().links).toEqual([])
      expect(
        hostSocket
          .humanOpOutcomes()
          .filter((outcome) => outcome.outcome !== 'applied')
      ).toEqual([])
    })
  }
)
