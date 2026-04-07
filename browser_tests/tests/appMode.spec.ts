import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('App mode usage', () => {
  test('Drag and Drop', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    const { centerPanel } = comfyPage.appMode
    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])
    await expect(centerPanel).toBeVisible()
    //an app without an image input will load the workflow
    await comfyPage.dragDrop.dragAndDropFile('workflowInMedia/workflow.webp')
    await expect(centerPanel).not.toBeVisible()

    //prep a load image
    await comfyPage.dragDrop.dragAndDropURL('/assets/images/og-image.png')
    const loadImage = await comfyPage.vueNodes.getNodeLocator('12')
    await expect(loadImage).toBeVisible()

    await comfyPage.appMode.enterAppModeWithInputs([['12', 'image']])
    await expect(centerPanel).toBeVisible()
    //an app with an image input will upload the image to the input
    await comfyPage.dragDrop.dragAndDropFile('workflowInMedia/workflow.webp')
    await expect(centerPanel).toBeVisible()
    //an app with an image input can load from a uri-source
    await comfyPage.dragDrop.dragAndDropURL('/assets/images/og-image.png')
    await expect(centerPanel).toBeVisible()
  })
  test('Widet Interaction', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([
      ['3', 'seed'],
      ['3', 'sampler_name'],
      ['6', 'text']
    ])
    const seed = comfyPage.appMode.linearWidgets.getByLabel('seed', {
      exact: true
    })
    const { input, incrementButton, decrementButton } =
      comfyPage.vueNodes.getInputNumberControls(seed)
    const initialValue = Number(await input.inputValue())

    await seed.dragTo(incrementButton, { steps: 5 })
    const intermediateValue = Number(await input.inputValue())
    await expect(intermediateValue).toBeGreaterThan(initialValue)

    await seed.dragTo(decrementButton, { steps: 5 })
    const endValue = Number(await input.inputValue())
    await expect(endValue).toBeLessThan(intermediateValue)

    const sampler = comfyPage.appMode.linearWidgets.getByLabel('sampler_name', {
      exact: true
    })
    await sampler.click()

    await comfyPage.page.getByRole('searchbox').fill('uni')
    await comfyPage.page.keyboard.press('ArrowDown')
    await comfyPage.page.keyboard.press('Enter')
    await expect(sampler).toHaveText('uni_pc')

    //verify values are consistent with litegraph
  })
  test.describe('Mobile', { tag: ['@mobile'] }, () => {
    test('panel navigation', async ({ comfyPage }) => {
      const { mobile } = comfyPage.appMode
      await comfyPage.appMode.enterAppModeWithInputs([['3', 'steps']])
      await expect(mobile.view).toBeVisible()
      await expect(mobile.navigation).toBeVisible()

      await mobile.navigateTab('assets')
      await expect(mobile.contentPanel).toHaveAccessibleName('Assets')

      const buttons = await mobile.navigationTabs.all()
      await buttons[0].dragTo(buttons[2], { steps: 5 })
      await expect(mobile.contentPanel).toHaveAccessibleName('Outputs')

      await mobile.navigateTab('run')
      await expect(comfyPage.appMode.linearWidgets).toBeInViewport({ ratio: 1 })

      const steps = comfyPage.page.getByRole('spinbutton')
      await expect(steps).toHaveValue('20')
      await mobile.tap(
        comfyPage.page.getByRole('button', { name: 'increment' }),
        { count: 5 }
      )
      await expect(steps).toHaveValue('25')
      await mobile.tap(
        comfyPage.page.getByRole('button', { name: 'decrement' }),
        { count: 3 }
      )

      await expect(steps).toHaveValue('22')
    })

    test('workflow selection', async ({ comfyPage }) => {
      const widgetNames = ['seed', 'steps', 'denoise', 'cfg']
      for (const name of widgetNames)
        await comfyPage.appMode.enterAppModeWithInputs([['3', name]])
      await expect(comfyPage.appMode.mobile.workflows).toBeVisible()

      const widgets = comfyPage.appMode.linearWidgets
      await comfyPage.appMode.mobile.navigateTab('run')
      for (let i = 0; i < widgetNames.length; i++) {
        await comfyPage.appMode.mobile.switchWorkflow(`(${i + 2})`)
        await expect(widgets.getByText(widgetNames[i])).toBeVisible()
      }
    })
  })
})
