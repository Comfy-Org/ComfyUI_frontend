import { describe, expect, it } from 'vitest'

import { emphasisThatCannotClose } from './emphasis'

describe('emphasisThatCannotClose', () => {
  it('accepts emphasis that closes on a space', () => {
    expect(emphasisThatCannotClose('**bold** and plain')).toEqual([])
  })

  it('accepts emphasis that closes at the end of the string', () => {
    expect(emphasisThatCannotClose('ends in **bold**')).toEqual([])
  })

  it('accepts Japanese emphasis closing before punctuation', () => {
    expect(emphasisThatCannotClose('**太字**、続き')).toEqual([])
  })

  /**
   * The defect this exists for. CommonMark will not let a delimiter close when
   * it is preceded by punctuation and followed by a word character, and a
   * bolded Japanese clause almost always ends in 。 or ） with the next word
   * running straight on.
   *
   * `/ja/pricing` published two of these. One rendered its asterisks literally.
   * The other was worse: the second `**` opened a new emphasis instead of
   * closing the first, so a paragraph of text that should have been plain came
   * out bold, and the markup still balanced — which is why nothing caught it.
   */
  it('rejects a closer trapped between punctuation and a word', () => {
    expect(
      emphasisThatCannotClose('**繰り越されます。**有効期限は1年間')
    ).toEqual(['**繰り越されます。**有効期限は1年間'])
  })

  it('rejects a closer after a full-width bracket', () => {
    expect(
      emphasisThatCannotClose('**延長（最大1時間）**と、API経由で')
    ).toEqual(['**延長（最大1時間）**と、API経由で'])
  })

  it('says nothing about text with no emphasis at all', () => {
    expect(emphasisThatCannotClose('ordinary sentence。continues')).toEqual([])
  })

  /** A lone delimiter is not emphasis, so there is nothing to fail to close. */
  it('ignores an unpaired delimiter', () => {
    expect(emphasisThatCannotClose('a ** lonely run')).toEqual([])
  })
})
