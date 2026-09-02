import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Node Library Essentials Tab', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Enable the essentials feature flag via the reactive serverFeatureFlags ref.
    // In production, this flag comes via WebSocket or remoteConfig (cloud only).
    // The localhost test server has neither, so we set it directly.
    await comfyPage.page.evaluate(() => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        node_library_essentials_enabled: true
      }
    })

    // Register a mock essential node so the essentials tab has content.
    await comfyPage.page.evaluate(() => {
      return window.app!.registerNodeDef('TestEssentialNode', {
        name: 'TestEssentialNode',
        display_name: 'Test Essential Node',
        category: 'essentials_test',
        input: { required: {}, optional: {} },
        output: ['IMAGE'],
        output_name: ['image'],
        output_is_list: [false],
        output_node: false,
        python_module: 'comfy_essentials.nodes',
        description: 'Mock essential node for testing',
        essentials_category: 'Image Generation'
      })
    })
  })

  test('Essential node cards have node names', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', true)
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
    await tab.essentialsTab.click()

    const firstCard = comfyPage.page.locator('[data-node-name]').first()
    await expect(firstCard).toBeVisible()

    await expect(firstCard).toHaveAttribute('data-node-name', /.+/)
  })

  test('Node library can switch between all and essentials tabs', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', true)
    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
    await tab.allTab.click()

    await tab.essentialsTab.click()
    await expect(tab.essentialsTab).toHaveAttribute('aria-selected', 'true')
    const essentialCards = comfyPage.page.locator('[data-node-name]')
    await expect(essentialCards.first()).toBeVisible()

    await tab.allTab.click()
    await expect(tab.allTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.essentialsTab).toHaveAttribute('aria-selected', 'false')
  })
})
