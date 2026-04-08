import type { Locator } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Job History Actions', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()

    // Expand the queue overlay so the JobHistoryActionsMenu is visible
    await comfyPage.page.getByTestId('queue-overlay-toggle').click()
  })

  async function openMoreOptionsPopover(comfyPage: {
    page: { getByLabel(label: string | RegExp): Locator }
  }) {
    const moreButton = comfyPage.page.getByLabel(/More options/i).first()
    await moreButton.click()
  }

  test('More options popover opens', async ({ comfyPage }) => {
    await openMoreOptionsPopover(comfyPage)

    await expect(
      comfyPage.page.locator('[data-testid="docked-job-history-action"]')
    ).toBeVisible()
  })

  test('Docked job history action is visible with text', async ({
    comfyPage
  }) => {
    await openMoreOptionsPopover(comfyPage)

    const action = comfyPage.page.locator(
      '[data-testid="docked-job-history-action"]'
    )
    await expect(action).toBeVisible()
    await expect(action).not.toBeEmpty()
  })

  test('Show run progress bar action is visible', async ({ comfyPage }) => {
    await openMoreOptionsPopover(comfyPage)

    await expect(
      comfyPage.page.locator('[data-testid="show-run-progress-bar-action"]')
    ).toBeVisible()
  })

  test('Clear history action is visible', async ({ comfyPage }) => {
    await openMoreOptionsPopover(comfyPage)

    await expect(
      comfyPage.page.locator('[data-testid="clear-history-action"]')
    ).toBeVisible()
  })

  test('Clicking docked job history closes popover', async ({ comfyPage }) => {
    await openMoreOptionsPopover(comfyPage)

    const action = comfyPage.page.locator(
      '[data-testid="docked-job-history-action"]'
    )
    await expect(action).toBeVisible()
    await action.click()

    await expect(action).not.toBeVisible()
  })

  test('Clicking show run progress bar toggles setting', async ({
    comfyPage
  }) => {
    const settingBefore = await comfyPage.settings.getSetting<boolean>(
      'Comfy.Queue.ShowRunProgressBar'
    )

    await openMoreOptionsPopover(comfyPage)

    const action = comfyPage.page.locator(
      '[data-testid="show-run-progress-bar-action"]'
    )
    await action.click()

    const settingAfter = await comfyPage.settings.getSetting<boolean>(
      'Comfy.Queue.ShowRunProgressBar'
    )
    expect(settingAfter).toBe(!settingBefore)
  })
})
