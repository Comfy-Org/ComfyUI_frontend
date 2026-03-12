import { describe, expect, it, vi } from 'vitest'

import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
import type { NodeExecutionOutput } from '@/schemas/apiSchema'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `/api${path}`),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

describe(flattenNodeOutput, () => {
  it('delegates to shared parser and returns ResultItemImpl instances', () => {
    const output: NodeExecutionOutput = {
      images: [{ filename: 'a.png', subfolder: '', type: 'output' }]
    }

    const result = flattenNodeOutput(['42', output])

    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('a.png')
    expect(result[0].nodeId).toBe('42')
    expect(result[0].mediaType).toBe('images')
  })

  it('supports non-standard output keys', () => {
    const output = {
      a_images: [{ filename: 'before.png', subfolder: '', type: 'output' }],
      b_images: [{ filename: 'after.png', subfolder: '', type: 'output' }]
    } as unknown as NodeExecutionOutput

    const result = flattenNodeOutput(['10', output])

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.filename)).toContain('before.png')
    expect(result.map((r) => r.filename)).toContain('after.png')
  })
})
