import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestDragAndScale } from '@/utils/__tests__/canvasTestUtils'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { visibleCanvasViewport } from './visibleCanvasViewport'

vi.mock(import('@/platform/telemetry'))

describe('visibleCanvasViewport', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses the applied CSS viewport while the agent panel is closed', () => {
    expect(
      visibleCanvasViewport({ ds: createTestDragAndScale(640, 360) })
    ).toEqual([0, 0, 640, 360])
  })

  it('subtracts the visible agent panel from the CSS viewport', () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.consentAccepted = true
    panel.isOpen = true
    panel.setWidth(500)

    expect(
      visibleCanvasViewport({ ds: createTestDragAndScale(800, 450) })
    ).toEqual([0, 0, 300, 450])
  })

  it('falls back to the whole canvas when the panel leaves nothing uncovered', () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.consentAccepted = true
    panel.isOpen = true
    panel.setWidth(500)

    expect(
      visibleCanvasViewport({ ds: createTestDragAndScale(480, 450) })
    ).toEqual([0, 0, 480, 450])
  })
})
