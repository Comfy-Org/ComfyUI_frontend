import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

import type { Route } from '@playwright/test'
import { test as base, expect } from '@playwright/test'

function assetPath(relativePath: string) {
  return fileURLToPath(new URL(relativePath, import.meta.url))
}

const IMAGE_PLACEHOLDER = assetPath('../assets/placeholder-1x1.webp')
const VIDEO_PLACEHOLDER = assetPath('../assets/placeholder.webm')
const INTER_FONT = readFileSync(
  assetPath('../assets/inter-latin.woff2')
).toString('base64')

const ANALYTICS_HOSTS = new Set([
  'www.googletagmanager.com',
  't.comfy.org',
  'va.vercel-scripts.com',
  'cdp.customer.io'
])
const EMBED_HOSTS = new Set([
  'www.youtube-nocookie.com',
  'demo.arcade.software'
])
const MEDIA_PATTERN =
  /^https:\/\/((media|comfy-hub-assets)\.comfy\.org|raw\.githubusercontent\.com)\/.*\.(webp|webm|mp4|png|jpg|jpeg|gif|avif|vtt)(\?.*)?$/i
const NODE_IMAGE_HOSTS = new Set([
  'avatars.githubusercontent.com',
  'raw.githubusercontent.com'
])
const VIDEO_PATTERN = /\.(webm|mp4)(\?|$)/i
const SUBTITLE_PATTERN = /\.vtt(\?|$)/i

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

export const test = base.extend({
  serviceWorkers: 'block',
  proxy: async ({ baseURL }, use) => {
    if (!baseURL) throw new Error('Website tests require a local baseURL')
    await using server = createServer((_request, response) => {
      response.writeHead(502).end()
    })
    server.on('connect', (_request, socket) => socket.destroy())
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP address for the deny proxy')
    await use({
      server: `http://127.0.0.1:${address.port}`,
      bypass: new URL(baseURL).hostname
    })
  },
  context: async ({ context, baseURL }, use) => {
    if (!baseURL) throw new Error('Website tests require a local baseURL')
    const localOrigin = new URL(baseURL).origin
    const unexpectedRequests = new Set<string>()

    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin === localOrigin) return route.continue()
      if (ANALYTICS_HOSTS.has(url.hostname))
        return route.abort('blockedbyclient')
      if (EMBED_HOSTS.has(url.hostname))
        return route.fulfill({ contentType: 'text/html', body: '' })
      if (url.hostname === 'js-na2.hsforms.net')
        return route.fulfill({ contentType: 'text/javascript', body: '' })
      if (url.hostname === 'fonts.googleapis.com')
        return route.fulfill({
          contentType: 'text/css',
          body: `@font-face {
            font-family: 'Inter';
            font-style: normal;
            font-weight: 100 900;
            font-display: swap;
            src: url(data:font/woff2;base64,${INTER_FONT}) format('woff2');
          }`
        })
      if (MEDIA_PATTERN.test(url.href)) return fulfillMedia(route)
      if (
        NODE_IMAGE_HOSTS.has(url.hostname) &&
        route.request().resourceType() === 'image'
      )
        return route.fulfill({ path: IMAGE_PLACEHOLDER })

      unexpectedRequests.add(url.href)
      return route.abort('blockedbyclient')
    })
    await context.routeWebSocket('**/*', (socket) => {
      unexpectedRequests.add(socket.url())
      return socket.close()
    })

    await use(context)
    expect([...unexpectedRequests], 'Unexpected external requests').toEqual([])
  }
})
