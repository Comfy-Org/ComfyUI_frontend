import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useBannerImage } from './useBannerImage'

describe('useBannerImage', () => {
  it('shows the default banner when neither url is provided', () => {
    const { showDefaultBanner, imgSrc } = useBannerImage({})
    expect(showDefaultBanner.value).toBe(true)
    expect(imgSrc.value).toBeUndefined()
  })

  it('prefers bannerUrl over iconUrl when both are provided', () => {
    const { showDefaultBanner, imgSrc } = useBannerImage({
      bannerUrl: 'https://example.com/banner.png',
      iconUrl: 'https://example.com/icon.png'
    })
    expect(showDefaultBanner.value).toBe(false)
    expect(imgSrc.value).toBe('https://example.com/banner.png')
  })

  it('falls back to iconUrl when bannerUrl is missing', () => {
    const { imgSrc } = useBannerImage({
      iconUrl: 'https://example.com/icon.png'
    })
    expect(imgSrc.value).toBe('https://example.com/icon.png')
  })

  it('reactively updates when sources change', () => {
    const banner = ref<string | undefined>(undefined)
    const { showDefaultBanner, imgSrc } = useBannerImage({ bannerUrl: banner })

    expect(showDefaultBanner.value).toBe(true)
    banner.value = 'https://example.com/new.png'
    expect(showDefaultBanner.value).toBe(false)
    expect(imgSrc.value).toBe('https://example.com/new.png')
  })

  it('flips isImageError when onImageError is called', () => {
    const { isImageError, onImageError } = useBannerImage({
      bannerUrl: 'x'
    })
    expect(isImageError.value).toBe(false)
    onImageError()
    expect(isImageError.value).toBe(true)
  })

  it('exposes the default banner constant for consumers', () => {
    const { DEFAULT_BANNER } = useBannerImage({})
    expect(DEFAULT_BANNER).toBe('/assets/images/fallback-gradient-avatar.svg')
  })
})
