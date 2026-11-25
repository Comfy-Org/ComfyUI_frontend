import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTestDragAndScale } from '@/utils/__tests__/canvasTestUtils'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { visibleCanvasViewport } from './visibleCanvasViewport'

function mountGraphArea(left: number, right: number) {
  const graphArea = document.createElement('div')
  graphArea.id = 'graph-canvas-panel'
  graphArea.getBoundingClientRect = () =>
    new DOMRect(left, 40, right - left, 500)
  document.body.append(graphArea)
}

function canvasAt(left: number, width = 1000, height = 600) {
  const ds = createTestDragAndScale(width, height)
  vi.spyOn(ds.element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(left, 0, width, height)
  )
  return { ds }
}

vi.mock(import('@comfyorg/telemetry'))

describe('visibleCanvasViewport', () => {
  afterEach(() => {
    document.getElementById('graph-canvas-panel')?.remove()
    localStorage.clear()
  })

  it('uses the whole canvas before the graph area mounts', () => {
    expect(visibleCanvasViewport(canvasAt(0))).toEqual([0, 0, 1000, 600])
  })

  it.for([
    {
      name: 'a properties panel on the right',
      canvasLeft: 0,
      graphArea: [0, 700],
      expected: [0, 0, 700, 600]
    },
    {
      name: 'a sidebar on the left and the agent panel on the right',
      canvasLeft: 0,
      graphArea: [300, 800],
      expected: [300, 0, 500, 600]
    },
    {
      name: 'a canvas that starts right of the page edge',
      canvasLeft: 50,
      graphArea: [350, 850],
      expected: [300, 0, 500, 600]
    },
    {
      name: 'a graph area wider than the canvas',
      canvasLeft: 0,
      graphArea: [-20, 1200],
      expected: [0, 0, 1000, 600]
    },
    {
      name: 'panels that leave no graph area',
      canvasLeft: 0,
      graphArea: [400, 400],
      expected: [0, 0, 1000, 600]
    }
  ] as const)(
    'keeps the full height and the uncovered width beside $name',
    ({ canvasLeft, graphArea, expected }) => {
      mountGraphArea(graphArea[0], graphArea[1])

      expect(visibleCanvasViewport(canvasAt(canvasLeft))).toEqual(expected)
    }
  )

  it.for([
    { name: 'overlays the canvas', reserved: 700, expected: [64, 0, 460, 600] },
    { name: 'is docked beside it', reserved: 0, expected: [64, 0, 960, 600] }
  ])(
    'stops at the agent panel only when it $name',
    ({ reserved, expected }) => {
      vi.stubGlobal('innerWidth', 1024)
      const panel = useAgentPanelStore()
      panel.enabled = true
      panel.consentAccepted = true
      panel.isOpen = true
      panel.setWidth(500)
      panel.setReservedWorkspaceWidth(reserved)
      mountGraphArea(64, 1024)

      expect(visibleCanvasViewport(canvasAt(0, 1024))).toEqual(expected)
    }
  )
})
