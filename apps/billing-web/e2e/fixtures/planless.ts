import type { Page } from '@playwright/test'

import { CLOUD_ORIGIN } from './env'
import { entryPath, expect } from './test'

/**
 * Opens a checkout link that names no plan and expects it to leave for
 * `destination` at once, with no sign-in page shown and no session minted.
 */
export async function expectPlanlessLinkToLeaveFor(
  tab: Page,
  link: Record<string, string>,
  destination: string
): Promise<void> {
  const shown: string[] = []
  const mints: string[] = []
  tab.on('framenavigated', (frame) => {
    if (frame === tab.mainFrame()) shown.push(new URL(frame.url()).pathname)
  })
  tab.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/token')
      mints.push(request.url())
  })

  await tab.goto(entryPath('checkout', link))

  await expect(tab).toHaveURL(destination)
  await expect(tab.getByRole('heading', { name: 'Host app' })).toBeVisible()
  expect(shown).not.toContain('/sign-in')
  expect(mints, 'a link that goes back mints no session').toEqual([])
}

/** The host's pricing table, in the link's workspace: where a plan is picked. */
export async function expectStraightToPricingTable(
  tab: Page,
  workspace: string
): Promise<void> {
  await expectPlanlessLinkToLeaveFor(
    tab,
    { workspace },
    `${CLOUD_ORIGIN}/?pricing=1&workspace=${workspace}`
  )
}
