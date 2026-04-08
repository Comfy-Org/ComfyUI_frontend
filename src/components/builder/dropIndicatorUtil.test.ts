import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { buildDropIndicator } from './dropIndicatorUtil'

vi.mock('@/scripts/api', () => ({
  api: { apiURL: (path: string) => `http://localhost:8188${path}` }
}))

vi.mock('@/scripts/app', () => ({
  app: { getPreviewFormatParam: () => '&format=webp' }
}))

vi.mock('@/platform/distribution/cloudPreviewUtil', () => ({
  appendCloudResParam: vi.fn()
}))

function makeNode(type: string, widgetValue?: unknown): LGraphNode {
  return {
    type,
    widgets:
      widgetValue !== undefined
        ? [{ value: widgetValue }, { callback: vi.fn() }]
        : undefined
  } as unknown as LGraphNode
}

describe('buildDropIndicator', () => {
  it('returns undefined for unsupported node types', () => {
    expect(buildDropIndicator(makeNode('KSampler'), {})).toBeUndefined()
    expect(buildDropIndicator(makeNode('CLIPTextEncode'), {})).toBeUndefined()
  })

  it('returns image indicator for LoadImage node with filename', () => {
    const result = buildDropIndicator(makeNode('LoadImage', 'photo.png'), {
      imageLabel: 'Upload'
    })

    expect(result).toBeDefined()
    expect(result!.iconClass).toBe('icon-[lucide--image]')
    expect(result!.imageUrl).toContain('/view?')
    expect(result!.imageUrl).toContain('filename=photo.png')
    expect(result!.label).toBe('Upload')
  })

  it('returns image indicator with no imageUrl when widget has no value', () => {
    const result = buildDropIndicator(makeNode('LoadImage', ''), {})

    expect(result).toBeDefined()
    expect(result!.imageUrl).toBeUndefined()
  })

  it('returns image indicator with no imageUrl when widgets are missing', () => {
    const node = { type: 'LoadImage' } as unknown as LGraphNode
    const result = buildDropIndicator(node, {})

    expect(result).toBeDefined()
    expect(result!.imageUrl).toBeUndefined()
  })

  it('includes onMaskEdit when imageUrl exists and openMaskEditor is provided', () => {
    const openMaskEditor = vi.fn()
    const node = makeNode('LoadImage', 'photo.png')
    const result = buildDropIndicator(node, { openMaskEditor })

    expect(result!.onMaskEdit).toBeDefined()
    result!.onMaskEdit!()
    expect(openMaskEditor).toHaveBeenCalledWith(node)
  })

  it('omits onMaskEdit when no imageUrl', () => {
    const openMaskEditor = vi.fn()
    const result = buildDropIndicator(makeNode('LoadImage', ''), {
      openMaskEditor
    })

    expect(result!.onMaskEdit).toBeUndefined()
  })

  it('returns video indicator for LoadVideo node with filename', () => {
    const result = buildDropIndicator(makeNode('LoadVideo', 'clip.mp4'), {
      videoLabel: 'Upload Video'
    })

    expect(result).toBeDefined()
    expect(result!.iconClass).toBe('icon-[lucide--video]')
    expect(result!.videoUrl).toContain('/view?')
    expect(result!.videoUrl).toContain('filename=clip.mp4')
    expect(result!.label).toBe('Upload Video')
    expect(result!.onMaskEdit).toBeUndefined()
  })

  it('returns video indicator with no videoUrl when widget has no value', () => {
    const result = buildDropIndicator(makeNode('LoadVideo', ''), {})

    expect(result).toBeDefined()
    expect(result!.videoUrl).toBeUndefined()
  })

  it('parses subfolder and type from widget value', () => {
    const result = buildDropIndicator(
      makeNode('LoadImage', 'sub/folder/image.png [output]'),
      {}
    )

    expect(result!.imageUrl).toContain('filename=image.png')
    expect(result!.imageUrl).toContain('subfolder=sub%2Ffolder')
    expect(result!.imageUrl).toContain('type=output')
  })

  it('invokes widget callback on onClick', () => {
    const node = makeNode('LoadImage', 'photo.png')
    const result = buildDropIndicator(node, {})

    result!.onClick!({} as MouseEvent)
    expect(node.widgets![1].callback).toHaveBeenCalledWith(undefined)
  })
})
