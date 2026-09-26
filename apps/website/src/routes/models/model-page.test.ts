import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopModelDetail } from '../../config/models-catalogue'
import { prepareModelPage } from './model-page'

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  related: vi.fn(),
  successor: vi.fn(),
  price: vi.fn()
}))
vi.mock(import('../../config/workshop-page-content'), () => ({
  getWorkshopPageDetail: mocks.lookup,
  workshopPages: []
}))
vi.mock(import('../../config/workshop-related'), () => ({
  relatedModels: mocks.related
}))
vi.mock(import('../../config/workshop-node-pricing'), () => ({
  estimateWorkshopNodePrice: mocks.price
}))
vi.mock(import('../../config/workshop-browse-content'), () => ({
  getWorkshopModel: mocks.successor,
  workshopModels: []
}))

const model: WorkshopModelDetail = {
  slug: 'provider--model--generate-images',
  name: 'Example Model',
  href: '/models/provider--model--generate-images/',
  routerId: 'provider/model',
  workflowCount: 1,
  provider: 'Example Provider',
  modality: 'image',
  capabilities: ['Image & text'],
  fields: [],
  examples: [],
  defaults: {}
}

beforeEach(() => {
  mocks.lookup.mockReturnValue(model)
  mocks.related.mockReturnValue([])
  mocks.price.mockResolvedValue(undefined)
  mocks.successor.mockReturnValue(undefined)
})

describe('Models route preparation', () => {
  it('canonicalizes aliases before evaluating prices or related rows', async () => {
    expect(await prepareModelPage('old-alias')).toEqual({
      kind: 'redirect',
      href: model.href
    })
    expect(mocks.price).not.toHaveBeenCalled()
    expect(mocks.related).not.toHaveBeenCalled()
  })

  it('does not invent a price or successor, and encodes capability searches', async () => {
    const page = await prepareModelPage(model.slug)
    expect(page).toMatchObject({
      kind: 'page',
      priceEstimate: undefined,
      successor: undefined,
      relatedHeading: 'More models'
    })
    if (page.kind !== 'page') throw new Error('Expected canonical page')
    expect(new URLSearchParams(page.tags[0].search).get('q')).toBe(
      'Image & text'
    )
  })

  it.for([
    ['zero tags', [], [], [], 0],
    [
      'exactly three tags',
      ['One', 'Two', 'Three'],
      ['One', 'Two', 'Three'],
      [],
      0
    ],
    [
      'more than three tags',
      ['One', 'Two', 'Three', 'Four'],
      ['One', 'Two', 'Three'],
      ['Four'],
      1
    ]
  ] as const)(
    'splits %s for the visible row and overflow control',
    async ([, capabilities, shown, rest, restTagCount]) => {
      mocks.lookup.mockReturnValue({ ...model, capabilities })

      const page = await prepareModelPage(model.slug)

      if (page.kind !== 'page') throw new Error('Expected canonical page')
      expect(page.shownTags.map((tag) => tag.label)).toEqual(shown)
      expect(page.restTags.map((tag) => tag.label)).toEqual(rest)
      expect(page.restTagCount).toBe(restTagCount)
    }
  )

  it.for([
    {
      name: 'FLUX 2 Max Text-to-Image',
      provider: 'Black Forest Labs',
      capabilities: ['bfl', 'flux', 'flux-2', 'text-to-image', 'premium'],
      shown: ['premium']
    },
    {
      name: 'Nano Banana Pro Image Edit',
      provider: 'Google',
      capabilities: ['gemini', 'google', 'pro', 'high-quality', 'edit'],
      shown: ['high-quality']
    },
    {
      name: 'Recraft V4.1 Text-to-Vector',
      provider: 'Recraft',
      capabilities: ['recraft', 'v4.1', 'svg'],
      shown: ['svg']
    },
    {
      name: 'Grok Imagine Video 1.5 Reference-to-Video',
      provider: 'xAI',
      capabilities: ['grok', 'xai', 'video', '1.5', 'reference', 'voice'],
      shown: ['voice']
    },
    {
      name: 'Seedream 4.0 Text-to-Image',
      provider: 'ByteDance',
      capabilities: ['byteplus', 'seedream', 'image-to-image', '写实'],
      shown: ['image-to-image', '写实']
    }
  ])(
    'hides provider IDs, bare versions and name echoes on $name',
    async ({ name, provider, capabilities, shown }) => {
      mocks.lookup.mockReturnValue({ ...model, name, provider, capabilities })

      const page = await prepareModelPage(model.slug)

      if (page.kind !== 'page') throw new Error('Expected canonical page')
      expect(page.tags.map((tag) => tag.label)).toEqual(shown)
    }
  )

  it('uses a provider heading only when every related card has that provider', async () => {
    mocks.related.mockReturnValue([{ ...model, slug: 'related' }])
    expect(await prepareModelPage(model.slug)).toHaveProperty(
      'relatedHeading',
      'More from Example Provider'
    )
    mocks.related.mockReturnValue([{ ...model, provider: 'Someone Else' }])
    expect(await prepareModelPage(model.slug)).toHaveProperty(
      'relatedHeading',
      'More models'
    )
  })

  it('localizes headings and carries the resolved successor and estimate', async () => {
    mocks.lookup.mockReturnValue({ ...model, successorSlug: 'new-model' })
    const successor = { ...model, slug: 'new-model', name: 'New Model' }
    mocks.successor.mockReturnValue(successor)
    mocks.price.mockResolvedValue('4–8 credits')
    const page = await prepareModelPage(model.slug, 'zh-CN')
    expect(page).toMatchObject({
      kind: 'page',
      successor,
      priceEstimate: '4–8 credits',
      useCaseLabel: '生成图像'
    })
    expect(mocks.successor).toHaveBeenCalledWith('new-model')
  })

  it('fails an unknown or missing route explicitly', async () => {
    mocks.lookup.mockReturnValue(undefined)
    await expect(prepareModelPage('unknown')).rejects.toThrow(
      'Unknown Models route: unknown'
    )
    await expect(prepareModelPage(undefined)).rejects.toThrow(
      'Unknown Models route: (missing)'
    )
  })
})
