import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('Linear Mode', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

  test('Displays linear controls when app mode active', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(
      comfyPage.page.locator('[data-testid="linear-widgets"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('Run button visible in linear mode', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(
      comfyPage.page.locator('[data-testid="linear-run-button"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('Run controls visible in app mode', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(
      comfyPage.page.locator('[data-testid="linear-run-button"]')
    ).toBeVisible({ timeout: 5000 })
  })

  test('Returns to graph mode', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(
      comfyPage.page.locator('[data-testid="linear-widgets"]')
    ).toBeVisible({ timeout: 5000 })

    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.canvas).toBeVisible({ timeout: 5000 })
    await expect(
      comfyPage.page.locator('[data-testid="linear-widgets"]')
    ).not.toBeVisible()
  })

  test('Canvas not visible in app mode', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(
      comfyPage.page.locator('[data-testid="linear-widgets"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(comfyPage.canvas).not.toBeVisible()
  })
})
