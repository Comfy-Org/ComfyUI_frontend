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
})
