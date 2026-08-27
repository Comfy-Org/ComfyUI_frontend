import { describe, expect, it } from 'vitest'

import { getRoutes, localizeHref } from './routes'

describe('localizeHref', () => {
  it('prefixes an internal path for a non-default locale', () => {
    expect(localizeHref('/mcp', 'zh-CN')).toBe('/zh-CN/mcp')
  })

  it('leaves the default locale unprefixed', () => {
    expect(localizeHref('/mcp', 'en')).toBe('/mcp')
  })

  it('passes external URLs through unchanged', () => {
    expect(
      localizeHref('https://docs.comfy.org/agent-tools/cloud', 'zh-CN')
    ).toBe('https://docs.comfy.org/agent-tools/cloud')
  })

  it('never prefixes locale-invariant routes', () => {
    expect(localizeHref('/terms-of-service', 'zh-CN')).toBe('/terms-of-service')
  })
})

describe('getRoutes models', () => {
  it('serves the models catalog at its canonical path for zh-CN', () => {
    expect(getRoutes('zh-CN').models).toBe('/p/supported-models')
  })
})

describe('getRoutes modelsShowcase', () => {
  it('serves the models showcase page at its canonical path for en', () => {
    expect(getRoutes('en').modelsShowcase).toBe('/models')
  })

  it('serves a localized models showcase path for zh-CN', () => {
    expect(getRoutes('zh-CN').modelsShowcase).toBe('/zh-CN/models')
  })
})

describe('getRoutes seedance', () => {
  it('serves the seedance page at its canonical path for en', () => {
    expect(getRoutes('en').seedance).toBe('/seedance-2.5')
  })

  it('serves a localized seedance path for zh-CN', () => {
    expect(getRoutes('zh-CN').seedance).toBe('/zh-CN/seedance-2.5')
  })
})

describe('getRoutes ltx', () => {
  it('serves the ltx page at its canonical path for en', () => {
    expect(getRoutes('en').ltx).toBe('/ltx-2.5')
  })

  it('serves a localized ltx path for zh-CN', () => {
    expect(getRoutes('zh-CN').ltx).toBe('/zh-CN/ltx-2.5')
  })
})

describe('getRoutes minimaxMusic3', () => {
  it('serves the minimax music 3 page at its canonical path for en', () => {
    expect(getRoutes('en').minimaxMusic3).toBe('/minimax-music-3')
  })

  it('serves a localized minimax music 3 path for zh-CN', () => {
    expect(getRoutes('zh-CN').minimaxMusic3).toBe('/zh-CN/minimax-music-3')
  })
})

describe('getRoutes minimax', () => {
  it('serves the minimax page at its canonical path for en', () => {
    expect(getRoutes('en').minimax).toBe('/minimax-h3')
  })

  it('serves a localized minimax path for zh-CN', () => {
    expect(getRoutes('zh-CN').minimax).toBe('/zh-CN/minimax-h3')
  })
})

describe('getRoutes flux3', () => {
  it('serves the flux 3 page at its canonical path for en', () => {
    expect(getRoutes('en').flux3).toBe('/flux-3')
  })

  it('serves a localized flux 3 path for zh-CN', () => {
    expect(getRoutes('zh-CN').flux3).toBe('/zh-CN/flux-3')
  })
})

describe('getRoutes fdct', () => {
  it('serves the fdct page at its canonical path for en', () => {
    expect(getRoutes('en').fdct).toBe('/forward-deployed-creatives')
  })

  it('serves a localized fdct path for zh-CN', () => {
    expect(getRoutes('zh-CN').fdct).toBe('/zh-CN/forward-deployed-creatives')
  })
})

describe('getRoutes minimaxLicense', () => {
  it('serves the MiniMax license page at its canonical path for en', () => {
    expect(getRoutes('en').minimaxLicense).toBe('/minimax/license')
  })

  it('serves a localized MiniMax license path for zh-CN', () => {
    expect(getRoutes('zh-CN').minimaxLicense).toBe('/zh-CN/minimax/license')
  })
})
