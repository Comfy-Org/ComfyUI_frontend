import { describe, expect, it } from 'vitest'

import { extractMediaUrls, mediaKindForModality } from './workshop-results'

describe('extractMediaUrls', () => {
  it('finds URLs wherever the partner happened to put them', () => {
    // Three real shapes from three different providers. None of them agree,
    // which is the reason this walks the document instead of reading a field.
    expect(extractMediaUrls({ images: [{ url: 'https://a/1.png' }] })).toEqual([
      'https://a/1.png'
    ])
    expect(extractMediaUrls({ video: { url: 'https://a/2.mp4' } })).toEqual([
      'https://a/2.mp4'
    ])
    expect(extractMediaUrls({ url: 'https://a/3.wav' })).toEqual([
      'https://a/3.wav'
    ])
  })

  it('keeps document order and drops repeats', () => {
    expect(
      extractMediaUrls({
        images: [{ url: 'https://a/1.png' }, { url: 'https://a/2.png' }],
        preview: 'https://a/1.png'
      })
    ).toEqual(['https://a/1.png', 'https://a/2.png'])
  })

  it('ignores the echoed inputs', () => {
    // Several providers echo the request back. Showing the image someone
    // just uploaded as though the model produced it is worse than useless.
    expect(
      extractMediaUrls({
        medias: [{ role: 'image', value: 'https://a/in.png' }],
        input: { image_url: 'https://a/in2.png' },
        images: [{ url: 'https://a/out.png' }]
      })
    ).toEqual(['https://a/out.png'])
  })

  it('takes inline data but not arbitrary strings', () => {
    expect(
      extractMediaUrls({
        audio: 'data:audio/wav;base64,AAAA',
        seed: '128371',
        model: 'flux-2-pro',
        note: 'see https://example.com in the docs'
      })
      // The prose mentions a URL but does not start with one, so it is text.
    ).toEqual(['data:audio/wav;base64,AAAA'])
  })

  it('terminates on a self-referential document', () => {
    const cyclic: Record<string, unknown> = { url: 'https://a/1.png' }
    cyclic.self = cyclic

    expect(extractMediaUrls(cyclic)).toEqual(['https://a/1.png'])
  })
})

describe('mediaKindForModality', () => {
  it('renders by what the model makes, not by what the URL looks like', () => {
    // Router re-hosts results on Comfy storage, and those URLs need not carry
    // a usable extension, so the catalog is the only reliable source.
    expect(mediaKindForModality('image')).toBe('image')
    expect(mediaKindForModality('video')).toBe('video')
    expect(mediaKindForModality('audio')).toBe('audio')
    expect(mediaKindForModality('music')).toBe('audio')
  })

  it('offers a link for what a media element cannot show', () => {
    expect(mediaKindForModality('3d')).toBe('link')
    expect(mediaKindForModality('svg')).toBe('link')
  })
})
