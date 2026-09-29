import { describe, expect, it } from 'vitest'

import { workshopModels } from '../../config/workshop-browse-content'
import { prepareModelPage } from './model-page'

const relatedRows = await Promise.all(
  workshopModels.map(async (model) => {
    const page = await prepareModelPage(model.slug)
    if (page.kind !== 'page') throw new Error(`Not canonical: ${model.slug}`)
    return { model, hrefs: page.related.map((other) => other.href) }
  })
)

describe('related links across the published model pages', () => {
  it('links every model page from at least one other model page', () => {
    const linked = new Set(
      relatedRows.flatMap(({ model, hrefs }) =>
        hrefs.filter((href) => href !== model.href)
      )
    )

    const orphans = workshopModels
      .map((model) => model.href)
      .filter((href) => !linked.has(href))
    expect(orphans).toEqual([])
  })

  it('links the other tasks of the same model and never the page itself', () => {
    const wrongLinks = relatedRows.flatMap(({ model, hrefs }) =>
      workshopModels
        .filter((other) => other.routerId === model.routerId)
        .filter((other) =>
          other.slug === model.slug
            ? hrefs.includes(other.href)
            : !hrefs.includes(other.href)
        )
        .map((other) => `${model.slug} -> ${other.slug}`)
    )
    expect(wrongLinks).toEqual([])
  })
})
