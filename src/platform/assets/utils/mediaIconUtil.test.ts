import { describe, expect, it } from 'vitest'

import { iconForMediaType, iconForMimeType } from './mediaIconUtil'

describe('iconForMediaType', () => {
  it('maps text and misc fallbacks correctly', () => {
    expect(iconForMediaType('text')).toBe('icon-[lucide--text]')
    expect(iconForMediaType('other')).toBe('icon-[lucide--check-check]')
  })

  it('preserves existing mappings for core media types', () => {
    expect(iconForMediaType('image')).toBe('icon-[lucide--image]')
    expect(iconForMediaType('video')).toBe('icon-[lucide--video]')
    expect(iconForMediaType('audio')).toBe('icon-[lucide--music]')
    expect(iconForMediaType('3D')).toBe('icon-[lucide--box]')
  })
})

describe('iconForMimeType', () => {
  it('maps image MIME types (including non-renderable variants) to file-image', () => {
    expect(iconForMimeType('image/png')).toBe('icon-[lucide--file-image]')
    expect(iconForMimeType('image/aces')).toBe('icon-[lucide--file-image]')
    expect(iconForMimeType('image/x-exr')).toBe('icon-[lucide--file-image]')
    expect(iconForMimeType('image/tiff')).toBe('icon-[lucide--file-image]')
  })

  it('maps video MIME types to file-video', () => {
    expect(iconForMimeType('video/mp4')).toBe('icon-[lucide--file-video]')
    expect(iconForMimeType('video/webm')).toBe('icon-[lucide--file-video]')
  })

  it('maps audio MIME types to file-audio', () => {
    expect(iconForMimeType('audio/mpeg')).toBe('icon-[lucide--file-audio]')
    expect(iconForMimeType('audio/wav')).toBe('icon-[lucide--file-audio]')
  })

  it('maps text MIME types to file-text', () => {
    expect(iconForMimeType('text/plain')).toBe('icon-[lucide--file-text]')
    expect(iconForMimeType('text/markdown')).toBe('icon-[lucide--file-text]')
  })

  it('maps model MIME types to the 3D box icon', () => {
    expect(iconForMimeType('model/gltf-binary')).toBe('icon-[lucide--box]')
    expect(iconForMimeType('model/obj')).toBe('icon-[lucide--box]')
    expect(iconForMimeType('model/vnd.usdz+zip')).toBe('icon-[lucide--box]')
  })

  it('returns the generic file icon for unknown or missing MIME types', () => {
    expect(iconForMimeType('application/x-safetensors')).toBe(
      'icon-[lucide--file]'
    )
    expect(iconForMimeType('application/json')).toBe('icon-[lucide--file]')
    expect(iconForMimeType('application/octet-stream')).toBe(
      'icon-[lucide--file]'
    )
    expect(iconForMimeType('')).toBe('icon-[lucide--file]')
    expect(iconForMimeType(null)).toBe('icon-[lucide--file]')
    expect(iconForMimeType(undefined)).toBe('icon-[lucide--file]')
  })

  it('handles parameter suffixes and case', () => {
    expect(iconForMimeType('image/PNG; charset=utf-8')).toBe(
      'icon-[lucide--file-image]'
    )
  })
})
