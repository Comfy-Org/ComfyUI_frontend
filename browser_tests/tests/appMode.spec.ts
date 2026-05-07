import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'

test.describe('App mode usage', () => {
  test('Drag and Drop', async ({ comfyPage, comfyFiles }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    const { centerPanel } = comfyPage.appMode
    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])
    await expect(centerPanel, 'Enter app mode').toBeVisible()

    //an app without an image input will load the workflow
    await test.step('App without an image input loads workflow', async () => {
      await comfyPage.dragDrop.dragAndDropFile('workflowInMedia/workflow.webp')
      await expect(centerPanel).toBeHidden()
    })

    //prep a load image
    await test.step('Add a load image node', async () => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.dragDrop.dragAndDropURL('/assets/images/og-image.png')
      comfyFiles.deleteAfterTest({ filename: 'og-image.png', type: 'input' })
      const loadImage = await comfyPage.vueNodes.getNodeLocator('10')
      await expect(loadImage).toBeVisible()
    })

    const imageInput = new WidgetSelectDropdownFixture(
      comfyPage.appMode.linearWidgets.locator('.lg-node-widget')
    )

    await test.step('Enter app mode with image input', async () => {
      await comfyPage.appMode.enterAppModeWithInputs([['10', 'image']])
      await expect(centerPanel).toBeVisible()

      await expect(imageInput.root).toBeVisible()
    })

    await test.step('Dragging an image redirects to image input', async () => {
      const initialImage = await imageInput.selectedItem()

      await comfyPage.dragDrop.dragAndDropExternalResource({
        fileName: 'workflowInMedia/workflow.webp',
        preserveNativePropagation: true
      })
      comfyFiles.deleteAfterTest({ filename: 'workflow.webp', type: 'input' })

      await expect(imageInput.selection).not.toHaveText(initialImage)
      await expect(
        centerPanel,
        'A file with workflow should not open a new workflow'
      ).toBeVisible()
    })

    await test.step('Dragging a url redirects to image input', async () => {
      const secondImage = await imageInput.selectedItem()
      await comfyPage.dragDrop.dragAndDropURL('/assets/images/og-image.png', {
        preserveNativePropagation: true
      })
      comfyFiles.deleteAfterTest({
        filename: 'og-image (1).png',
        type: 'input'
      })
      await expect(imageInput.selection).not.toHaveText(secondImage)
    })
  })

  test('Widget Interaction', async ({ comfyPage }) => {
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
    expect(intermediateValue).toBeGreaterThan(initialValue)

    await seed.dragTo(decrementButton, { steps: 5 })
    const endValue = Number(await input.inputValue())
    expect(endValue).toBeLessThan(intermediateValue)

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
      const initialValue = Number(await steps.inputValue())
      await mobile.tap(
        comfyPage.page.getByRole('button', { name: 'increment' }),
        { count: 5 }
      )
      await expect(steps).toHaveValue(String(initialValue + 5))
      await mobile.tap(
        comfyPage.page.getByRole('button', { name: 'decrement' }),
        { count: 3 }
      )

      await expect(steps).toHaveValue(String(initialValue + 2))
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
