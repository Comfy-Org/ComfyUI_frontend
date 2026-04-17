import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getVideoFrameUrl, isVideoSrc, rewriteHubAssetUrl } from './hubAssetUrl'

describe('isVideoSrc', () => {
  it.each([
    ['https://cdn.example.com/clip.mp4', true],
    ['https://cdn.example.com/clip.webm', true],
    ['https://cdn.example.com/clip.MOV', true],
    ['/__hub_assets/uploads/clip.mp4', true],
    ['https://cdn.example.com/thumb.webp', false],
    ['https://cdn.example.com/thumb.png', false],
    ['', false]
  ])('isVideoSrc(%s) → %s', (url, expected) => {
    expect(isVideoSrc(url)).toBe(expected)
  })

  it('handles undefined', () => {
    expect(isVideoSrc(undefined)).toBe(false)
  })
})

describe('getVideoFrameUrl', () => {
  it('inserts Cloudflare frame segment after the hub-assets origin', () => {
    expect(
      getVideoFrameUrl('https://comfy-hub-assets.comfy.org/uploads/abc.mp4')
    ).toBe(
      'https://comfy-hub-assets.comfy.org/cdn-cgi/media/mode=frame,time=1s/uploads/abc.mp4'
    )
  })

  it('inserts Cloudflare frame segment after the dev proxy prefix', () => {
    expect(getVideoFrameUrl('/__hub_assets/uploads/abc.mp4')).toBe(
      '/__hub_assets/cdn-cgi/media/mode=frame,time=1s/uploads/abc.mp4'
    )
  })

  it('supports custom time offset', () => {
    expect(
      getVideoFrameUrl(
        'https://comfy-hub-assets.comfy.org/uploads/abc.mp4',
        '3s'
      )
    ).toBe(
      'https://comfy-hub-assets.comfy.org/cdn-cgi/media/mode=frame,time=3s/uploads/abc.mp4'
    )
  })

  it('returns the URL unchanged for unknown hosts', () => {
    const unrelated = 'https://cdn.example.com/clip.mp4'
    expect(getVideoFrameUrl(unrelated)).toBe(unrelated)
  })
})

describe('rewriteHubAssetUrl', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
  })

  it('returns undefined when url is missing', () => {
    expect(rewriteHubAssetUrl(undefined)).toBeUndefined()
  })

  it('rewrites hub-assets URLs in dev mode', () => {
    expect(
      rewriteHubAssetUrl('https://comfy-hub-assets.comfy.org/uploads/x.mp4')
    ).toBe('/__hub_assets/uploads/x.mp4')
  })

  it('passes through unrelated URLs unchanged', () => {
    expect(rewriteHubAssetUrl('https://cdn.example.com/x.mp4')).toBe(
      'https://cdn.example.com/x.mp4'
    )
  })

  it('passes through unchanged when not in dev mode', () => {
    vi.stubEnv('DEV', false)
    const absolute = 'https://comfy-hub-assets.comfy.org/uploads/x.mp4'
    expect(rewriteHubAssetUrl(absolute)).toBe(absolute)
  })
})
