import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { loadSeedIntoActiveTab } from '@e2e/fixtures/utils/seedActiveTab'
import { nextFrame } from '@e2e/fixtures/utils/timing'

const RESIZE_TYPE = 'TestResizeImageMask'
const SOURCE_TYPE = 'TestImageSource'
const RESIZE_ID = 878
const SOURCE_ID = 877
export const CHILD = 'resize_type.match'
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

function projectedChild(host: HostDoc) {
  const node = host
    .projection()
    .nodes.find((candidate) => String(candidate.id) === String(RESIZE_ID))
  return node?.inputs?.find(
    (input) =>
      typeof input === 'object' &&
      input !== null &&
      'name' in input &&
      input.name === CHILD
  )
}

function projectedLinkIds(host: HostDoc): unknown[] {
  return host
    .projection()
    .links.flatMap((link) => (Array.isArray(link) ? [link[0]] : []))
}

class DynamicComboChildLinkScenario {
  public readonly childLabel: Locator

  constructor(
    private readonly page: Page,
    public readonly host: HostDoc,
    public readonly hostSocket: AgentFollowerHostSocket,
    private readonly vueNodes: VueNodeHelpers
  ) {
    this.childLabel = vueNodes
      .getNodeLocator(String(RESIZE_ID))
      .getByText('match', { exact: true })
  }

  projectedChild() {
    return projectedChild(this.host)
  }

  projectedLinkIds(): unknown[] {
    return projectedLinkIds(this.host)
  }

  humanOpFailures() {
    return this.hostSocket
      .humanOpOutcomes()
      .filter((outcome) => outcome.outcome !== 'applied')
  }

  selectMatchSize(): void {
    this.hostSocket.send(
      this.host.apply([
        {
          op: 'set_widget',
          node_id: RESIZE_ID,
          widget: 'resize_type',
          value: 'match size'
        }
      ])
    )
  }

  async childIndex(): Promise<number> {
    return await this.page.evaluate(
      ({ id, name }) =>
        window.app!.graph.getNodeById(id)?.findInputSlot(name) ?? -1,
      { id: toNodeId(RESIZE_ID), name: CHILD }
    )
  }

  async connectChild(childIndex: number): Promise<number> {
    const output = this.vueNodes.getOutputSlotConnectionDot(
      String(SOURCE_ID),
      0
    )
    const input = this.vueNodes.getInputSlotConnectionDot(
      String(RESIZE_ID),
      childIndex
    )
    await expect(output).toBeVisible()
    await expect(input).toBeVisible()
    await output.dragTo(input)
    await nextFrame(this.page)
    await expect.poll(() => this.linkId(childIndex)).not.toBeNull()
    const linkId = await this.linkId(childIndex)
    if (linkId === null) throw new Error('The visible slot drag made no link')
    return linkId
  }

  async removeLink(linkId: number): Promise<void> {
    await this.page.evaluate(
      (id) => window.app!.graph.removeLink(id),
      toLinkId(linkId)
    )
    await nextFrame(this.page)
  }

  private async linkId(childIndex: number): Promise<number | null> {
    return await this.page.evaluate(
      ({ id, slot }) =>
        window.app!.graph.getNodeById(id)?.inputs[slot]?.link ?? null,
      { id: toNodeId(RESIZE_ID), slot: childIndex }
    )
  }
}

type DynamicComboChildLinkFixtures = {
  dynamicComboChildLink: DynamicComboChildLinkScenario
}

export const dynamicComboChildLinkTest =
  agentTest.extend<DynamicComboChildLinkFixtures>({
    dynamicComboChildLink: async ({ page, agentFlagEnabled }, use) => {
      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        'apply'
      )
      await hostSocket.install()
      await mockAgentTurnApi(page, {
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID,
        workflow_id: WORKFLOW_ID
      })
      await bootAgentApp(page, agentFlagEnabled, {
        objectInfo: { [RESIZE_TYPE]: resizeDef, [SOURCE_TYPE]: sourceDef },
        settings: { 'Comfy.Graph.CanvasInfo': false }
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)
      await loadSeedIntoActiveTab(page, seed)

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('hello')
      await expect(agentPanel.root.getByText('hello').first()).toBeVisible()
      await hostSocket.waitForSubscribe()
      hostSocket.send({
        type: 'agent_message_done',
        data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
      })

      const vueNodes = new VueNodeHelpers(page)
      await expect(vueNodes.getNodeLocator(String(RESIZE_ID))).toBeVisible()
      await use(
        new DynamicComboChildLinkScenario(page, host, hostSocket, vueNodes)
      )
    }
  })
