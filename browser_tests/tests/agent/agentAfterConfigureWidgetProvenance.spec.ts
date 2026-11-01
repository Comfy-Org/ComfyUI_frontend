import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const LOADED_NODE_ID = '3'
const LOADED_WIDGET = 'steps'
const EXTENSION_VALUE = '47'

async function enableCrdtDebugPanel(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.Agent.CrdtDebug.enabled', 'true')
    localStorage.setItem('Comfy.Agent.CrdtDevPanel.open', 'true')
  })
}

test.describe(
  'PM-2438: afterConfigureGraph widget provenance',
  {
    tag: ['@cloud', '@agent', '@canvas', '@vue-nodes', '@widget'],
    annotation: {
      type: 'issue',
      description: 'https://linear.app/comfy/issue/PM-2438'
    }
  },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test.beforeEach(async ({ page }) => enableCrdtDebugPanel(page))

    test('keeps a load-time extension widget write out of the bound Agent document', async ({
      agentConversation,
      comfyPage,
      page
    }) => {
      await agentConversation.runTurns()

      await page.evaluate(() => {
        window.app!.registerExtension({
          name: 'PM2438.afterConfigureWidgetWrite',
          afterConfigureGraph() {
            const sampler = window.app!.graph.findNodesByType('KSampler')[0]
            const steps = sampler.widgets?.find(
              (widget) => widget.name === 'steps'
            )
            if (steps) steps.value = 47
          }
        })
      })

      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')

      await expect(
        agentConversation.vueNodes
          .getNodeLocator(LOADED_NODE_ID)
          .getByLabel(LOADED_WIDGET, { exact: true })
          .getByRole('spinbutton')
      ).toHaveValue(EXTENSION_VALUE)

      await page.getByTestId('crdt-dev-panel-tab-log').click()
      await page
        .getByTestId('crdt-dev-panel-filter')
        .selectOption('mint_divergence')
      await expect(page.getByTestId('crdt-dev-panel-log')).toBeEmpty()
    })
  }
)
