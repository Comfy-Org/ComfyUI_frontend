import { describe, expect, it } from 'vitest'

import { hubModelSlugs } from '../../config/hub-models'
import { prepareModelPage } from '../../routes/models/model-page'
import { modelMetaDescription } from './model-meta-description'

const MAX_LENGTH = 170
// Re-baseline ratchets, with headroom over today's catalogue.
const MOST_PAGES_SHARING_A_BODY = 6
const DISTINCT_BODY_SHARE = 0.85
const PRICED_SHARE = 0.75
const SINGLE_FIGURE_PRICE = /^~?\d+(?:\.\d+)? credits(?:\/|$)/i

async function canonicalPages() {
  const pages = await Promise.all(
    Array.from(hubModelSlugs.keys(), (id) => prepareModelPage(id))
  )
  return pages.filter((page) => page.kind === 'page')
}

const lorem = (count: number) => `${Array(count).fill('lorem').join(' ')}.`

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
        'SeedVR2 Image Upscaler by WaveSpeed: Upscales an image to 2K/4K/8K. Run it in your browser or call it via API. Typical cost: 2.11 credits per run.'
    },
    {
      name: 'names the company even when the name carries its brand',
      page: {
        model: {
          name: 'FLUX 2 Max Text-to-Image',
          provider: 'Black Forest Labs',
          summary: 'Generates an image from text.'
        }
      },
      expected:
        'FLUX 2 Max Text-to-Image by Black Forest Labs: Generates an image from text. Run it in your browser or call it via API.'
    },
    {
      name: 'does not repeat a provider the name already contains',
      page: { model: { name: 'Kling Omni', provider: 'Kling' } },
      expected: 'Kling Omni. Run it in your browser or call it via API.'
    },
    {
      name: 'names a provider with no Latin letters',
      page: {
        model: { name: 'Seed 3', provider: '字节跳动', summary: 'Draws.' }
      },
      expected:
        'Seed 3 by 字节跳动: Draws. Run it in your browser or call it via API.'
    },
    {
      name: 'treats a blank summary as missing',
      page: { model: { name: 'Kling Omni', provider: 'Kling', summary: '  ' } },
      expected: 'Kling Omni. Run it in your browser or call it via API.'
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
      name: 'ends an unpunctuated summary with a period',
      page: { model: { name: 'Remove an object', summary: 'Erase it' } },
      expected:
        'Remove an object: Erase it. Run it in your browser or call it via API.'
    },
    {
      name: 'strips markdown code spans from the summary',
      page: {
        model: {
          name: 'Meshy Texture',
          provider: 'Meshy',
          summary: 'Pass `meshy_task_id` plus `image_style`.'
        }
      },
      expected:
        'Meshy Texture: Pass meshy_task_id plus image_style. Run it in your browser or call it via API.'
    },
    {
      name: 'leaves the unit out when the price label has none',
      page: {
        model: { name: 'Recraft V4', provider: 'Recraft', summary: 'Draws.' },
        priceEstimate: '12 credits'
      },
      expected:
        'Recraft V4: Draws. Run it in your browser or call it via API. Typical cost: 12 credits.'
    },
    {
      name: 'omits a price range',
      page: {
        model: { name: 'Recraft V4', provider: 'Recraft', summary: 'Draws.' },
        priceEstimate: '~21.1-65.4 credits/Run'
      },
      expected: 'Recraft V4: Draws. Run it in your browser or call it via API.'
    },
    {
      name: 'writes the Chinese price without English words',
      locale: 'zh-CN' as const,
      page: {
        model: { name: 'Recraft V4', provider: 'Recraft', summary: '绘图。' },
        priceEstimate: '~9.5 credits/Image'
      },
      expected:
        'Recraft V4：绘图。在浏览器中运行，或通过 API 调用。默认设置下约 ~9.5 积分。'
    }
  ])('$name', ({ page, expected, locale }) => {
    expect(modelMetaDescription(page, locale)).toBe(expected)
  })

  it.for([
    [
      'shortens the call to action',
      13,
      /lorem\. Run it in your browser or via API\. Typical cost/
    ],
    [
      'drops the call to action',
      17,
      /lorem\. Typical cost: 4\.2 credits per run\.$/
    ],
    ['drops the price before cutting the summary', 24, /lorem\.$/],
    ['cuts the summary last', 40, /^Luma Ray: lorem( lorem)*…$/]
  ] as const)('%s when the description runs long', ([, words, pattern]) => {
    const description = modelMetaDescription({
      model: { name: 'Luma Ray', provider: 'Luma', summary: lorem(words) },
      priceEstimate: '4.2 credits/Run'
    })
    expect(description).toMatch(pattern)
    expect(description.length).toBeLessThanOrEqual(MAX_LENGTH)
  })

  it('stays within the cap when the name alone is too long', () => {
    const description = modelMetaDescription({
      model: { name: 'Model '.repeat(40).trim(), summary: 'Short.' }
    })
    expect(description.length).toBeLessThanOrEqual(MAX_LENGTH)
    expect(description.endsWith('…')).toBe(true)
  })

  it('builds every model page description from its own facts', async () => {
    const pages = await canonicalPages()
    expect(pages.length).toBeGreaterThan(100)
    for (const page of pages) {
      const description = modelMetaDescription(page)
      const { model, priceEstimate } = page
      expect(description.startsWith(model.name)).toBe(true)
      expect(description.length).toBeLessThanOrEqual(MAX_LENGTH)
      expect(description).not.toMatch(/undefined|\$|`/)
      if (!priceEstimate) expect(description).not.toContain('Typical cost')
    }
  })

  it('shows the typical cost on most single-figure priced pages', async () => {
    const singleFigurePages = (await canonicalPages()).filter(
      ({ priceEstimate }) => SINGLE_FIGURE_PRICE.test(priceEstimate ?? '')
    )
    const priced = singleFigurePages.filter((page) =>
      modelMetaDescription(page).includes('Typical cost')
    )
    expect(singleFigurePages.length).toBeGreaterThan(0)
    expect(priced.length).toBeGreaterThanOrEqual(
      singleFigurePages.length * PRICED_SHARE
    )
  })

  it('keeps most model pages on a description body of their own', async () => {
    const pages = await canonicalPages()
    const pagesPerBody = new Map<string, number>()
    for (const page of pages) {
      const body = modelMetaDescription(page).slice(page.model.name.length)
      pagesPerBody.set(body, (pagesPerBody.get(body) ?? 0) + 1)
    }
    expect(Math.max(...pagesPerBody.values())).toBeLessThanOrEqual(
      MOST_PAGES_SHARING_A_BODY
    )
    expect(pagesPerBody.size).toBeGreaterThanOrEqual(
      pages.length * DISTINCT_BODY_SHARE
    )
  })
})
