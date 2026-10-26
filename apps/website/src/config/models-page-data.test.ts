import { expect, it, vi } from 'vitest'

import { prepareModelPage } from '@/routes/models/model-page'
import { workshopModels } from './workshop-browse-content'
import { fetchModelsCatalogue } from './models-catalogue-data'
import { fetchModelsPage } from './models-page-data'

const modelSlug = 'bfl--flux-2-max--generate-images'
const page = await prepareModelPage(modelSlug)
if (page.kind !== 'page') throw new Error('Expected a canonical model fixture')
const preparedPage = page

it('restores the model form from its per-page execution contract', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({
      ...preparedPage,
      model: { ...preparedPage.model, form: undefined }
    })
  )
  const result = await fetchModelsPage(modelSlug)
  expect(result).toEqual(preparedPage)
})

it('keeps the model files a workflow page needs', async () => {
  const workflowSlug = 'workflows/change-material'
  const workflowPage = await prepareModelPage(workflowSlug)
  if (workflowPage.kind !== 'page' || !('parts' in workflowPage.model))
    throw new Error('Expected a workflow page fixture')
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(workflowPage))

  const result = await fetchModelsPage(workflowSlug)

  expect(result.model).toHaveProperty('parts', workflowPage.model.parts)
  expect(workflowPage.model.parts.files).toContainEqual({
    name: 'qwen_image_vae.safetensors',
    directory: 'vae',
    folder: 'models/vae/',
    href: '/hub/models/local/qwen-image-vae/',
    downloadUrl:
      'https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors'
  })
})

it('loads catalogue cards without execution contracts', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json(workshopModels))
  expect(await fetchModelsCatalogue()).toEqual(workshopModels)
})

it('rejects unsuccessful page responses', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }))
  await expect(fetchModelsPage(modelSlug)).rejects.toThrow('503')
})

it('rejects malformed model data before a render view receives it', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({ ...preparedPage, model: {} })
  )
  await expect(fetchModelsPage(modelSlug)).rejects.toThrow()
})
