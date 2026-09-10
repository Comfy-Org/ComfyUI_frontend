// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import PackBanner from './PackBanner.vue'

describe('PackBanner', () => {
  it('forwards the requested loading priority to the banner image', () => {
    render(PackBanner, {
      props: {
        bannerUrl: 'https://example.com/banner.webp',
        name: 'Example',
        loading: 'eager'
      }
    })

    expect(screen.getByRole('img').getAttribute('loading')).toBe('eager')
    expect(screen.getByRole('img').getAttribute('decoding')).toBe('async')
  })

  it('removes the loaded-image backdrop when the image URL changes', async () => {
    const { rerender } = render(PackBanner, {
      props: {
        bannerUrl: 'https://example.com/first.webp',
        name: 'Example'
      }
    })

    await fireEvent.load(screen.getByRole('img'))
    expect(screen.getByTestId('banner-backdrop')).toBeTruthy()

    await rerender({
      bannerUrl: 'https://example.com/second.webp',
      name: 'Example'
    })
    expect(screen.queryByTestId('banner-backdrop')).toBeNull()
  })
})
