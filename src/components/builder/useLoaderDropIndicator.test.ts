import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { getLoaderDropIndicator } from './useLoaderDropIndicator'

vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((route: string) => `http://localhost:8188/api${route}`)
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => '&preview=webp')
  }
}))

function makeWidget(
  name: string,
  value: unknown,
  callback?: IBaseWidget['callback']
): IBaseWidget {
  return fromAny<IBaseWidget, unknown>({ name, value, callback })
}

function makeNode(type: string, widgets: IBaseWidget[]): LGraphNode {
  return fromAny<LGraphNode, unknown>({ type, widgets })
}

const options = {
  mobile: false,
  label: (key: string) => key,
  onMaskEdit: vi.fn()
}

describe('getLoaderDropIndicator', () => {
  it('returns undefined for node types with no loader preview', () => {
    const node = makeNode('KSampler', [])
    expect(getLoaderDropIndicator(node, options)).toBeUndefined()
  })

  it('builds an image preview for LoadImage with a selected file', () => {
    const node = makeNode('LoadImage', [makeWidget('image', 'photo.png')])

    const indicator = getLoaderDropIndicator(node, options)

    expect(indicator?.mediaType).toBe('image')
    expect(indicator?.mediaUrl).toBe(
      'http://localhost:8188/api/view?filename=photo.png&subfolder=&type=input&preview=webp'
    )
    expect(indicator?.label).toBe('linearMode.dragAndDropImage')
    expect(indicator?.onMaskEdit).toBeTypeOf('function')
  })

  it('builds a video preview for LoadVideo without appending the image preview format param', () => {
    const node = makeNode('LoadVideo', [makeWidget('file', 'clip.mp4')])

    const indicator = getLoaderDropIndicator(node, options)

    expect(indicator?.mediaType).toBe('video')
    expect(indicator?.mediaUrl).toBe(
      'http://localhost:8188/api/view?filename=clip.mp4&subfolder=&type=input'
    )
    expect(indicator?.label).toBe('linearMode.dragAndDropVideo')
    expect(indicator?.onMaskEdit).toBeUndefined()
  })

  it('builds an audio preview for LoadAudio', () => {
    const node = makeNode('LoadAudio', [makeWidget('audio', 'voice.mp3')])

    const indicator = getLoaderDropIndicator(node, options)

    expect(indicator?.mediaType).toBe('audio')
    expect(indicator?.mediaUrl).toBe(
      'http://localhost:8188/api/view?filename=voice.mp3&subfolder=&type=input'
    )
    expect(indicator?.label).toBe('linearMode.dragAndDropAudio')
    expect(indicator?.onMaskEdit).toBeUndefined()
  })

  it('parses subfolder and type annotations out of the widget value', () => {
    const node = makeNode('LoadVideo', [
      makeWidget('file', 'sub/dir/clip.mp4 [output]')
    ])

    const indicator = getLoaderDropIndicator(node, options)

    expect(indicator?.mediaUrl).toBe(
      'http://localhost:8188/api/view?filename=clip.mp4&subfolder=sub%2Fdir&type=output'
    )
  })

  it('returns no mediaUrl when no file has been selected yet', () => {
    const node = makeNode('LoadVideo', [makeWidget('file', '')])

    const indicator = getLoaderDropIndicator(node, options)

    expect(indicator?.mediaUrl).toBeUndefined()
    expect(indicator?.iconClass).toBeTruthy()
  })

  it('omits the label on mobile', () => {
    const node = makeNode('LoadVideo', [makeWidget('file', 'clip.mp4')])

    const indicator = getLoaderDropIndicator(node, {
      ...options,
      mobile: true
    })

    expect(indicator?.label).toBeUndefined()
  })

  it('clicking the indicator opens the upload dialog via the "upload" widget', () => {
    const uploadCallback = vi.fn()
    const node = makeNode('LoadVideo', [
      makeWidget('file', 'clip.mp4'),
      makeWidget('upload', undefined, uploadCallback)
    ])

    const indicator = getLoaderDropIndicator(node, options)
    indicator?.onClick()

    expect(uploadCallback).toHaveBeenCalledWith(undefined)
  })
})
