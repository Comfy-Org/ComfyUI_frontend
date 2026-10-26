import { describe, expect, it } from 'vitest'

import { workshopModels } from '@/config/workshop-browse-content'
import { prepareModelPage } from './model-page'

const providerRows = await Promise.all(
  workshopModels.map(async (model) => {
    const page = await prepareModelPage(model.slug)
    if (page.kind !== 'page') throw new Error(`Not canonical: ${model.slug}`)
    return { model, hrefs: page.providerModels.map((other) => other.href) }
  })
)

describe('provider links across the published model pages', () => {
  it('links every other page of the same provider and never the page itself', () => {
    const wrongLinks = providerRows.flatMap(({ model, hrefs }) =>
      workshopModels
        .filter(
          (other) =>
            model.provider !== undefined && other.provider === model.provider
        )
        .filter((other) =>
          other.slug === model.slug
            ? hrefs.includes(other.href ?? '')
            : !hrefs.includes(other.href ?? '')
        )
        .map((other) => `${model.slug} -> ${other.slug}`)
    )
    expect(wrongLinks).toEqual([])
  })

  it('links only pages of the same provider', () => {
    const foreign = providerRows.flatMap(({ model, hrefs }) =>
      hrefs
        .map((href) => workshopModels.find((other) => other.href === href))
        .filter((other) => other?.provider !== model.provider)
        .map((other) => `${model.slug} -> ${other?.slug ?? 'unknown'}`)
    )
    expect(foreign).toEqual([])
  })
})
