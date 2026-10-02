import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

async function mockFlags(context: BrowserContext, enabled: boolean) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          contentType: 'application/json',
          json: {
            featureFlags: {
              'workshop-enabled': true,
              'workshop-apps-enabled': true,
              'workshop-background-removal-app-enabled': enabled
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

test('closes Background Removal while its flag is off', async ({
  page,
  context
}) => {
  await mockFlags(context, false)
  await page.goto('/hub/apps/background-removal/')
  await expect(page.getByText('Cinematic Studio is not open yet')).toBeVisible()
  await expect(page.getByTestId('background-removal')).toHaveCount(0)
})

test('removes the background of the example from the floating panel', async ({
  page,
  context
}) => {
  await mockFlags(context, true)
  await page.goto('/hub/apps/background-removal/')
  const app = page.getByTestId('background-removal')
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' })
  ).toBeHidden()
  await app.getByRole('button', { name: 'Try the example' }).click()
  const panel = app.getByRole('complementary', {
    name: 'Background Removal settings'
  })
  await panel.getByRole('radio', { name: 'Lilac' }).click()
  await panel.getByRole('button', { name: 'Format: PNG' }).click()
  await page.getByRole('menuitemradio', { name: /^WebP/ }).click()
  await expect(app.getByRole('button', { name: 'Undo' })).toBeEnabled()
  expect(await panel.boundingBox()).toMatchObject({ width: 280 })

  await panel.getByTestId('background-removal-run').click()
  await expect(app.getByRole('status')).toContainText('Removing the background')
  const download = app.getByRole('link', { name: 'Download' })
  await expect(download).toHaveAttribute('href', /^blob:/)
  await expect(download).toHaveAttribute('download', 'potted-plant-cutout.webp')
  expect((await download.boundingBox())?.y).toBe(
    (await app.getByText('GitHub · Coming soon').boundingBox())?.y
  )
  const split = app.getByRole('slider', {
    name: 'Drag to compare the original and the cutout'
  })
  await split.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(split).toHaveValue('49')

  await app.getByRole('button', { name: 'Edit settings' }).click()
  await expect(panel.getByRole('radio', { name: 'Lilac' })).toBeChecked()
})

test('removes the background from the bottom composer', async ({
  page,
  context
}) => {
  await mockFlags(context, true)
  await page.goto('/hub/apps/background-removal/?ux=e')
  const app = page.getByTestId('background-removal')
  await app.getByRole('button', { name: 'Try the example' }).click()
  await expect(app.getByRole('complementary')).toHaveCount(0)

  await app.getByRole('button', { name: /Background/ }).click()
  await app
    .getByRole('dialog', { name: 'Background' })
    .getByRole('radio', { name: 'White' })
    .click()
  await app.getByRole('button', { name: 'Format: PNG' }).click()
  await page.getByRole('menuitemradio', { name: /^WebP/ }).click()
  await expect(
    app
      .getByRole('toolbar', { name: 'Background Removal tools' })
      .getByRole('button')
      .last()
  ).toHaveAccessibleName('Redo')
  await app.getByTestId('background-removal-run').click()
  await expect(app.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'download',
    'potted-plant-cutout.webp'
  )
})

test('removes the background from the bottom sheet on phones @mobile', async ({
  page,
  context
}) => {
  await mockFlags(context, true)
  await page.goto('/hub/apps/background-removal/')
  const app = page.getByTestId('background-removal')
  await app.getByRole('button', { name: 'Try the example' }).click()
  const sheet = app.getByRole('complementary', {
    name: 'Background Removal settings'
  })

  await sheet.getByRole('button', { name: 'Transparent · PNG' }).click()
  await sheet.getByRole('radio', { name: 'White' }).click()
  await sheet.getByRole('button', { name: 'Hide settings' }).click()
  await expect(sheet.getByRole('button', { name: 'White · PNG' })).toBeVisible()

  await sheet.getByTestId('background-removal-run').click()
  await expect(app.getByRole('link', { name: 'Download' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBe(0)
})
