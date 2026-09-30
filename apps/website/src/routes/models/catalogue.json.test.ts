import { expect, it, vi } from 'vitest'

import { fetchModelsCatalogue } from '../../config/models-catalogue-data'
import { isWorkshopModelDisabled } from '../../config/workshop-model-availability'
import { appModels } from '../../config/workshop-app-content'
import { authoredWorkshopModels } from '../../config/workshop-browse-content'
import { workshopPages } from '../../config/workshop-page-content'
import { GET } from './catalogue.json'

async function fetchPayload() {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(GET()))
  return fetchModelsCatalogue()
}

it('serves the catalogue cards, apps included, as JSON', async () => {
  const response = GET()

  expect(response.headers.get('Content-Type')).toBe('application/json')
  expect(await response.json()).toEqual(
    JSON.parse(JSON.stringify([...workshopPages, ...appModels]))
  )
})

it('serves a payload the catalogue island parses', async () => {
  const payload = await GET().json()
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(GET()))

  expect(await fetchModelsCatalogue()).toEqual(payload)
})

it('fails the catalogue parse when a disabled model leaks into the payload', async () => {
  const disabled = authoredWorkshopModels.find((model) =>
    isWorkshopModelDisabled(model.slug)
  )
  expect(disabled).toBeDefined()
  expect(disabled).not.toHaveProperty('href')
  const payload = await GET().json()
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json([...payload, disabled]))
  )

  await expect(fetchModelsCatalogue()).rejects.toThrow()
})

it("names the alt-provider Router IDs that serve an entry's model", async () => {
  const payload = await fetchPayload()
  const kling = payload.filter((entry) => entry.routerId === 'kling/kling-v3')

  expect(kling.length).toBeGreaterThan(0)
  for (const entry of kling)
    expect('servedBy' in entry && entry.servedBy).toEqual([
      { provider: 'higgsfield', routerId: 'higgsfield/higgsfield-kling-3-std' }
    ])
  const legs = payload.flatMap((entry) =>
    'servedBy' in entry ? (entry.servedBy ?? []) : []
  )
  expect(legs.length).toBeGreaterThan(0)
  for (const { provider, routerId } of legs)
    expect(routerId).toMatch(new RegExp(`^${provider}/[^/]+$`))
})
