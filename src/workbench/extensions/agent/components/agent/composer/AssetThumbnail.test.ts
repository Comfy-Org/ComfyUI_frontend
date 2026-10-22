import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import AssetThumbnail from './AssetThumbnail.vue'

describe('asset poster loading', () => {
  it.for(['tray', 'menu', 'inline'] as const)(
    'falls back after a failed poster and retries a replacement URL in the %s',
    async (variant) => {
      const { rerender } = render(AssetThumbnail, {
        props: {
          name: 'My video',
          mediaKind: 'video',
          previewUrl: '/expired.png',
          variant
        },
        global: { plugins: [i18n] }
      })
      const poster = screen.getByAltText(variant === 'tray' ? 'My video' : '')
      await fireEvent.error(poster)
      expect(screen.getByRole('img', { name: 'Video' })).toBeVisible()
      expect(
        screen.queryByAltText(variant === 'tray' ? 'My video' : '')
      ).not.toBeInTheDocument()
      await rerender({ previewUrl: '/replacement.png' })
      const replacement = screen.getByAltText(
        variant === 'tray' ? 'My video' : ''
      )
      expect(replacement).toHaveAttribute('src', '/replacement.png')
      await fireEvent.error(poster)
      expect(replacement).toBeInTheDocument()
      await fireEvent.error(replacement)
      expect(screen.getByRole('img', { name: 'Video' })).toBeVisible()
      await fireEvent.error(poster)
      expect(screen.getByRole('img', { name: 'Video' })).toBeVisible()
      await rerender({ previewUrl: '/expired.png' })
      expect(
        screen.getByAltText(variant === 'tray' ? 'My video' : '')
      ).toHaveAttribute('src', '/expired.png')
    }
  )
})
