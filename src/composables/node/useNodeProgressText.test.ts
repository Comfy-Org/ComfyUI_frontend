import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

const mockTextPreviewWidget = vi.hoisted(() => vi.fn())

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useProgressTextWidget',
  () => ({
    useTextPreviewWidget: () => mockTextPreviewWidget
  })
)

import { useNodeProgressText } from './useNodeProgressText'

function node(widgets?: IBaseWidget[]): LGraphNode {
  return createMockLGraphNode({ widgets, setDirtyCanvas: vi.fn() })
}

describe('useNodeProgressText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTextPreviewWidget.mockImplementation(
      (_node: LGraphNode, spec: { name: string; type: string }) => ({
        name: spec.name,
        type: spec.type,
        value: ''
      })
    )
  })

  it('updates an existing text preview widget', () => {
    const existing = { name: '$$node-text-preview', value: '' } as IBaseWidget
    const graphNode = node([existing])
    const { showTextPreview } = useNodeProgressText()

    showTextPreview(graphNode, 'running')

    expect(existing.value).toBe('running')
    expect(mockTextPreviewWidget).not.toHaveBeenCalled()
    expect(graphNode.setDirtyCanvas).toHaveBeenCalledWith(true)
  })

  it('creates a text preview widget when one is missing', () => {
    const createdWidget = fromPartial<IBaseWidget>({
      name: '$$node-text-preview',
      type: 'progressText',
      value: ''
    })
    mockTextPreviewWidget.mockReturnValueOnce(createdWidget)
    const graphNode = node([])
    const { showTextPreview } = useNodeProgressText()

    showTextPreview(graphNode, 'queued')

    expect(mockTextPreviewWidget).toHaveBeenCalledWith(graphNode, {
      name: '$$node-text-preview',
      type: 'progressText'
    })
    expect(createdWidget.value).toBe('queued')
  })

  it('removes an existing preview widget and calls its cleanup', () => {
    const onRemove = vi.fn()
    const keep = { name: 'other' } as IBaseWidget
    const preview = fromPartial<IBaseWidget & { onRemove?: () => void }>({
      name: '$$node-text-preview',
      onRemove
    })
    const graphNode = node([keep, preview])
    const { removeTextPreview } = useNodeProgressText()

    removeTextPreview(graphNode)

    expect(onRemove).toHaveBeenCalledOnce()
    expect(graphNode.widgets).toEqual([keep])
  })

  it('does nothing when there are no widgets or no preview widget', () => {
    const { removeTextPreview } = useNodeProgressText()
    const withoutWidgets = node()
    const withoutPreview = node([{ name: 'other' } as IBaseWidget])

    removeTextPreview(withoutWidgets)
    removeTextPreview(withoutPreview)

    expect(withoutWidgets.widgets).toBeUndefined()
    expect(withoutPreview.widgets).toHaveLength(1)
  })
})
