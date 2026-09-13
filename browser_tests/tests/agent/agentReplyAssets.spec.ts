import type { Route, WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { FeatureFlagsWsMessage } from '@/schemas/apiSchema'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { transparentPng } from '@e2e/fixtures/utils/viewFileMocks'
import {
  MESSAGE_DONE_EVENT,
  agentTest,
  messageDeltaEvent
} from '@e2e/tests/agent/agentPanelMocks'

const COLLAPSED_COUNT = 12
const MODEL_COUNT = 13
const HIDDEN_MODEL = `mesh-${MODEL_COUNT - 1}.glb`
const VISIBLE_MODELS = Array.from(
  { length: COLLAPSED_COUNT },
  (_, index) => `mesh-${index}.glb`
)

const MODEL_REPLY = Array.from(
  { length: MODEL_COUNT },
  (_, index) => `- ![mesh-${index}](/api/view?filename=mesh-${index}.glb)`
).join('\n')

type WsFrame =
  | AgentWsEvent
  | { type: 'feature_flags'; data: FeatureFlagsWsMessage }

function pushEvent(ws: WebSocketRoute, event: WsFrame): void {
  ws.send(JSON.stringify(event))
}

/**
 * Names the component asked the asset API about, in request order. Every
 * looked-up model answers with a ready preview, so a tile renders without
 * needing a WebGL thumbnail render.
 */
const test = mergeTests(agentTest, webSocketFixture).extend<{
  lookedUpModels: string[]
}>({
  lookedUpModels: async ({ page }, use) => {
    const lookedUp: string[] = []

    await page.route('**/api/assets**', (route: Route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/content'))
        return route.fulfill({
          contentType: 'image/png',
          body: transparentPng
        })

      const name =
        url.searchParams.get('hash') ?? url.searchParams.get('name_contains')
      if (!name) return route.fulfill(jsonRoute({ assets: [] }))

      if (/^mesh-\d+\.glb$/.test(name)) lookedUp.push(name)
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

    await use(lookedUp)
  }
})

test.describe('Agent reply assets', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('looks up 3D previews only for the reply assets on screen', async ({
    comfyPage,
    postedMessages,
    getWebSocket,
    lookedUpModels
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
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
      [...new Set(lookedUpModels)].sort(),
      'a collapsed reply must look up the models it shows, and only those'
    ).toEqual([...VISIBLE_MODELS].sort())

    await panel.getByRole('button', { name: enMessages.agent.showMore }).click()

    await expect(tiles).toHaveCount(MODEL_COUNT)
    await expect(thumbnails).toHaveCount(MODEL_COUNT)
    await expect.poll(() => new Set(lookedUpModels).size).toBe(MODEL_COUNT)
    expect(lookedUpModels).toContain(HIDDEN_MODEL)
  })
})
