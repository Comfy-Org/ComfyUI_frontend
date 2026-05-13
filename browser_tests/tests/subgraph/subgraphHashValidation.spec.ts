import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Subgraph hash validation (FE-559)',
  { tag: ['@subgraph'] },
  () => {
    test('redirects to root when navigating to a non-existent subgraph hash', async ({
      comfyPage
    }) => {
      const rootId = await comfyPage.page.evaluate(
        () => window.app!.rootGraph.id
      )
      const phantomId = '11111111-1111-4111-8111-111111111111'
      expect(phantomId).not.toBe(rootId)

      await comfyPage.page.evaluate((hash) => {
        window.location.hash = hash
      }, `#${phantomId}`)

      await expect
        .poll(() => comfyPage.page.evaluate(() => window.location.hash))
        .toBe(`#${rootId}`)
    })

    test('redirects to root when hash is malformed (not a UUID)', async ({
      comfyPage
    }) => {
      const rootId = await comfyPage.page.evaluate(
        () => window.app!.rootGraph.id
      )

      await comfyPage.page.evaluate(() => {
        window.location.hash = '#not-a-valid-uuid'
      })

      await expect
        .poll(() => comfyPage.page.evaluate(() => window.location.hash))
        .toBe(`#${rootId}`)
    })
  }
)
