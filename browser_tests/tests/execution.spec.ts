import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  await comfyPage.closeMenu()
})

test.describe('Execution', { tag: ['@smoke', '@workflow'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.setup()
  })

  test(
    'Report error on unconnected slot',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.canvasOps.disconnectEdge()
      await comfyPage.page.keyboard.press('Escape')

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()
      await errorOverlay.waitFor({ state: 'hidden' })
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
      await expect
        .poll(async () => (await input.getWidget(0)).getValue())
        .toBe('foo')
      await expect
        .poll(async () => (await output1.getWidget(0)).getValue())
        .toBe('')
      await expect
        .poll(async () => (await output2.getWidget(0)).getValue())
        .toBe('')

      await output1.click('title')

      await comfyPage.command.executeCommand('Comfy.QueueSelectedOutputNodes')
      await expect
        .poll(async () => (await input.getWidget(0)).getValue())
        .toBe('foo')
      await expect
        .poll(async () => (await output1.getWidget(0)).getValue())
        .toBe('foo')
      await expect
        .poll(async () => (await output2.getWidget(0)).getValue())
        .toBe('')
    })
  }
)
