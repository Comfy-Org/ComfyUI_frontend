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

  test(
    'Can add description to widgets',
    { tag: '@vue-nodes' },
    async ({ comfyPage }) => {
      const descLocator =
        comfyPage.appMode.widgets.getWidgetDescription('6:text')

      await test.step('set up baseline app', async () => {
        await comfyPage.appMode.enterAppModeWithInputs([['6', 'text']])
        await expect(descLocator, 'Empty description hidden').toBeHidden()
      })

      const description = "Don't forget the massive fennec ears!"

      await test.step('Enter builder and add description', async () => {
        await comfyPage.appMode.enterBuilder()
        await comfyPage.appMode.steps.goToPreview()
        await expect(
          descLocator,
          'Display placeholder in builder'
        ).toBeVisible()

        await descLocator.dblclick()
        await descLocator.locator('input').fill(description)
        await descLocator.locator('input').blur()
        await expect(descLocator, 'Description updates').toHaveText(description)
      })

      await test.step('Exit builder and return to app mode', async () => {
        await comfyPage.appMode.footer.exitBuilder()
        await comfyPage.appMode.toggleAppMode()
        await expect(descLocator, 'Description displays').toHaveText(
          description
        )
      })

      await test.step('Swap workflows to test persistance', async () => {
        await comfyPage.appMode.toggleAppMode()
        await comfyPage.menu.topbar.getTab(0).click()
        await comfyPage.menu.topbar.getTab(1).click()
        await comfyPage.appMode.toggleAppMode()
        await expect(descLocator, 'Description persists').toHaveText(
          description
        )
      })
    }
  )

  test('Can not select nodes with errors or notes', async ({ comfyPage }) => {
    //Manually set error state on checkpoint loader
    //Shouldn't be needed on ci, but has spotty reliability
    await comfyPage.page.evaluate(() => (graph!.nodes[6].has_errors = true))
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

    const items = comfyPage.appMode.select.inputItems
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()
    await expect(items).toHaveCount(0)

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
    await comfyPage.searchBoxV2.openByDoubleClickCanvas()
    await expect(
      comfyPage.searchBoxV2.input,
      'Canvas is initially editable'
    ).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')

    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()

    await comfyPage.searchBoxV2.openByDoubleClickCanvas()
    await expect(
      comfyPage.searchBoxV2.input,
      'Entering builder makes the canvas readonly'
    ).toBeHidden()

    await comfyPage.page.keyboard.press('Space')
    await comfyPage.searchBoxV2.openByDoubleClickCanvas()
    await expect(
      comfyPage.searchBoxV2.input,
      'Canvas remains readonly after pressing space'
    ).toBeHidden()

    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    // oxlint-disable-next-line playwright/no-force-option -- Node container has conditional pointer-events:none that blocks actionability
    await ksampler.header.dblclick({ force: true })
    await expect(
      ksampler.titleEditor.input,
      'Double clicking node titles will not initiate a rename'
    ).toBeHidden()

    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.searchBoxV2.openByDoubleClickCanvas()
    await expect(
      comfyPage.searchBoxV2.input,
      'Canvas is no longer readonly after exiting'
    ).toBeVisible()
  })
})
