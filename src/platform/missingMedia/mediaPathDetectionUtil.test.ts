import { describe, expect, it } from 'vitest'

import {
  getAnnotatedMediaPathTypeForDetection,
  getMediaPathDetectionNames,
  normalizeAnnotatedMediaPathForDetection
} from './mediaPathDetectionUtil'

describe('normalizeAnnotatedMediaPathForDetection', () => {
  it.each([
    ['photo.png [input]', 'photo.png'],
    ['result.png [output]', 'result.png'],
    ['photo.png   [input]', 'photo.png'],
    ['with spaces.png [output]', 'with spaces.png'],
    ['nested/folder/video.mp4 [output]', 'nested/folder/video.mp4']
  ])('strips Core-style annotation from %s', (value, expected) => {
    expect(normalizeAnnotatedMediaPathForDetection(value)).toBe(expected)
  })

  it.each([
    ['photo.png[input]', 'photo.png'],
    ['result.png[output]', 'result.png'],
    ['with spaces.png   [output]', 'with spaces.png']
  ])('strips Cloud compact annotation from %s', (value, expected) => {
    expect(
      normalizeAnnotatedMediaPathForDetection(value, {
        allowCompactSuffix: true
      })
    ).toBe(expected)
  })

  it('does not strip compact annotations in Core mode', () => {
    expect(normalizeAnnotatedMediaPathForDetection('photo.png[input]')).toBe(
      'photo.png[input]'
    )
  })

  it.each(['photo.png [draft]', 'photo [output] copy.png', 'photo.png', ''])(
    'leaves non-matching values unchanged: %s',
    (value) => {
      expect(normalizeAnnotatedMediaPathForDetection(value)).toBe(value)
    }
  )
})

describe('getMediaPathDetectionNames', () => {
  it('returns raw and normalized names when an annotation is stripped', () => {
    expect(getMediaPathDetectionNames('photo.png [input]')).toEqual([
      'photo.png [input]',
      'photo.png'
    ])
  })

  it('returns only the raw name when no annotation is stripped', () => {
    expect(getMediaPathDetectionNames('photo.png')).toEqual(['photo.png'])
  })
})

describe('getAnnotatedMediaPathTypeForDetection', () => {
  it.each([
    ['photo.png [input]', 'input'],
    ['photo.png [output]', 'output']
  ])('returns the Core-style annotation type from %s', (value, expected) => {
    expect(getAnnotatedMediaPathTypeForDetection(value)).toBe(expected)
  })

  it('returns the compact annotation type in Cloud mode', () => {
    expect(
      getAnnotatedMediaPathTypeForDetection('photo.png[output]', {
        allowCompactSuffix: true
      })
    ).toBe('output')
  })

  it('returns undefined when no supported annotation is present', () => {
    expect(getAnnotatedMediaPathTypeForDetection('photo.png [draft]')).toBe(
      undefined
    )
  })
})
