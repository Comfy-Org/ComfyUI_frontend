import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

test('a single supported resolution stays visible but cannot be changed', async ({
  page
}) => {
  await page.goto('/models/krea--krea-2-medium-turbo--generate-images/')
  const resolution = page.getByRole('combobox', {
    name: 'Resolution',
    exact: true
  })
  await expect(resolution).toBeDisabled()
  await expect(resolution.getByRole('option')).toHaveCount(1)
  await expect(
    resolution.getByRole('option', { selected: true })
  ).not.toHaveText('')
})

test('FLUX Erase hydrates its local image and mask and shows an actual Erase result', async ({
  page
}) => {
  const response = await page.goto('/models/bfl--flux-erase--edit-images/')
  expect(await response?.text()).not.toContain('blob:nodedata:')
  const image = page
    .getByRole('group', { name: 'Reference image', exact: true })
    .getByRole('img')
  const mask = page
    .getByRole('group', { name: 'Mask', exact: true })
    .getByRole('img')
  for (const preview of [image, mask]) {
    await expect(preview).toHaveAttribute('src', /^blob:http:/)
    await expect(preview).toHaveJSProperty('naturalWidth', 256)
  }
  await expect(
    page.getByTestId('playground-output').getByRole('img')
  ).toHaveAttribute('src', /\/output\/api_flux_erase_image\.png$/)
})

test('Kontext Pro shows a sourced price estimate', async ({ page }) => {
  await page.goto('/models/bfl--flux-kontext-pro--edit-images/')
  await expect(page.getByTestId('model-price')).toContainText(
    'Estimated 8.44 credits/Run'
  )
})

test('Beeble displays readable options while the API keeps its native values', async ({
  page
}) => {
  await page.goto('/models/beeble--switchx-video-edit--edit-videos/')
  const alpha = page.getByRole('combobox', {
    name: 'Transparency mode',
    exact: true
  })
  await expect(
    alpha.getByRole('option', { name: 'Auto', exact: true })
  ).toHaveCount(1)
  await expect(
    alpha.getByRole('option', { name: 'Fill', exact: true })
  ).toHaveCount(1)
  await alpha.selectOption({ label: 'Fill' })
  await page.getByRole('tab', { name: 'API', exact: true }).click()
  await expect(page.getByTestId('snippet')).toContainText('fill')
})

test('HeyGen offers named language and locale choices and keeps Voice ID in Advanced', async ({
  page
}) => {
  await page.goto('/models/heygen--starfish-tts--audio/')
  await expect(
    page.getByRole('combobox', { name: 'Language', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Locale', exact: true })
  ).toBeVisible()
  await expect(page.getByTestId('field-voice_id')).not.toBeVisible()
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption({ label: 'French' })
  await page
    .getByRole('combobox', { name: 'Locale', exact: true })
    .selectOption({ label: 'French (France)' })
  await page.getByTestId('playground-advanced').locator('summary').click()
  await expect(
    page.getByRole('textbox', { name: 'Voice ID', exact: true })
  ).toBeVisible()
  await page.getByRole('tab', { name: 'API', exact: true }).click()
  await expect(page.getByTestId('snippet')).toContainText('fr-FR')
  await expect(page.getByTestId('snippet')).not.toContainText('French (France)')
})

test('BRIA Expand previews its source image instead of showing a URL textbox', async ({
  page
}) => {
  await page.goto('/models/bria--expand-image--edit-images/')
  const source = page.getByRole('group', { name: 'Source image', exact: true })
  await expect(source.getByRole('img')).toBeVisible()
  await expect(source.getByRole('img')).toHaveJSProperty('naturalWidth', 1)
  await expect(source.getByRole('textbox')).toHaveCount(0)
  await expect(
    source.getByLabel('Source image', { exact: true })
  ).toHaveAttribute('type', 'file')
})
