import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

async function mockFlags(
  context: BrowserContext,
  flags: { apps: boolean; workflows: boolean }
) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          contentType: 'application/json',
          json: {
            featureFlags: {
              'workshop-enabled': true,
              'workshop-apps-enabled': flags.apps,
              'workshop-workflows-enabled': flags.workflows
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

test('opens Cinematic Studio on the apps flag alone', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/cinematic-studio/')
  await expect(page.getByTestId('cinematic')).toBeVisible()
  await expect(page.getByText('Cinematic Studio is not open yet')).toHaveCount(
    0
  )
})

test('keeps Cinematic Studio closed when only the workflows flag is on', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: true })
  await page.goto('/cinematic-studio/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('cinematic')).toHaveCount(0)
})

test('lists the apps that open today in the Apps tab on the apps flag', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: true })
  await page.goto('/models/?type=apps')
  const shelf = page.getByTestId('app-shelf')
  await expect(shelf.getByRole('heading', { level: 3 })).toHaveText([
    'Cinematic Studio',
    'Re-shoot a video'
  ])
  await expect(page.getByText('Apps are coming soon')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Browse all apps/ })
  ).toHaveCount(0)

  await shelf.getByRole('link', { name: /Re-shoot a video/ }).click()
  await expect(page).toHaveURL(/\/cinematic-studio\/?\?app=reshoot$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Re-shoot a video' })
  ).toBeVisible()
})

test('keeps the Apps tab on coming soon without the apps flag', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: true })
  await page.goto('/models/?type=apps')
  await expect(page.getByText('Apps are coming soon')).toBeVisible()
  await expect(page.getByTestId('workshop-app-card')).toHaveCount(0)
})
