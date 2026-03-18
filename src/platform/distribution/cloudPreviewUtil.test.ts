import { describe, expect, it, vi } from 'vitest'

import { appendCloudResParam } from './cloudPreviewUtil'

const mockIsCloud = vi.hoisted(() => ({ value: false }))

vi.mock('./types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

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

  it.for(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif'])(
    'sets res=512 for .%s in cloud mode',
    (ext) => {
      mockIsCloud.value = true
      const params = buildParams(`file.${ext}`)
      expect(params.get('res')).toBe('512')
    }
  )

  it.for([
    'video.mp4',
    'video.webm',
    'audio.mp3',
    'audio.wav',
    'model.glb',
    'icon.svg'
  ])('does not set res for %s in cloud mode', (name) => {
    mockIsCloud.value = true
    expect(buildParams(name).has('res')).toBe(false)
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
