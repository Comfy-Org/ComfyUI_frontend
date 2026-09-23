import { readFileSync } from 'node:fs'

import { expect } from '@playwright/test'

import { workshopModelAvailabilitySchema } from '../src/config/workshop-model-availability-schema'
import { test } from './fixtures/modelsAccount'

const availability = workshopModelAvailabilitySchema.parse(
  JSON.parse(
    readFileSync(
      new URL('../src/data/workshop-model-availability.json', import.meta.url),
      'utf8'
    )
  )
)
const disabledModelSlugs = Object.entries(availability).flatMap(
  ([slug, state]) => (state.disabled ? [slug] : [])
)

test('availability manifest withholds disabled models from catalogue and routes', async ({
  request
}) => {
  const catalogueResponse = await request.get('/models/catalogue.json')
  expect(catalogueResponse.ok()).toBe(true)
  const catalogue: unknown = await catalogueResponse.json()
  if (!Array.isArray(catalogue)) throw new Error('Invalid models catalogue')
  const publishedSlugs = new Set(
    catalogue.flatMap((entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'slug' in entry &&
      typeof entry.slug === 'string'
        ? [entry.slug]
        : []
    )
  )

  expect(disabledModelSlugs.length).toBeGreaterThan(0)
  for (const slug of disabledModelSlugs) {
    expect(publishedSlugs.has(slug), `${slug} is in the catalogue`).toBe(false)
    const response = await request.get(`/models/${slug}/`)
    expect(response.status(), `${slug} has a public route`).toBe(404)
  }
})

test('GPT Image generation pages remain discoverable while disabled edit pages are withheld', async ({
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
  await expect(cards).toHaveCount(5)
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
  const disabledPage = await page.goto(
    '/models/openai--gpt-image-2--edit-images/'
  )
  expect(disabledPage?.status()).toBe(404)
  await expect(page.getByTestId('model-detail')).toHaveCount(0)
})

test('role-specific pages omit controls that their requests cannot accept', async ({
  page
}) => {
  await page.goto('/models/vertexai--veo-3--animate-images/')
  await expect(
    page.getByRole('group', { name: 'First frame', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Reference images', exact: true })
  ).toHaveCount(0)

  await page.goto('/models/byteplus--seedream-5-pro--generate-images/')
  await expect(
    page.getByRole('group', { name: 'Source images', exact: true })
  ).toHaveCount(0)
  await page.getByTestId('playground-advanced').locator('summary').click()
  await expect(page.getByText('Separate layers', { exact: true })).toHaveCount(
    0
  )
})
