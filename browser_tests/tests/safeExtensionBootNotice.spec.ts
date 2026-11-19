import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.describe('Safe extension boot notice', { tag: '@ui' }, () => {
  test(
    'says custom extensions are off for a ?safe load, and a reload turns them back on',
    { tag: '@screenshot' },
    async ({ comfyPage, page }) => {
      const notice = comfyPage.toast.withText(
        'Safe mode: custom extensions are off'
      )

      await test.step('A ?safe load shows the notice once the graph is up', async () => {
        await comfyPage.goto({ url: `${comfyPage.url}/?safe` })
        await comfyPage.waitForAppReady()
        await expect(notice).toBeVisible()
        await expect(page).not.toHaveURL(/[?&]safe/)
        await expectElementScreenshot(notice, 'safe-extension-boot-notice.png')
      })

      await test.step('Reload with extensions clears it', async () => {
        // A reload back into safe mode would show the notice again once the
        // graph view is up, so wait for the new document and the app first.
        await Promise.all([
          page.waitForEvent('load'),
          notice.getByRole('button', { name: 'Reload with extensions' }).click()
        ])
        await comfyPage.waitForAppReady()
        await expect(page).not.toHaveURL(/[?&]safe/)
        await expect(notice).toHaveCount(0)
      })
    }
  )
})
