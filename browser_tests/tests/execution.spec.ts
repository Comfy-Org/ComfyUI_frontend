import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { DefaultGraphPositions } from '../fixtures/constants/defaultGraphPositions'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Execution', { tag: ['@smoke', '@workflow'] }, () => {
  test(
    'Report error on unconnected slot',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.disconnectEdge()
      await comfyPage.canvasOps.clickEmptySpace(
        DefaultGraphPositions.emptySpaceClick
      )

      await comfyPage.executeCommand('Comfy.QueuePrompt')
      await expect(comfyPage.page.locator('.comfy-error-report')).toBeVisible()
      await comfyPage.page
        .locator('.p-dialog')
        .getByRole('button', { name: 'Close' })
        .click()
      await comfyPage.page.locator('.comfy-error-report').waitFor({
        state: 'hidden'
      })
      await expect(comfyPage.canvas).toHaveScreenshot(
        'execution-error-unconnected-slot.png'
      )
    }
  )
})

test.describe(
  'Execute to selected output nodes',
  { tag: ['@smoke', '@workflow'] },
  () => {
    test('Execute to selected output nodes', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('execution/partial_execution')
      const input = await comfyPage.nodeOps.getNodeRefById(3)
      const output1 = await comfyPage.nodeOps.getNodeRefById(1)
      const output2 = await comfyPage.nodeOps.getNodeRefById(4)
      expect(await (await input.getWidget(0)).getValue()).toBe('foo')
      expect(await (await output1.getWidget(0)).getValue()).toBe('')
      expect(await (await output2.getWidget(0)).getValue()).toBe('')

      await output1.click('title')

      await comfyPage.executeCommand('Comfy.QueueSelectedOutputNodes')
      await expect(async () => {
        expect(await (await input.getWidget(0)).getValue()).toBe('foo')
        expect(await (await output1.getWidget(0)).getValue()).toBe('foo')
        expect(await (await output2.getWidget(0)).getValue()).toBe('')
      }).toPass({ timeout: 2_000 })
    })
  }
)
