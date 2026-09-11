import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isDirectExecution } from './script-entry-point'

describe('isDirectExecution', () => {
  it('recognizes the same script through a symbolic-link path', () => {
    const directory = mkdtempSync(join(tmpdir(), 'workshop-entry-point-'))
    try {
      const realDirectory = join(directory, 'real')
      const linkedDirectory = join(directory, 'linked')
      mkdirSync(realDirectory)
      symlinkSync(realDirectory, linkedDirectory)
      const filename = join(realDirectory, 'generator.ts')
      writeFileSync(filename, '')

      expect(
        isDirectExecution(filename, join(linkedDirectory, 'generator.ts'))
      ).toBe(true)
    } finally {
      rmSync(directory, { recursive: true })
    }
  })
})
