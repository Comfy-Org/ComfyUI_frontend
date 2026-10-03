import { describe, expect, it } from 'vitest'

import routerIndex from '../../content/workshop-router-index.json'
import { modelDocsHref } from './model-docs'

const DOCS = 'https://docs.comfy.org/development/comfy-router/models'

// Router providers the docs page has no section for yet.
const UNDOCUMENTED = new Set(['runware'])

describe('modelDocsHref', () => {
  it('links a model through its Router id or its display name', () => {
    expect(
      modelDocsHref({ provider: 'Black Forest Labs', routerId: 'bfl/flux' })
    ).toBe(`${DOCS}#black-forest-labs`)
    expect(modelDocsHref({ provider: 'Black Forest Labs' })).toBe(
      `${DOCS}#black-forest-labs`
    )
    expect(modelDocsHref({ provider: 'xAI', routerId: 'xai/grok-image' })).toBe(
      `${DOCS}#xai`
    )
    expect(
      modelDocsHref({ provider: 'Lightricks', routerId: 'ltx/ltx-2' })
    ).toBe(`${DOCS}#ltx`)
  })

  it('keeps Luma and Luma 2 distinct via the raw provider slug', () => {
    expect(
      modelDocsHref({ provider: 'Luma', routerId: 'luma/dream-machine' })
    ).toBe(`${DOCS}#luma`)
    expect(
      modelDocsHref({ provider: 'Luma', routerId: 'luma_2/dream-machine' })
    ).toBe(`${DOCS}#luma-2`)
  })

  it('sends the special Router prefixes to their own sections', () => {
    expect(modelDocsHref({ routerId: 'gemini-interactions/omni-1.1' })).toBe(
      `${DOCS}#gemini-interactions`
    )
    expect(modelDocsHref({ routerId: 'vertexai/veo-3' })).toBe(`${DOCS}#google`)
  })

  it('maps every provider in the Router index or lists it as undocumented', () => {
    const prefixes = new Set(
      routerIndex.map((entry) => entry.id.split('/')[0] ?? '')
    )
    const unmapped = [...prefixes].filter(
      (prefix) =>
        !UNDOCUMENTED.has(prefix) && !modelDocsHref({ routerId: `${prefix}/x` })
    )
    expect(unmapped).toEqual([])
    for (const prefix of UNDOCUMENTED) {
      expect(prefixes).toContain(prefix)
      expect(modelDocsHref({ routerId: `${prefix}/x` })).toBeUndefined()
    }
  })

  it('offers no link for a provider the docs do not cover', () => {
    expect(modelDocsHref({ provider: 'Magnific' })).toBeUndefined()
    expect(modelDocsHref({ routerId: 'runware/x' })).toBeUndefined()
    expect(modelDocsHref({ provider: 'constructor' })).toBeUndefined()
    expect(modelDocsHref({})).toBeUndefined()
  })
})
