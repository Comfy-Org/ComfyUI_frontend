import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

async function waitForRootCanvasReady(page: Page) {
  await expect
    .poll(async () => {
      const state = await page.evaluate(() => ({
        rootId: window.app?.rootGraph?.id ?? '',
        canvasGraphId: window.app?.canvas?.graph?.id ?? ''
      }))
      return state.rootId !== '' && state.canvasGraphId === state.rootId
    })
    .toBe(true)
}

async function expectCanvasOnRootGraph(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        rootId: window.app!.rootGraph.id,
        canvasGraphId: window.app!.canvas.graph?.id,
        hash: window.location.hash
      }))
    )
    .toEqual({
      rootId: expect.any(String),
      canvasGraphId: expect.stringMatching(/.+/),
      hash: expect.stringMatching(/^#.+/)
    })
  const state = await page.evaluate(() => ({
    rootId: window.app!.rootGraph.id,
    canvasGraphId: window.app!.canvas.graph?.id,
    hash: window.location.hash
  }))
  expect(state.canvasGraphId).toBe(state.rootId)
  expect(state.hash).toBe(`#${state.rootId}`)
}

test.describe(
  'Subgraph hash validation (FE-559)',
  { tag: ['@subgraph'] },
  () => {
    test('redirects URL and canvas to root for a non-existent subgraph hash', async ({
      comfyPage
    }) => {
      await waitForRootCanvasReady(comfyPage.page)
      const rootId = await comfyPage.page.evaluate(
        () => window.app!.rootGraph.id
      )
      const phantomId = '11111111-1111-4111-8111-111111111111'
      expect(phantomId).not.toBe(rootId)

      await comfyPage.page.evaluate((hash) => {
        window.location.hash = hash
      }, `#${phantomId}`)

      await expect
        .poll(() => comfyPage.page.evaluate(() => window.location.hash), {
          timeout: 5000
        })
        .toBe(`#${rootId}`)
      await expectCanvasOnRootGraph(comfyPage.page)
    })

    test('redirects URL and canvas to root when hash is malformed', async ({
      comfyPage
    }) => {
      await waitForRootCanvasReady(comfyPage.page)
      const rootId = await comfyPage.page.evaluate(
        () => window.app!.rootGraph.id
      )

      await comfyPage.page.evaluate(() => {
        window.location.hash = '#not-a-valid-uuid'
      })

      await expect
        .poll(() => comfyPage.page.evaluate(() => window.location.hash), {
          timeout: 5000
        })
        .toBe(`#${rootId}`)
      await expectCanvasOnRootGraph(comfyPage.page)
    })
  }
)
