import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { E2E_USER } from './env'
import type { MockCloud } from './cloud'
import { installMockCloud } from './cloud'

/** The entry URL a product would mint for one intent, on the `test` family. */
export function entryPath(
  intent: string,
  extra: Record<string, string> = {}
): string {
  const params = new URLSearchParams({
    product: 'comfyui',
    return_to: 'comfyui_workspace',
    ...extra
  })
  return `/v1/${intent}?${params.toString()}`
}

async function signInThroughEmail(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/)
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(E2E_USER.email)
  await page.getByLabel('Password', { exact: true }).fill(E2E_USER.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL((url) => `${url.pathname}${url.search}` === path)
}

export const test = base.extend<{
  cloud: MockCloud
  /** Opens an entry link, signs in through the mocked identity, and lands back on it. */
  signIn: (path: string) => Promise<void>
}>({
  // Auto, so no spec can reach the network before the mock is in place.
  cloud: [
    async ({ context }, use) => {
      await use(await installMockCloud(context))
    },
    { auto: true }
  ],
  signIn: async ({ page }, use) => {
    await use((path) => signInThroughEmail(page, path))
  }
})

export { expect }
