import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { subgraphBreadcrumbFixture } from '@e2e/fixtures/helpers/SubgraphBreadcrumbHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const test = mergeTests(comfyPageFixture, subgraphBreadcrumbFixture)

test.describe('App mode usage', () => {
  test('Drag and Drop @vue-nodes', async ({ comfyPage, comfyFiles }) => {
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
      await comfyPage.searchBoxV2.addNode('Load Image')
      const loadImage = await comfyPage.vueNodes.getNodeLocator('10')
      await expect(loadImage).toBeVisible()
    })

    const imageInput = comfyPage.appMode.widgets.getSelectDropdown('10:image')

    await test.step('Enter app mode with image input', async () => {
      await comfyPage.appMode.enterAppModeWithInputs([['10', 'image']])
      await expect(centerPanel).toBeVisible()

      await expect(imageInput.root).toBeVisible()
    })

    await test.step('Dragging an image redirects to image input', async () => {
      const initialImage = await imageInput.selectedItem()

      await comfyPage.dragDrop.dragAndDropExternalResource({
        fileName: 'workflow.webp',
        filePath: './browser_tests/assets/workflowInMedia/workflow.webp',
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
        filename: 'og-image.png',
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

    await comfyPage.page
      .getByTestId(TestIds.widgets.selectDefaultSearchInput)
      .fill('uni')
    await comfyPage.page.keyboard.press('Enter')
    await expect(sampler).toHaveText('uni_pc')

    //verify values are consistent with litegraph
  })

  test('FormDropdown search Enter selects the top filtered item', async ({
    comfyPage
  }) => {
    await comfyPage.appMode.enableLinearMode()
    const loadImageNode = await comfyPage.nodeOps.addNode('LoadImage')
    await comfyPage.nextFrame()

    const fileComboWidget = await loadImageNode.getWidget(0)
    const targetImage = String(await fileComboWidget.getValue())
    const initialImage = 'not-selected.png'
    await comfyPage.page.evaluate(
      ([nodeId, value]) => {
        const node = window.app!.graph!.getNodeById(nodeId)
        const widget = node?.widgets?.[0]
        if (!widget) throw new Error(`Image widget not found: ${nodeId}`)

        widget.value = value
      },
      [loadImageNode.id, initialImage] as const
    )
    await expect.poll(() => fileComboWidget.getValue()).toBe(initialImage)

    await comfyPage.appMode.enterAppModeWithInputs([
      [String(loadImageNode.id), 'image']
    ])
    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    const imageInput = comfyPage.appMode.widgets.getSelectDropdown(
      `${loadImageNode.id}:image`
    )
    const popover = comfyPage.appMode.imagePickerPopover

    await expect(imageInput.root).toBeVisible()
    await imageInput.searchAndSelectTop(popover, targetImage)

    await expect(popover).toBeHidden()
    await expect(imageInput.selection).toHaveText(targetImage)
    await expect.poll(() => fileComboWidget.getValue()).toBe(targetImage)
  })

  test('Shows a single side toolbar per mode, filtered to assets + apps in app mode', async ({
    comfyPage
  }) => {
    const { sideToolbar, nodeLibraryTab, assetsTab, appsTab } = comfyPage.menu

    await test.step('Graph mode shows the full toolbar', async () => {
      await expect(sideToolbar).toHaveCount(1)
      await expect(nodeLibraryTab.tabButton).toBeVisible()
    })

    await test.step('App mode shows only assets + apps', async () => {
      await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])
      await expect(comfyPage.appMode.centerPanel).toBeVisible()

      await expect(sideToolbar).toHaveCount(1)
      await expect(assetsTab.tabButton).toBeVisible()
      await expect(appsTab.tabButton).toBeVisible()
      await expect(nodeLibraryTab.tabButton).toBeHidden()
    })
  })

  test('Workflow actions menu keeps the same position across graph/app mode', async ({
    comfyPage,
    subgraphBreadcrumb
  }) => {
    const { workflowActions, centerPanel } = comfyPage.appMode

    // Toggling graph<->app mode happens from this control, so it must not move
    // out from under the cursor as the mode flips.
    const graphActions = workflowActions.triggerIn(
      subgraphBreadcrumb.panel.root
    )
    await expect(graphActions).toBeVisible()
    const graphBox = await graphActions.boundingBox()

    expect(graphBox).not.toBeNull()

    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])
    await expect(centerPanel).toBeVisible()

    const appActions = workflowActions.triggerIn(centerPanel)
    await expect(appActions).toBeVisible()

    // The toggle segments reorder (morph) as the mode flips, so poll until the
    // active control settles at the same x it occupied in graph mode.
    await expect
      .poll(async () => {
        const box = await appActions.boundingBox()
        return box ? Math.abs(box.x - graphBox!.x) : Infinity
      })
      .toBeLessThanOrEqual(1)
  })

  test('Toggle segment flips mode without opening the menu', async ({
    comfyPage
  }) => {
    const { workflowActions } = comfyPage.appMode
    await expect(workflowActions.viewModeToggle).toBeVisible()

    await workflowActions.enterAppModeSegment.click()

    await expect(comfyPage.appMode.centerPanel).toBeVisible()
    // The inactive segment switches mode; it must not also open the actions menu.
    await expect(workflowActions.menu).toBeHidden()
    await expect(workflowActions.viewModeToggle).toBeVisible()
  })

  test('Toggle segment flips mode via keyboard without opening the menu', async ({
    comfyPage
  }) => {
    const { workflowActions } = comfyPage.appMode
    await workflowActions.enterAppModeSegment.focus()
    await workflowActions.enterAppModeSegment.press('Enter')

    await expect(comfyPage.appMode.centerPanel).toBeVisible()
    await expect(workflowActions.menu).toBeHidden()
    await expect(workflowActions.trigger).toBeFocused()
  })

  test('Mode toggle re-appears after exiting the builder to graph mode', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    await comfyPage.appMode.enableLinearMode()
    await expect(toggle).toBeVisible()

    await comfyPage.appMode.enterBuilder()
    await expect(toggle).toBeHidden()
    await expect(comfyPage.appMode.centerPanel).toBeHidden()

    await comfyPage.appMode.footer.exitButton.click()
    // Exiting the builder lands in graph mode: the app-mode-only center panel
    // stays hidden while the graph-mode toggle host re-mounts and the toggle
    // re-appears.
    await expect(toggle).toBeVisible()
    await expect(comfyPage.appMode.centerPanel).toBeHidden()
  })

  test('Mode toggle survives a sidebar tab remounting the app panel', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.appMode.workflowActions.viewModeToggle
    await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])
    await expect(comfyPage.appMode.centerPanel).toBeVisible()
    await expect(toggle).toBeVisible()

    // Opening a sidebar tab remounts the app panel; the toggle re-renders with it.
    await comfyPage.menu.assetsTab.tabButton.click()
    await expect(toggle).toBeVisible()
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
