import { describe, expect, it } from 'vitest'

import { extractMediaUrls } from './qa-analyze-pr'

describe('extractMediaUrls', () => {
  it('extracts markdown image URLs', () => {
    const text = '![screenshot](https://example.com/image.png)'
    expect(extractMediaUrls(text)).toEqual(['https://example.com/image.png'])
  })

  it('extracts multiple markdown images', () => {
    const text = [
      '![before](https://example.com/before.png)',
      'Some text',
      '![after](https://example.com/after.jpg)'
    ].join('\n')
    expect(extractMediaUrls(text)).toEqual([
      'https://example.com/before.png',
      'https://example.com/after.jpg'
    ])
  })

  it('extracts raw URLs with media extensions', () => {
    const text = 'Check this: https://cdn.example.com/demo.mp4 for details'
    expect(extractMediaUrls(text)).toEqual(['https://cdn.example.com/demo.mp4'])
  })

  it('extracts GitHub user-attachments URLs', () => {
    const text =
      'https://github.com/user-attachments/assets/abc12345-6789-0def-1234-567890abcdef'
    expect(extractMediaUrls(text)).toEqual([
      'https://github.com/user-attachments/assets/abc12345-6789-0def-1234-567890abcdef'
    ])
  })

  it('extracts private-user-images URLs', () => {
    const text =
      'https://private-user-images.githubusercontent.com/12345/abcdef-1234?jwt=token123'
    expect(extractMediaUrls(text)).toEqual([
      'https://private-user-images.githubusercontent.com/12345/abcdef-1234?jwt=token123'
    ])
  })

  it('extracts URLs with query parameters', () => {
    const text = 'https://example.com/image.png?w=800&h=600'
    expect(extractMediaUrls(text)).toEqual([
      'https://example.com/image.png?w=800&h=600'
    ])
  })

  it('deduplicates URLs', () => {
    const text = [
      '![img](https://example.com/same.png)',
      '![img2](https://example.com/same.png)',
      'Also https://example.com/same.png'
    ].join('\n')
    expect(extractMediaUrls(text)).toEqual(['https://example.com/same.png'])
  })

  it('returns empty array for empty input', () => {
    expect(extractMediaUrls('')).toEqual([])
  })

  it('returns empty array for text with no media URLs', () => {
    expect(extractMediaUrls('Just some text without any URLs')).toEqual([])
  })

  it('handles mixed media types', () => {
    const text = [
      '![screen](https://example.com/screenshot.png)',
      'Video: https://example.com/demo.webm',
      '![gif](https://example.com/animation.gif)'
    ].join('\n')
    const urls = extractMediaUrls(text)
    expect(urls).toContain('https://example.com/screenshot.png')
    expect(urls).toContain('https://example.com/demo.webm')
    expect(urls).toContain('https://example.com/animation.gif')
  })

  it('ignores non-http URLs in markdown', () => {
    const text = '![local](./local-image.png)'
    expect(extractMediaUrls(text)).toEqual([])
  })
})
