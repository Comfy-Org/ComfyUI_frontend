import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Dictionary } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp as ComfyAppInstance } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

const mockAppInstance = fromPartial<ComfyAppInstance>({})

const mockOpenMaskEditor = vi.hoisted(() => vi.fn())

const { app, ComfyApp } = vi.hoisted(() => {
  const selectedNodes: Dictionary<LGraphNode> = {}
  const registerExtension = vi.fn<(extension: ComfyExtension) => void>()
  const comfyApp: {
    clipspace_return_node: LGraphNode | null
    open_maskeditor: (() => void) | null
  } = {
    clipspace_return_node: null,
    open_maskeditor: null
  }

  return {
    app: { registerExtension, canvas: { selected_nodes: selectedNodes } },
    ComfyApp: comfyApp
  }
})

vi.mock<unknown>(import('@/scripts/app'), () => ({ app, ComfyApp }))

vi.mock(import('@/composables/maskeditor/useMaskEditor'), () => ({
  useMaskEditor: () => ({ openMaskEditor: mockOpenMaskEditor })
}))

vi.mock(import('@/composables/maskeditor/useCanvasTransform'), () => ({
  useCanvasTransform: () => ({
    rotateClockwise: vi.fn(),
    rotateCounterclockwise: vi.fn(),
    mirrorHorizontal: vi.fn(),
    mirrorVertical: vi.fn()
  })
}))

import '@/extensions/core/maskeditor'

const registeredCall = app.registerExtension.mock.calls[0]
if (!registeredCall)
  throw new Error('Comfy.MaskEditor extension did not register')
const ext: ComfyExtension = registeredCall[0]

const nodeWithImage = (
  overrides: Partial<Pick<LGraphNode, 'imgs' | 'previewMediaType'>> = {}
): LGraphNode =>
  fromAny<LGraphNode, unknown>({
    imgs: [new Image()],
    previewMediaType: undefined,
    ...overrides
  })

function getCommand(id: string) {
  const command = ext.commands?.find((c) => c.id === id)
  if (!command) throw new Error(`Command not registered: ${id}`)
  return command
}

describe('Comfy.MaskEditor extension', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
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

    it('opens the mask editor for a node with a live preview and no imgs array', () => {
      const node = nodeWithImage({ imgs: undefined, previewMediaType: 'image' })
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
  })

  describe('ComfyApp.open_maskeditor clipspace compatibility', () => {
    it('opens the mask editor for clipspace_return_node when invoked', () => {
      ext.init?.call(ext, mockAppInstance)
      const node = nodeWithImage()
      ComfyApp.clipspace_return_node = node

      assert.exists(ComfyApp.open_maskeditor)
      ComfyApp.open_maskeditor()

      expect(mockOpenMaskEditor).toHaveBeenCalledExactlyOnceWith(node)
    })

    it('logs and bails when clipspace_return_node is unset', () => {
      ext.init?.call(ext, mockAppInstance)
      ComfyApp.clipspace_return_node = null

      assert.exists(ComfyApp.open_maskeditor)
      ComfyApp.open_maskeditor()

      expect(mockOpenMaskEditor).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(
        '[MaskEditor] No clipspace_return_node found'
      )
    })
  })
})
