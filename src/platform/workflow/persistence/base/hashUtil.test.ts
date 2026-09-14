import { describe, expect, it } from 'vitest'

import { hashPath } from './hashUtil'

describe('hashPath', () => {
  it('returns 8-character hex string', () => {
    const result = hashPath('workflows/test.json')
    expect(result).toMatch(/^[0-9a-f]{8}$/)
  })

  it('keys the same path the same way it did in earlier releases', () => {
    expect(hashPath('')).toBe('811c9dc5')
    expect(hashPath('workflows/Untitled.json')).toBe('325d5d45')
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

  it.fails('produces different hashes for known collision paths', () => {
    const hash1 = hashPath('workflows/ewip.json')
    const hash2 = hashPath('workflows/4hbab.json')
    expect(hash1).not.toBe(hash2)
  })
})
