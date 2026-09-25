import { describe, expect, it } from 'vitest'

import type { FrameSource } from './workshop-model-restrictions'
import {
  frameRatioRule,
  frameSource,
  framesDisagreeOnRatio
} from './workshop-model-restrictions'
import type { FieldValue } from './workshop-playground'

describe('frameRatioRule', () => {
  it('names the frame fields on the page the rule was read for', () => {
    expect(
      frameRatioRule('byteplus--seedance-2-5-first-last-frame--animate-images')
    ).toEqual({
      first: 'first_frame_url',
      last: 'last_frame_url'
    })
  })

  // The rule comes from one model's documentation. Its siblings share a
  // provider and a mode, not a rulebook.
  it.for([
    'byteplus--seedance-2-fast-first-last-frame--animate-images',
    'kling--omni-pro-first-last-frame--animate-images',
    'byteplus--seedance-2-5-reference--generate-videos',
    'unknown-model'
  ] as const)('leaves %s unrestricted', (slug) => {
    expect(frameRatioRule(slug)).toBeUndefined()
  })
})

describe('frameSource', () => {
  const file = new File([], 'frame.png', { type: 'image/png' })

  const read: readonly [string, FieldValue, FrameSource][] = [
    [
      'a URL string',
      'https://example.com/a.png',
      { url: 'https://example.com/a.png' }
    ],
    [
      'an uploaded file',
      { name: 'a.png', size: 1, type: 'image/png', file },
      { file, url: undefined }
    ],
    [
      'a file carrying only a preview',
      { name: 'a.png', size: 1, type: 'image/png', previewUrl: 'blob:a' },
      { file: undefined, url: 'blob:a' }
    ],
    [
      'the first of a list',
      [{ name: 'a.png', size: 1, type: 'image/png', previewUrl: 'blob:a' }],
      { file: undefined, url: 'blob:a' }
    ]
  ]

  it.for(read)('reads %s', ([, value, expected]) => {
    expect(frameSource(value)).toEqual(expected)
  })

  const unreadable: readonly [string, FieldValue][] = [
    ['nothing', undefined],
    ['an empty string', ''],
    ['an empty list', []],
    ['a file with no source yet', { name: 'a.png', size: 1, type: 'image/png' }]
  ]

  it.for(unreadable)('reads no frame from %s', ([, value]) => {
    expect(frameSource(value)).toBeUndefined()
  })
})

describe('framesDisagreeOnRatio', () => {
  const landscape = { width: 1920, height: 1080 }

  it.for([
    ['a portrait last frame', { width: 1080, height: 1920 }, true],
    ['a square last frame', { width: 1024, height: 1024 }, true],
    ['a 4:3 last frame against 16:9', { width: 1600, height: 1200 }, true],
    ['the same shape at another size', { width: 1280, height: 720 }, false],
    ['an identical frame', landscape, false],
    ['a frame off by one pixel', { width: 1919, height: 1080 }, false],
    // 16:9 against 1901x1080 is 1% narrower exactly, the widest shape the
    // tolerance still accepts; one pixel narrower is the first it rejects.
    ['a frame exactly at the tolerance', { width: 1901, height: 1080 }, false],
    ['a frame just past the tolerance', { width: 1900, height: 1080 }, true]
  ] as const)('reads %s', ([, last, expected]) => {
    expect(framesDisagreeOnRatio(landscape, last)).toBe(expected)
  })

  // Nothing measured is not the same as nothing wrong, and a notice fired on a
  // frame that failed to decode would be noise the reader cannot act on.
  it.for([
    ['no first frame', undefined, landscape],
    ['no last frame', landscape, undefined],
    ['neither frame', undefined, undefined],
    ['a zero-height frame', landscape, { width: 100, height: 0 }],
    ['a negative dimension', landscape, { width: -100, height: 50 }],
    ['a non-finite dimension', landscape, { width: Number.NaN, height: 50 }]
  ] as const)('stays quiet on %s', ([, first, last]) => {
    expect(framesDisagreeOnRatio(first, last)).toBe(false)
  })
})
