import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { writeFileExclusive } from './exclusiveWrite'

describe('writeFileExclusive', () => {
  it('replaces an existing file after the replacement is ready', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comfy-exclusive-write-'))
    const output = join(dir, 'demo.spec.ts')
    try {
      writeFileSync(output, 'existing')

      writeFileExclusive(output, 'replacement', true)

      expect(readFileSync(output, 'utf-8')).toBe('replacement')
      expect(readdirSync(dir)).toEqual(['demo.spec.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('cleans up the staged file when replacement fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comfy-exclusive-write-'))
    const output = join(dir, 'demo.spec.ts')
    try {
      mkdirSync(output)

      expect(() => writeFileExclusive(output, 'replacement', true)).toThrow()

      expect(readdirSync(dir)).toEqual(['demo.spec.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
