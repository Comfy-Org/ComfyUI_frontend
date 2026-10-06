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
        'FLUX 2 Max Text-to-Image is a text-to-image model from Black Forest Labs. You can call it through the Comfy Router API as bfl/flux-2-max.'
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
        'Kling O3 Image-to-Video is an image-to-video model from Kling. You can call it through the Comfy Router API as kling/o3.'
    },
    {
      case: 'drops the provider clause when the provider is unknown',
      model: routerModel({ provider: undefined }),
      expected:
        'FLUX 2 Max Text-to-Image is a text-to-image model. You can call it through the Comfy Router API as bfl/flux-2-max.'
    },
    {
      case: 'drops a task that disagrees with the task in the name',
      model: routerModel({
        name: 'Seedance 2.0 Reference-to-Video',
        provider: 'ByteDance',
        task: 'text-to-video',
        routerId: 'bytedance/seedance-2-0-reference-to-video'
      }),
      expected:
        'Seedance 2.0 Reference-to-Video is a model from ByteDance. You can call it through the Comfy Router API as bytedance/seedance-2-0-reference-to-video.'
    },
    {
      case: 'keeps a task the name agrees with after "Image Edit"',
      model: routerModel({
        name: 'Nano Banana Image Edit',
        provider: 'Google',
        task: 'image-to-image',
        routerId: 'google/nano-banana'
      }),
      expected:
        'Nano Banana Image Edit is an image-to-image model from Google. You can call it through the Comfy Router API as google/nano-banana.'
    },
    {
      case: 'drops the task when the output is unknown',
      model: routerModel({ task: 'text-to-other' }),
      expected:
        'FLUX 2 Max Text-to-Image is a model from Black Forest Labs. You can call it through the Comfy Router API as bfl/flux-2-max.'
    }
  ])('$case', ({ model, expected }) => {
    expect(modelDefinition(model)).toBe(expected)
  })

  it.for([
    {
      locale: 'zh-CN',
      model: routerModel(),
      expected:
        'FLUX 2 Max Text-to-Image 是 Black Forest Labs 推出的文本转图像模型。你可以通过 Comfy Router API 以 bfl/flux-2-max 调用它。'
    },
    {
      locale: 'zh-CN',
      model: routerModel({ provider: undefined, task: 'text-to-other' }),
      expected:
        'FLUX 2 Max Text-to-Image 是一款 AI 模型。你可以通过 Comfy Router API 以 bfl/flux-2-max 调用它。'
    },
    {
      locale: 'ja',
      model: routerModel(),
      expected:
        'FLUX 2 Max Text-to-Image is a text-to-image model from Black Forest Labs. You can call it through the Comfy Router API as bfl/flux-2-max.'
    }
  ] as const)(
    'writes the $locale sentence in its own wording',
    ({ locale, model, expected }) => {
      expect(modelDefinition(model, locale)).toBe(expected)
    }
  )

  it.for(workshopModels.map((model) => [model.slug, model] as const))(
    '%s names the model, its provider and its Router id',
    ([, model]) => {
      const sentence = modelDefinition(model)
      expect(sentence).toContain(model.name)
      expect(sentence).toContain(`from ${model.provider}.`)
      expect(sentence).toContain(` as ${model.routerId}.`)
      expect(sentence).not.toMatch(/undefined|null|\{|\s{2}|\s[.,]/)
      expect(sentence).not.toMatch(/browser/i)
      expect(modelDefinition(model, 'zh-CN')).not.toContain('浏览器')
    }
  )
})

describe('modelFacts', () => {
  it('lists provider, task, Router id and price', () => {
    expect(modelFacts(routerModel(), '14.8 credits/Run')).toEqual([
      { term: 'Provider', value: 'Black Forest Labs' },
      { term: 'Task', value: 'Text to Image' },
      { term: 'Router model ID', value: 'bfl/flux-2-max', mono: true },
      { term: 'Estimated price', value: '14.8 credits/Run' }
    ])
  })

  it('writes the zh-CN terms and task label', () => {
    expect(modelFacts(routerModel(), '14.8 credits/Run', 'zh-CN')).toEqual([
      { term: '提供方', value: 'Black Forest Labs' },
      { term: '任务', value: '文本转图像' },
      { term: 'Router 模型 ID', value: 'bfl/flux-2-max', mono: true },
      { term: '预估价格', value: '14.8 credits/Run' }
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
