import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const mockDialogStore = vi.hoisted(() => ({
  showDialog: vi.fn()
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => mockDialogStore
}))

vi.mock('@/components/maskeditor/dialog/TopBarHeader.vue', () => ({
  default: { name: 'TopBarHeaderStub' }
}))

vi.mock('@/components/maskeditor/MaskEditorContent.vue', () => ({
  default: { name: 'MaskEditorContentStub' }
}))

import { useMaskEditor } from '@/composables/maskeditor/useMaskEditor'

type NodeShape = {
  imgs?: unknown[]
  previewMediaType?: string
}

const nodeWithImage = (overrides: NodeShape = {}): LGraphNode =>
  ({
    imgs: [new Image()],
    previewMediaType: undefined,
    ...overrides
  }) as unknown as LGraphNode

describe('useMaskEditor', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('openMaskEditor', () => {
    it('should open the dialog with the node forwarded as a prop', () => {
      const node = nodeWithImage()

      useMaskEditor().openMaskEditor(node)

      expect(mockDialogStore.showDialog).toHaveBeenCalledTimes(1)
      expect(mockDialogStore.showDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'global-mask-editor',
          props: { node }
        })
      )
    })

    it('should pass header and content components to the dialog', () => {
      useMaskEditor().openMaskEditor(nodeWithImage())

      expect(mockDialogStore.showDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          headerComponent: expect.anything(),
          component: expect.anything()
        })
      )
    })

    it('should configure modal dialog with maximizable and closable flags', () => {
      useMaskEditor().openMaskEditor(nodeWithImage())

      expect(mockDialogStore.showDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          dialogComponentProps: expect.objectContaining({
            modal: true,
            maximizable: true,
            closable: true
          })
        })
      )
    })

    it('should accept a node whose previewMediaType is "image" without imgs', () => {
      const node = nodeWithImage({
        imgs: undefined,
        previewMediaType: 'image'
      })

      useMaskEditor().openMaskEditor(node)

      expect(mockDialogStore.showDialog).toHaveBeenCalledTimes(1)
    })

    it('should log and bail when node is null', () => {
      useMaskEditor().openMaskEditor(null as unknown as LGraphNode)

      expect(errorSpy).toHaveBeenCalledWith('[MaskEditor] No node provided')
      expect(mockDialogStore.showDialog).not.toHaveBeenCalled()
    })

    it('should log and bail when node has neither imgs nor image preview', () => {
      const node = nodeWithImage({ imgs: [], previewMediaType: undefined })

      useMaskEditor().openMaskEditor(node)

      expect(errorSpy).toHaveBeenCalledWith('[MaskEditor] Node has no images')
      expect(mockDialogStore.showDialog).not.toHaveBeenCalled()
    })

    it('should bail when node has empty imgs and a non-image preview type', () => {
      const node = nodeWithImage({ imgs: [], previewMediaType: 'video' })

      useMaskEditor().openMaskEditor(node)

      expect(mockDialogStore.showDialog).not.toHaveBeenCalled()
    })
  })
})
