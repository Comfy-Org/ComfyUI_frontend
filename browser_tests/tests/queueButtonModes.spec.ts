import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Queue button modes', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

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

    await expect(menu.getByRole('menuitemradio').first()).toBeVisible()
  })

  test('Queue mode menu closes after selecting a mode', async ({
    comfyPage
  }) => {
    const trigger = comfyPage.page.getByTestId(
      TestIds.topbar.queueModeMenuTrigger
    )
    await trigger.click()

    const menu = comfyPage.page.getByRole('menu')
    await expect(menu).toBeVisible()

    const firstItem = menu.getByRole('menuitemradio').first()
    await firstItem.click()

    await expect(menu).toBeHidden()
  })

  test('Run button sends prompt when clicked', async ({ comfyPage }) => {
    let promptQueued = false
    await comfyPage.page.route('**/api/prompt', async (route) => {
      promptQueued = true
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          prompt_id: 'test-id',
          number: 1,
          node_errors: {}
        })
      })
    })

    await comfyPage.runButton.click()

    await expect.poll(() => promptQueued).toBe(true)
  })
})
