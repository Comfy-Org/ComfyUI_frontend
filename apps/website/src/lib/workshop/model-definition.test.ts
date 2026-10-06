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

const routerClause = (routerId: string) =>
  `You can call it through the Comfy Router API as ${routerId}.`

const flatten = (text: string) => text.toLowerCase().replaceAll('-', ' ')

describe('modelDefinition', () => {
  it.for([
    {
      case: 'names the task and the provider the name leaves out',
      model: routerModel({ name: 'FLUX Pro Fill', task: 'image-to-image' }),
      what: 'FLUX Pro Fill is an image-to-image model from Black Forest Labs.'
    },
    {
      case: 'uses "a" before a consonant task',
      model: routerModel({
        name: 'FLUX Video Upscale',
        task: 'video-to-video'
      }),
      what: 'FLUX Video Upscale is a video-to-video model from Black Forest Labs.'
    },
    {
      case: 'names only the provider when the name ends in the task',
      model: routerModel(),
      what: 'FLUX 2 Max Text-to-Image is made by Black Forest Labs.'
    },
    {
      case: 'names only the provider when the name says "Image Edit"',
      model: routerModel({
        name: 'Nano Banana Image Edit',
        provider: 'Google',
        task: 'image-to-image'
      }),
      what: 'Nano Banana Image Edit is made by Google.'
    },
    {
      case: 'names only the task when the name carries the provider',
      model: routerModel({
        name: 'Bria Eraser',
        provider: 'Bria',
        task: 'image-to-image'
      }),
      what: 'Bria Eraser is an image-to-image model.'
    },
    {
      case: 'names only the task when the provider is unknown',
      model: routerModel({ name: 'FLUX Pro Fill', provider: undefined }),
      what: 'FLUX Pro Fill is a text-to-image model.'
    },
    {
      case: 'omits the sentence when the name carries the task and provider',
      model: routerModel({
        name: 'Kling 3.0 Text-to-Video',
        provider: 'Kling',
        task: 'text-to-video'
      }),
      what: ''
    },
    {
      case: 'omits the sentence when the name carries the task and no provider is known',
      model: routerModel({ provider: undefined }),
      what: ''
    },
    {
      case: 'omits the sentence when the task contradicts the name',
      model: routerModel({
        name: 'Kling Lip Sync Audio-to-Video',
        provider: 'Kling',
        task: 'video-to-video'
      }),
      what: ''
    },
    {
      case: 'omits the sentence when a reference model is tagged text input',
      model: routerModel({
        name: 'Seedance 2.0 Reference-to-Video',
        provider: 'ByteDance',
        task: 'text-to-video'
      }),
      what: ''
    },
    {
      case: 'accepts media input for a reference model',
      model: routerModel({
        name: 'Seedance 2.5 Reference-to-Video',
        provider: 'ByteDance',
        task: 'image-to-video'
      }),
      what: 'Seedance 2.5 Reference-to-Video is made by ByteDance.'
    },
    {
      case: 'omits the sentence when the task is unknown',
      model: routerModel({ name: 'FLUX Pro Fill', task: 'text-to-other' }),
      what: ''
    }
  ])('$case', ({ model, what }) => {
    const router = routerClause(model.routerId)
    expect(modelDefinition(model)).toBe(what ? `${what} ${router}` : router)
  })

  it.for([
    {
      locale: 'zh-CN',
      model: routerModel({ name: 'FLUX Pro Fill' }),
      expected:
        'FLUX Pro Fill 是 Black Forest Labs 推出的文本转图像模型。你可以通过 Comfy Router API 以 bfl/flux-2-max 调用它。'
    },
    {
      locale: 'zh-CN',
      model: routerModel(),
      expected:
        'FLUX 2 Max Text-to-Image 由 Black Forest Labs 推出。你可以通过 Comfy Router API 以 bfl/flux-2-max 调用它。'
    },
    {
      locale: 'zh-CN',
      model: routerModel({ name: 'FLUX Pro Fill', provider: undefined }),
      expected:
        'FLUX Pro Fill 是一款文本转图像模型。你可以通过 Comfy Router API 以 bfl/flux-2-max 调用它。'
    },
    {
      locale: 'ja',
      model: routerModel({ name: 'FLUX Pro Fill' }),
      expected:
        'FLUX Pro Fill is a text-to-image model from Black Forest Labs. You can call it through the Comfy Router API as bfl/flux-2-max.'
    }
  ] as const)(
    'writes the $locale sentence in its own wording',
    ({ locale, model, expected }) => {
      expect(modelDefinition(model, locale)).toBe(expected)
    }
  )

  it.for(
    workshopModels
      .filter((model) => model.href !== undefined)
      .map((model) => [model.slug, model] as const)
  )('%s says only what its name leaves out', ([, model]) => {
    const sentence = modelDefinition(model)
    const router = routerClause(model.routerId)
    expect(sentence.endsWith(router)).toBe(true)
    const what = sentence.slice(0, -router.length).trim()
    if (what !== '') expect(what.startsWith(`${model.name} is `)).toBe(true)
    const rest = flatten(what.replace(model.name, ''))

    if (model.provider && flatten(model.name).includes(flatten(model.provider)))
      expect(rest).not.toContain(flatten(model.provider))
    if (model.task && flatten(model.name).endsWith(flatten(model.task)))
      expect(rest).not.toContain(flatten(model.task))
    expect(what).not.toMatch(/\bis an? model\b/)
    expect(what).not.toMatch(/\ba [aeiou]/i)
    expect(what).not.toMatch(/\ban [^aeiou\s]/i)
    expect(sentence).not.toMatch(/undefined|null|\{|\s{2}|\s[.,]/)
    expect(sentence).not.toMatch(/browser/i)
    expect(modelDefinition(model, 'zh-CN')).not.toContain('浏览器')
  })
})

describe('modelFacts', () => {
  it('lists provider, task and Router id', () => {
    expect(modelFacts(routerModel())).toEqual([
      { term: 'Provider', value: 'Black Forest Labs' },
      { term: 'Task', value: 'Text to Image' },
      { term: 'Router model ID', value: 'bfl/flux-2-max', mono: true }
    ])
  })

  it('writes the zh-CN terms and task label', () => {
    expect(modelFacts(routerModel(), 'zh-CN')).toEqual([
      { term: '提供方', value: 'Black Forest Labs' },
      { term: '任务', value: '文本转图像' },
      { term: 'Router 模型 ID', value: 'bfl/flux-2-max', mono: true }
    ])
  })

  it.for([
    {
      case: 'a provider and task it does not know',
      model: routerModel({ provider: undefined, task: 'text-to-other' })
    },
    {
      case: 'a task that contradicts the name',
      model: routerModel({
        name: 'Kling Lip Sync Audio-to-Video',
        provider: undefined,
        task: 'video-to-video'
      })
    }
  ])('omits the rows for $case', ({ model }) => {
    expect(modelFacts(model)).toEqual([
      { term: 'Router model ID', value: 'bfl/flux-2-max', mono: true }
    ])
  })
})
