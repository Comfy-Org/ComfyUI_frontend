import { useToast } from '@/components/ui/toast'
import { useDialogStore } from '@/stores/dialogStore'

import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { useLayerEditor } from './useLayerEditor'

vi.mock(import('@/i18n'))

beforeEach(() => {
  vi.mocked(useNodeOutputStore().getNodeImageUrls).mockImplementation(
    () => undefined
  )
})

describe('useLayerEditor', () => {
  it('does nothing without a node', () => {
    useLayerEditor().openLayerEditor(null)
    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
  })

  it('toasts instead of opening when the node has fewer than 2 output images', () => {
    const node = {} as LGraphNode
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'only-one.png'
    ])
    useLayerEditor().openLayerEditor(node)
    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
    expect(useToast().info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: 'layerEditor.needsTwoImages' })
    )
  })

  it('opens the layer editor dialog for a node with multiple images', () => {
    const node = {} as LGraphNode
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'a.png',
      'b.png'
    ])
    useLayerEditor().openLayerEditor(node)
    expect(useDialogStore().showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-layer-editor',
        props: { node }
      })
    )
  })
})
