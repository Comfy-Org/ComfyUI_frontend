import { describe, expect, it } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import { modelsHubMeta } from './models-hub-meta'

describe('modelsHubMeta', () => {
  it('titles the hub for ComfyUI models within SERP length', () => {
    const { title } = modelsHubMeta([])
    expect(title).toContain('ComfyUI Models')
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it('keeps a full catalogue description within 120 to 160 characters', () => {
    const catalogue = [
      'FLUX 2 Pro',
      'Seedance 2.5',
      'Kling 3',
      'Veo 3',
      'Nano Banana Pro',
      ...Array.from({ length: 295 }, (_, index) => `Model ${index}`)
    ].map((name) => ({ name }))
    const { description } = modelsHubMeta(catalogue)
    expect(description).toContain('Browse 300 AI models')
    expect(description).toContain('FLUX, Seedance, Kling, Veo, and Nano Banana')
    expect(description.length).toBeGreaterThanOrEqual(120)
    expect(description.length).toBeLessThanOrEqual(160)
  })

  it('drops a family the catalogue no longer has', () => {
    const { description } = modelsHubMeta([
      { name: 'FLUX 2 Pro Text-to-Image' },
      { name: 'Veo 3 Text-to-Video' }
    ])
    expect(description).toContain('Browse 2 AI models')
    expect(description).toContain('FLUX and Veo')
    expect(description).not.toContain('Kling')
  })

  it('leaves out the names clause when no family is in the catalogue', () => {
    const { description } = modelsHubMeta([
      { name: 'Grok Imagine' },
      { name: 'Wan 2.7' }
    ])
    expect(description).toBe(
      'Browse 2 AI models in ComfyUI. Call any model through the Comfy Router API.'
    )
  })

  it('uses the singular for a one-model catalogue', () => {
    const { description } = modelsHubMeta([{ name: 'Veo 3 Text-to-Video' }])
    expect(description).toBe(
      'Browse 1 AI model in ComfyUI, including Veo. Call it through the Comfy Router API.'
    )
  })

  it.for([
    ['en', 'models.hub.meta.description', 1],
    ['en', 'models.hub.meta.description', 2],
    ['en', 'models.hub.meta.descriptionWithoutNames', 1],
    ['en', 'models.hub.meta.descriptionWithoutNames', 2],
    ['zh-CN', 'models.hub.meta.description', 1],
    ['zh-CN', 'models.hub.meta.description', 2],
    ['zh-CN', 'models.hub.meta.descriptionWithoutNames', 1],
    ['zh-CN', 'models.hub.meta.descriptionWithoutNames', 2]
  ] as const)(
    'never promises browser runs in the %s %s for %i model(s)',
    ([locale, key, count]) => {
      expect(
        translationsFor(locale).t(
          key,
          { count, names: 'Veo' },
          { plural: count }
        )
      ).not.toMatch(/browser|浏览器/i)
    }
  )
})
