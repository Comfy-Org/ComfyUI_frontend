import type { Page } from '@playwright/test'

import { entryPath, expect } from './test'

const planlessCheckout = (workspace: string) =>
  entryPath('checkout', { workspace })

/**
 * Opens a checkout link that names no plan and expects what the embedded
 * checkout always did with it: straight back to the host, the link's
 * workspace echoed, with no sign-in page shown and no session minted.
 */
export async function expectStraightToHost(
  tab: Page,
  workspace: string
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

  await tab.goto(planlessCheckout(workspace))

  await expect(tab).toHaveURL(
    `https://testcloud.comfy.org/?workspace=${workspace}`
  )
  await expect(tab.getByRole('heading', { name: 'Host app' })).toBeVisible()
  expect(shown).not.toContain('/sign-in')
  expect(mints, 'a link that goes back mints no session').toEqual([])
}
