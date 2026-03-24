import { describe, expect, it } from 'vitest'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { findEmptyFileInputNodes } from './app'

function makeNode(
  classType: string,
  inputs: Record<string, unknown>,
  title?: string
) {
  return {
    class_type: classType,
    inputs,
    _meta: { title: title ?? classType }
  }
}

describe('findEmptyFileInputNodes', () => {
  it('detects LoadImage with empty image field', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', { image: '' }),
      '2': makeNode('KSampler', { seed: 42 })
    }
    expect(findEmptyFileInputNodes(output)).toEqual([
      { nodeId: '1', classType: 'LoadImage', title: 'LoadImage' }
    ])
  })

  it('detects multiple empty file input nodes', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', { image: '' }, 'My Image'),
      '2': makeNode('LoadAudio', { audio: '' }),
      '3': makeNode('LoadVideo', { video: 'file.mp4' })
    }
    const result = findEmptyFileInputNodes(output)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      nodeId: '1',
      classType: 'LoadImage',
      title: 'My Image'
    })
    expect(result[1]).toEqual({
      nodeId: '2',
      classType: 'LoadAudio',
      title: 'LoadAudio'
    })
  })

  it('returns empty array when all file inputs are populated', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', { image: 'photo.png' }),
      '2': makeNode('Load3D', { model_file: 'model.glb' })
    }
    expect(findEmptyFileInputNodes(output)).toEqual([])
  })

  it('returns empty array when no file input nodes exist', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('KSampler', { seed: 42 }),
      '2': makeNode('CLIPTextEncode', { text: 'hello' })
    }
    expect(findEmptyFileInputNodes(output)).toEqual([])
  })

  it('detects Load3D with empty model_file', () => {
    const output: ComfyApiWorkflow = {
      '5': makeNode('Load3D', { model_file: '' })
    }
    expect(findEmptyFileInputNodes(output)).toEqual([
      { nodeId: '5', classType: 'Load3D', title: 'Load3D' }
    ])
  })

  it('detects null file input values', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', { image: null })
    }
    expect(findEmptyFileInputNodes(output)).toHaveLength(1)
  })

  it('detects undefined file input values', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', { image: undefined })
    }
    expect(findEmptyFileInputNodes(output)).toHaveLength(1)
  })

  it('detects whitespace-only file input values', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', { image: '   ' })
    }
    expect(findEmptyFileInputNodes(output)).toHaveLength(1)
  })

  it('skips linked inputs (array references to other nodes)', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', { image: ['5', 0] })
    }
    expect(findEmptyFileInputNodes(output)).toEqual([])
  })

  it('filters to only specified node IDs when provided', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', { image: '' }),
      '2': makeNode('LoadAudio', { audio: '' }),
      '3': makeNode('KSampler', { seed: 42 })
    }
    const result = findEmptyFileInputNodes(output, new Set(['2', '3']))
    expect(result).toEqual([
      { nodeId: '2', classType: 'LoadAudio', title: 'LoadAudio' }
    ])
  })

  it('detects missing file input field entirely', () => {
    const output: ComfyApiWorkflow = {
      '1': makeNode('LoadImage', {})
    }
    expect(findEmptyFileInputNodes(output)).toHaveLength(1)
  })
})
