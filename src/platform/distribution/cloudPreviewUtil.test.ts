import { describe, expect, it, vi } from 'vitest'

let mockIsCloud = false
vi.mock('./types', () => ({
  get isCloud() {
    return mockIsCloud
  }
}))

const { getCloudResParam } = await import('./cloudPreviewUtil')

describe('getCloudResParam', () => {
  it('returns empty string in non-cloud mode', () => {
    mockIsCloud = false
    expect(getCloudResParam('test.png')).toBe('')
  })

  it('returns res param for image files in cloud mode', () => {
    mockIsCloud = true
    expect(getCloudResParam('test.png')).toBe('&res=512')
    expect(getCloudResParam('photo.jpg')).toBe('&res=512')
    expect(getCloudResParam('photo.jpeg')).toBe('&res=512')
    expect(getCloudResParam('image.webp')).toBe('&res=512')
    expect(getCloudResParam('image.gif')).toBe('&res=512')
    expect(getCloudResParam('image.bmp')).toBe('&res=512')
    expect(getCloudResParam('image.tiff')).toBe('&res=512')
    expect(getCloudResParam('image.tif')).toBe('&res=512')
  })

  it('returns empty string for non-image files in cloud mode', () => {
    mockIsCloud = true
    expect(getCloudResParam('video.mp4')).toBe('')
    expect(getCloudResParam('video.webm')).toBe('')
    expect(getCloudResParam('audio.mp3')).toBe('')
    expect(getCloudResParam('audio.wav')).toBe('')
    expect(getCloudResParam('model.glb')).toBe('')
    expect(getCloudResParam('icon.svg')).toBe('')
  })

  it('returns res param when no filename provided in cloud mode', () => {
    mockIsCloud = true
    expect(getCloudResParam()).toBe('&res=512')
    expect(getCloudResParam(undefined)).toBe('&res=512')
  })

  it('returns empty string when no filename provided in non-cloud mode', () => {
    mockIsCloud = false
    expect(getCloudResParam()).toBe('')
  })
})
