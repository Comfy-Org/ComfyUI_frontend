import { describe, expect, it } from 'vitest'

import type { ResultItem } from '@/schemas/apiSchema'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'

describe('createAnnotatedPath', () => {
  describe('string input', () => {
    it('returns filename unchanged with default options', () => {
      expect(createAnnotatedPath('image.png')).toBe('image.png')
    })

    it('prepends subfolder when provided', () => {
      expect(createAnnotatedPath('image.png', { subfolder: 'sub' })).toBe(
        'sub/image.png'
      )
    })

    it('appends annotation for non-input rootFolder', () => {
      expect(createAnnotatedPath('image.png', { rootFolder: 'output' })).toBe(
        'image.png [output]'
      )
    })

    it('adds no annotation when rootFolder is input', () => {
      expect(createAnnotatedPath('image.png', { rootFolder: 'input' })).toBe(
        'image.png'
      )
    })

    it('does not double-annotate an already-annotated filepath', () => {
      expect(
        createAnnotatedPath('image.png [output]', { rootFolder: 'temp' })
      ).toBe('image.png [output]')
    })

    it('combines subfolder and non-input rootFolder annotation', () => {
      expect(
        createAnnotatedPath('image.png', {
          subfolder: 'sub',
          rootFolder: 'temp'
        })
      ).toBe('sub/image.png [temp]')
    })
  })

  describe('ResultItem input', () => {
    it('combines filename and subfolder from ResultItem', () => {
      const item: ResultItem = { filename: 'photo.jpg', subfolder: 'gallery' }
      expect(createAnnotatedPath(item)).toBe('gallery/photo.jpg')
    })

    it('appends annotation when ResultItem type is not input', () => {
      const item: ResultItem = {
        filename: 'result.png',
        subfolder: 'results',
        type: 'output'
      }
      expect(createAnnotatedPath(item, { rootFolder: 'output' })).toBe(
        'results/result.png [output]'
      )
    })

    it('returns just filename when subfolder is empty', () => {
      const item: ResultItem = { filename: 'solo.png', subfolder: '' }
      expect(createAnnotatedPath(item)).toBe('solo.png')
    })
  })
})
