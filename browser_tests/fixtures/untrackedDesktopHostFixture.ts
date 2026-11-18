import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

/** A local Desktop 2 host whose bridge downloads models but never reports their progress. */
export const untrackedDesktopHostFixture = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      Object.assign(window, {
        __comfyDesktop2: {
          isRemote: () => false,
          downloadModel: async () => true
        }
      })
    })
    await use(page)
  }
})
