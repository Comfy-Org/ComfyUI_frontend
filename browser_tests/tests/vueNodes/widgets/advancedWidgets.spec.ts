import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const SHOW_ADVANCED_INPUTS = 'Show advanced inputs'
const HIDE_ADVANCED_INPUTS = 'Hide advanced inputs'

test.describe('Advanced Widget Visibility', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting(
      'Comfy.Node.AlwaysShowAdvancedWidgets',
      false
    )

    // Add a ModelSamplingFlux node which has both advanced (max_shift,
    // base_shift) and non-advanced (width, height) widgets.
    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('ModelSamplingFlux')!
      node.pos = [500, 200]
      window.app!.graph.add(node)
    })
    await comfyPage.vueNodes.waitForNodes()
  })

  function getNode(comfyPage: ComfyPage) {
    return comfyPage.vueNodes.getNodeByTitle('ModelSamplingFlux')
  }

  function getWidgets(comfyPage: ComfyPage) {
    return getNode(comfyPage).locator('.lg-node-widget')
  }

  test('should hide advanced widgets by default', async ({ comfyPage }) => {
    const node = getNode(comfyPage)
    const widgets = getWidgets(comfyPage)

    // Non-advanced widgets (width, height) should be visible
    await expect(widgets).toHaveCount(2)
    await expect(node.getByLabel('width', { exact: true })).toBeVisible()
    await expect(node.getByLabel('height', { exact: true })).toBeVisible()

    // Advanced widgets should not be rendered
    await expect(
      node.getByLabel('max_shift', { exact: true })
    ).not.toBeVisible()
    await expect(
      node.getByLabel('base_shift', { exact: true })
    ).not.toBeVisible()

    // "Show advanced inputs" button should be present
    await expect(node.getByText(SHOW_ADVANCED_INPUTS)).toBeVisible()
  })

  test('should show advanced widgets when per-node toggle is clicked', async ({
    comfyPage
  }) => {
    const node = getNode(comfyPage)
    const widgets = getWidgets(comfyPage)

    await expect(widgets).toHaveCount(2)

    // Click the toggle button to show advanced widgets
    await node.getByText(SHOW_ADVANCED_INPUTS).click()

    await expect(widgets).toHaveCount(4)
    await expect(node.getByLabel('max_shift', { exact: true })).toBeVisible()
    await expect(node.getByLabel('base_shift', { exact: true })).toBeVisible()

    // Button text should change to "Hide advanced inputs"
    await expect(node.getByText(HIDE_ADVANCED_INPUTS)).toBeVisible()

    // Click again to hide
    await node.getByText(HIDE_ADVANCED_INPUTS).click()
    await expect(widgets).toHaveCount(2)
  })

  test('should hide advanced footer button while collapsed', async ({
    comfyPage
  }) => {
    const node = getNode(comfyPage)
    const showAdvancedButton = node.getByText(SHOW_ADVANCED_INPUTS)
    const vueNode =
      await comfyPage.vueNodes.getFixtureByTitle('ModelSamplingFlux')

    await expect(showAdvancedButton).toBeVisible()

    await vueNode.toggleCollapse()
    await comfyPage.nextFrame()

    await expect(showAdvancedButton).toBeHidden()

    await vueNode.toggleCollapse()
    await comfyPage.nextFrame()

    await expect(showAdvancedButton).toBeVisible()
  })

  test('should show advanced widgets when global setting is enabled', async ({
    comfyPage
  }) => {
    const node = getNode(comfyPage)
    const widgets = getWidgets(comfyPage)

    await expect(widgets).toHaveCount(2)

    // Enable the global setting
    await comfyPage.settings.setSetting(
      'Comfy.Node.AlwaysShowAdvancedWidgets',
      true
    )

    // All 4 widgets should now be visible
    await expect(widgets).toHaveCount(4)
    await expect(node.getByLabel('max_shift', { exact: true })).toBeVisible()
    await expect(node.getByLabel('base_shift', { exact: true })).toBeVisible()

    // The toggle button should not be shown when global setting is active
    await expect(node.getByText(SHOW_ADVANCED_INPUTS)).toBeHidden()
  })
})
