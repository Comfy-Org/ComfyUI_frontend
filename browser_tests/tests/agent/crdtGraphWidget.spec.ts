import { expect, mergeTests } from '@playwright/test'

import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { AgentCrdtHelper } from '@e2e/fixtures/helpers/AgentCrdtHelper'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const NODE_TYPE = 'E2EAgentNumber'
const NODE_TITLE = 'E2E Agent Number'
const RENAMED_NODE = 'My Agent Control'

const CATALOG: WidgetCatalog = {
  types: {
    [NODE_TYPE]: { widget_order: ['value'] }
  }
}

const WORKFLOW: WorkflowJSON = {
  nodes: [
    {
      id: 1,
      type: NODE_TYPE,
      pos: [320, 240],
      size: [300, 140],
      widgets_values: []
    }
  ],
  links: [],
  definitions: { subgraphs: [] }
}

function setWidget(value: number): Op {
  return {
    op_id: 'op-e2e-promoted-value',
    actor: 'agent:e2e:harness',
    base_version: 2,
    stamp: [2, 'agent:e2e:harness'],
    op: 'set_widget',
    node_id: 1,
    widget: 'value',
    value
  }
}

// Regression source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16964
test.describe('Agent CRDT graph projection', { tag: '@cloud' }, () => {
  test.use({
    connectWebSocketToServer: false,
    // Enable Vue nodes without the `@vue-nodes` fixture tag: that tag waits
    // for a startup node, while this case intentionally receives its first
    // node from the agent document subscription.
    agentSettings: { 'Comfy.VueNodes.Enabled': true },
    agentObjectInfo: {
      E2EAgentNumber: {
        input: { required: { value: ['INT', { default: 0 }] } },
        input_order: { required: ['value'] },
        output: [],
        output_name: [],
        output_is_list: [],
        name: 'E2EAgentNumber',
        display_name: 'E2E Agent Number',
        description: '',
        category: 'testing',
        python_module: 'e2e',
        output_node: false
      }
    }
  })

  test('keeps the visible title and widget after an agent update', async ({
    comfyPage,
    getWebSocket,
    getWebSocketMessages
  }) => {
    const page = comfyPage.page
    await page.getByRole('button', { name: 'Ask Comfy Agent' }).click()
    const panel = page.locator('#agent-panel-root')
    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill('Build a reusable number control')
    await panel.getByRole('button', { name: 'Send' }).click()

    const crdt = new AgentCrdtHelper(
      await getWebSocket(),
      getWebSocketMessages,
      WORKFLOW,
      CATALOG
    )
    const workflowId = await crdt.seedSubscribedDocument()

    await comfyPage.vueNodes.waitForNodes()
    const instance = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
    await instance.setTitle(RENAMED_NODE)
    await expect(instance.title).toHaveText(RENAMED_NODE)

    const widget = comfyPage.vueNodes.getWidgetByName(RENAMED_NODE, 'value')
    const { input } = comfyPage.vueNodes.getInputNumberControls(widget)
    await expect(input).toHaveValue('0')

    crdt.applyAgentOps(workflowId, [setWidget(42)])

    await expect(instance.title).toHaveText(RENAMED_NODE)
    await expect(input).toHaveValue('42')
  })
})
