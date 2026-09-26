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

test('opens Cinematic Studio on the workflows flag alone', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: true })
  await page.goto('/cinematic-studio/')
  await expect(page.getByTestId('cinematic')).toBeVisible()
})

test('keeps Cinematic Studio closed without the apps or workflows flag', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: false })
  await page.goto('/cinematic-studio/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('cinematic')).toHaveCount(0)
})

test('lists the apps in the Apps tab for everyone who sees workflows', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: true })
  await page.goto('/models/?type=apps')
  const shelf = page.getByTestId('app-shelf')
  await expect(shelf.getByRole('heading', { level: 3 })).toHaveText([
    'Cinematic Studio',
    'Re-shoot a video'
  ])
  await expect(
    page.getByRole('button', { name: /Browse all apps/ })
  ).toHaveCount(0)

  await shelf.getByRole('link', { name: /Re-shoot a video/ }).click()
  await expect(page).toHaveURL(/\/cinematic-studio\/?\?app=reshoot$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Re-shoot a video' })
  ).toBeVisible()
})
