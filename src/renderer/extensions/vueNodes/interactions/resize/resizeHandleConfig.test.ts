import { describe, expect, it } from 'vitest'

import type { CompassCorners } from '@/lib/litegraph/src/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  RESIZE_HANDLES,
  RESIZE_HANDLE_ARIA_LABELS_EN,
  hasNorthEdge,
  hasWestEdge
} from './resizeHandleConfig'

describe('hasWestEdge', () => {
  it.each<[CompassCorners, boolean]>([
    ['NW', true],
    ['SW', true],
    ['NE', false],
    ['SE', false]
  ])('returns %s for %s', (corner, expected) => {
    expect(hasWestEdge(corner)).toBe(expected)
  })
})

describe('hasNorthEdge', () => {
  it.each<[CompassCorners, boolean]>([
    ['NW', true],
    ['NE', true],
    ['SW', false],
    ['SE', false]
  ])('returns %s for %s', (corner, expected) => {
    expect(hasNorthEdge(corner)).toBe(expected)
  })
})

describe('RESIZE_HANDLE_ARIA_LABELS_EN', () => {
  it('exposes a non-empty English label for every configured corner', () => {
    for (const { corner } of RESIZE_HANDLES) {
      const label = RESIZE_HANDLE_ARIA_LABELS_EN[corner]
      expect(label, `label for ${corner}`).toBeTypeOf('string')
      expect(label.length, `label for ${corner} non-empty`).toBeGreaterThan(0)
    }
  })

  it('matches the English value resolved from each handle i18nKey', () => {
    for (const { corner, i18nKey } of RESIZE_HANDLES) {
      const [section, key] = i18nKey.split('.') as [
        keyof typeof enMessages,
        string
      ]
      const expected = (enMessages[section] as Record<string, string>)[key]
      expect(RESIZE_HANDLE_ARIA_LABELS_EN[corner]).toBe(expected)
    }
  })
})
