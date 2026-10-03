import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

// Astro renders every island's HTML on the server and drops the `ssr` attribute
// from its <astro-island> wrapper once the component hydrates.
export async function expectIslandHydrated(page: Page, target: Locator) {
  const island = page.locator('astro-island').filter({ has: target })
  await expect(island).toHaveCount(1)
  await expect(island).not.toHaveAttribute('ssr')
}

// Until hydration the markup looks interactive but swallows clicks, so any
// test that clicks into an island has to wait for its wrapper first.
export async function waitForIsland(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  await expectIslandHydrated(page, target)
}
