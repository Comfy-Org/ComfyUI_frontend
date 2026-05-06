import { expect } from '@playwright/test'

import type { PromptResponse } from '@/schemas/apiSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Queue button modes', { tag: '@ui' }, () => {
  test('Run button is visible in topbar', async ({ comfyPage }) => {
    await expect(comfyPage.runButton).toBeVisible()
  })

  test('Queue mode trigger menu is visible', async ({ comfyPage }) => {
    const trigger = comfyPage.page.getByTestId(
      TestIds.topbar.queueModeMenuTrigger
    )
    await expect(trigger).toBeVisible()
  })

  test('Clicking queue mode trigger opens mode menu', async ({ comfyPage }) => {
    const trigger = comfyPage.page.getByTestId(
      TestIds.topbar.queueModeMenuTrigger
    )
    await trigger.click()

    const menu = comfyPage.page.getByRole('menu')
    await expect(menu).toBeVisible()
  })

  test('Queue mode menu shows available modes', async ({ comfyPage }) => {
    const trigger = comfyPage.page.getByTestId(
      TestIds.topbar.queueModeMenuTrigger
    )
    await trigger.click()

    const menu = comfyPage.page.getByRole('menu')
    await expect(menu).toBeVisible()

    const items = menu.getByRole('menuitem')
    await expect(items).toHaveCount(3)
    await expect(items.nth(0)).toHaveText('Run')
    await expect(items.nth(1)).toHaveText('Run (On Change)')
    await expect(items.nth(2)).toHaveText('Run (Instant)')
  })

  test('Selecting a non-default mode updates the Run button label', async ({
    comfyPage
  }) => {
    const trigger = comfyPage.page.getByTestId(
      TestIds.topbar.queueModeMenuTrigger
    )
    await trigger.click()

    const menu = comfyPage.page.getByRole('menu')
    await expect(menu).toBeVisible()

    // Select "Run (On Change)" — a non-default mode so we observe a real change
    const onChangeItem = menu.getByRole('menuitem').nth(1)
    await onChangeItem.click()

    await expect(comfyPage.runButton).toContainText('Run (On Change)')
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

    await comfyPage.runButton.click()

    await expect.poll(() => promptQueued).toBe(true)
  })
})
