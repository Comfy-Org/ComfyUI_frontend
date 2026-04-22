import { fileURLToPath } from 'node:url'

import { test as base } from '@playwright/test'

const IMAGE_PLACEHOLDER = fileURLToPath(
  new URL('../assets/placeholder-1x1.webp', import.meta.url)
)
const VIDEO_PLACEHOLDER = fileURLToPath(
  new URL('../assets/placeholder.webm', import.meta.url)
)

const MEDIA_PATTERN =
  /^https:\/\/media\.comfy\.org\/.*\.(webp|webm|mp4|png|jpg|jpeg|vtt)(\?.*)?$/i

export const test = base.extend<{ blockExternalMedia: void }>({
  blockExternalMedia: [
    async ({ page }, use) => {
      await page.route('**/va.vercel-scripts.com/**', (route) =>
        route.abort('blockedbyclient')
      )
      await page.route(MEDIA_PATTERN, async (route) => {
        const url = route.request().url()
        if (/\.(webm|mp4)(\?|$)/i.test(url)) {
          await route.fulfill({ path: VIDEO_PLACEHOLDER, status: 200 })
        } else if (/\.vtt(\?|$)/i.test(url)) {
          await route.fulfill({
            status: 200,
            contentType: 'text/vtt',
            body: 'WEBVTT\n'
          })
        } else {
          await route.fulfill({ path: IMAGE_PLACEHOLDER, status: 200 })
        }
      })
      await use()
    },
    { auto: true }
  ]
})
