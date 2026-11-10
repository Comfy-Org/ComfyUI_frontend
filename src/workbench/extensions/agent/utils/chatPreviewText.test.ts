import { describe, expect, it } from 'vitest'

import { readablePreview } from './chatPreviewText'

describe('readablePreview', () => {
  it('shows a workflow reference as its name, not as markdown link syntax', () => {
    expect(
      readablePreview(
        'Workflow references and metadata [02_qwen_Image_edit_subgraphed](workflow://file%3A123) please check'
      )
    ).toBe(
      'Workflow references and metadata 02_qwen_Image_edit_subgraphed please check'
    )
  })

  it('unescapes brackets and backslashes inside a reference name', () => {
    expect(
      readablePreview('open [my \\[draft\\] flow](workflow://abc) now')
    ).toBe('open my [draft] flow now')
  })

  it('keeps reference ids that contain encoded parentheses out of the text', () => {
    expect(
      readablePreview('[A](workflow://id%28x%29) and [B](workflow://y)')
    ).toBe('A and B')
  })

  it('leaves ordinary markdown links and text alone', () => {
    expect(readablePreview('see [docs](https://example.com) for more')).toBe(
      'see [docs](https://example.com) for more'
    )
  })

  it('collapses newlines and repeated whitespace into single spaces', () => {
    expect(readablePreview('  first line\n\nsecond\t line  ')).toBe(
      'first line second line'
    )
  })

  it('returns undefined for a missing or blank preview', () => {
    expect(readablePreview(undefined)).toBeUndefined()
    expect(readablePreview('  \n ')).toBeUndefined()
  })
})
