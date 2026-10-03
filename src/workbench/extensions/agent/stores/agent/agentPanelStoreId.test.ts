import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
import { useAgentDockMount } from '@/workbench/extensions/agent/composables/useAgentDockMount'
import { createTestDragAndScale } from '@/utils/__tests__/canvasTestUtils'

import { useAgentPanelStore } from './agentPanelStore'

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))
vi.mock(import('@/composables/billing/useBillingContext'))

/**
 * Regression pin for the duplicate Pinia id `agentPanel`.
 *
 * A second module used to call `defineStore('agentPanel')` with a gate-only
 * `{enabled, isOpen, gateSettled}` shape. Pinia keys stores by id, so the
 * first setup to run won and every later `useAgentPanelStore()` got that
 * instance no matter which module it imported. The dock mount imported the
 * gate-only module and runs first, so the panel resolved a store with no
 * `width` (Fit View computed `NaN` and poisoned `ds.scale`/`ds.offset`) and
 * no `toggleMaximize` (maximize threw a TypeError).
 *
 * Each case instantiates through the dock mount first to reproduce that
 * registration order.
 */
describe('the agentPanel store id', () => {
  let pinia: Pinia

  beforeEach(() => {
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    vi.stubGlobal('devicePixelRatio', 1)
    vi.mocked(useBillingContext).mockReturnValue({
      subscription: ref({ hasFunds: false, agentHasFunds: false })
    } as ReturnType<typeof useBillingContext>)
  })

  it('resolves the full panel shape even though the dock mount registers it first', () => {
    useAgentDockMount()

    const store = useAgentPanelStore()

    expect(typeof store.width).toBe('number')
    expect(Number.isFinite(store.width)).toBe(true)
    expect(typeof store.toggleMaximize).toBe('function')
    expect(Object.keys(pinia.state.value.agentPanel)).toContain(
      'targetTracking'
    )
  })

  it('maximizes the panel through the store the dock mount already registered', () => {
    useAgentDockMount()
    const store = useAgentPanelStore()
    const widthBefore = store.width

    store.toggleMaximize()

    expect(store.width).toBeGreaterThan(widthBefore)
    expect(store.isMaximized).toBe(true)
  })

  it('keeps the visible canvas viewport finite while the panel is docked', () => {
    const { docked } = useAgentDockMount()
    const store = useAgentPanelStore()
    store.enabled = true
    store.consentAccepted = true
    store.isOpen = true
    expect(docked.value).toBe(true)

    // `visibleCanvasViewport` reads the applied CSS viewport off `ds`, not the
    // backing store off `canvas.canvas`, so the stub supplies a `DragAndScale`
    // whose viewport has been applied at 1600x900.
    const canvas = { ds: createTestDragAndScale(1600, 900) }
    const viewport = visibleCanvasViewport(canvas)

    expect(viewport.every((value) => Number.isFinite(value))).toBe(true)
    expect(viewport).toEqual([0, 0, 1600 - store.width, 900])
  })
})
