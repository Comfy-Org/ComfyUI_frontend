import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { WidgetState } from '@/types/widgetState'
import { widgetId } from '@/types/widgetId'
import { toNodeId } from '@/types/nodeId'

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
  callback?: IBaseWidget['callback']
): IBaseWidget {
  return fromAny<IBaseWidget, unknown>({ name, callback })
}

function makeNode(type: string, widgets: IBaseWidget[]): LGraphNode {
  return fromAny<LGraphNode, unknown>({ type, widgets })
}

function makeWidgetValueStore(value: unknown) {
  return { getWidget: vi.fn(() => fromAny<WidgetState, unknown>({ value })) }
}

const imageId = widgetId('graph-test', toNodeId(1), 'image')
const videoId = widgetId('graph-test', toNodeId(1), 'file')
const audioId = widgetId('graph-test', toNodeId(1), 'audio')
const audioUIId = widgetId('graph-test', toNodeId(1), 'audioUI')

const options = {
  mobile: false,
  label: (key: string) => key,
  onMaskEdit: vi.fn(),
  widgetValueStore: makeWidgetValueStore(undefined)
}

describe('getLoaderDropIndicator', () => {
  it('returns undefined for node types with no loader preview', () => {
    const node = makeNode('KSampler', [])
    expect(getLoaderDropIndicator(node, imageId, options)).toBeUndefined()
  })

  it('builds an image preview for LoadImage with a selected file', () => {
    const node = makeNode('LoadImage', [makeWidget('image')])

    const indicator = getLoaderDropIndicator(node, imageId, {
      ...options,
      widgetValueStore: makeWidgetValueStore('photo.png')
    })

    expect(indicator?.mediaType).toBe('image')
    expect(indicator?.mediaUrl).toBe(
      'http://localhost:8188/api/view?filename=photo.png&subfolder=&type=input&preview=webp'
    )
    expect(indicator?.label).toBe('linearMode.dragAndDropImage')
    expect(indicator?.onMaskEdit).toBeTypeOf('function')
  })

  it('builds a video preview for LoadVideo without appending the image preview format param', () => {
    const node = makeNode('LoadVideo', [makeWidget('file')])

    const indicator = getLoaderDropIndicator(node, videoId, {
      ...options,
      widgetValueStore: makeWidgetValueStore('clip.mp4')
    })

    expect(indicator?.mediaType).toBe('video')
    expect(indicator?.mediaUrl).toBe(
      'http://localhost:8188/api/view?filename=clip.mp4&subfolder=&type=input'
    )
    expect(indicator?.label).toBe('linearMode.dragAndDropVideo')
    expect(indicator?.onMaskEdit).toBeUndefined()
  })

  it('builds an audio preview for LoadAudio', () => {
    const node = makeNode('LoadAudio', [makeWidget('audio')])

    const indicator = getLoaderDropIndicator(node, audioId, {
      ...options,
      widgetValueStore: makeWidgetValueStore('voice.mp3')
    })

    expect(indicator?.mediaType).toBe('audio')
    expect(indicator?.mediaUrl).toBe(
      'http://localhost:8188/api/view?filename=voice.mp3&subfolder=&type=input'
    )
    expect(indicator?.label).toBe('linearMode.dragAndDropAudio')
    expect(indicator?.onMaskEdit).toBeUndefined()
  })

  it('returns undefined for LoadAudio when the selected widget is audioUI, not audio', () => {
    const node = makeNode('LoadAudio', [
      makeWidget('audio'),
      makeWidget('audioUI')
    ])

    const indicator = getLoaderDropIndicator(node, audioUIId, {
      ...options,
      widgetValueStore: makeWidgetValueStore(
        'http://localhost:8188/api/view?filename=voice.mp3&subfolder=&type=input'
      )
    })

    expect(indicator).toBeUndefined()
  })

  it('parses subfolder and type annotations out of the widget value', () => {
    const node = makeNode('LoadVideo', [makeWidget('file')])

    const indicator = getLoaderDropIndicator(node, videoId, {
      ...options,
      widgetValueStore: makeWidgetValueStore('sub/dir/clip.mp4 [output]')
    })

    expect(indicator?.mediaUrl).toBe(
      'http://localhost:8188/api/view?filename=clip.mp4&subfolder=sub%2Fdir&type=output'
    )
  })

  it('returns no mediaUrl when no file has been selected yet', () => {
    const node = makeNode('LoadVideo', [makeWidget('file')])

    const indicator = getLoaderDropIndicator(node, videoId, {
      ...options,
      widgetValueStore: makeWidgetValueStore('')
    })

    expect(indicator?.mediaUrl).toBeUndefined()
    expect(indicator?.iconClass).toBeTruthy()
  })

  it('omits the label on mobile', () => {
    const node = makeNode('LoadVideo', [makeWidget('file')])

    const indicator = getLoaderDropIndicator(node, videoId, {
      ...options,
      mobile: true,
      widgetValueStore: makeWidgetValueStore('clip.mp4')
    })

    expect(indicator?.label).toBeUndefined()
  })

  it('clicking the indicator opens the upload dialog via the "upload" widget', () => {
    const uploadCallback = vi.fn()
    const node = makeNode('LoadVideo', [
      makeWidget('file'),
      makeWidget('upload', uploadCallback)
    ])

    const indicator = getLoaderDropIndicator(node, videoId, {
      ...options,
      widgetValueStore: makeWidgetValueStore('clip.mp4')
    })
    indicator?.onClick()

    expect(uploadCallback).toHaveBeenCalledWith(undefined)
  })

  it('reads the current value from widgetValueStore rather than node.widgets', () => {
    const node = makeNode('LoadImage', [makeWidget('image')])
    const widgetValueStore = makeWidgetValueStore('from-store.png')

    const indicator = getLoaderDropIndicator(node, imageId, {
      ...options,
      widgetValueStore
    })

    expect(widgetValueStore.getWidget).toHaveBeenCalledWith(imageId)
    expect(indicator?.mediaUrl).toContain('from-store.png')
  })
})
