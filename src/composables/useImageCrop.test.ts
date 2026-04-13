import { describe, expect, it } from 'vitest'

import { imageCropLoadingAfterUrlChange } from '@/composables/useImageCrop'

describe('imageCropLoadingAfterUrlChange', () => {
  it('clears loading when url becomes null', () => {
    expect(imageCropLoadingAfterUrlChange(null, 'https://a/b.png')).toBe(false)
  })

  it('starts loading when url changes to a new string', () => {
    expect(imageCropLoadingAfterUrlChange('https://b', 'https://a')).toBe(true)
  })

  it('starts loading when first url is set', () => {
    expect(imageCropLoadingAfterUrlChange('https://a', undefined)).toBe(true)
  })

  it('returns null when url is unchanged so caller can skip updating', () => {
    expect(imageCropLoadingAfterUrlChange('https://a', 'https://a')).toBe(null)
  })
})
