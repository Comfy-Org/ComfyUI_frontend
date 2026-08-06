import { describe, expect, it } from 'vitest'

import { convert } from './convert'
import {
  EditApplicationError,
  applyEdits,
  applyUnifiedDiff,
  deriveEdits,
  diffToEdits,
  toUnifiedDiff
} from './edits'

const RGTHREE = [
  'onConstructed() {',
  '    var _a;',
  '    this.type = (_a = this.type) !== null && _a !== void 0 ? _a : undefined;',
  '    this.__constructed__ = true;',
  '    return true',
  '}'
].join('\n')

describe('conversions as edits', () => {
  describe('round trip', () => {
    it('reproduces the converted source exactly', () => {
      const result = convert(RGTHREE)
      expect(applyEdits(RGTHREE, result.edits)).toBe(result.source)
    })

    it('records one edit for the real rgthree idiom', () => {
      const result = convert(RGTHREE)
      expect(result.edits).toEqual([{ line: 3, op: 'delete' }])
    })

    it('produces no edits for a file that needs nothing', () => {
      const clean = 'const x = 1;\nexport default x;'
      const result = convert(clean)
      expect(result.edits).toEqual([])
      expect(applyEdits(clean, result.edits)).toBe(clean)
    })

    it('survives several edits in one file', () => {
      const source = [
        'a();',
        'this.type = this.type ?? undefined;',
        'b();',
        'this.type = this.type ?? undefined;',
        'c();'
      ].join('\n')
      const result = convert(source)
      expect(result.edits).toHaveLength(2)
      expect(applyEdits(source, result.edits)).toBe('a();\nb();\nc();')
    })
  })

  describe('the edits are tiny compared with the file', () => {
    it('does not scale with file size', () => {
      const padding = Array.from({ length: 2000 }, (_, i) => `// line ${i}`)
      const big = [...padding, 'this.type = this.type ?? undefined;'].join('\n')

      const result = convert(big)
      expect(result.edits).toHaveLength(1)
      // The whole-file artifact would be ~30x the size of the edit list.
      expect(JSON.stringify(result.edits).length).toBeLessThan(
        result.source.length / 30
      )
    })
  })

  describe('application refuses a source it was not built for', () => {
    it('throws when the target line does not exist', () => {
      expect(() =>
        applyEdits('one\ntwo', [{ line: 99, op: 'delete' }])
      ).toThrow(EditApplicationError)
    })

    it('explains that the source does not match', () => {
      expect(() =>
        applyEdits('one\ntwo', [{ line: 99, op: 'delete' }])
      ).toThrow(/does not match/)
    })

    it('rejects a replace with no text rather than deleting silently', () => {
      expect(() => applyEdits('one', [{ line: 1, op: 'replace' }])).toThrow(
        EditApplicationError
      )
    })
  })

  describe('deriveEdits', () => {
    it('reports replacements as well as deletions', () => {
      const edits = deriveEdits('a\nb\nc', ['a', 'B!', null])
      expect(edits).toEqual([
        { line: 2, op: 'replace', text: 'B!' },
        { line: 3, op: 'delete' }
      ])
    })
  })

  describe('unified diff', () => {
    const roundTrip = (before: string, after: string) => {
      const diff = toUnifiedDiff(before, after, 'x.js')
      expect(applyUnifiedDiff(before, diff)).toBe(after)
      return diff
    }

    it('is empty when nothing changed', () => {
      expect(toUnifiedDiff('a\nb', 'a\nb', 'x.js')).toBe('')
    })

    it('round-trips a replacement', () => {
      expect(roundTrip('one\ntwo\nthree', 'one\nTWO\nthree')).toContain('-two')
    })

    it('round-trips an append past the end', () => {
      // The previous renderer dropped this silently and emitted a hunk header
      // that disagreed with its own body.
      expect(roundTrip('one\ntwo', 'one\ntwo\nthree')).toContain('+three')
    })

    it('round-trips a deletion', () => {
      expect(roundTrip('one\ntwo\nthree', 'one\nthree')).toContain('-two')
    })

    it('splits distant changes into separate hunks', () => {
      const before = Array.from({ length: 40 }, (_, i) => `line ${i}`).join(
        '\n'
      )
      const after = before.replace('line 2', 'FIRST').replace('line 35', 'LAST')
      expect(roundTrip(before, after).match(/^@@/gm)).toHaveLength(2)
    })

    it('counts lines correctly in the hunk header', () => {
      const diff = toUnifiedDiff('one\ntwo', 'one\ntwo\nthree', 'x.js')
      const [, aCount, bCount] = /@@ -\d+,(\d+) \+\d+,(\d+) @@/.exec(diff)!
      expect(Number(bCount)).toBe(Number(aCount) + 1)
    })

    it('refuses to apply to a source it was not built from', () => {
      const diff = toUnifiedDiff('one\ntwo\nthree', 'one\nTWO\nthree', 'x.js')
      expect(() => applyUnifiedDiff('one\nDIFFERENT\nthree', diff)).toThrow(
        EditApplicationError
      )
    })
  })
})

describe('diffToEdits', () => {
  const roundTrip = (before: string, after: string) => {
    const edits = diffToEdits(before, after)
    expect(applyEdits(before, edits)).toBe(after)
    return edits
  }

  it('records nothing when the file is unchanged', () => {
    expect(roundTrip('a\nb\nc', 'a\nb\nc')).toEqual([])
  })

  it('records one edit for a one-line change', () => {
    // The point of the whole exercise: rgthree's conversion is one line, and
    // the artifact should say so rather than restating 45k unchanged ones.
    expect(roundTrip('a\nb\nc', 'a\nB\nc')).toEqual([
      { line: 2, op: 'replace', text: 'B' }
    ])
  })

  it('records a deletion', () => {
    expect(roundTrip('a\nb\nc', 'a\nc')).toEqual([{ line: 2, op: 'delete' }])
  })

  it('records an insertion', () => {
    expect(roundTrip('a\nc', 'a\nb\nc')).toEqual([
      { line: 2, op: 'insert', text: 'b' }
    ])
  })

  it('appends past the end of the file', () => {
    expect(roundTrip('a\nb', 'a\nb\nc')).toEqual([
      { line: 3, op: 'insert', text: 'c' }
    ])
  })

  it('keeps the edit list proportional to the change, not the file', () => {
    const before = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n')
    const after = before.replace('line 250', 'CHANGED')
    expect(roundTrip(before, after)).toHaveLength(1)
  })

  it('handles interleaved changes', () => {
    roundTrip('a\nb\nc\nd\ne', 'a\nX\nc\nY\nZ\ne')
  })
})
