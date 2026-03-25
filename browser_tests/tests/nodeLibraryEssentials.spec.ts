import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('Node Library Essentials Tab', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

    // Enable the essentials feature flag via localStorage dev override.
    // getServerCapability() checks getDevOverride() (localStorage ff: prefix) first.
    await comfyPage.page.evaluate(() => {
      localStorage.setItem('ff:node_library_essentials_enabled', 'true')
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

  test('Node library opens via sidebar', async ({ comfyPage }) => {
    const tabButton = comfyPage.page.locator('.node-library-tab-button')
    await tabButton.click()

    const sidebarContent = comfyPage.page.locator(
      '.comfy-vue-side-bar-container'
    )
    await expect(sidebarContent).toBeVisible()
  })

  test('Essentials tab is visible in node library', async ({ comfyPage }) => {
    const tabButton = comfyPage.page.locator('.node-library-tab-button')
    await tabButton.click()

    const essentialsTab = comfyPage.page.getByRole('tab', {
      name: /essentials/i
    })
    await expect(essentialsTab).toBeVisible()
  })

  test('Clicking essentials tab shows essential node cards', async ({
    comfyPage
  }) => {
    const tabButton = comfyPage.page.locator('.node-library-tab-button')
    await tabButton.click()

    const essentialsTab = comfyPage.page.getByRole('tab', {
      name: /essentials/i
    })
    await essentialsTab.click()

    const essentialCards = comfyPage.page.locator('[data-node-name]')
    await expect(essentialCards.first()).toBeVisible()
  })

  test('Essential node cards have node names', async ({ comfyPage }) => {
    const tabButton = comfyPage.page.locator('.node-library-tab-button')
    await tabButton.click()

    const essentialsTab = comfyPage.page.getByRole('tab', {
      name: /essentials/i
    })
    await essentialsTab.click()

    const firstCard = comfyPage.page.locator('[data-node-name]').first()
    await expect(firstCard).toBeVisible()

    const nodeName = await firstCard.getAttribute('data-node-name')
    expect(nodeName).toBeTruthy()
    expect(nodeName!.length).toBeGreaterThan(0)
  })

  test('Node library can switch between all and essentials tabs', async ({
    comfyPage
  }) => {
    const tabButton = comfyPage.page.locator('.node-library-tab-button')
    await tabButton.click()

    const essentialsTab = comfyPage.page.getByRole('tab', {
      name: /essentials/i
    })
    const allNodesTab = comfyPage.page.getByRole('tab', { name: /^all$/i })

    await essentialsTab.click()
    await expect(essentialsTab).toHaveAttribute('aria-selected', 'true')
    const essentialCards = comfyPage.page.locator('[data-node-name]')
    await expect(essentialCards.first()).toBeVisible()

    await allNodesTab.click()
    await expect(allNodesTab).toHaveAttribute('aria-selected', 'true')
    await expect(essentialsTab).toHaveAttribute('aria-selected', 'false')
  })
})
