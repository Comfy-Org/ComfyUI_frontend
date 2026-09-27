import {
  ComfyPage,
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Linear Mode', { tag: '@ui' }, () => {
  test('Displays linear controls when app mode active', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(comfyPage.page.getByTestId('linear-widgets')).toBeVisible()
  })

  test('Run button visible in linear mode', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([])

    await expect(
      comfyPage.page.getByTestId(TestIds.linear.runButton)
    ).toBeVisible()
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

  test('Spinner persists until workflow loaded', async ({
    page,
    request
  }, testInfo) => {
    const comfyPage = new ComfyPage(page, request)
    const { parallelIndex } = testInfo
    const username = `playwright-test-${parallelIndex}`
    const userId = await comfyPage.setupUser(username)
    comfyPage.userIds[parallelIndex] = userId

    await page.goto(`${comfyPage.url}/api/users`)
    await page.evaluate((id) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('Comfy.userId', id)
    }, comfyPage.id)

    const splash = page.locator('#splash-loader')

    let notifyWorkflowRequested!: () => void
    const workflowRequested = new Promise<void>(
      (r) => (notifyWorkflowRequested = r)
    )
    let unblockRequest!: () => void
    const requestUnblocked = new Promise<void>((r) => (unblockRequest = r))

    await page.route('**/templates/default.json', async (route) => {
      notifyWorkflowRequested()
      await requestUnblocked
      return route.continue()
    })

    await comfyPage.goto({ url: `${comfyPage.url}/?template=default` })
    await workflowRequested

    await comfyPage.nextFrame()
    await expect(splash).toBeVisible()
    unblockRequest()
    await expect(splash).toBeHidden()
  })
})
