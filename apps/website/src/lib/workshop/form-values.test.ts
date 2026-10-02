import { describe, expect, it } from 'vitest'

import type { FileValue, FormValues } from '../../config/workshop-playground'
import { sameFormValues } from './form-values'

const picked: FileValue = { name: 'a.webp', size: 12, type: 'image/webp' }
const readAgain: FileValue = { name: 'a.webp', size: 12, type: 'image/webp' }

describe('sameFormValues', () => {
  it.for([
    ['a rebuilt record with the same answers', { a: '1' }, { a: '1' }, true],
    ['a changed answer', { a: '1' }, { a: '2' }, false],
    ['a cleared answer', { a: '1' }, { a: '' }, false],
    ['an answer that was added', {}, { a: '1' }, false],
    ['an answer that went missing', { a: '1' }, {}, false],
    ['the very same file', { a: picked }, { a: picked }, true],
    ['a file read twice', { a: picked }, { a: readAgain }, false],
    ['the same list of files', { a: [picked] }, { a: [picked] }, true],
    ['a list that grew', { a: [picked] }, { a: [picked, readAgain] }, false],
    ['a file against a list', { a: picked }, { a: [picked] }, false]
  ] satisfies [string, FormValues, FormValues, boolean][])(
    'reads %s',
    ([, left, right, expected]) => {
      expect(sameFormValues(left, right)).toBe(expected)
      expect(sameFormValues(right, left)).toBe(expected)
    }
  )
})
