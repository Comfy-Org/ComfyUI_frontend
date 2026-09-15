import { beforeEach, expect, it, vi } from 'vitest'

import { prepareModelPage } from '../routes/models/model-page'
import { fetchModelsCatalogue, fetchModelsPage } from './models-page-data'
import { workshopModels } from './workshop-browse-content'

const modelSlug = 'bfl--flux-2-max--generate-images'
const page = await prepareModelPage(modelSlug)
if (page.kind !== 'page') throw new Error('Expected a canonical model fixture')
const preparedPage = page

const { fetchData } = vi.hoisted(() => ({ fetchData: vi.fn<typeof fetch>() }))

beforeEach(() => {
  vi.stubGlobal('fetch', fetchData)
})

it('restores the model form from its per-page execution contract', async () => {
  fetchData.mockResolvedValue(
    Response.json({
      ...preparedPage,
      model: { ...preparedPage.model, form: undefined }
    })
  )
  const result = await fetchModelsPage(modelSlug)
  expect(result).toEqual(preparedPage)
})

it('loads catalogue cards without execution contracts', async () => {
  fetchData.mockResolvedValue(Response.json(workshopModels))
  expect(await fetchModelsCatalogue()).toEqual(workshopModels)
})

it('rejects unsuccessful page responses', async () => {
  fetchData.mockResolvedValue(new Response(null, { status: 503 }))
  await expect(fetchModelsPage(modelSlug)).rejects.toThrow('503')
})

it('rejects malformed model data before a render view receives it', async () => {
  fetchData.mockResolvedValue(Response.json({ ...preparedPage, model: {} }))
  await expect(fetchModelsPage(modelSlug)).rejects.toThrow()
})
