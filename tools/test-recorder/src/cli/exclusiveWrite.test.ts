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
import { describe, expect, it, vi } from 'vitest'

import { writeFileExclusive } from './exclusiveWrite'

vi.mock(import('node:fs'), { spy: true })

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

  it('preserves the existing spec when staging fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comfy-exclusive-write-'))
    const output = join(dir, 'demo.spec.ts')
    try {
      writeFileSync(output, 'existing')
      vi.mocked(writeFileSync).mockImplementationOnce(() => {
        throw new Error('disk full')
      })

      expect(() => writeFileExclusive(output, 'replacement', true)).toThrow(
        'disk full'
      )

      expect(readFileSync(output, 'utf-8')).toBe('existing')
      expect(readdirSync(dir)).toEqual(['demo.spec.ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('replaces a destination whose name uses the longest supported length', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comfy-exclusive-write-'))
    const suffix = '.spec.ts'
    const name = `${'a'.repeat(228 - suffix.length)}${suffix}`
    const output = join(dir, name)
    try {
      writeFileExclusive(output, 'existing', false)

      writeFileExclusive(output, 'replacement', true)

      expect(readFileSync(output, 'utf-8')).toBe('replacement')
      expect(readdirSync(dir)).toEqual([name])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
