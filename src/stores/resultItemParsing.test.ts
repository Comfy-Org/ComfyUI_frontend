import { describe, expect, it } from 'vitest'

import type { NodeExecutionOutput } from '@/schemas/apiSchema'
import { parseNodeOutput, parseTaskOutput } from '@/stores/resultItemParsing'

function makeOutput(
  overrides: Partial<NodeExecutionOutput> = {}
): NodeExecutionOutput {
  return { ...overrides }
}

describe(parseNodeOutput, () => {
  it('returns empty array for output with no known media types', () => {
    const result = parseNodeOutput('1', makeOutput({ text: 'hello' }))
    expect(result).toEqual([])
  })

  it('flattens images into ResultItemImpl instances', () => {
    const output = makeOutput({
      images: [
        { filename: 'a.png', subfolder: '', type: 'output' },
        { filename: 'b.png', subfolder: 'sub', type: 'output' }
      ]
    })

    const result = parseNodeOutput('42', output)

    expect(result).toHaveLength(2)
    expect(result[0].filename).toBe('a.png')
    expect(result[0].nodeId).toBe('42')
    expect(result[0].mediaType).toBe('images')
    expect(result[1].filename).toBe('b.png')
    expect(result[1].subfolder).toBe('sub')
  })

  it('flattens audio outputs', () => {
    const output = makeOutput({
      audio: [{ filename: 'sound.wav', subfolder: '', type: 'output' }]
    })

    const result = parseNodeOutput(7, output)

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('audio')
    expect(result[0].nodeId).toBe(7)
  })

  it('flattens multiple media types in a single output', () => {
    const output = makeOutput({
      images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
      video: [{ filename: 'vid.mp4', subfolder: '', type: 'output' }]
    })

    const result = parseNodeOutput('1', output)

    expect(result).toHaveLength(2)
    const types = result.map((r) => r.mediaType)
    expect(types).toContain('images')
    expect(types).toContain('video')
  })

  it('handles gifs and 3d output types', () => {
    const output = makeOutput({
      gifs: [
        { filename: 'anim.gif', subfolder: '', type: 'output' }
      ] as NodeExecutionOutput['gifs'],
      '3d': [
        { filename: 'model.glb', subfolder: '', type: 'output' }
      ] as NodeExecutionOutput['3d']
    })

    const result = parseNodeOutput('5', output)

    expect(result).toHaveLength(2)
    const types = result.map((r) => r.mediaType)
    expect(types).toContain('gifs')
    expect(types).toContain('3d')
  })

  it('ignores empty arrays', () => {
    const output = makeOutput({ images: [], audio: [] })
    const result = parseNodeOutput('1', output)
    expect(result).toEqual([])
  })

  it('excludes animated key', () => {
    const output = makeOutput({
      images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
      animated: [true]
    })

    const result = parseNodeOutput('1', output)

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('images')
  })

  it('excludes text key', () => {
    const output = makeOutput({
      images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
      text: 'some text output'
    })

    const result = parseNodeOutput('1', output)

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('images')
  })

  it('excludes non-ResultItem array items', () => {
    const output = {
      images: [{ filename: 'img.png', subfolder: '', type: 'output' }],
      custom_data: [{ randomKey: 123 }]
    } as unknown as NodeExecutionOutput

    const result = parseNodeOutput('1', output)

    expect(result).toHaveLength(1)
    expect(result[0].mediaType).toBe('images')
  })

  it('accepts items with filename but no subfolder', () => {
    const output = {
      images: [
        { filename: 'valid.png', subfolder: '', type: 'output' },
        { filename: 'no-subfolder.png' }
      ]
    } as unknown as NodeExecutionOutput

    const result = parseNodeOutput('1', output)

    expect(result).toHaveLength(2)
    expect(result[0].filename).toBe('valid.png')
    expect(result[1].filename).toBe('no-subfolder.png')
    expect(result[1].subfolder).toBe('')
  })

  it('excludes items missing filename', () => {
    const output = {
      images: [
        { filename: 'valid.png', subfolder: '', type: 'output' },
        { subfolder: '', type: 'output' }
      ]
    } as unknown as NodeExecutionOutput

    const result = parseNodeOutput('1', output)

    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('valid.png')
  })

  describe('image compare outputs', () => {
    it('produces a single image_compare item from a_images and b_images', () => {
      const output = {
        a_images: [{ filename: 'before.png', subfolder: '', type: 'output' }],
        b_images: [{ filename: 'after.png', subfolder: '', type: 'output' }]
      } as unknown as NodeExecutionOutput

      const result = parseNodeOutput('10', output)

      expect(result).toHaveLength(1)
      expect(result[0].mediaType).toBe('image_compare')
      expect(result[0].nodeId).toBe('10')
      expect(result[0].filename).toBe('before.png')
      expect(result[0].compareImages).toBeDefined()
      expect(result[0].compareImages!.before).toHaveLength(1)
      expect(result[0].compareImages!.after).toHaveLength(1)
      expect(result[0].compareImages!.before[0].filename).toBe('before.png')
      expect(result[0].compareImages!.after[0].filename).toBe('after.png')
    })

    it('handles multiple batch images in a_images and b_images', () => {
      const output = {
        a_images: [
          { filename: 'a1.png', subfolder: '', type: 'output' },
          { filename: 'a2.png', subfolder: '', type: 'output' }
        ],
        b_images: [
          { filename: 'b1.png', subfolder: '', type: 'output' },
          { filename: 'b2.png', subfolder: '', type: 'output' },
          { filename: 'b3.png', subfolder: '', type: 'output' }
        ]
      } as unknown as NodeExecutionOutput

      const result = parseNodeOutput('5', output)

      expect(result).toHaveLength(1)
      expect(result[0].compareImages!.before).toHaveLength(2)
      expect(result[0].compareImages!.after).toHaveLength(3)
    })

    it('handles only a_images present', () => {
      const output = {
        a_images: [{ filename: 'before.png', subfolder: '', type: 'output' }]
      } as unknown as NodeExecutionOutput

      const result = parseNodeOutput('1', output)

      expect(result).toHaveLength(1)
      expect(result[0].mediaType).toBe('image_compare')
      expect(result[0].compareImages!.before).toHaveLength(1)
      expect(result[0].compareImages!.after).toHaveLength(0)
    })

    it('handles only b_images present', () => {
      const output = {
        b_images: [{ filename: 'after.png', subfolder: '', type: 'output' }]
      } as unknown as NodeExecutionOutput

      const result = parseNodeOutput('1', output)

      expect(result).toHaveLength(1)
      expect(result[0].mediaType).toBe('image_compare')
      expect(result[0].compareImages!.before).toHaveLength(0)
      expect(result[0].compareImages!.after).toHaveLength(1)
      expect(result[0].filename).toBe('after.png')
    })

    it('includes other output keys alongside image compare', () => {
      const output = {
        a_images: [{ filename: 'before.png', subfolder: '', type: 'output' }],
        b_images: [{ filename: 'after.png', subfolder: '', type: 'output' }],
        images: [{ filename: 'extra.png', subfolder: '', type: 'output' }]
      } as unknown as NodeExecutionOutput

      const result = parseNodeOutput('1', output)

      expect(result).toHaveLength(2)
      expect(result[0].mediaType).toBe('image_compare')
      expect(result[1].mediaType).toBe('images')
      expect(result[1].filename).toBe('extra.png')
    })

    it('skips image compare when both a_images and b_images are empty', () => {
      const output = {
        a_images: [],
        b_images: []
      } as unknown as NodeExecutionOutput

      const result = parseNodeOutput('1', output)

      expect(result).toHaveLength(0)
    })
  })
})

describe(parseTaskOutput, () => {
  it('flattens across multiple nodes', () => {
    const taskOutput: Record<string, NodeExecutionOutput> = {
      '1': makeOutput({
        images: [{ filename: 'a.png', subfolder: '', type: 'output' }]
      }),
      '2': makeOutput({
        audio: [{ filename: 'b.wav', subfolder: '', type: 'output' }]
      })
    }

    const result = parseTaskOutput(taskOutput)

    expect(result).toHaveLength(2)
    expect(result[0].nodeId).toBe('1')
    expect(result[0].filename).toBe('a.png')
    expect(result[1].nodeId).toBe('2')
    expect(result[1].filename).toBe('b.wav')
  })
})
