import { describe, expect, it } from 'vitest'

import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'

describe('useSelectionGrid', () => {
  it.for([
    { canvas: 'an editable canvas', isReadOnly: false, canTidy: true },
    { canvas: 'a read-only canvas', isReadOnly: true, canTidy: false }
  ])(
    'lets two selected nodes be tidied on $canvas: $canTidy',
    ({ isReadOnly, canTidy }) => {
      setCanvasSelection([new LGraphNode('A'), new LGraphNode('B')])
      useCanvasStore().isReadOnly = isReadOnly

      expect(useSelectionGrid().canTidy.value).toBe(canTidy)
    }
  )
})
