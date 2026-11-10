import { describe, expect, it } from 'vitest'

import { readablePreview } from './chatPreviewText'

describe('readablePreview', () => {
  it.for([
    {
      case: 'a workflow reference becomes its name',
      input:
        'Workflow references and metadata [02_qwen_Image_edit_subgraphed](workflow://file%3A123) please check',
      expected:
        'Workflow references and metadata 02_qwen_Image_edit_subgraphed please check'
    },
    {
      case: 'brackets inside a reference name are unescaped',
      input: 'open [my \\[draft\\] flow](workflow://abc) now',
      expected: 'open my [draft] flow now'
    },
    {
      case: 'encoded parentheses in a reference id stay out of the text',
      input: '[A](workflow://id%28x%29) and [B](workflow://y)',
      expected: 'A and B'
    },
    {
      case: 'ordinary markdown links are left alone',
      input: 'see [docs](https://example.com) for more',
      expected: 'see [docs](https://example.com) for more'
    },
    {
      case: 'newlines and repeated whitespace collapse',
      input: '  first line\n\nsecond\t line  ',
      expected: 'first line second line'
    }
  ])('$case', ({ input, expected }) => {
    expect(readablePreview(input)).toBe(expected)
  })

  it('returns undefined for a missing or blank preview', () => {
    expect(readablePreview(undefined)).toBeUndefined()
    expect(readablePreview('  \n ')).toBeUndefined()
  })
})
