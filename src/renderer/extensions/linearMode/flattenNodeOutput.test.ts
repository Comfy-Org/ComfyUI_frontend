import { describe, expect, it } from 'vitest'

import { flattenNodeOutput } from '@/renderer/extensions/linearMode/flattenNodeOutput'
import type { NodeExecutionOutput } from '@/schemas/apiSchema'

function makeOutput(
  overrides: Partial<NodeExecutionOutput> = {}
): NodeExecutionOutput {
  return { ...overrides }
}

describe(flattenNodeOutput, () => {
  it('delegates to parseNodeOutput and returns ResultItemImpl instances', () => {
    const output = makeOutput({
      images: [
        { filename: 'a.png', subfolder: '', type: 'output' },
        { filename: 'b.png', subfolder: 'sub', type: 'output' }
      ]
    })

    const result = flattenNodeOutput(['42', output])

    expect(result).toHaveLength(2)
    expect(result[0].filename).toBe('a.png')
    expect(result[0].nodeId).toBe('42')
    expect(result[0].mediaType).toBe('images')
    expect(result[1].filename).toBe('b.png')
    expect(result[1].subfolder).toBe('sub')
  })

  it('returns empty array for text-only output', () => {
    const result = flattenNodeOutput(['1', makeOutput({ text: 'hello' })])
    expect(result).toEqual([])
  })

  it('combines a_images and b_images into a single image_compare item', () => {
    const output = makeOutput({
      a_images: [{ filename: 'before.png', subfolder: '', type: 'output' }],
      b_images: [{ filename: 'after.png', subfolder: '', type: 'output' }]
    } as unknown as Partial<NodeExecutionOutput>)

    const result = flattenNodeOutput(['10', output])

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('image_compare')
    expect(result[0].isImageCompare).toBe(true)
    expect(result[0].compareImages!.before).toHaveLength(1)
    expect(result[0].compareImages!.after).toHaveLength(1)
    expect(result[0].compareImages!.before[0].filename).toBe('before.png')
    expect(result[0].compareImages!.after[0].filename).toBe('after.png')
  })
})
