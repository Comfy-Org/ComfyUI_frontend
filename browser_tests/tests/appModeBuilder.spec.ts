import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('App mode builder selection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
  })

  test('Can independently select inputs of same name', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    const items = comfyPage.appMode.select.selectedItems

    await comfyPage.vueNodes.selectNodes(['6', '7'])
    await comfyPage.command.executeCommand('Comfy.Graph.ConvertToSubgraph')

    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()
    await expect(items).toHaveCount(0)

    const prompts = comfyPage.vueNodes
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
    const items = comfyPage.appMode.select.selectedItems
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()
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
    await comfyPage.appMode.steps.goToOutputs()

    await comfyPage.nodeOps
      .getNodeRefById('9')
      .then((ref) => ref.centerOnNode())
    const saveImage = await comfyPage.vueNodes.getNodeLocator('9')
    await saveImage.click()

    const items = comfyPage.appMode.select.selectedItems
    await expect(items).toHaveCount(1)
  })

  test('Can not select nodes with errors or notes', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    const items = comfyPage.appMode.select.selectedItems
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()
    await expect(items).toHaveCount(0)

    await comfyPage.appMode.select.selectInputWidget(
      'Load Checkpoint',
      'ckpt_name'
    )
    //await expect.soft(items).toHaveCount(0)

    await comfyPage.workflow.loadWorkflow('nodes/note_nodes')
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()
    await expect(items).toHaveCount(0)

    await comfyPage.appMode.select.selectInputWidget('Note', 'text')
    await comfyPage.appMode.select.selectInputWidget('Markdown Note', 'text')

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
    await comfyPage.appMode.steps.goToInputs()

    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(comfyPage.searchBox.input).toHaveCount(0)

    //space toggles panning mode, canvas should remain readOnly after pressing
    await comfyPage.page.keyboard.press('Space')
    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(comfyPage.searchBox.input).toHaveCount(0)

    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    // oxlint-disable-next-line playwright/no-force-option -- Node container has conditional pointer-events:none that blocks actionability
    await ksampler.header.dblclick({ force: true })
    await expect(ksampler.titleInput).toBeHidden()

    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(comfyPage.searchBox.input).toHaveCount(1)
  })
})
