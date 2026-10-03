import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Canvas additions beside an empty Agent composer',
  { tag: ['@cloud', '@agent', '@canvas', '@node'] },
  () => {
    test.use({ objectInfo: 'server' })

    test('does not auto-mention a node added on the canvas', async ({
      agentPanel,
      comfyPage
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await comfyPage.page
        .getByRole('button', {
          name: enMessages.sideToolbar.newBlankWorkflow,
          exact: true
        })
        .click()
      const topbar = new Topbar(comfyPage.page)
      await topbar.getTab(0).click()
      await topbar.getTab(1).click()
      await agentPanel.selectWorkflow('Unsaved Workflow (2)')

      await expect(agentPanel.composer).toBeEmpty()
      await expect(
        agentPanel.root.getByTestId('composer-node-section')
      ).toHaveCount(0)

      await comfyPage.searchBoxV2.addNodeAndGetId('KSampler', {
        position: { x: 400, y: 300 }
      })

      await expect(agentPanel.composer).toBeEmpty()
      await expect(
        agentPanel.root.getByTestId('composer-node-section')
      ).toHaveCount(0)
    })
  }
)
