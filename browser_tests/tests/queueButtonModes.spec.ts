import { expect } from '@playwright/test'

import type { PromptResponse } from '@/schemas/apiSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const queueModeLabels = ['Run', 'Run (On Change)', 'Run (Instant)']
const runOnChangeLabel = queueModeLabels[1]

test.describe('Queue button modes', { tag: '@ui' }, () => {
  test('Run button is visible in topbar', async ({ comfyPage }) => {
    await expect(comfyPage.actionbar.queueButton.primaryButton).toBeVisible()
  })

  test('Queue mode trigger menu is visible', async ({ comfyPage }) => {
    await expect(comfyPage.actionbar.queueButton.dropdownButton).toBeVisible()
  })

  test('Clicking queue mode trigger opens mode menu', async ({ comfyPage }) => {
    const options = await comfyPage.actionbar.queueButton.openOptions()

    await expect(options.menu).toBeVisible()
  })

  test('Queue mode menu shows available modes', async ({ comfyPage }) => {
    const options = await comfyPage.actionbar.queueButton.openOptions()

    await expect(options.menu).toBeVisible()
    await expect(options.modeItems).toHaveText(queueModeLabels)
  })

  test('Selecting a non-default mode updates the Run button label', async ({
    comfyPage
  }) => {
    const queueButton = comfyPage.actionbar.queueButton
    const options = await queueButton.openOptions()

    await expect(options.menu).toBeVisible()
    await options.selectMode(runOnChangeLabel)

    await expect(queueButton.primaryButton).toContainText(runOnChangeLabel)
  })

  test('Run button sends prompt when clicked', async ({ comfyPage }) => {
    let promptQueued = false
    const mockResponse: PromptResponse = {
      prompt_id: 'test-id',
      node_errors: {},
      error: ''
    }
    await comfyPage.page.route('**/api/prompt', async (route) => {
      promptQueued = true
      await route.fulfill({
        status: 200,
        body: JSON.stringify(mockResponse)
      })
    })

    await comfyPage.actionbar.queueButton.primaryButton.click()

    await expect.poll(() => promptQueued).toBe(true)
  })
})
