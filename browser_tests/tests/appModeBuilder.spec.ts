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
    const items = comfyPage.appMode.select.inputItems

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

  test('Can select outputs', async ({ comfyPage }) => {
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToOutputs()

    await comfyPage.nodeOps
      .getNodeRefById('9')
      .then((ref) => ref.centerOnNode())
    const saveImage = await comfyPage.vueNodes.getNodeLocator('9')
    await saveImage.click()

    const items = comfyPage.appMode.select.inputItems
    await expect(items).toHaveCount(1)
  })

  test('Can not select nodes with errors or notes', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    const items = comfyPage.appMode.select.inputItems
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()
    await expect(items).toHaveCount(0)

    //On ci, no models exist, so Load Checkpoint is in an error state
    await comfyPage.appMode.select.selectInputWidget(
      'Load Checkpoint',
      'ckpt_name'
    )
    await expect(items).toHaveCount(0)

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
    await expect(
      comfyPage.searchBox.input,
      'Canvas is initially editable'
    ).toHaveCount(1)
    await comfyPage.page.keyboard.press('Escape')

    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()

    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(
      comfyPage.searchBox.input,
      'Entering builder makes the canvas readonly'
    ).toHaveCount(0)

    await comfyPage.page.keyboard.press('Space')
    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(
      comfyPage.searchBox.input,
      'Canvas remains readonly after pressing space'
    ).toHaveCount(0)

    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    // oxlint-disable-next-line playwright/no-force-option -- Node container has conditional pointer-events:none that blocks actionability
    await ksampler.header.dblclick({ force: true })
    await expect(
      ksampler.titleEditor.input,
      'Double clicking node titles will not initiate a rename'
    ).toBeHidden()

    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.page.mouse.dblclick(100, 100, { delay: 5 })
    await expect(
      comfyPage.searchBox.input,
      'Canvas is no longer readonly after exiting'
    ).toHaveCount(1)
  })
})
