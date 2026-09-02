import { fileURLToPath } from 'node:url'

import type { Route } from '@playwright/test'
import { test as base } from '@playwright/test'

function assetPath(relativePath: string) {
  return fileURLToPath(new URL(relativePath, import.meta.url))
}

const IMAGE_PLACEHOLDER = assetPath('../assets/placeholder-1x1.webp')
const VIDEO_PLACEHOLDER = assetPath('../assets/placeholder.webm')

const ANALYTICS_PATTERN = '**/va.vercel-scripts.com/**' as const
const CDP_PATTERN = '**/cdp.customer.io/**' as const
const YOUTUBE_EMBED_PATTERN = '**/*.youtube-nocookie.com/**' as const
const MEDIA_PATTERN =
  /^https:\/\/((media|comfy-hub-assets)\.comfy\.org|raw\.githubusercontent\.com)\/.*\.(webp|webm|mp4|png|jpg|jpeg|vtt)(\?.*)?$/i
const VIDEO_PATTERN = /\.(webm|mp4)(\?|$)/i
const SUBTITLE_PATTERN = /\.vtt(\?|$)/i

function blockAnalytics(route: Route) {
  return route.abort('blockedbyclient')
}

function fulfillEmptyPage(route: Route) {
  return route.fulfill({ status: 200, contentType: 'text/html', body: '' })
}

async function fulfillMedia(route: Route) {
  const url = route.request().url()
  if (VIDEO_PATTERN.test(url))
    return route.fulfill({ path: VIDEO_PLACEHOLDER, status: 200 })

  if (SUBTITLE_PATTERN.test(url))
    return route.fulfill({
      status: 200,
      contentType: 'text/vtt',
      body: 'WEBVTT\n'
    })

  await route.fulfill({ path: IMAGE_PLACEHOLDER, status: 200 })
}

export const test = base.extend<{ blockExternalMedia: void }>({
  blockExternalMedia: [
    async ({ page }, use) => {
      await page.route(ANALYTICS_PATTERN, blockAnalytics)
      await page.route(CDP_PATTERN, blockAnalytics)
      await page.route(YOUTUBE_EMBED_PATTERN, fulfillEmptyPage)
      await page.route(MEDIA_PATTERN, fulfillMedia)
      await use()
    },
    { auto: true }
  ]
})
