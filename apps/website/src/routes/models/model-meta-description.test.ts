import { describe, expect, it } from 'vitest'

import { workshopPagePaths } from '../../config/workshop-page-content'
import { splitPriceLabel } from '../../lib/workshop/price-label'
import { modelMetaDescription, prepareModelPage } from './model-page'

const MAX_LENGTH = 170

async function canonicalPages() {
  const pages = await Promise.all(
    workshopPagePaths.map((slug) => prepareModelPage(slug))
  )
  return pages.filter((page) => page.kind === 'page')
}

describe('modelMetaDescription', () => {
  it.for([
    {
      name: 'names the provider when the model name lacks it',
      page: {
        model: {
          name: 'SeedVR2 Image Upscaler',
          provider: 'WaveSpeed',
          summary: 'Upscales an image to 2K/4K/8K.'
        },
        priceEstimate: '2.11 credits/Run'
      },
      expected:
        'SeedVR2 Image Upscaler by WaveSpeed: Upscales an image to 2K/4K/8K. Run it in your browser or call it via API. From 2.11 credits per run.'
    },
    {
      name: 'does not double a brand the name already carries',
      page: {
        model: {
          name: 'FLUX 2 Max Text-to-Image',
          provider: 'Black Forest Labs',
          summary: 'Generates an image from text.'
        }
      },
      expected:
        'FLUX 2 Max Text-to-Image: Generates an image from text. Run it in your browser or call it via API.'
    },
    {
      name: 'omits the provider and price when neither is known',
      page: {
        model: { name: 'Remove an object', summary: 'Erase what you mark.' }
      },
      expected:
        'Remove an object: Erase what you mark. Run it in your browser or call it via API.'
    },
    {
      name: 'falls back to the name when there is no summary',
      page: { model: { name: 'Kling Omni', provider: 'Kling' } },
      expected: 'Kling Omni. Run it in your browser or call it via API.'
    }
  ])('$name', ({ page, expected }) => {
    expect(modelMetaDescription(page)).toBe(expected)
  })

  it.for([
    [
      'shortens the call to action',
      14,
      /\. Run it in your browser or via API\. From/
    ],
    ['drops the call to action', 18, /lorem\. From/],
    [
      'cuts the summary at a word',
      40,
      /^Luma Ray: lorem( lorem)*… From 4\.2 credits per run\.$/
    ]
  ] as const)('%s when the description runs long', ([, words, pattern]) => {
    const description = modelMetaDescription({
      model: {
        name: 'Luma Ray',
        provider: 'Luma',
        summary: `${Array(words).fill('lorem').join(' ')}.`
      },
      priceEstimate: '4.2 credits/Run'
    })
    expect(description).toMatch(pattern)
    expect(description.length).toBeLessThanOrEqual(MAX_LENGTH)
  })

  it('gives every model page a unique description built from its own facts', async () => {
    const pages = await canonicalPages()
    const descriptions = pages.map((page) => modelMetaDescription(page))

    expect(pages.length).toBeGreaterThan(100)
    expect(new Set(descriptions).size).toBe(descriptions.length)
    for (const [index, page] of pages.entries()) {
      const description = descriptions[index]
      const { model, priceEstimate } = page
      expect(description.startsWith(model.name)).toBe(true)
      expect(description.length).toBeLessThanOrEqual(MAX_LENGTH)
      expect(description).not.toMatch(/undefined|\$/)
      if (model.summary)
        expect(description).toContain(
          description.includes('…') ? model.summary.slice(0, 40) : model.summary
        )
      if (priceEstimate)
        expect(description).toContain(splitPriceLabel(priceEstimate).amount)
      else expect(description).not.toContain('credits')
    }
  })
})
