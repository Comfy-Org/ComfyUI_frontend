import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

test.describe('App mode builder selection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        linear_toggle_enabled: true
      }
    })
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      true
    )
  })

  test('Can independently select inputs of same name', async ({
    comfyPage
  }) => {
    const items = comfyPage.page.getByTestId(TestIds.builder.ioItem)

    await comfyPage.vueNodes.selectNodes(['6', '7'])
    await comfyPage.command.executeCommand('Comfy.Graph.ConvertToSubgraph')

    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.goToInputs()
    await expect(items).toHaveCount(0)

    const prompts = await comfyPage.vueNodes
      .getNodeByTitle('New Subgraph')
      .locator('.lg-node-widget')
    const count = await prompts.count()
    for (let i = 0; i < count; i++) {
      await expect(prompts.nth(i)).toBeVisible()
      await prompts.nth(i).click()
      await expect(items).toHaveCount(i + 1)
    }
  })
  test('Can drag and drop inputs', async ({ comfyPage }) => {
    const items = comfyPage.page.getByTestId(TestIds.builder.ioItem)
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.goToInputs()
    await expect(items).toHaveCount(0)

    const ksampler = await comfyPage.vueNodes.getNodeLocator('3')
    for (const widget of await ksampler.locator('.lg-node-widget').all())
      await widget.click()

    await items.first().dragTo(items.last(), { steps: 5 })
    await expect(items.first()).toContainText('steps')
    await items.last().dragTo(items.first(), { steps: 5 })
    //dragTo doesn't cross the center point, so denoise is moved to position 2
    await expect(items.nth(1)).toContainText('denoise')
  })
  test('Can select outputs', async ({ comfyPage }) => {
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.goToOutputs()

    await comfyPage.nodeOps
      .getNodeRefById('9')
      .then((ref) => ref.centerOnNode())
    const saveImage = await comfyPage.vueNodes.getNodeLocator('9')
    await saveImage.click()

    const items = comfyPage.page.getByTestId(TestIds.builder.ioItem)
    await expect(items).toHaveCount(1)
  })
  test('Can not select nodes with errors or notes', async ({ comfyPage }) => {
    const items = comfyPage.page.getByTestId(TestIds.builder.ioItem)
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.goToInputs()
    await expect(items).toHaveCount(0)

    await comfyPage.vueNodes
      .getNodeLocator('4')
      .locator('.lg-node-widget')
      .click()
    await expect.soft(items).toHaveCount(0)

    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.goToInputs()
    await expect(items).toHaveCount(0)
    await comfyPage.vueNodes
      .getNodeLocator('1')
      .locator('.lg-node-widget')
      .click({ force: true })
    await comfyPage.vueNodes
      .getNodeLocator('2')
      .locator('.lg-node-widget')
      .click({ force: true })
    await expect(items).toHaveCount(0)
  })
  test('Marks canvas readOnly', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'v1 (legacy)'
    )

    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(comfyPage.searchBox.input).toHaveCount(1)
    await comfyPage.page.keyboard.press('Escape')

    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.goToInputs()

    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(comfyPage.searchBox.input).toHaveCount(0)

    //space toggles panning mode, canvas should remain readOnly after pressing
    await comfyPage.page.keyboard.press('Space')
    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(comfyPage.searchBox.input).toHaveCount(0)

    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await ksampler.header.dblclick({ force: true })
    expect(ksampler.titleInput).not.toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(comfyPage.searchBox.input).toHaveCount(1)
  })
})
