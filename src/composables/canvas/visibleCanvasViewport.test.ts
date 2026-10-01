import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DragAndScale } from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { visibleCanvasViewport } from './visibleCanvasViewport'

vi.mock(import('@/platform/telemetry'))

function createCanvas(width = 800, height = 450) {
  const element = document.createElement('canvas')
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
    throw new Error('visibleCanvasViewport must not measure the DOM')
  })
  const ds = new DragAndScale(element)
  ds.setViewportSize(width, height)
  return { ds }
}

describe('visibleCanvasViewport', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses the full CSS-pixel canvas when the panel is absent', () => {
    expect(visibleCanvasViewport(createCanvas())).toEqual([0, 0, 800, 450])
  })

  it('uses the applied DragAndScale viewport dimensions', () => {
    expect(visibleCanvasViewport(createCanvas(640, 360))).toEqual([
      0, 0, 640, 360
    ])
  })

  it('subtracts the visible agent panel from the CSS-pixel canvas', () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.consentAccepted = true
    panel.isOpen = true
    panel.setWidth(500)

    expect(visibleCanvasViewport(createCanvas())).toEqual([0, 0, 300, 450])
  })
})
