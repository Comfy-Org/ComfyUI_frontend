import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../../fixtures/ComfyPage'

test.describe('Assets Sidebar', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.queue.mockHistory([
      { promptId: 'history-asset-1', status: 'success' }
    ])
    await comfyPage.setup({ clearStorage: false })

    await comfyPage.page.getByRole('button', { name: /^Assets/ }).click()
    await expect(
      comfyPage.page.getByRole('button', {
        name: /history-asset-1\.png/i
      })
    ).toBeVisible()
  })

  test('right-click menu can inspect an asset', async ({ comfyPage }) => {
    const assetCard = comfyPage.page.getByRole('button', {
      name: /history-asset-1\.png/i
    })

    await assetCard.click({ button: 'right' })

    const menuPanel = comfyPage.page.locator('.media-asset-menu-panel')
    await expect(menuPanel).toBeVisible()

    await menuPanel.getByRole('menuitem', { name: /inspect asset/i }).click()

    const dialog = comfyPage.page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Close')).toBeVisible()
  })

  test('actions menu closes on scroll', async ({ comfyPage }) => {
    const assetCard = comfyPage.page.getByRole('button', {
      name: /history-asset-1\.png/i
    })

    await assetCard.hover()
    await assetCard.getByRole('button', { name: /more options/i }).click()

    const menuPanel = comfyPage.page.locator('.media-asset-menu-panel')
    await expect(menuPanel).toBeVisible()

    await comfyPage.page.evaluate(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    await expect(menuPanel).toBeHidden()
  })
})
