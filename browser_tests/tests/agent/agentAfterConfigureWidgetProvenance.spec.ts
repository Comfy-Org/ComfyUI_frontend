import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

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
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'apply',
      crdtDebugEnabled: true
    })

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
          .getNodeLocator('3')
          .getByLabel('steps', { exact: true })
          .getByRole('spinbutton')
      ).toHaveValue('47')

      await page.getByTestId('crdt-dev-panel-tab-log').click()
      await page
        .getByTestId('crdt-dev-panel-filter')
        .selectOption('mint_divergence')
      await expect(page.getByTestId('crdt-dev-panel-log')).toBeEmpty()
    })
  }
)
