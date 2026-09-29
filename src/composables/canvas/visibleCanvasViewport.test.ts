import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { visibleCanvasViewport } from './visibleCanvasViewport'

vi.mock(import('@/platform/telemetry'))

function rect(left: number, right: number, height = 450, top = 0): DOMRect {
  return {
    left,
    right,
    top,
    bottom: top + height,
    width: right - left,
    height,
    x: left,
    y: top,
    toJSON: () => ({})
  }
}

function createCanvas(canvasRect: DOMRect): LGraphCanvas {
  const element = document.createElement('canvas')
  element.width = 1600
  element.height = 900
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(canvasRect)
  return { canvas: element, dpr: 2 } as LGraphCanvas
}

describe('visibleCanvasViewport', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses the full CSS-pixel canvas when the panel is absent', () => {
    expect(visibleCanvasViewport(createCanvas(rect(0, 800)))).toEqual([
      0, 0, 800, 450
    ])
  })

  it('uses the canvas DPR when layout dimensions are unavailable', () => {
    expect(visibleCanvasViewport(createCanvas(rect(0, 0, 0)))).toEqual([
      0, 0, 800, 450
    ])
  })

  it('subtracts the visible agent panel from the CSS-pixel canvas', () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.consentAccepted = true
    panel.isOpen = true
    panel.setWidth(500)

    expect(visibleCanvasViewport(createCanvas(rect(0, 800)))).toEqual([
      0, 0, 300, 450
    ])
  })
})
