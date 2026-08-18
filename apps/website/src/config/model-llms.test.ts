import { describe, expect, it } from 'vitest'

import { buildModelLlmsLinks } from './model-llms'

describe('buildModelLlmsLinks', () => {
  it('builds the twin path and canonical URL from the site origin', () => {
    const links = buildModelLlmsLinks(
      'flux-2-klein-4b',
      'Flux 2 Klein 4b',
      new URL('https://example.org')
    )
    expect(links.mdPath).toBe('/p/supported-models/flux-2-klein-4b.md')
    expect(links.canonicalMdUrl).toBe(
      'https://example.org/p/supported-models/flux-2-klein-4b.md'
    )
  })

  it('falls back to comfy.org when no site is configured', () => {
    const links = buildModelLlmsLinks('kling-ai', 'Kling AI', undefined)
    expect(links.canonicalMdUrl).toBe(
      'https://comfy.org/p/supported-models/kling-ai.md'
    )
  })

  it('encodes the prompt into both agent URLs', () => {
    const links = buildModelLlmsLinks('kling-ai', 'Kling AI', undefined)
    for (const url of [links.claudeUrl, links.chatgptUrl]) {
      const q = new URL(url).searchParams.get('q')
      expect(q).toContain('https://comfy.org/p/supported-models/kling-ai.md')
      expect(q).toContain('Kling AI')
    }
    expect(links.claudeUrl.startsWith('https://claude.ai/new?q=')).toBe(true)
    expect(links.chatgptUrl.startsWith('https://chatgpt.com/?q=')).toBe(true)
    expect(links.claudeUrl).not.toContain(' ')
  })
})
