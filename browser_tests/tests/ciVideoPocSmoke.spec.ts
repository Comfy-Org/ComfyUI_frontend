import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

// PoC test for the "attach video walkthrough of new tests to the PR" CI
// change. Intentionally trivial: it only needs to exist as a *newly-added*
// spec file so CI's new-test detection has something to record a video of.
test.describe('CI video PoC smoke', { tag: '@smoke' }, () => {
  test('canvas is visible after the default workflow loads', async ({
    comfyPage
  }) => {
    await expect(comfyPage.canvas).toBeVisible()

    const nodeCount = await comfyPage.page.evaluate(
      () => window.app!.graph!.nodes.length
    )
    expect(nodeCount).toBeGreaterThan(0)
  })
})
