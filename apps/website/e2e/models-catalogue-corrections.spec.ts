import { expect } from '@playwright/test'

import { test } from './fixtures/modelsAccount'

test('GPT Image generation pages are discoverable as text-to-image while published URLs remain valid', async ({
  page
}) => {
  const hydrated = Promise.withResolvers<void>()
  const moduleRequested = page.waitForRequest(
    '**/_website/ModelsCatalogue.*.js'
  )
  await page.route('**/_website/ModelsCatalogue.*.js', async (route) => {
    await hydrated.promise
    await route.fallback()
  })
  try {
    await page.goto('/models/?useCase=generate-images', { waitUntil: 'commit' })
    await moduleRequested
    await expect(page.getByTestId('workshop-search')).toHaveCount(0)
    await expect(page.getByTestId('models-loading')).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: /Grok Imagine/ })
    ).toHaveCount(0)
  } finally {
    hydrated.resolve()
  }
  await page.getByTestId('workshop-search').fill('gpt image')
  const cards = page
    .getByTestId('workshop-models-grid')
    .getByTestId('workshop-model-card')
  await expect(cards).toHaveCount(3)
  await page.getByRole('link', { name: /GPT Image 1\.5/ }).click()
  await expect(page).toHaveURL(
    /\/models\/openai--gpt-image-1\.5--edit-images\/$/
  )
  await expect(
    page.getByRole('textbox', { name: 'Prompt', exact: true })
  ).toBeVisible()
  await page.goto('/models/?useCase=edit-images')
  await page.getByTestId('workshop-search').fill('gpt image')
  await expect(cards).toHaveCount(0)
})
