import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('Node Library Essentials Tab', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.featureFlags.mockServerFeatures({
      node_library_essentials_enabled: true
    })
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
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

  test('Clicking essentials tab shows essentials panel', async ({
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

  test('Essential node cards are displayed', async ({ comfyPage }) => {
    const tabButton = comfyPage.page.locator('.node-library-tab-button')
    await tabButton.click()

    const essentialsTab = comfyPage.page.getByRole('tab', {
      name: /essentials/i
    })
    await essentialsTab.click()

    const essentialCards = comfyPage.page.locator('[data-node-name]')
    await expect(async () => {
      expect(await essentialCards.count()).toBeGreaterThan(0)
    }).toPass()
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
    const essentialCards = comfyPage.page.locator('[data-node-name]')
    await expect(essentialCards.first()).toBeVisible()

    await allNodesTab.click()
    await expect(essentialCards.first()).not.toBeVisible()
  })
})
