import { describe, expect, it } from 'vitest'

import { widgetSubtitle } from '@/utils/widgetSubtitleUtil'

describe('widgetSubtitle', () => {
  describe('type-driven label', () => {
    it.each([
      ['STRING', 'text'],
      ['INT', 'number'],
      ['FLOAT', 'number'],
      ['BOOLEAN', 'toggle'],
      ['COMBO', 'list'],
      ['TEXTAREA', 'text'],
      ['IMAGE', 'image'],
      ['COLOR', 'color']
    ])('maps backend spec type %s -> %s', (specType, expected) => {
      expect(
        widgetSubtitle({ name: 'unmapped', spec: { type: specType, name: '' } })
      ).toBe(expected)
    })

    it.each([
      ['number', 'number'],
      ['text', 'text'],
      ['toggle', 'toggle'],
      ['slider', 'number']
    ])(
      'maps render type %s -> %s when spec is absent',
      (renderType, expected) => {
        expect(widgetSubtitle({ name: 'unmapped', type: renderType })).toBe(
          expected
        )
      }
    )

    it('falls back to lowercased raw type for unknown values', () => {
      expect(widgetSubtitle({ name: 'foo', type: 'UNKNOWN_THING' })).toBe(
        'unknown_thing'
      )
    })

    it('returns empty string when neither type nor name is set', () => {
      expect(widgetSubtitle({})).toBe('')
    })
  })

  describe('name-pattern overrides', () => {
    it.each([
      'width',
      'height',
      'image_width',
      'image_height',
      'size',
      'dimensions'
    ])('overrides type with "size" for name %s', (name) => {
      expect(widgetSubtitle({ name, spec: { type: 'INT', name } })).toBe('size')
    })

    it.each(['seed', 'noise_seed', 'random_seed'])(
      'overrides type with "seed" for name %s',
      (name) => {
        expect(widgetSubtitle({ name, spec: { type: 'INT', name } })).toBe(
          'seed'
        )
      }
    )

    it('does not match patterns inside compound words', () => {
      // "_size" boundary should not match "noise" — the regex anchors
      // on word boundaries, not arbitrary substrings.
      expect(
        widgetSubtitle({
          name: 'noise',
          spec: { type: 'STRING', name: 'noise' }
        })
      ).toBe('text')
    })

    it('does not match "size" inside other words like "resize"', () => {
      // The (?:^|_) prefix ensures "size" only matches at the start
      // or after an underscore, not arbitrary positions in a word.
      // For "resize" the pattern looks for "(^|_)resize($|_)" which
      // doesn't match "size" - so "resize" should NOT collapse to "size".
      expect(
        widgetSubtitle({
          name: 'resize_factor',
          spec: { type: 'FLOAT', name: 'resize_factor' }
        })
      ).toBe('number')
    })
  })

  describe('precedence', () => {
    it('uses spec.type over widget.type when both are present', () => {
      // spec.type wins: STRING -> "text"; widget.type ("number") is ignored.
      expect(
        widgetSubtitle({
          name: 'prompt',
          type: 'number',
          spec: { type: 'STRING', name: 'prompt' }
        })
      ).toBe('text')
    })

    it('name pattern beats both type sources', () => {
      // width is INT; pattern overrides "number" -> "size".
      expect(
        widgetSubtitle({
          name: 'width',
          type: 'number',
          spec: { type: 'INT', name: 'width' }
        })
      ).toBe('size')
    })
  })
})
