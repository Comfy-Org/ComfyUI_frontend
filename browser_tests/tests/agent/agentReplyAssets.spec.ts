import type { Route, WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  MESSAGE_DONE_EVENT,
  agentTest,
  messageDeltaEvent
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const COLLAPSED_COUNT = 12
const MODEL_COUNT = 13
const HIDDEN_MODEL = `mesh-${MODEL_COUNT - 1}.glb`

const MODEL_REPLY = Array.from(
  { length: MODEL_COUNT },
  (_, index) => `- ![mesh-${index}](/api/view?filename=mesh-${index}.glb)`
).join('\n')

const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

function pushEvent(ws: WebSocketRoute, event: unknown): void {
  ws.send(JSON.stringify(event))
}

test.describe('Agent reply assets', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('looks up 3D previews only for the reply assets on screen', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page
    const lookedUp: string[] = []

    await page.route('**/api/assets**', (route: Route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/content'))
        return route.fulfill({ contentType: 'image/png', body: PNG_PIXEL })

      const name =
        url.searchParams.get('hash') ?? url.searchParams.get('name_contains')
      if (!name) return route.fulfill(jsonRoute({ assets: [] }))

      lookedUp.push(name)
      return route.fulfill(
        jsonRoute({
          assets: [
            {
              id: `asset-${name}`,
              name,
              hash: name,
              preview_id: `preview-${name}`
            }
          ]
        })
      )
    })

    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()

    const panel = page.locator('#agent-panel-root')
    await panel
      .getByRole('textbox', { name: /^Describe ideas/ })
      .fill('show me every mesh')

    const ws = await getWebSocket()
    await panel.getByRole('button', { name: enMessages.agent.send }).click()
    await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

    pushEvent(ws, { type: 'feature_flags', data: { assets: true } })
    pushEvent(ws, messageDeltaEvent(MODEL_REPLY))
    pushEvent(ws, MESSAGE_DONE_EVENT)

    const tiles = panel.getByRole('button', { name: /^mesh-\d+$/ })
    const thumbnails = panel.locator('img[alt^="mesh-"]')

    await expect(tiles).toHaveCount(COLLAPSED_COUNT)
    await expect(thumbnails).toHaveCount(COLLAPSED_COUNT)
    expect(
      new Set(lookedUp).size,
      'a collapsed reply must only look up the models it shows'
    ).toBe(COLLAPSED_COUNT)
    expect(lookedUp).not.toContain(HIDDEN_MODEL)

    await panel.getByRole('button', { name: enMessages.agent.showMore }).click()

    await expect(tiles).toHaveCount(MODEL_COUNT)
    await expect.poll(() => lookedUp).toContain(HIDDEN_MODEL)
  })
})
