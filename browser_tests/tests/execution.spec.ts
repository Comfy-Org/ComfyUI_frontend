import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Execution', () => {
  test('Report error on unconnected slot', async ({ comfyPage }) => {
    await comfyPage.disconnectEdge()
    await comfyPage.clickEmptySpace()

    await comfyPage.executeCommand('Comfy.QueuePrompt')
    await expect(comfyPage.page.locator('.comfy-error-report')).toBeVisible()
    await comfyPage.page.locator('.p-dialog-close-button').click()
    await comfyPage.page.locator('.comfy-error-report').waitFor({
      state: 'hidden'
    })
    await expect(comfyPage.canvas).toHaveScreenshot(
      'execution-error-unconnected-slot.png'
    )
  })
})

test.describe('Execute to selected output nodes', () => {
  test('Execute to selected output nodes', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('execution/partial_execution')
    const input = await comfyPage.getNodeRefById(3)
    const output1 = await comfyPage.getNodeRefById(1)
    const output2 = await comfyPage.getNodeRefById(4)
    expect(await (await input.getWidget(0)).getValue()).toBe('foo')
    expect(await (await output1.getWidget(0)).getValue()).toBe('')
    expect(await (await output2.getWidget(0)).getValue()).toBe('')

    await output1.click('title')

    await comfyPage.executeCommand('Comfy.QueueSelectedOutputNodes')
    // @note: Wait for the execution to finish. We might want to move to a more
    // reliable way to wait for the execution to finish. Workflow in this test
    // is simple enough that this is fine for now.
    await comfyPage.page.waitForTimeout(200)

    expect(await (await input.getWidget(0)).getValue()).toBe('foo')
    expect(await (await output1.getWidget(0)).getValue()).toBe('foo')
    expect(await (await output2.getWidget(0)).getValue()).toBe('')
  })
})
