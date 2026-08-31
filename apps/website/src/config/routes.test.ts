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

describe('getRoutes agent', () => {
  it('serves the agent page at its canonical path for en', () => {
    expect(getRoutes('en').agent).toBe('/agent')
  })

  it('serves the English-only agent page at its canonical path for zh-CN', () => {
    expect(getRoutes('zh-CN').agent).toBe('/agent')
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

describe('getRoutes geminiOmni', () => {
  it('serves the gemini omni page at its canonical path for en', () => {
    expect(getRoutes('en').geminiOmni).toBe('/gemini-omni')
  })

  it('serves a localized gemini omni path for zh-CN', () => {
    expect(getRoutes('zh-CN').geminiOmni).toBe('/zh-CN/gemini-omni')
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

describe('getRoutes pricing', () => {
  it('serves the pricing page at its canonical path for en', () => {
    expect(getRoutes('en').pricing).toBe('/pricing')
  })

  it('serves a localized pricing path for zh-CN', () => {
    expect(getRoutes('zh-CN').pricing).toBe('/zh-CN/pricing')
  })
})

describe('getRoutes enterprise', () => {
  it('serves the enterprise page at its canonical path for en', () => {
    expect(getRoutes('en').enterprise).toBe('/enterprise')
  })

  it('serves a localized enterprise path for zh-CN', () => {
    expect(getRoutes('zh-CN').enterprise).toBe('/zh-CN/enterprise')
  })
})

describe('getRoutes enterpriseManagedBuilds', () => {
  it('serves the managed builds page at its canonical path for en', () => {
    expect(getRoutes('en').enterpriseManagedBuilds).toBe(
      '/enterprise/managed-builds'
    )
  })

  it('serves a localized managed builds path for zh-CN', () => {
    expect(getRoutes('zh-CN').enterpriseManagedBuilds).toBe(
      '/zh-CN/enterprise/managed-builds'
    )
  })
})

describe('getRoutes platform', () => {
  it('serves the platform page at its canonical path for en', () => {
    expect(getRoutes('en').platform).toBe('/platform')
  })

  it('serves a localized platform path for zh-CN', () => {
    expect(getRoutes('zh-CN').platform).toBe('/zh-CN/platform')
  })
})

describe('getRoutes platform product pages', () => {
  it('serves the platform product pages at their canonical paths for en', () => {
    const routes = getRoutes('en')

    expect(routes.platformServerless).toBe('/platform/serverless')
    expect(routes.platformModels).toBe('/platform/models')
    expect(routes.platformBuilder).toBe('/platform/builder')
  })

  it('serves localized platform product paths for zh-CN', () => {
    const routes = getRoutes('zh-CN')

    expect(routes.platformServerless).toBe('/zh-CN/platform/serverless')
    expect(routes.platformModels).toBe('/zh-CN/platform/models')
    expect(routes.platformBuilder).toBe('/zh-CN/platform/builder')
  })
})
