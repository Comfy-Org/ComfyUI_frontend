import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

test.describe('App mode usage', () => {
  test('Drag and Drop', async ({ comfyPage }) => {
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
  test('Widget Interaction', async ({ comfyPage }) => {
    await comfyPage.appMode.enterAppModeWithInputs([
      ['4', 'seed'],
      ['4', 'sampler_name'],
      ['6', 'text']
    ])
  })
  test.describe('Mobile', { tag: ['@mobile'] }, () => {
    test('panel navigation', async ({ comfyPage }) => {
      const { mobileNavigation, mobileView } = comfyPage.appMode
      await comfyPage.appMode.enterAppModeWithInputs([['3', 'steps']])
      await expect(mobileView).toBeVisible()

      const panel = comfyPage.page.getByRole('tabpanel')
      await expect(mobileNavigation).toBeVisible()
      await comfyPage.appMode.mobileNavigateTab('assets')
      await expect(panel).toContainClass('left-[200vw]')
      const buttons = await mobileNavigation.getByRole('tab').all()
      await buttons[0].dragTo(buttons[2], { steps: 5 })
      await expect(panel).toContainClass('left-[100vw]')

      await comfyPage.appMode.mobileNavigateTab('run')
      const widgets = mobileView.getByTestId(TestIds.linear.widgetContainer)
      await expect(widgets).toBeInViewport({ ratio: 1 })

      const steps = comfyPage.page.getByRole('spinbutton')
      await expect(steps).toHaveValue('20')
      await comfyPage.page
        .getByRole('button', { name: 'increment' })
        .click({ clickCount: 5 })
      await expect(steps).toHaveValue('25')
      await comfyPage.page
        .getByRole('button', { name: 'decrement' })
        .click({ clickCount: 3 })
      await expect(steps).toHaveValue('22')
    })

    test('workflow selection', async ({ comfyPage }) => {
      const widgetNames = ['seed', 'steps', 'denoise', 'cfg']
      for (const name of widgetNames)
        await comfyPage.appMode.enterAppModeWithInputs([['3', name]])
      await expect(comfyPage.appMode.mobileWorkflows).toBeVisible()
      const widgets = comfyPage.appMode.linearWidgets
      await comfyPage.appMode.mobileView
        .getByRole('tab', { name: 'Edit & Run' })
        .click()
      for (let i = 0; i < widgetNames.length; i++) {
        await comfyPage.appMode.switchMobileWorkflow(`(${i + 2})`)
        await expect(widgets.getByText(widgetNames[i])).toBeVisible()
      }
    })
  })
})
