import { describe, expect, it, vi } from 'vitest'

import type { NodeExecutionOutput, TaskOutput } from '@/schemas/apiSchema'
import {
  flattenNodeExecutionOutput,
  flattenTaskOutputs,
  isResultItemLike
} from '@/stores/resultItemParsing'

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `/api${path}`),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

describe(isResultItemLike, () => {
  it('accepts valid result items', () => {
    expect(
      isResultItemLike({ filename: 'a.png', subfolder: '', type: 'output' })
    ).toBe(true)
  })

  it('accepts items without type', () => {
    expect(isResultItemLike({ filename: 'a.png', subfolder: '' })).toBe(true)
  })

  it('rejects null/undefined/primitives', () => {
    expect(isResultItemLike(null)).toBe(false)
    expect(isResultItemLike(undefined)).toBe(false)
    expect(isResultItemLike('string')).toBe(false)
    expect(isResultItemLike(42)).toBe(false)
  })

  it('rejects arrays', () => {
    expect(isResultItemLike([1, 2, 3])).toBe(false)
  })

  it('rejects objects missing filename', () => {
    expect(isResultItemLike({ subfolder: '', type: 'output' })).toBe(false)
  })

  it('rejects objects missing subfolder', () => {
    expect(isResultItemLike({ filename: 'a.png', type: 'output' })).toBe(false)
  })

  it('rejects objects with non-string filename', () => {
    expect(isResultItemLike({ filename: 123, subfolder: '' })).toBe(false)
  })

  it('rejects objects with non-string subfolder', () => {
    expect(isResultItemLike({ filename: 'a.png', subfolder: 42 })).toBe(false)
  })

  it('rejects objects with invalid type', () => {
    expect(
      isResultItemLike({
        filename: 'a.png',
        subfolder: '',
        type: 'invalid_type'
      })
    ).toBe(false)
  })

  it('rejects objects with only type (no filename/subfolder)', () => {
    expect(isResultItemLike({ type: 'output' })).toBe(false)
  })

  it('rejects empty objects', () => {
    expect(isResultItemLike({})).toBe(false)
  })
})

describe(flattenNodeExecutionOutput, () => {
  it('flattens standard image outputs', () => {
    const output: NodeExecutionOutput = {
      images: [
        { filename: 'a.png', subfolder: '', type: 'output' },
        { filename: 'b.png', subfolder: 'sub', type: 'output' }
      ]
    }

    const result = flattenNodeExecutionOutput('42', output)

    expect(result).toHaveLength(2)
    expect(result[0].filename).toBe('a.png')
    expect(result[0].nodeId).toBe('42')
    expect(result[0].mediaType).toBe('images')
    expect(result[1].subfolder).toBe('sub')
  })

  it('flattens non-standard output keys', () => {
    const output = {
      a_images: [{ filename: 'before.png', subfolder: '', type: 'output' }],
      b_images: [{ filename: 'after.png', subfolder: '', type: 'output' }]
    } as unknown as NodeExecutionOutput

    const result = flattenNodeExecutionOutput('10', output)

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.filename)).toContain('before.png')
    expect(result.map((r) => r.filename)).toContain('after.png')
  })

  it('flattens multiple media types', () => {
    const output: NodeExecutionOutput = {
      images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
      video: [{ filename: 'vid.mp4', subfolder: '', type: 'output' }]
    }

    const result = flattenNodeExecutionOutput('1', output)

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.mediaType)).toContain('images')
    expect(result.map((r) => r.mediaType)).toContain('video')
  })

  it('excludes animated key', () => {
    const output: NodeExecutionOutput = {
      images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
      animated: [true]
    }

    const result = flattenNodeExecutionOutput('1', output)

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('images')
  })

  it('skips non-array values like text strings', () => {
    const output: NodeExecutionOutput = {
      images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
      text: 'hello'
    }

    const result = flattenNodeExecutionOutput('1', output)

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('images')
  })

  it('filters out non-ResultItem array items', () => {
    const output = {
      images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
      custom_data: [{ randomKey: 123 }]
    } as unknown as NodeExecutionOutput

    const result = flattenNodeExecutionOutput('1', output)

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('images')
  })

  it('returns empty array for output with no valid media', () => {
    const result = flattenNodeExecutionOutput('1', { text: 'hello' })
    expect(result).toEqual([])
  })

  it('returns empty array for empty arrays', () => {
    const output: NodeExecutionOutput = { images: [], audio: [] }
    const result = flattenNodeExecutionOutput('1', output)
    expect(result).toEqual([])
  })

  it('accepts numeric nodeId', () => {
    const output: NodeExecutionOutput = {
      audio: [{ filename: 'sound.wav', subfolder: '', type: 'output' }]
    }

    const result = flattenNodeExecutionOutput(7, output)

    expect(result).toHaveLength(1)
    expect(result[0].nodeId).toBe(7)
  })
})

describe(flattenTaskOutputs, () => {
  it('returns empty array for undefined outputs', () => {
    expect(flattenTaskOutputs(undefined)).toEqual([])
  })

  it('flattens outputs from multiple nodes', () => {
    const outputs: TaskOutput = {
      'node-1': {
        images: [{ filename: 'a.png', subfolder: '', type: 'output' }]
      },
      'node-2': {
        video: [{ filename: 'b.mp4', subfolder: '', type: 'output' }]
      }
    }

    const result = flattenTaskOutputs(outputs)

    expect(result).toHaveLength(2)
    expect(result[0].nodeId).toBe('node-1')
    expect(result[1].nodeId).toBe('node-2')
  })

  it('filters animated and non-ResultItem values across nodes', () => {
    const outputs: TaskOutput = {
      'node-1': {
        images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
        animated: [true],
        text: 'hello'
      }
    }

    const result = flattenTaskOutputs(outputs)

    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('img.png')
  })

  it('supports non-standard output keys across nodes', () => {
    const outputs = {
      'node-1': {
        a_images: [{ filename: 'before.png', subfolder: '', type: 'output' }],
        b_images: [{ filename: 'after.png', subfolder: '', type: 'output' }]
      }
    } as unknown as TaskOutput

    const result = flattenTaskOutputs(outputs)

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.filename)).toContain('before.png')
    expect(result.map((r) => r.filename)).toContain('after.png')
  })
})
