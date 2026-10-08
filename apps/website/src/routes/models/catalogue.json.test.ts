import { expect, it, vi } from 'vitest'

import { fetchModelsCatalogue } from '@/config/models-catalogue-data'
import { isWorkshopModelDisabled } from '@/config/workshop-model-availability'
import { appModels } from '@/config/workshop-app-content'
import { authoredWorkshopModels } from '@/config/workshop-browse-content'
import { workshopPages } from '@/config/workshop-page-content'
import { GET } from './catalogue.json'

it('serves the catalogue cards, apps included, as JSON', async () => {
  const response = GET()

  expect(response.headers.get('Content-Type')).toBe('application/json')
  expect(await response.json()).toEqual(
    JSON.parse(JSON.stringify([...workshopPages, ...appModels]))
  )
})

it('serves a payload the catalogue island parses', async () => {
  const payload = await GET().json()
  vi.mocked(fetch).mockImplementation(
    vi.fn<typeof fetch>().mockResolvedValue(GET())
  )

  expect(await fetchModelsCatalogue()).toEqual(payload)
})

it('fails the catalogue parse when a disabled model leaks into the payload', async () => {
  const disabled = authoredWorkshopModels.find((model) =>
    isWorkshopModelDisabled(model.slug)
  )
  expect(disabled).toBeDefined()
  expect(disabled).not.toHaveProperty('href')
  const payload = await GET().json()
  vi.mocked(fetch).mockImplementation(
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json([...payload, disabled]))
  )

  await expect(fetchModelsCatalogue()).rejects.toThrow()
})
