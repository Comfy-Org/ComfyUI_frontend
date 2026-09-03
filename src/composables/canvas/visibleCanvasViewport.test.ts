import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { visibleCanvasViewport } from './visibleCanvasViewport'

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))

describe('visibleCanvasViewport', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('devicePixelRatio', 2)
  })

  it('uses the full CSS-pixel canvas while the Agent panel is closed', () => {
    const canvas = {
      canvas: { width: 1600, height: 900 }
    } as LGraphCanvas

    expect(visibleCanvasViewport(canvas)).toEqual([0, 0, 800, 450])
  })

  it('excludes the docked Agent panel width from the visible canvas', () => {
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.isOpen = true
    panel.setWidth(500)
    const canvas = {
      canvas: { width: 1600, height: 900 }
    } as LGraphCanvas

    expect(visibleCanvasViewport(canvas)).toEqual([0, 0, 300, 450])
  })
})
