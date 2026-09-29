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

test('@mobile keeps the Re-shoot aim badges to one line on a phone', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/reshoot/')
  await page.getByText('Sci-fi pilot').first().click()

  const viewport = page.getByTestId('reshoot-viewport').first()
  await expect(
    viewport.getByText('Drag to orbit', { exact: true })
  ).toBeVisible()
  await expect(viewport.getByText(/Scroll to move closer/)).toBeHidden()

  for (const badge of [
    viewport.getByTestId('reshoot-drag-hint'),
    viewport.getByTestId('reshoot-angle-readout')
  ]) {
    const box = await badge.boundingBox()
    expect(box?.height).toBeLessThan(40)
  }
})

test('@mobile pins the Re-shoot preview while the camera controls scroll under it', async ({
  page,
  context
}) => {
  await mockFlags(context, { apps: true, workflows: false })
  await page.goto('/models/apps/reshoot/')
  await page.getByText('Sci-fi pilot').first().click()

  const frame = page.getByTestId('reshoot-frame')
  const distance = page.getByRole('slider', { name: /Distance/ })
  await page.getByTestId('reshoot-action').scrollIntoViewIfNeeded()
  const pinned = await frame.boundingBox()
  expect(pinned?.y).toBeGreaterThanOrEqual(0)
  expect(pinned?.y).toBeLessThan(120)

  const before = Number(await distance.inputValue())
  await page.getByRole('button', { name: 'Move the camera closer' }).tap()
  await expect
    .poll(async () => Number(await distance.inputValue()))
    .toBeLessThan(before)
})
