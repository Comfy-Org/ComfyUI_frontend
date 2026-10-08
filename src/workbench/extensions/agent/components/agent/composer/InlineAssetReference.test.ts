import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import type { ComposerAttachment } from '../../../types/composerAttachment'
import InlineAssetReference from './InlineAssetReference.vue'

function renderReference(
  props: Pick<ComposerAttachment, 'name' | 'previewUrl' | 'mediaKind'>
) {
  return render(InlineAssetReference, {
    props: { ...props, removeLabel: `Remove ${props.name} reference` },
    global: { plugins: [i18n] }
  })
}

describe('inline asset media', () => {
  it.for([
    { name: 'cat.png', mediaKind: 'image' },
    { name: 'My video', mediaKind: 'video' }
  ] as const)(
    'shows the image/poster for $mediaKind',
    ({ name, mediaKind }) => {
      renderReference({
        name,
        mediaKind,
        previewUrl: '/poster.png'
      })
      expect(screen.getByAltText('')).toHaveAttribute('src', '/poster.png')
      expect(screen.getByText(name)).toBeVisible()
    }
  )

  it('uses a video icon while awaiting the shared poster', () => {
    renderReference({
      name: 'My video',
      mediaKind: 'video'
    })
    expect(screen.getByRole('img', { name: 'Video' })).toBeInTheDocument()
  })

  it.for([
    { name: 'recording', mediaKind: 'audio', label: 'Audio' },
    { name: 'song.mp3', mediaKind: undefined, label: 'Audio' },
    { name: 'My video', mediaKind: 'video', label: 'Video' }
  ] as const)(
    'identifies $name by its media type when no thumbnail is available',
    ({ name, mediaKind, label }) => {
      renderReference({ name, mediaKind })
      expect(screen.getByRole('img', { name: label })).toBeInTheDocument()
      expect(screen.getByText(name)).toBeVisible()
    }
  )
})
