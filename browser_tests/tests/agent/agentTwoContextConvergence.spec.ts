import { expect } from '@playwright/test'

import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi
} from '@e2e/fixtures/agentPanelFixture'
import { AgentSharedHostFixture } from '@e2e/fixtures/agentSharedHostFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

const WORKFLOW_ID = '16e93c08-e115-478d-aace-0df97ff3ab87'
const THREAD_ID = 'ab4bc091-c995-4f39-8cad-9f90805e76bd'
const MESSAGE_ID = '98e6663f-c9df-4a85-89c4-46ab2a77d174'
const NODE_ID = 720
const CLIENT_VALUE = 'edited in the first browser'
const HOST_VALUE = 'then edited by the agent'

const promptNode = {
  id: NODE_ID,
  type: 'CLIPTextEncode',
  pos: [0, 0] as [number, number],
  size: [300, 120] as [number, number],
  mode: 0,
  order: 0,
  flags: {},
  inputs: [],
  outputs: [],
  properties: {},
  widgets_values: ['shared seed']
}

async function bootSharedPage(page: Parameters<typeof bootAgentApp>[0]) {
  await mockAgentTurnApi(page, {
    thread_id: THREAD_ID,
    message_id: MESSAGE_ID,
    workflow_id: WORKFLOW_ID
  })
  await bootAgentApp(page, true, {
    objectInfo: 'server',
    vueNodes: true
  })
  await new AgentPanel(page).open()
}

test.describe(
  'Agent shared document across browser contexts',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('replicates client and host widget edits between independently connected pages', async ({
      browser
    }) => {
      test.setTimeout(90_000)
      const contextA = await browser.newContext()
      const contextB = await browser.newContext()
      try {
        const pageA = await contextA.newPage()
        const pageB = await contextB.newPage()
        const sharedHost = new AgentSharedHostFixture(
          WORKFLOW_ID,
          { nodes: [], links: [] },
          { types: { CLIPTextEncode: { widget_order: ['text'] } } }
        )

        await sharedHost.attach(pageA, 'shared-host-page-a')
        await sharedHost.attach(pageB, 'shared-host-page-b')

        await bootSharedPage(pageA)
        await bootSharedPage(pageB)

        sharedHost.broadcast({
          type: 'agent_active_tab',
          data: {
            workflow_id: WORKFLOW_ID,
            name: 'Shared workflow'
          }
        })
        await expect(
          pageA.getByRole('tab', { name: /Shared workflow/ })
        ).toHaveAttribute('aria-selected', 'true')
        await expect(
          pageB.getByRole('tab', { name: /Shared workflow/ })
        ).toHaveAttribute('aria-selected', 'true')
        await sharedHost.waitForSubscribers()

        sharedHost.pushAgentOps([
          {
            op: 'add_node',
            node_id: NODE_ID,
            class_type: 'CLIPTextEncode',
            pos: promptNode.pos,
            node: promptNode
          }
        ])

        const textboxA = new VueNodeHelpers(pageA)
          .getNodeLocator(String(NODE_ID))
          .getByRole('textbox')
        const textboxB = new VueNodeHelpers(pageB)
          .getNodeLocator(String(NODE_ID))
          .getByRole('textbox')
        await expect(textboxA).toHaveValue('shared seed')
        await expect(textboxB).toHaveValue('shared seed')

        await textboxA.fill(CLIENT_VALUE)
        await textboxA.blur()
        await expect(textboxB).toHaveValue(CLIENT_VALUE)

        sharedHost.pushAgentOps([
          {
            op: 'set_widget',
            node_id: NODE_ID,
            widget: 'text',
            value: HOST_VALUE
          }
        ])
        await expect(textboxA).toHaveValue(HOST_VALUE)
        await expect(textboxB).toHaveValue(HOST_VALUE)
      } finally {
        await contextA.close()
        await contextB.close()
      }
    })
  }
)
