import { expect } from '@playwright/test'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import {
  HOST_OWNED_COMBO_HOST_ID,
  HOST_OWNED_COMBO_SAVED_VALUES,
  hostOwnedDynamicComboCatalog,
  hostOwnedDynamicComboDefs,
  hostOwnedDynamicComboSeed
} from '@e2e/fixtures/data/agent/hostOwnedDynamicCombo'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { loadSeedIntoActiveTab } from '@e2e/fixtures/utils/seedActiveTab'

const WORKFLOW_ID = '24059000-0000-4000-8000-000000000001'
const MESSAGE_ID = '24059000-0000-4000-8000-000000000002'
const THREAD_ID = '24059000-0000-4000-8000-000000000003'

test.describe(
  'Agent edits on a subgraph host that owns a dynamic combo',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('a canvas edit to the combo option widget and to a sibling both save', async ({
      page,
      agentFlagEnabled
    }) => {
      test.setTimeout(90_000)
      const seed = hostOwnedDynamicComboSeed()
      const host = new HostDoc(WORKFLOW_ID, seed, hostOwnedDynamicComboCatalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        'apply'
      )
      await hostSocket.install()
      await page.route('**/api/object_info', (route) =>
        route.fulfill(jsonRoute(hostOwnedDynamicComboDefs))
      )

      await bootAgentApp(page, agentFlagEnabled, {
        objectInfo: 'server',
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            message_id: MESSAGE_ID,
            thread_id: THREAD_ID,
            workflow_id: WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })
      await loadSeedIntoActiveTab(page, seed)

      const vueNodes = new VueNodeHelpers(page)
      const hostNode = vueNodes.getNodeLocator(HOST_OWNED_COMBO_HOST_ID)
      await expect(hostNode).toBeVisible()

      await new Topbar(page).saveWorkflowAs('Unsaved Workflow')
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.sendMessage('watch this workflow')
      await agentPanel.expectUserMessages(['watch this workflow'])
      await hostSocket.waitForSubscribe()

      function savedHostValues() {
        const node = host
          .projection()
          .nodes.find(
            (candidate) => String(candidate.id) === HOST_OWNED_COMBO_HOST_ID
          )
        return node?.widgets_values
      }

      await expect.poll(savedHostValues).toEqual(HOST_OWNED_COMBO_SAVED_VALUES)

      await test.step('editing the combo option widget saves at its own slot', async () => {
        await vueNodes.setInputNumberValue(
          vueNodes.getWidgetRowByLabel(hostNode, 'normalization'),
          '7'
        )
        await expect.poll(savedHostValues).toEqual(['depth', 7, 4])
      })

      await test.step('editing the sibling afterwards saves at its own slot', async () => {
        await vueNodes.setInputNumberValue(
          vueNodes.getWidgetRowByLabel(hostNode, 'value'),
          '9'
        )
        await expect.poll(savedHostValues).toEqual(['depth', 7, 9])
      })
    })
  }
)
