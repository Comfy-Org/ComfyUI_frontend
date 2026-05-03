import { describe, expect, it } from 'vitest'

import { buildVideoSources } from './video'

describe('buildVideoSources', () => {
  it('builds a source per requested format', () => {
    const sources = buildVideoSources({
      name: 'hero',
      baseUrl: 'https://media.comfy.org/website/marketing',
      width: 1280,
      formats: ['webm', 'mp4']
    })

    expect(sources).toEqual([
      {
        src: 'https://media.comfy.org/website/marketing/hero-1280.webm',
        type: 'video/webm',
        format: 'webm'
      },
      {
        src: 'https://media.comfy.org/website/marketing/hero-1280.mp4',
        type: 'video/mp4',
        format: 'mp4'
      }
    ])
  })

  it('preserves caller-supplied format order', () => {
    const sources = buildVideoSources({
      name: 'clip',
      baseUrl: 'https://cdn.example.com/v',
      width: 960,
      formats: ['mp4', 'webm']
    })

    expect(sources.map((s) => s.format)).toEqual(['mp4', 'webm'])
  })

  it('strips a single trailing slash from baseUrl', () => {
    const sources = buildVideoSources({
      name: 'reel',
      baseUrl: 'https://media.comfy.org/website/marketing/',
      width: 1920,
      formats: ['webm']
    })

    expect(sources[0]?.src).toBe(
      'https://media.comfy.org/website/marketing/reel-1920.webm'
    )
  })

  it('returns an empty list when no formats are requested', () => {
    const sources = buildVideoSources({
      name: 'x',
      baseUrl: 'https://example.com',
      width: 640,
      formats: []
    })

    expect(sources).toEqual([])
  })
})
