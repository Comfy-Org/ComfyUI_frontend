import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { useLayerEditor } from './useLayerEditor'

const { showDialog, getNodeImageUrls } = vi.hoisted(() => ({
  showDialog: vi.fn(),
  getNodeImageUrls: vi.fn()
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({ getNodeImageUrls })
}))

describe('useLayerEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing without a node', () => {
    useLayerEditor().openLayerEditor(null as unknown as LGraphNode)
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('does nothing when the node has fewer than 2 output images', () => {
    const node = {} as LGraphNode
    getNodeImageUrls.mockReturnValue(['only-one.png'])
    useLayerEditor().openLayerEditor(node)
    expect(showDialog).not.toHaveBeenCalled()
  })

  it('opens the layer editor dialog for a node with multiple images', () => {
    const node = {} as LGraphNode
    getNodeImageUrls.mockReturnValue(['a.png', 'b.png'])
    useLayerEditor().openLayerEditor(node)
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-layer-editor',
        props: { node }
      })
    )
  })
})
