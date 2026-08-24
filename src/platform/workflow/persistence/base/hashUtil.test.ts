import { describe, expect, it } from 'vitest'

import { hashPath } from './hashUtil'

describe('hashPath', () => {
  it('returns 8-character hex string', () => {
    const result = hashPath('workflows/test.json')
    expect(result).toMatch(/^[0-9a-f]{8}$/)
  })

  it('returns consistent results', () => {
    const path = 'workflows/My Complex Workflow Name.json'
    const hash1 = hashPath(path)
    const hash2 = hashPath(path)
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for similar paths', () => {
    const hash1 = hashPath('workflows/Untitled.json')
    const hash2 = hashPath('workflows/Untitled (2).json')
    expect(hash1).not.toBe(hash2)
  })
})
