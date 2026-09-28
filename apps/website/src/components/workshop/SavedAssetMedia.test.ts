import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { SavedAssetKind } from '../../lib/workshop/saved-assets'
import SavedAssetMedia from './SavedAssetMedia.vue'

describe('SavedAssetMedia', () => {
  it.for([
    ['image', 'IMG'],
    ['video', 'VIDEO'],
    ['audio', 'AUDIO']
  ] as const)('plays a saved %s in its own element', ([kind, tag]) => {
    render(SavedAssetMedia, {
      props: {
        kind: kind satisfies SavedAssetKind,
        url: 'https://assets.example/saved',
        alt: 'Your assets'
      },
      attrs: { 'data-testid': 'media' }
    })

    expect(
      screen.getByTestId('media').tagName,
      'a video served into an <img> shows nothing at all'
    ).toBe(tag)
  })

  it.for([[true], [false]] as const)(
    'renews the URL of a saved video without changing whether it plays, playing: %s',
    async ([wasPlaying]) => {
      const { rerender } = render(SavedAssetMedia, {
        props: {
          kind: 'video' satisfies SavedAssetKind,
          url: 'https://assets.example/a?sig=first',
          assetId: 'asset-a',
          controls: true
        },
        attrs: { 'data-testid': 'media' }
      })
      const media = screen.getByTestId('media')
      if (!(media instanceof HTMLMediaElement))
        throw new Error('a saved video belongs in a media element')

      await media.play()
      if (!wasPlaying) media.pause()
      media.currentTime = 4
      await rerender({ url: 'https://assets.example/a?sig=second' })
      // The browser rewinds on the new src and autoplay starts it again.
      media.currentTime = 0
      await media.play()
      media.dispatchEvent(new Event('loadedmetadata'))

      expect(media.currentTime).toBe(4)
      expect(
        media.paused,
        'autoplay is still set, so a video the reader paused restarts itself'
      ).toBe(!wasPlaying)
    }
  )
})
