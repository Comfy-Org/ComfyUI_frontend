import { describe, expect, it } from 'vitest'

import { findNulByte, formatOffences, isTextPath } from './check-text-encoding'

const encoder = new TextEncoder()
const NUL = String.fromCodePoint(0)

function bytes(text: string): Uint8Array {
  return encoder.encode(text)
}

describe('check-text-encoding', () => {
  describe('findNulByte', () => {
    it('finds a NUL and reports the line it sits on', () => {
      const source = `const a = 1\nconst b = '${NUL}'\n`

      expect(findNulByte('a.ts', bytes(source))).toEqual({
        path: 'a.ts',
        line: 2,
        byte: 0,
        offset: source.indexOf(NUL)
      })
    })

    it('finds a NUL past the 8000 bytes git itself inspects', () => {
      // Git's binary heuristic only reads the first 8000 bytes, so a file like
      // this one still renders as a reviewable diff while breaking greps and
      // editors. PR #19717's test file was in exactly that state, which is why
      // this check reads whole files rather than trusting git's verdict.
      const padding = `// ${'x'.repeat(78)}\n`.repeat(120)
      const source = `${padding}const sep = '${NUL}'\n`
      expect(bytes(source).length).toBeGreaterThan(8000)

      expect(findNulByte('late.ts', bytes(source))?.line).toBe(121)
    })

    it('accepts a unicode escape written as text, which is the fix', () => {
      const source = "const sep = '\\u0000'\n"

      expect(findNulByte('a.ts', bytes(source))).toBeUndefined()
    })

    it('accepts tabs, newlines, carriage returns and form feeds', () => {
      const source = '\tconst a = 1\r\n\fconst b = 2\n'

      expect(findNulByte('a.ts', bytes(source))).toBeUndefined()
    })

    it.for([
      ['an escape, as ANSI colour-width tests embed', 0x1b],
      ['a vertical tab', 0x0b],
      ['a bell', 0x07],
      ['DEL', 0x7f]
    ] as const)('accepts %s, which git still diffs', ([, byte]) => {
      // Deliberately narrow. Only NUL costs a file its diff, and a real
      // in-tree file (`tools/test-recorder/src/ui/logger.test.ts`) embeds a
      // raw ESC on purpose — flagging the whole C0 range would fail it.
      const source = `const a = '${String.fromCodePoint(byte)}'`

      expect(findNulByte('a.ts', bytes(source))).toBeUndefined()
    })

    it('accepts non-ASCII text', () => {
      const source = '// em dash — and an emoji 🎛\n'

      expect(findNulByte('a.ts', bytes(source))).toBeUndefined()
    })

    it('accepts an empty file', () => {
      expect(findNulByte('a.ts', bytes(''))).toBeUndefined()
    })
  })

  describe('isTextPath', () => {
    it.for(['src/a.ts', 'src/A.vue', 'docs/b.md', 'c.yaml', 'd.json'] as const)(
      'checks %s',
      (path) => {
        expect(isTextPath(path)).toBe(true)
      }
    )

    it.for(['logo.png', 'font.woff2', 'clip.mp4', 'noext'] as const)(
      'skips %s',
      (path) => {
        expect(isTextPath(path)).toBe(false)
      }
    )
  })

  describe('formatOffences', () => {
    it('names the file, the line, the byte and the remedy', () => {
      const message = formatOffences([
        { path: 'src/a.ts', line: 17, byte: 0, offset: 632 }
      ])

      expect(message).toContain('src/a.ts:17')
      expect(message).toContain('byte 0x00 at offset 632')
      expect(message).toContain('unicode escape')
    })
  })
})
