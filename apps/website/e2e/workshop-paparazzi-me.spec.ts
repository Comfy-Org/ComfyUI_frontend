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

test('inserts the Paparazzi me example into a picked scene from the panel', async ({
  page,
  context
}) => {
  await mockFlags(context, true)
  await page.goto('/hub/apps/paparazzi-me/')
  const app = page.getByTestId('paparazzi-me')
  const panel = app.getByRole('complementary', { name: 'Paparazzi settings' })
  expect(await panel.boundingBox()).toMatchObject({ width: 280 })
  await expect(
    app.getByRole('img', {
      name: 'A paparazzi photo of Nova Reyes: Red carpet'
    })
  ).toBeVisible()

  const name = panel.getByRole('combobox', { name: 'Star’s name' })
  await name.fill('Sable')
  await panel.getByRole('option', { name: /Sable Quinn/ }).click()
  await expect(name).toHaveValue('Sable Quinn')
  const row = panel.getByTestId('paparazzi-scene-row')
  await expect(row).toContainText('Red carpet')

  await row.click()
  const picker = app.getByRole('dialog', { name: 'Pick a scene' })
  await expect(picker.getByRole('radio')).toHaveCount(9)
  const pickerBox = await picker.boundingBox()
  const panelBox = await panel.boundingBox()
  expect(pickerBox?.x).toBeGreaterThan((panelBox?.x ?? 0) + 280)
  await picker.getByRole('radio', { name: 'Hotel exit' }).click()
  await expect(picker).toBeHidden()
  await expect(row).toContainText('Hotel exit')
  await expect(
    app
      .getByRole('toolbar', { name: 'Paparazzi tools' })
      .getByRole('button')
      .last()
  ).toHaveAccessibleName('Redo')

  await panel.getByTestId('paparazzi-run').click()
  await expect(app.getByRole('status')).toContainText('Sable Quinn, Hotel exit')
  const download = app.getByRole('link', { name: 'Download' })
  await expect(download).toHaveAttribute('href', /^blob:/)
  await expect(download).toHaveAttribute('download', /^paparazzi-me-\d+\.jpg$/)
  await app.getByRole('button', { name: 'Compare' }).click()
  await expect(
    app.getByRole('slider', {
      name: 'Drag to compare the paparazzi photo and your shot'
    })
  ).toBeVisible()

  await app.getByRole('button', { name: 'Edit shot' }).click()
  await expect(name).toHaveValue('Sable Quinn')
})

test('inserts the example from the Paparazzi me bottom sheet on phones @mobile', async ({
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
  await sheet.getByTestId('paparazzi-scene-row').click()
  await app
    .getByRole('dialog', { name: 'Pick a scene' })
    .getByRole('radio', { name: 'Red carpet' })
    .click()
  await sheet.getByRole('button', { name: 'Hide settings' }).click()

  await sheet.getByTestId('paparazzi-run').click()
  await expect(app.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    '/images/apps/paparazzi-me/example-result.jpg'
  )
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBe(0)
})
