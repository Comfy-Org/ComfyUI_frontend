import { test as base } from '@playwright/test'

interface TestWindow extends Window {
  __ws__?: Record<string, WebSocket>
}

export const webSocketFixture = base.extend<{
  ws: { trigger(data: unknown, url?: string): Promise<void> }
}>({
  ws: [
    async ({ page }, use) => {
      // Each time a page loads, to catch navigations
      page.on('load', async () => {
        await page.evaluate(function () {
          // Create a wrapper for WebSocket that stores them globally
          // so we can look it up to trigger messages
          const store: Record<string, WebSocket> = ((
            window as TestWindow
          ).__ws__ = {})
          window.WebSocket = class extends window.WebSocket {
            constructor(
              ...rest: ConstructorParameters<typeof window.WebSocket>
            ) {
              super(...rest)
              store[this.url] = this
            }
          }
        })
      })

      await use({
        async trigger(data, url) {
          // Trigger a websocket event on the page
          await page.evaluate(
            function ([data, url]) {
              if (!url) {
                // If no URL specified, use page URL
                const u = new URL(window.location.toString())
                u.protocol = 'ws:'
                u.pathname = '/'
                url = u.toString() + 'ws'
              }
              const wsStore = (window as TestWindow).__ws__
              if (!wsStore) {
                throw new Error(
                  'TestWindow.__ws__ is not initialized. The WebSocket fixture may not have been properly set up.'
                )
              }
              const ws = wsStore[url]
              if (!ws) {
                throw new Error(
                  `WebSocket not found for URL: ${url}. Available URLs: ${Object.keys(wsStore).join(', ')}`
                )
              }
              ws.dispatchEvent(
                new MessageEvent('message', {
                  data
                })
              )
            },
            [JSON.stringify(data), url]
          )
        }
      })
    },
    // We need this to run automatically as the first thing so it adds handlers as soon as the page loads
    { auto: true }
  ]
})
