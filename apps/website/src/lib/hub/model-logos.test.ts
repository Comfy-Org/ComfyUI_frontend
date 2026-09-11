import { describe, expect, it } from 'vitest'

import { resolveTemplateLogos } from './model-logos'

describe('resolveTemplateLogos', () => {
  it('falls back to known model names when no structured provider resolves', () => {
    expect(
      resolveTemplateLogos({
        logos: [{ provider: ['Unknown One', 'Unknown Two'] }],
        models: ['Kling']
      })
    ).toEqual([{ src: '/icons/ai-models/kling.svg', name: 'Kling' }])
  })

  it('keeps resolved structured providers ahead of model-name fallbacks', () => {
    expect(
      resolveTemplateLogos({
        logos: [{ provider: ['Unknown', 'Google', 'Gemini'] }],
        models: ['Kling']
      })
    ).toEqual([{ src: '/icons/ai-models/gemini.svg', name: 'Google' }])
  })
})
