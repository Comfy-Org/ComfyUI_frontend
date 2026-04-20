import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Linear Mode', { tag: '@ui' }, () => {
  test('Displays linear controls when app mode active', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(comfyPage.page.getByTestId('linear-widgets')).toBeVisible()
  })

  test('Run button visible in linear mode', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(comfyPage.page.getByTestId('linear-run-button')).toBeVisible()
  })

  test('Workflow info section visible', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(
      comfyPage.page.getByTestId('linear-workflow-info')
    ).toBeVisible()
  })

  test('Returns to graph mode', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(comfyPage.page.getByTestId('linear-widgets')).toBeVisible()

    await comfyPage.appMode.toggleAppMode()

    await expect(comfyPage.canvas).toBeVisible()
    await expect(comfyPage.page.getByTestId('linear-widgets')).toBeHidden()
  })

  test('Canvas not visible in app mode', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(comfyPage.page.getByTestId('linear-widgets')).toBeVisible()
    await expect(comfyPage.canvas).toBeHidden()
  })
})
