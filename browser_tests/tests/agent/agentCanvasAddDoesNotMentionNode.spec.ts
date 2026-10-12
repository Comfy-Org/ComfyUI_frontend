import { expect } from '@playwright/test'

import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Canvas additions beside an empty Agent composer',
  { tag: ['@cloud', '@agent', '@canvas', '@node'] },
  () => {
    test.use({ objectInfo: { KSampler: agentReplayNodeDefs.KSampler } })

    test('does not auto-mention a node added on the canvas', async ({
      agentPanel,
      comfyPage
    }) => {
      const { topbar } = comfyPage.menu

      await test.step('target a blank tab revisited with the Agent open', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await topbar.newWorkflowButton.click()
        await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
        await topbar.getTab(0).click()
        await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow')
        await topbar.getTab(1).click()
        await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
        await agentPanel.selectWorkflow('Unsaved Workflow (2)')

        await expect(agentPanel.composer).toBeEmpty()
        await expect(agentPanel.composerNodeSection).toHaveCount(0)
      })

      await test.step('add a node through canvas search', async () => {
        await comfyPage.searchBoxV2.addNodeAndGetId('KSampler', {
          position: { x: 400, y: 300 }
        })

        await expect(agentPanel.composer).toBeEmpty()
        await expect(agentPanel.composerNodeSection).toHaveCount(0)
      })
    })
  }
)
