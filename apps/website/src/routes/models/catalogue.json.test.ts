import { expect, it, vi } from 'vitest'

import { fetchModelsCatalogue } from '@/config/models-catalogue-data'
import { isWorkshopModelDisabled } from '@/config/workshop-model-availability'
import { appModels } from '@/config/workshop-app-content'
import { authoredWorkshopModels } from '@/config/workshop-browse-content'
import { workshopPages } from '@/config/workshop-page-content'
import { GET } from './catalogue.json'
import { modelPriceEstimate } from './model-page'

it('serves the catalogue cards, apps included, as JSON', async () => {
  const response = await GET()

  expect(response.headers.get('Content-Type')).toBe('application/json')
  const served: { slug: string }[] = await response.json()
  expect(served.map(({ slug }) => slug)).toEqual(
    [...workshopPages, ...appModels].map(({ slug }) => slug)
  )
})

it('carries the price estimate each model page shows, and none where the page has none', async () => {
  const served: { slug: string; priceEstimate?: string }[] = await (
    await GET()
  ).json()
  const estimates = await Promise.all(workshopPages.map(modelPriceEstimate))

  expect(served.slice(0, workshopPages.length)).toEqual(
    JSON.parse(
      JSON.stringify(
        workshopPages.map((page, index) => ({
          ...page,
          priceEstimate: estimates[index]
        }))
      )
    )
  )
  expect(estimates.some(Boolean)).toBe(true)
})

it('serves a payload the catalogue island parses', async () => {
  const payload = await (await GET()).json()
  vi.mocked(fetch).mockResolvedValue(await GET())

  expect(await fetchModelsCatalogue()).toEqual(payload)
})

it('fails the catalogue parse when a disabled model leaks into the payload', async () => {
  const disabled = authoredWorkshopModels.find((model) =>
    isWorkshopModelDisabled(model.slug)
  )
  expect(disabled).toBeDefined()
  expect(disabled).not.toHaveProperty('href')
  const payload = await (await GET()).json()
  vi.mocked(fetch).mockResolvedValue(Response.json([...payload, disabled]))

  await expect(fetchModelsCatalogue()).rejects.toThrow()
})
