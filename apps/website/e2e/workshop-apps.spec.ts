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
  await page.goto('/models/apps/cinematic-studio/')
  await expect(page.getByTestId('cinematic')).toBeVisible()
  await expect(page.getByText('Cinematic Studio is not open yet')).toHaveCount(
    0
  )
})

test('keeps Cinematic Studio closed on the workflows flag alone', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: false, workflows: true })
  await page.goto('/models/apps/cinematic-studio/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('cinematic')).toHaveCount(0)
})

test('lists both apps in the catalogue Apps tab, on /models/apps/ pages', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/?type=apps')
  const shelf = page.getByTestId('app-shelf')
  const cards = shelf.getByRole('link')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toHaveAttribute(
    'href',
    '/models/apps/cinematic-studio/'
  )
  await expect(cards.nth(1)).toHaveAttribute('href', '/models/apps/reshoot/')
  await expect(
    page.getByRole('button', { name: /Browse all apps/ })
  ).toHaveCount(0)
})

test('sends the old studio address to the app page it named', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/cinematic-studio/?app=reshoot&ux=d&model=flux')
  await expect(page).toHaveURL(/\/models\/apps\/reshoot\/\?ux=d&model=flux$/)
})

test('shows a preview frame for every Cinematic Studio shot option', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/cinematic-studio/')
  await page
    .getByRole('button', { name: /^Shot\b/ })
    .first()
    .click()

  const shots = page.getByRole('radiogroup', { name: 'Shot' })
  await expect(shots.getByRole('radio')).toHaveCount(8)
  await expect(
    shots.locator('img[src^="/images/cinematic-studio/options/shot-"]')
  ).toHaveCount(7)
  for (const id of [
    'xwide',
    'wide',
    'medium',
    'close',
    'xclose',
    'ots',
    'low'
  ]) {
    await expect(
      shots.locator(
        `img[src="/images/cinematic-studio/options/shot-${id}.jpg"]`
      )
    ).toHaveCount(1)
  }
})

test('matches the Cinematic Studio grade to an uploaded image', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/cinematic-studio/')

  await expect(
    page.getByRole('button', { name: /Add a palette reference/ })
  ).toHaveCount(0)
  await page.getByRole('button', { name: /^Grade/ }).click()
  await page
    .getByTestId('cinematic-grade-image-input')
    .setInputFiles('public/images/cinematic-studio/neon-street.jpg')

  await expect(page.getByRole('button', { name: /^Grade/ })).toContainText(
    'Your image'
  )
})
