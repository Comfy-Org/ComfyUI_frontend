import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

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

  function getNode(
    comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
  ) {
    return comfyPage.vueNodes.getNodeByTitle('ModelSamplingFlux')
  }

  function getWidgets(
    comfyPage: Parameters<Parameters<typeof test>[2]>[0]['comfyPage']
  ) {
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
    await expect(node.getByText('Show advanced inputs')).toBeVisible()
  })

  test('should show advanced widgets when per-node toggle is clicked', async ({
    comfyPage
  }) => {
    const node = getNode(comfyPage)
    const widgets = getWidgets(comfyPage)

    await expect(widgets).toHaveCount(2)

    // Click the toggle button to show advanced widgets
    await expect(node.getByText('Show advanced inputs')).toBeVisible()
    await node.getByText('Show advanced inputs').click()

    await expect(widgets).toHaveCount(4)
    await expect(node.getByLabel('max_shift', { exact: true })).toBeVisible()
    await expect(node.getByLabel('base_shift', { exact: true })).toBeVisible()

    // Button text should change to "Hide advanced inputs"
    await expect(node.getByText('Hide advanced inputs')).toBeVisible()

    // Click again to hide
    await expect(node.getByText('Hide advanced inputs')).toBeVisible()
    await node.getByText('Hide advanced inputs').click()
    await expect(widgets).toHaveCount(2)
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
    await expect(node.getByText('Show advanced inputs')).not.toBeVisible()
  })
})
