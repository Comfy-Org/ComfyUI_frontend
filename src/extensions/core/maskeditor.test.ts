import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp as ComfyAppInstance } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

const mockAppInstance = fromPartial<ComfyAppInstance>({})

const mockOpenMaskEditor = vi.hoisted(() => vi.fn())

const { app, ComfyApp } = vi.hoisted(() => ({
  app: {
    registerExtension: vi.fn(),
    canvas: { selected_nodes: {} as Record<string, unknown> }
  },
  ComfyApp: {
    clipspace_return_node: null as LGraphNode | null,
    open_maskeditor: undefined as unknown
  }
}))

vi.mock('@/scripts/app', () => ({ app, ComfyApp }))

vi.mock('@/composables/maskeditor/useMaskEditor', () => ({
  useMaskEditor: () => ({ openMaskEditor: mockOpenMaskEditor })
}))

vi.mock('@/composables/maskeditor/useCanvasTransform', () => ({
  useCanvasTransform: () => ({
    rotateClockwise: vi.fn(),
    rotateCounterclockwise: vi.fn(),
    mirrorHorizontal: vi.fn(),
    mirrorVertical: vi.fn()
  })
}))

import '@/extensions/core/maskeditor'

const ext = app.registerExtension.mock.calls[0]?.[0] as ComfyExtension

type NodeShape = { imgs?: unknown[]; previewMediaType?: string }

const nodeWithImage = (overrides: NodeShape = {}): LGraphNode =>
  ({
    imgs: [new Image()],
    previewMediaType: undefined,
    ...overrides
  }) as unknown as LGraphNode

function getCommand(id: string) {
  const command = ext.commands?.find((c) => c.id === id)
  if (!command) throw new Error(`Command not registered: ${id}`)
  return command
}

describe('Comfy.MaskEditor extension', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockOpenMaskEditor.mockClear()
    app.canvas.selected_nodes = {}
    ComfyApp.clipspace_return_node = null
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('Comfy.MaskEditor.OpenMaskEditor command', () => {
    it('opens the mask editor for the single selected node', () => {
      const node = nodeWithImage()
      app.canvas.selected_nodes = { '1': node }

      getCommand('Comfy.MaskEditor.OpenMaskEditor').function()

      expect(mockOpenMaskEditor).toHaveBeenCalledExactlyOnceWith(node)
    })

    it('does nothing when no node is selected', () => {
      app.canvas.selected_nodes = {}

      getCommand('Comfy.MaskEditor.OpenMaskEditor').function()

      expect(mockOpenMaskEditor).not.toHaveBeenCalled()
    })

    it('does nothing when multiple nodes are selected', () => {
      app.canvas.selected_nodes = {
        '1': nodeWithImage(),
        '2': nodeWithImage()
      }

      getCommand('Comfy.MaskEditor.OpenMaskEditor').function()

      expect(mockOpenMaskEditor).not.toHaveBeenCalled()
    })

    it('does not open when the selected node has no images', () => {
      const node = nodeWithImage({ imgs: [], previewMediaType: undefined })
      app.canvas.selected_nodes = { '1': node }

      getCommand('Comfy.MaskEditor.OpenMaskEditor').function()

      expect(mockOpenMaskEditor).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith('[MaskEditor] Node has no images')
    })
  })

  describe('ComfyApp.open_maskeditor clipspace compatibility', () => {
    it('registers a static open_maskeditor method on init', () => {
      ext.init?.call(ext, mockAppInstance)

      expect(ComfyApp.open_maskeditor).toBeTypeOf('function')
    })

    it('opens the mask editor for clipspace_return_node when invoked', () => {
      ext.init?.call(ext, mockAppInstance)
      const node = nodeWithImage()
      ComfyApp.clipspace_return_node = node

      ;(ComfyApp.open_maskeditor as () => void)()

      expect(mockOpenMaskEditor).toHaveBeenCalledExactlyOnceWith(node)
    })

    it('logs and bails when clipspace_return_node is unset', () => {
      ext.init?.call(ext, mockAppInstance)
      ComfyApp.clipspace_return_node = null

      ;(ComfyApp.open_maskeditor as () => void)()

      expect(mockOpenMaskEditor).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(
        '[MaskEditor] No clipspace_return_node found'
      )
    })
  })
})
