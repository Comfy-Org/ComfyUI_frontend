import type { Page } from '@playwright/test'

import type { MockCloud } from './cloud'
import { entryPath, expect } from './test'

export const planlessCheckout = (workspace: string) =>
  entryPath('checkout', { workspace })

const mints = (cloud: MockCloud) =>
  cloud.requests.filter((request) => request.path === '/auth/token').length

/**
 * Opens a checkout link that names no plan and expects what the embedded
 * checkout always did with it: straight back to the host, the link's
 * workspace echoed, with no sign-in page shown and no session minted.
 */
export async function expectStraightToHost(
  tab: Page,
  cloud: MockCloud,
  workspace: string
): Promise<void> {
  const mintsBefore = mints(cloud)
  const shown: string[] = []
  tab.on('framenavigated', (frame) => {
    if (frame === tab.mainFrame()) shown.push(new URL(frame.url()).pathname)
  })

  await tab.goto(planlessCheckout(workspace))

  await expect(tab).toHaveURL(
    `https://testcloud.comfy.org/?workspace=${workspace}`
  )
  await expect(tab.getByRole('heading', { name: 'Host app' })).toBeVisible()
  expect(shown).not.toContain('/sign-in')
  expect(mints(cloud), 'a link that goes back mints no session').toBe(
    mintsBefore
  )
}
