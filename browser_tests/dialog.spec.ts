import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Load workflow warning', () => {
  test('Should display a warning when loading a workflow with missing nodes', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('missing_nodes')

    // Wait for the element with the .comfy-missing-nodes selector to be visible
    const missingNodesWarning = comfyPage.page.locator('.comfy-missing-nodes')
    await expect(missingNodesWarning).toBeVisible()
  })
})

test.describe('Execution error', () => {
  test('Should display an error message when an execution error occurs', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('execution_error')
    await comfyPage.queueButton.click()

    // Wait for the element with the .comfy-execution-error selector to be visible
    const executionError = comfyPage.page.locator('.comfy-error-report')
    await expect(executionError).toBeVisible()
  })
})
