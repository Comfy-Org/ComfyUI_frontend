import { describe, expect, it } from 'vitest'

import type { RouterWorkshopModel } from '@/config/models-catalogue'
import { workshopModels } from '@/config/workshop-browse-content'
import { modelDefinition, modelFacts } from './model-definition'

const routerModel = (
  overrides: Partial<RouterWorkshopModel> = {}
): RouterWorkshopModel => ({
  slug: 'bfl--flux-2-max--generate-images',
  name: 'FLUX 2 Max Text-to-Image',
  provider: 'Black Forest Labs',
  task: 'text-to-image',
  modality: 'image',
  workflowCount: 0,
  capabilities: [],
  routerId: 'bfl/flux-2-max',
  ...overrides
})

describe('modelDefinition', () => {
  it.for([
    {
      case: 'names the task and the provider',
      model: routerModel(),
      expected:
        'FLUX 2 Max Text-to-Image is a text-to-image model from Black Forest Labs. On Comfy you can run it in your browser or call it through the Comfy Router API as bfl/flux-2-max.'
    },
    {
      case: 'uses "an" before a vowel task',
      model: routerModel({
        name: 'Kling O3 Image-to-Video',
        provider: 'Kling',
        task: 'image-to-video',
        routerId: 'kling/o3'
      }),
      expected:
        'Kling O3 Image-to-Video is an image-to-video model from Kling. On Comfy you can run it in your browser or call it through the Comfy Router API as kling/o3.'
    },
    {
      case: 'drops the provider clause when the provider is unknown',
      model: routerModel({ provider: undefined }),
      expected:
        'FLUX 2 Max Text-to-Image is a text-to-image model. On Comfy you can run it in your browser or call it through the Comfy Router API as bfl/flux-2-max.'
    },
    {
      case: 'drops the task when the output is unknown',
      model: routerModel({ task: 'text-to-other' }),
      expected:
        'FLUX 2 Max Text-to-Image is a model from Black Forest Labs. On Comfy you can run it in your browser or call it through the Comfy Router API as bfl/flux-2-max.'
    }
  ])('$case', ({ model, expected }) => {
    expect(modelDefinition(model)).toBe(expected)
  })

  it('writes Chinese copy without spaces between sentences', () => {
    expect(modelDefinition(routerModel(), 'zh-CN')).toBe(
      'FLUX 2 Max Text-to-Image 是 Black Forest Labs 推出的 text-to-image 模型。在 Comfy 上，你可以在浏览器中运行它，或通过 Comfy Router API 以 bfl/flux-2-max 调用。'
    )
  })

  it.for(workshopModels.map((model) => [model.slug, model] as const))(
    '%s names the model, its provider and its Router id',
    ([, model]) => {
      const sentence = modelDefinition(model)
      expect(sentence).toContain(model.name)
      expect(sentence).toContain(`from ${model.provider}.`)
      expect(sentence).toContain(` as ${model.routerId}.`)
      expect(sentence).not.toMatch(/undefined|null|\{|\s{2}|\s[.,]/)
    }
  )
})

describe('modelFacts', () => {
  it('lists provider, task, Router id and price', () => {
    expect(modelFacts(routerModel(), '14.8 credits/Run')).toEqual([
      { term: 'Provider', value: 'Black Forest Labs' },
      { term: 'Task', value: 'Text to Image' },
      { term: 'Router model ID', value: 'bfl/flux-2-max', mono: true },
      { term: 'Price', value: '14.8 credits/Run' }
    ])
  })

  it('omits the rows it has no data for', () => {
    expect(
      modelFacts(
        routerModel({ provider: undefined, task: 'text-to-other' }),
        undefined
      )
    ).toEqual([
      { term: 'Router model ID', value: 'bfl/flux-2-max', mono: true }
    ])
  })
})
