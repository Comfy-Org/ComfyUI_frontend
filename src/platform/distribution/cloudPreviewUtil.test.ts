import { describe, expect, it, vi } from 'vitest'

const mockIsCloud = vi.hoisted(() => ({ value: false }))

vi.mock('./types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

import { appendCloudResParam } from './cloudPreviewUtil'

function buildParams(filename?: string): URLSearchParams {
  const params = new URLSearchParams()
  appendCloudResParam(params, filename)
  return params
}

describe('appendCloudResParam', () => {
  it('does not set res in non-cloud mode', () => {
    mockIsCloud.value = false
    expect(buildParams('test.png').has('res')).toBe(false)
  })

  it('sets res=512 for image files in cloud mode', () => {
    mockIsCloud.value = true
    for (const ext of [
      'png',
      'jpg',
      'jpeg',
      'webp',
      'gif',
      'bmp',
      'tiff',
      'tif'
    ]) {
      const params = buildParams(`file.${ext}`)
      expect(params.get('res')).toBe('512')
    }
  })

  it('does not set res for non-image files in cloud mode', () => {
    mockIsCloud.value = true
    for (const name of [
      'video.mp4',
      'video.webm',
      'audio.mp3',
      'audio.wav',
      'model.glb',
      'icon.svg'
    ]) {
      expect(buildParams(name).has('res')).toBe(false)
    }
  })

  it('sets res=512 when no filename provided in cloud mode', () => {
    mockIsCloud.value = true
    expect(buildParams().get('res')).toBe('512')
    expect(buildParams(undefined).get('res')).toBe('512')
  })

  it('does not set res when no filename provided in non-cloud mode', () => {
    mockIsCloud.value = false
    expect(buildParams().has('res')).toBe(false)
  })
})
