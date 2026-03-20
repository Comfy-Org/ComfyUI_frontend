import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../../fixtures/ComfyPage'

test.describe('Job History Sidebar', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.queue.mockQueueState()
    await comfyPage.queue.mockHistory([
      { promptId: 'history-job-1', status: 'success' }
    ])
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', true)
    await comfyPage.setup({ clearStorage: false })

    await comfyPage.page.getByTestId('queue-overlay-toggle').click()
    await expect(
      comfyPage.page.locator('[data-job-id="history-job-1"]')
    ).toBeVisible()
  })

  test('hover popover and actions menu stay clickable', async ({
    comfyPage
  }) => {
    const jobRow = comfyPage.page.locator('[data-job-id="history-job-1"]')
    await jobRow.hover()

    const popover = comfyPage.page.locator('.job-details-popover')
    await expect(popover).toBeVisible()
    await popover.getByRole('button', { name: /^copy$/i }).click()

    await jobRow.hover()
    const moreButton = jobRow.locator('.job-actions-menu-trigger')
    await expect(moreButton).toBeVisible()
    await moreButton.click()

    const menuPanel = comfyPage.page.locator('.job-menu-panel')
    await expect(menuPanel).toBeVisible()

    const box = await menuPanel.boundingBox()
    if (!box) {
      throw new Error('Job actions menu did not render a bounding box')
    }

    await comfyPage.page.mouse.move(
      box.x + box.width / 2,
      box.y + Math.min(box.height / 2, 24)
    )
    await expect(menuPanel).toBeVisible()

    await menuPanel.getByRole('menuitem', { name: /copy job id/i }).click()
    await expect(menuPanel).toBeHidden()
  })
})
