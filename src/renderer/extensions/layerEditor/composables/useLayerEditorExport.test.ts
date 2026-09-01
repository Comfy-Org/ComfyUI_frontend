import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { Psd } from 'ag-psd'

import type { Document } from '@/renderer/extensions/layerEditor/engine/document'
import { registerBuiltinKinds } from '@/renderer/extensions/layerEditor/engine/kinds'
import { defaultMode } from '@/renderer/extensions/layerEditor/engine/mode'
import type { BlendFn } from '@/renderer/extensions/layerEditor/engine/mode'
import type {
  GroupData,
  RasterData
} from '@/renderer/extensions/layerEditor/engine/node'

import { useLayerEditorExport } from './useLayerEditorExport'
import type { LayerEditorSession } from './useLayerEditorSession'

const { writePsd, downloadBlob, toastAdd } = vi.hoisted(() => ({
  writePsd: vi.fn((_psd: unknown) => new ArrayBuffer(4)),
  downloadBlob: vi.fn(),
  toastAdd: vi.fn()
}))

vi.mock('ag-psd', () => ({ writePsd }))
vi.mock('@/base/common/downloadUtil', () => ({ downloadBlob }))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: toastAdd })
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

function stubContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const noop = () => {}
  return {
    canvas,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillStyle: '',
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    drawImage: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    rect: noop,
    clip: noop,
    putImageData: noop
  } as unknown as CanvasRenderingContext2D
}

const origGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  registerBuiltinKinds()
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    kind: string
  ) {
    return kind === '2d' ? stubContext(this) : null
  } as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = origGetContext
})

function contentCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function rasterNode(
  id: string,
  name: string,
  opacity: number,
  blend: BlendFn
): RasterData {
  return {
    id,
    kind: 'raster',
    name,
    visible: true,
    opacity,
    mode: defaultMode(blend),
    transform: { x: 0, y: 0, w: 16, h: 16, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    contentId: `content-${id}`,
    naturalWidth: 16,
    naturalHeight: 16
  }
}

function makeSession(nodes: RasterData[], glOk = true): LayerEditorSession {
  const root: GroupData = {
    id: 'root',
    kind: 'group',
    name: 'root',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 64, h: 32, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children: nodes,
    passThrough: false
  }
  const doc: Document = {
    version: 2,
    width: 64,
    height: 32,
    root,
    channels: []
  }
  const entries = new Map(
    nodes.map((n) => [
      n.contentId,
      {
        id: n.contentId,
        canvas: contentCanvas(16, 16),
        width: 16,
        height: 16,
        uploadedUrl: null
      }
    ])
  )
  return {
    glOk: ref(glOk),
    requestRender: vi.fn(),
    compositor: {
      readback: () => ({
        width: 64,
        height: 32,
        data: new Uint8ClampedArray(0)
      })
    },
    content: { get: (id: string) => entries.get(id) },
    editor: {
      floating: () => null,
      anchorFloating: vi.fn(),
      guides: () => [],
      document: () => doc,
      render: vi.fn()
    }
  } as unknown as LayerEditorSession
}

describe('useLayerEditorExport', () => {
  it('writes a psd matching the layer tree and triggers a download', async () => {
    const session = makeSession([
      rasterNode('a', 'Background', 1, 'normal'),
      rasterNode('b', 'Overlay', 0.5, 'multiply')
    ])
    const { exporting, exportPsd } = useLayerEditorExport(session)

    await exportPsd()

    expect(writePsd).toHaveBeenCalledTimes(1)
    const psd = writePsd.mock.calls[0][0] as Psd
    expect(psd.width).toBe(64)
    expect(psd.height).toBe(32)
    expect(psd.canvas).toBeTruthy()
    expect(psd.children).toHaveLength(2)
    expect(psd.children![0]).toMatchObject({
      name: 'Background',
      opacity: 1,
      blendMode: 'normal'
    })
    expect(psd.children![1]).toMatchObject({
      name: 'Overlay',
      opacity: 0.5,
      blendMode: 'multiply'
    })

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [filename, blob] = downloadBlob.mock.calls[0] as [string, Blob]
    expect(filename).toMatch(/^comfyui-layers-\d{8}-\d{6}\.psd$/)
    expect(blob).toBeInstanceOf(Blob)
    expect(exporting.value).toBe(false)
    expect(session.requestRender).toHaveBeenCalled()
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('shows an error toast when writing fails', async () => {
    writePsd.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const session = makeSession([rasterNode('a', 'Background', 1, 'normal')])
    const { exporting, exportPsd } = useLayerEditorExport(session)

    await exportPsd()

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'layerEditor.exportPsdFailed'
      })
    )
    expect(exporting.value).toBe(false)
    expect(session.requestRender).toHaveBeenCalled()
  })

  it('does nothing when the compositor is unavailable', async () => {
    const session = makeSession(
      [rasterNode('a', 'Background', 1, 'normal')],
      false
    )
    const { exportPsd } = useLayerEditorExport(session)

    await exportPsd()

    expect(writePsd).not.toHaveBeenCalled()
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})
