import { useDialogStore } from '@/stores/dialogStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { useLayerEditor } from './useLayerEditor'

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key
}))

beforeEach(() => {
  vi.mocked(useToastStore().add).mockImplementation(() => undefined)
  vi.mocked(useNodeOutputStore().getNodeImageUrls).mockImplementation(
    () => undefined
  )
})

describe('useLayerEditor', () => {
  it('does nothing without a node', () => {
    useLayerEditor().openLayerEditor(null)
    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
  })

  it('toasts instead of opening when the node has fewer than 2 output images', () => {
    const node = {} as LGraphNode
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'only-one.png'
    ])
    useLayerEditor().openLayerEditor(node)
    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
    expect(vi.mocked(useToastStore().add)).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        detail: 'layerEditor.needsTwoImages'
      })
    )
  })

  it('opens the layer editor dialog for a node with multiple images', () => {
    const node = {} as LGraphNode
    vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue([
      'a.png',
      'b.png'
    ])
    useLayerEditor().openLayerEditor(node)
    expect(vi.mocked(useDialogStore().showDialog)).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-layer-editor',
        props: { node }
      })
    )
  })
})
