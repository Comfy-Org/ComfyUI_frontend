import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { userStylesheetFixture as test } from '@e2e/fixtures/userStylesheetFixture'

test(
  'renders the current user stylesheet and its image',
  { tag: '@oss' },
  async ({ comfyPage, userStylesheetProbe }, testInfo) => {
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => ({
          main: getComputedStyle(document.documentElement)
            .getPropertyValue('--ecs-main-stylesheet')
            .trim(),
          imported: getComputedStyle(document.documentElement)
            .getPropertyValue('--ecs-imported-stylesheet')
            .trim(),
          border: getComputedStyle(document.body, '::after').border
        }))
      )
      .toEqual({
        main: 'loaded',
        imported: 'loaded',
        border: '12px solid rgb(34, 102, 238)'
      })

    try {
      await expect(comfyPage.page).toHaveScreenshot(
        'user-stylesheet-image.png',
        {
          clip: { x: 44, y: 44, width: 8, height: 8 },
          maxDiffPixels: 0
        }
      )
    } finally {
      await testInfo.attach('stylesheet-requests', {
        body: JSON.stringify(userStylesheetProbe.requests, null, 2),
        contentType: 'application/json'
      })
    }
  }
)
