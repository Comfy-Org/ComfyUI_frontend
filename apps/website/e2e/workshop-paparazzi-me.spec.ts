import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

async function mockFlags(context: BrowserContext, paparazzi: boolean) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          contentType: 'application/json',
          json: {
            featureFlags: {
              'workshop-enabled': true,
              'workshop-apps-enabled': true,
              'workshop-workflows-enabled': false,
              'workshop-paparazzi-me-app-enabled': paparazzi
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

test('closes Paparazzi me while its flag is off', async ({ page, context }) => {
  await mockFlags(context, false)
  await page.goto('/hub/apps/paparazzi-me/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('paparazzi-me')).toHaveCount(0)
})

test('snaps the Paparazzi me example from the floating panel', async ({
  page,
  context
}) => {
  await mockFlags(context, true)
  await page.goto('/hub/apps/paparazzi-me/')
  const app = page.getByTestId('paparazzi-me')
  await expect(
    app.getByRole('region', { name: 'Your face' }).getByRole('img')
  ).toBeVisible()
  const panel = app.getByRole('complementary', { name: 'Paparazzi settings' })

  const name = panel.getByRole('combobox', { name: 'Star’s name' })
  await name.fill('Sable')
  await panel.getByRole('option', { name: /Sable Quinn/ }).click()
  await expect(name).toHaveValue('Sable Quinn')
  await panel.getByRole('radio', { name: 'Street at night' }).click()
  await expect(app.getByRole('button', { name: 'Undo' })).toBeEnabled()

  await panel.getByTestId('paparazzi-run').click()
  await expect(app.getByRole('status')).toContainText('Developing the shot')
  await expect(app.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    /^blob:/
  )
  await app.getByRole('button', { name: 'Compare' }).click()
  await expect(
    app.getByRole('slider', {
      name: 'Drag to compare your photo and the paparazzi shot'
    })
  ).toBeVisible()

  await app.getByRole('button', { name: 'Edit shot' }).click()
  await expect(name).toHaveValue('Sable Quinn')
})

test('snaps from the Paparazzi me bottom sheet on phones @mobile', async ({
  page,
  context
}) => {
  await mockFlags(context, true)
  await page.goto('/hub/apps/paparazzi-me/')
  const app = page.getByTestId('paparazzi-me')
  const sheet = app.getByRole('complementary', { name: 'Paparazzi settings' })
  await sheet
    .getByRole('button', { name: 'Nova Reyes · Red carpet · 2K' })
    .click()
  await sheet.getByRole('radio', { name: 'Airport' }).click()
  await sheet.getByRole('button', { name: 'Hide settings' }).click()
  await expect(
    sheet.getByRole('button', { name: 'Nova Reyes · Airport · 2K' })
  ).toBeVisible()

  await sheet.getByTestId('paparazzi-run').click()
  await expect(app.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    '/images/apps/paparazzi-me/result-airport.jpg'
  )
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBe(0)
})
