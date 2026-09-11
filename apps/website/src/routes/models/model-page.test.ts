import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopModelDetail } from '../../config/models-catalogue'
import { prepareModelPage } from './model-page'

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  related: vi.fn(),
  successor: vi.fn(),
  price: vi.fn()
}))
vi.mock(import('../../config/workshop-router-content'), () => ({
  getRouterWorkshopModelDetail: mocks.lookup
}))
vi.mock(import('../../config/workshop-related'), () => ({
  relatedModels: mocks.related
}))
vi.mock(import('../../config/workshop-node-pricing'), () => ({
  estimateWorkshopNodePrice: mocks.price
}))
vi.mock(import('../../config/models-catalogue'), async (importOriginal) => ({
  ...(await importOriginal()),
  getWorkshopModel: mocks.successor
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

  it('does not invent a price or successor, and encodes capability links', async () => {
    const page = await prepareModelPage(model.slug)
    expect(page).toMatchObject({
      kind: 'page',
      priceEstimate: undefined,
      successor: undefined,
      relatedHeading: 'More models'
    })
    if (page.kind !== 'page') throw new Error('Expected canonical page')
    expect(
      new URLSearchParams(page.tags[0].search).getAll('capability')
    ).toEqual(['Image & text'])
  })

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
      modalityLabel: { image: '图像' }
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
